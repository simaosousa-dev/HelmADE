use std::collections::HashMap;
use std::sync::Mutex;
use tauri::AppHandle;

use super::pty::{PtySession, SpawnOptions};

/// Gestor thread-safe de múltiplas sessões de terminal concorrentes no HelmADE.
pub struct PtyManager {
    sessions: Mutex<HashMap<String, PtySession>>,
}

impl PtyManager {
    /// Cria uma nova instância vazia do gestor de PTYs.
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    /// Cria e inicializa uma nova sessão PTY identificada por `session_id`.
    /// Se já existir uma sessão com o mesmo ID, a anterior é terminada de forma limpa.
    pub fn spawn(&self, opts: SpawnOptions, app_handle: Option<AppHandle>) -> Result<(), String> {
        let session_id = opts.session_id.clone();
        let session = PtySession::spawn(opts, app_handle)?;

        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| "Falha ao bloquear gestor de sessões PTY".to_string())?;

        // Encerra sessão pré-existente com o mesmo ID, se houver
        if let Some(mut old_session) = sessions.remove(&session_id) {
            let _ = old_session.kill();
        }

        sessions.insert(session_id, session);
        Ok(())
    }

    /// Envia dados (texto/comandos) para a entrada padrão do PTY especificado.
    pub fn write(&self, session_id: &str, data: &str) -> Result<(), String> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| "Falha ao bloquear gestor de sessões PTY".to_string())?;

        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Sessão PTY '{}' não encontrada", session_id))?;

        session.write(data)
    }

    /// Redimensiona as colunas e linhas da janela da sessão PTY.
    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| "Falha ao bloquear gestor de sessões PTY".to_string())?;

        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Sessão PTY '{}' não encontrada", session_id))?;

        session.resize(cols, rows)
    }

    /// Termina o processo da sessão PTY e remove-a do gestor.
    pub fn kill(&self, session_id: &str) -> Result<bool, String> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| "Falha ao bloquear gestor de sessões PTY".to_string())?;

        if let Some(mut session) = sessions.remove(session_id) {
            session.kill()
        } else {
            Ok(false)
        }
    }

    /// Retorna as linhas acumuladas de scrollback no buffer circular da sessão.
    pub fn get_scrollback(&self, session_id: &str) -> Result<Vec<String>, String> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| "Falha ao bloquear gestor de sessões PTY".to_string())?;

        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Sessão PTY '{}' não encontrada", session_id))?;

        session.get_scrollback()
    }

    /// Retorna o número atual de sessões ativas no gestor.
    pub fn active_session_count(&self) -> usize {
        if let Ok(sessions) = self.sessions.lock() {
            sessions.len()
        } else {
            0
        }
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
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_pty_lifecycle_single_session() {
        let manager = PtyManager::new();
        let session_id = "test-session-1".to_string();

        let opts = SpawnOptions {
            session_id: session_id.clone(),
            cwd: None,
            shell: Some("/bin/sh".to_string()),
            cols: Some(80),
            rows: Some(24),
            env: None,
        };

        // 1. Spawn
        let spawn_res = manager.spawn(opts, None);
        assert!(spawn_res.is_ok(), "Falha no spawn: {:?}", spawn_res.err());
        assert_eq!(manager.active_session_count(), 1);

        // 2. Write
        let write_res = manager.write(&session_id, "echo 'HELMPTY_TEST_OK'\n");
        assert!(write_res.is_ok());

        // Espera breve para leitura assíncrona processar a saída
        thread::sleep(Duration::from_millis(250));

        // 3. Scrollback inspection
        let scrollback = manager.get_scrollback(&session_id).unwrap();
        let full_output = scrollback.join("\n");
        assert!(
            full_output.contains("HELMPTY_TEST_OK"),
            "Saída esperada não encontrada no scrollback: {}",
            full_output
        );

        // 4. Resize
        let resize_res = manager.resize(&session_id, 120, 40);
        assert!(resize_res.is_ok());

        // 5. Kill
        let kill_res = manager.kill(&session_id);
        assert!(kill_res.is_ok());
        assert_eq!(manager.active_session_count(), 0);
    }

    #[test]
    fn test_pty_concurrency_16_parallel_sessions() {
        let manager = PtyManager::new();
        let total_sessions = 16;

        // Inicia 16 sessões simultâneas
        for i in 0..total_sessions {
            let session_id = format!("swarm-grid-{}", i);
            let opts = SpawnOptions {
                session_id: session_id.clone(),
                cwd: None,
                shell: Some("/bin/sh".to_string()),
                cols: Some(80),
                rows: Some(24),
                env: None,
            };

            let res = manager.spawn(opts, None);
            assert!(res.is_ok(), "Falha ao iniciar sessão {}: {:?}", i, res.err());
        }

        assert_eq!(manager.active_session_count(), total_sessions);

        // Escreve em todas as sessões em paralelo
        for i in 0..total_sessions {
            let session_id = format!("swarm-grid-{}", i);
            let cmd = format!("echo 'SWARM_PAYLOAD_{}'\n", i);
            let res = manager.write(&session_id, &cmd);
            assert!(res.is_ok());
        }

        thread::sleep(Duration::from_millis(400));

        // Valida que cada sessão capturou o seu payload correto no ring buffer
        for i in 0..total_sessions {
            let session_id = format!("swarm-grid-{}", i);
            let scrollback = manager.get_scrollback(&session_id).unwrap();
            let text = scrollback.join("\n");
            assert!(
                text.contains(&format!("SWARM_PAYLOAD_{}", i)),
                "Sessão {} falhou em capturar payload no scrollback: {}",
                i,
                text
            );
        }

        // Limpeza de todas as sessões
        for i in 0..total_sessions {
            let session_id = format!("swarm-grid-{}", i);
            let kill_res = manager.kill(&session_id);
            assert!(kill_res.is_ok());
        }

        assert_eq!(manager.active_session_count(), 0);
    }
}
