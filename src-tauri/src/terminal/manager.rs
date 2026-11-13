use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread;

use super::pty::{OutputSink, PtySession, SpawnOptions, KILL_GRACE};

/// Thread-safe registry of the PTY sessions owned by the app.
pub struct PtyManager {
    sessions: Mutex<HashMap<String, PtySession>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    fn lock(&self) -> Result<MutexGuard<'_, HashMap<String, PtySession>>, String> {
        self.sessions
            .lock()
            .map_err(|_| "Falha ao bloquear gestor de sessões PTY".to_string())
    }

    fn with_session<T>(
        &self,
        session_id: &str,
        action: impl FnOnce(&PtySession) -> Result<T, String>,
    ) -> Result<T, String> {
        let sessions = self.lock()?;
        let session = sessions
            .get(session_id)
            .ok_or_else(|| "Sessão de terminal não encontrada".to_string())?;
        action(session)
    }

    /// Spawns a session. A previous session with the same id is terminated first.
    pub fn spawn(
        &self,
        opts: SpawnOptions,
        sink: Option<Arc<dyn OutputSink>>,
    ) -> Result<(), String> {
        let session_id = opts.session_id.clone();
        let session = PtySession::spawn(opts, sink)?;
        let previous = self.lock()?.insert(session_id, session);
        if let Some(mut old_session) = previous {
            old_session.kill()?;
        }
        Ok(())
    }

    pub fn write(&self, session_id: &str, data: &str) -> Result<(), String> {
        self.with_session(session_id, |session| session.write(data))
    }

    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        self.with_session(session_id, |session| session.resize(cols, rows))
    }

    /// Terminates a session and forgets it. Returns `false` when it did not exist.
    pub fn kill(&self, session_id: &str) -> Result<bool, String> {
        let removed = self.lock()?.remove(session_id);
        match removed {
            Some(mut session) => session.kill(),
            None => Ok(false),
        }
    }

    /// Terminates every session and blocks until the grace period has elapsed.
    /// Used on app quit so no child process outlives the cockpit.
    pub fn kill_all(&self) -> usize {
        let sessions: Vec<PtySession> = match self.sessions.lock() {
            Ok(mut guard) => guard.drain().map(|(_, session)| session).collect(),
            Err(_) => return 0,
        };
        if sessions.is_empty() {
            return 0;
        }
        for session in &sessions {
            session.hang_up();
        }
        thread::sleep(KILL_GRACE);
        for session in &sessions {
            session.force_kill();
        }
        sessions.len()
    }

    /// Raw scrollback of the session, ready to be replayed into a terminal emulator.
    pub fn get_scrollback(&self, session_id: &str) -> Result<String, String> {
        self.with_session(session_id, |session| session.get_scrollback())
    }

    pub fn is_alive(&self, session_id: &str) -> bool {
        self.with_session(session_id, |session| Ok(session.is_alive()))
            .unwrap_or(false)
    }

    pub fn active_session_count(&self) -> usize {
        self.sessions.lock().map(|s| s.len()).unwrap_or(0)
    }
}

impl Default for PtyManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{Duration, Instant};

    pub fn sh(session_id: &str) -> SpawnOptions {
        SpawnOptions {
            session_id: session_id.to_string(),
            shell: Some("/bin/sh".to_string()),
            cols: Some(80),
            rows: Some(24),
            ..SpawnOptions::default()
        }
    }

    /// Polls until `predicate` holds or the timeout elapses.
    pub fn wait_until(timeout: Duration, mut predicate: impl FnMut() -> bool) -> bool {
        let deadline = Instant::now() + timeout;
        while Instant::now() < deadline {
            if predicate() {
                return true;
            }
            thread::sleep(Duration::from_millis(10));
        }
        predicate()
    }

    fn process_exists(pid: i32) -> bool {
        // SAFETY: signal 0 only checks for existence.
        unsafe { libc::kill(pid, 0) == 0 }
    }

    #[derive(Default)]
    struct RecordingSink {
        bytes: AtomicU64,
        exits: Mutex<Vec<(String, Option<u32>)>>,
    }

    impl OutputSink for RecordingSink {
        fn on_output(&self, _session_id: &str, chunk: &str) -> bool {
            self.bytes.fetch_add(chunk.len() as u64, Ordering::Relaxed);
            false
        }

        fn on_exit(&self, session_id: &str, exit_code: Option<u32>) {
            if let Ok(mut exits) = self.exits.lock() {
                exits.push((session_id.to_string(), exit_code));
            }
        }
    }

    #[test]
    fn test_pty_lifecycle_single_session() {
        let manager = PtyManager::new();
        let id = "test-session-1";
        manager.spawn(sh(id), None).expect("spawn");
        assert_eq!(manager.active_session_count(), 1);

        manager.write(id, "echo 'HELMPTY_TEST_OK'\n").expect("write");
        assert!(wait_until(Duration::from_secs(5), || {
            manager
                .get_scrollback(id)
                .map(|s| s.contains("HELMPTY_TEST_OK"))
                .unwrap_or(false)
        }));

        manager.resize(id, 120, 40).expect("resize");
        assert!(manager.kill(id).expect("kill"));
        assert_eq!(manager.active_session_count(), 0);
        assert!(!manager.kill(id).expect("second kill is a no-op"));
    }

    #[test]
    fn test_pty_concurrency_16_parallel_sessions() {
        let manager = PtyManager::new();
        let total = 16;
        for i in 0..total {
            manager
                .spawn(sh(&format!("swarm-grid-{i}")), None)
                .expect("spawn");
        }
        assert_eq!(manager.active_session_count(), total);

        for i in 0..total {
            manager
                .write(&format!("swarm-grid-{i}"), &format!("echo 'SWARM_PAYLOAD_{i}'\n"))
                .expect("write");
        }
        for i in 0..total {
            let id = format!("swarm-grid-{i}");
            let marker = format!("SWARM_PAYLOAD_{i}");
            assert!(
                wait_until(Duration::from_secs(5), || manager
                    .get_scrollback(&id)
                    .map(|s| s.contains(&marker))
                    .unwrap_or(false)),
                "session {i} never produced its payload"
            );
        }

        assert_eq!(manager.kill_all(), total);
        assert_eq!(manager.active_session_count(), 0);
    }

    #[test]
    fn exit_is_reported_with_the_exit_code() {
        let manager = PtyManager::new();
        let sink = Arc::new(RecordingSink::default());
        manager
            .spawn(sh("exit-code"), Some(sink.clone()))
            .expect("spawn");
        manager.write("exit-code", "exit 7\n").expect("write");

        assert!(wait_until(Duration::from_secs(5), || {
            sink.exits.lock().map(|e| !e.is_empty()).unwrap_or(false)
        }));
        let exits = sink.exits.lock().expect("exits");
        assert_eq!(exits[0], ("exit-code".to_string(), Some(7)));
        assert!(!manager.is_alive("exit-code"));
    }

    #[test]
    fn command_is_executed_in_place_of_the_shell() {
        let manager = PtyManager::new();
        let sink = Arc::new(RecordingSink::default());
        let opts = SpawnOptions {
            command: Some(vec![
                "/bin/echo".to_string(),
                "it's $(whoami) HELM_EXEC_OK".to_string(),
            ]),
            ..sh("exec-agent")
        };
        manager.spawn(opts, Some(sink.clone())).expect("spawn");

        // The process is the program itself, so the session ends when it does.
        assert!(wait_until(Duration::from_secs(5), || {
            sink.exits.lock().map(|e| !e.is_empty()).unwrap_or(false)
        }));
        let scrollback = manager.get_scrollback("exec-agent").expect("scrollback");
        assert!(scrollback.contains("it's $(whoami) HELM_EXEC_OK"));
    }

    #[test]
    fn kill_all_leaves_no_orphan_processes() {
        let manager = PtyManager::new();
        let id = "orphans";
        manager.spawn(sh(id), None).expect("spawn");
        manager
            .write(id, "sleep 600 & echo CHILD_PID=$!\n")
            .expect("write");

        let mut child_pid = None;
        assert!(wait_until(Duration::from_secs(5), || {
            let scrollback = manager.get_scrollback(id).unwrap_or_default();
            child_pid = scrollback
                .lines()
                .filter_map(|l| l.trim().strip_prefix("CHILD_PID="))
                .find_map(|v| v.trim().parse::<i32>().ok());
            child_pid.is_some()
        }));
        let child_pid = child_pid.expect("background child pid");
        assert!(process_exists(child_pid));

        assert_eq!(manager.kill_all(), 1);
        assert!(
            wait_until(Duration::from_secs(5), || !process_exists(child_pid)),
            "background child {child_pid} survived kill_all"
        );
    }

    #[test]
    fn spawn_rejects_missing_working_directory() {
        let manager = PtyManager::new();
        let opts = SpawnOptions {
            cwd: Some("/definitely/not/a/real/dir".to_string()),
            ..sh("bad-cwd")
        };
        assert!(manager.spawn(opts, None).is_err());
        assert_eq!(manager.active_session_count(), 0);
    }
}
