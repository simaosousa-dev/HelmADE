use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};

use super::ring_buffer::RingBuffer;

const READ_BUFFER_BYTES: usize = 64 * 1024;
/// Upper bound of one coalesced batch handed to the sink.
const BATCH_MAX_BYTES: usize = 256 * 1024;
/// A burst is coalesced for at most this long, so a flood becomes a few large events.
const BATCH_WINDOW: Duration = Duration::from_millis(8);
/// Keystroke echo waits at most this long for more output before being emitted.
const BATCH_GAP: Duration = Duration::from_millis(2);
/// Output the sink is holding back is released once the stream pauses for this long.
const HELD_OUTPUT_FLUSH: Duration = Duration::from_millis(12);
/// Grace period between SIGHUP and SIGKILL when a session is terminated.
pub const KILL_GRACE: Duration = Duration::from_millis(150);

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SpawnOptions {
    pub session_id: String,
    pub cwd: Option<String>,
    pub shell: Option<String>,
    /// Program and arguments to `exec` instead of leaving an interactive shell.
    /// Used for agent CLIs so there is never a shell underneath the agent.
    pub command: Option<Vec<String>>,
    pub cols: Option<u16>,
    pub rows: Option<u16>,
    pub env: Option<HashMap<String, String>>,
}

/// Receives everything a session produces. Implemented by the Tauri event bridge in
/// production and by counters in tests and benchmarks.
pub trait OutputSink: Send + Sync {
    /// Returns `true` when the sink is holding text back and wants `on_idle` once output pauses.
    fn on_output(&self, session_id: &str, chunk: &str) -> bool;
    fn on_idle(&self, _session_id: &str) {}
    fn on_exit(&self, session_id: &str, exit_code: Option<u32>);
}

/// Single-quotes an argument for a POSIX shell command line.
pub fn shell_quote(arg: &str) -> String {
    format!("'{}'", arg.replace('\'', r"'\''"))
}

/// Builds `exec 'program' 'arg' …` so the shell replaces itself with the program.
pub fn exec_command_line(argv: &[String]) -> Result<String, String> {
    let program = argv.first().map(|p| p.trim()).unwrap_or("");
    if program.is_empty() {
        return Err("O comando do agente está vazio".to_string());
    }
    if argv.iter().any(|a| a.contains('\0')) {
        return Err("O comando do agente contém caracteres inválidos".to_string());
    }
    let quoted: Vec<String> = argv.iter().map(|a| shell_quote(a)).collect();
    Ok(format!("exec {}", quoted.join(" ")))
}

/// Number of trailing bytes that start a UTF-8 sequence the buffer does not finish.
fn incomplete_utf8_tail(bytes: &[u8]) -> usize {
    for back in 1..=bytes.len().min(4) {
        let byte = bytes[bytes.len() - back];
        if byte & 0xC0 == 0x80 {
            continue;
        }
        let needed = match byte {
            b if b >= 0xF0 => 4,
            b if b >= 0xE0 => 3,
            b if b >= 0xC0 => 2,
            _ => 1,
        };
        return if needed > back { back } else { 0 };
    }
    0
}

/// Decodes `pending + bytes`, keeping an unfinished trailing character for the next call
/// so multi-byte characters split across reads are never turned into U+FFFD.
fn decode_utf8(pending: &mut Vec<u8>, bytes: &[u8]) -> String {
    pending.extend_from_slice(bytes);
    let tail = incomplete_utf8_tail(pending);
    let rest = pending.split_off(pending.len() - tail);
    let text = String::from_utf8_lossy(pending).into_owned();
    *pending = rest;
    text
}

fn default_shell() -> String {
    ["/bin/zsh", "/bin/bash"]
        .into_iter()
        .find(|path| std::path::Path::new(path).exists())
        .unwrap_or("/bin/sh")
        .to_string()
}

/// Signals the whole process group led by `pid` (the PTY child is a session leader).
fn signal_group(pid: Option<u32>, signal: libc::c_int) {
    let Some(pid) = pid else { return };
    let Ok(pid) = i32::try_from(pid) else { return };
    if pid <= 1 {
        return;
    }
    // SAFETY: `kill` has no memory-safety preconditions; a stale pid only yields ESRCH.
    unsafe {
        libc::kill(-pid, signal);
    }
}

/// SIGKILLs every process still attached to `tty`. Catches background jobs and dev servers
/// that live in their own process group and ignored the hang-up.
fn kill_processes_on_tty(tty: Option<&str>) {
    let Some(name) = tty.map(|t| t.trim_start_matches("/dev/")) else {
        return;
    };
    let Ok(output) = std::process::Command::new("/bin/ps")
        .args(["-t", name, "-o", "pid="])
        .output()
    else {
        return;
    };
    for pid in String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| line.trim().parse::<i32>().ok())
        .filter(|pid| *pid > 1)
    {
        // SAFETY: `kill` has no memory-safety preconditions; a stale pid only yields ESRCH.
        unsafe {
            libc::kill(pid, libc::SIGKILL);
        }
    }
}

/// Device name of the slave side (e.g. `/dev/ttys004`), used to find leftover processes.
fn slave_tty_name(master: &dyn MasterPty) -> Option<String> {
    static PTSNAME_LOCK: Mutex<()> = Mutex::new(());
    let fd = master.as_raw_fd()?;
    let _guard = PTSNAME_LOCK.lock().ok()?;
    // SAFETY: `fd` is a live PTY master. `ptsname` returns NULL or a NUL-terminated string
    // in a static buffer, which is copied before the lock that serialises callers is released.
    unsafe {
        let name = libc::ptsname(fd);
        if name.is_null() {
            return None;
        }
        Some(std::ffi::CStr::from_ptr(name).to_string_lossy().into_owned())
    }
}

fn force_kill_session(pid: Option<u32>, tty: Option<&str>) {
    signal_group(pid, libc::SIGKILL);
    kill_processes_on_tty(tty);
}

/// One PTY session: the child process, its writer and the scrollback of its raw output.
pub struct PtySession {
    pub id: String,
    master: Box<dyn MasterPty + Send>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pid: Option<u32>,
    tty: Option<String>,
    pub ring_buffer: Arc<Mutex<RingBuffer>>,
    is_running: Arc<AtomicBool>,
}

impl PtySession {
    pub fn spawn(opts: SpawnOptions, sink: Option<Arc<dyn OutputSink>>) -> Result<Self, String> {
        let pair = native_pty_system()
            .openpty(PtySize {
                rows: opts.rows.unwrap_or(24),
                cols: opts.cols.unwrap_or(80),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Falha ao abrir par PTY: {e}"))?;

        let shell = opts.shell.clone().unwrap_or_else(default_shell);
        let mut cmd = CommandBuilder::new(&shell);
        // A login shell so PATH matches the user's terminal even when launched from Finder.
        match &opts.command {
            Some(argv) => {
                cmd.arg("-lic");
                cmd.arg(exec_command_line(argv)?);
            }
            None => cmd.arg("-l"),
        }
        if let Some(cwd) = &opts.cwd {
            if !std::path::Path::new(cwd).is_dir() {
                return Err("O diretório de trabalho do terminal não existe".to_string());
            }
            cmd.cwd(cwd);
        }

        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        for (key, value) in opts.env.iter().flatten() {
            cmd.env(key, value);
        }

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Falha ao executar o processo do terminal: {e}"))?;
        // The parent must not keep the slave open or EOF would never be observed.
        drop(pair.slave);

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Falha ao clonar leitor do PTY: {e}"))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Falha ao capturar escritor do PTY: {e}"))?;

        let pid = child.process_id();
        let tty = slave_tty_name(pair.master.as_ref());
        let ring_buffer = Arc::new(Mutex::new(RingBuffer::default()));
        let is_running = Arc::new(AtomicBool::new(true));

        let (tx, rx) = mpsc::sync_channel::<Vec<u8>>(32);
        thread::spawn(move || read_loop(reader, tx));

        let pump = Pump {
            session_id: opts.session_id.clone(),
            ring_buffer: Arc::clone(&ring_buffer),
            is_running: Arc::clone(&is_running),
            sink,
        };
        thread::spawn(move || pump.run(rx, child));

        Ok(Self {
            id: opts.session_id,
            master: pair.master,
            writer: Arc::new(Mutex::new(writer)),
            pid,
            tty,
            ring_buffer,
            is_running,
        })
    }

    pub fn write(&self, data: &str) -> Result<(), String> {
        let mut writer = self
            .writer
            .lock()
            .map_err(|_| "Falha ao bloquear escritor PTY".to_string())?;
        writer
            .write_all(data.as_bytes())
            .and_then(|_| writer.flush())
            .map_err(|e| format!("Falha ao escrever no PTY: {e}"))
    }

    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        self.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Falha ao redimensionar PTY: {e}"))
    }

    /// Asks the session leader's group and the foreground job to hang up. Does not block.
    pub fn hang_up(&self) {
        self.is_running.store(false, Ordering::Relaxed);
        let foreground = self
            .master
            .process_group_leader()
            .and_then(|pgid| u32::try_from(pgid).ok());
        signal_group(foreground, libc::SIGHUP);
        signal_group(self.pid, libc::SIGHUP);
    }

    /// Forcefully ends whatever survived `hang_up`.
    pub fn force_kill(&self) {
        force_kill_session(self.pid, self.tty.as_deref());
    }

    /// Terminates the session without blocking the caller: SIGHUP now, SIGKILL after the grace period.
    pub fn kill(&mut self) -> Result<bool, String> {
        self.hang_up();
        let pid = self.pid;
        let tty = self.tty.clone();
        thread::spawn(move || {
            thread::sleep(KILL_GRACE);
            force_kill_session(pid, tty.as_deref());
        });
        Ok(true)
    }

    pub fn get_scrollback(&self) -> Result<String, String> {
        self.ring_buffer
            .lock()
            .map(|rb| rb.snapshot())
            .map_err(|_| "Falha ao bloquear ring buffer".to_string())
    }

    pub fn is_alive(&self) -> bool {
        self.is_running.load(Ordering::Relaxed)
    }

    pub fn pid(&self) -> Option<u32> {
        self.pid
    }
}

fn read_loop(mut reader: Box<dyn Read + Send>, tx: mpsc::SyncSender<Vec<u8>>) {
    let mut buf = vec![0u8; READ_BUFFER_BYTES];
    loop {
        match reader.read(&mut buf) {
            // EOF, or EIO once the child side of the PTY is gone.
            Ok(0) | Err(_) => break,
            Ok(n) => {
                if tx.send(buf[..n].to_vec()).is_err() {
                    break;
                }
            }
        }
    }
}

/// Coalesces raw reads into batches, records them and forwards them to the sink.
struct Pump {
    session_id: String,
    ring_buffer: Arc<Mutex<RingBuffer>>,
    is_running: Arc<AtomicBool>,
    sink: Option<Arc<dyn OutputSink>>,
}

impl Pump {
    fn run(self, rx: Receiver<Vec<u8>>, mut child: Box<dyn Child + Send + Sync>) {
        let mut pending_utf8 = Vec::new();
        let mut sink_holding = false;

        loop {
            let first = if sink_holding {
                match rx.recv_timeout(HELD_OUTPUT_FLUSH) {
                    Ok(bytes) => bytes,
                    Err(RecvTimeoutError::Timeout) => {
                        self.notify_idle();
                        sink_holding = false;
                        continue;
                    }
                    Err(RecvTimeoutError::Disconnected) => break,
                }
            } else {
                match rx.recv() {
                    Ok(bytes) => bytes,
                    Err(_) => break,
                }
            };

            let mut batch = first;
            let started = Instant::now();
            while batch.len() < BATCH_MAX_BYTES && started.elapsed() < BATCH_WINDOW {
                match rx.recv_timeout(BATCH_GAP) {
                    Ok(more) => batch.extend_from_slice(&more),
                    Err(_) => break,
                }
            }

            let text = decode_utf8(&mut pending_utf8, &batch);
            if text.is_empty() {
                continue;
            }
            if let Ok(mut ring) = self.ring_buffer.lock() {
                ring.push_chunk(&text);
            }
            if let Some(sink) = &self.sink {
                sink_holding = sink.on_output(&self.session_id, &text);
            }
        }

        if sink_holding {
            self.notify_idle();
        }
        let exit_code = child.wait().ok().map(|status| status.exit_code());
        self.is_running.store(false, Ordering::Relaxed);
        if let Some(sink) = &self.sink {
            sink.on_exit(&self.session_id, exit_code);
        }
    }

    fn notify_idle(&self) {
        if let Some(sink) = &self.sink {
            sink.on_idle(&self.session_id);
        }
    }
}

impl Drop for PtySession {
    fn drop(&mut self) {
        if self.is_alive() {
            self.hang_up();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decode_utf8_carries_split_multibyte_characters() {
        let bytes = "ação 🚀".as_bytes();
        for split in 1..bytes.len() {
            let mut pending = Vec::new();
            let mut out = decode_utf8(&mut pending, &bytes[..split]);
            out.push_str(&decode_utf8(&mut pending, &bytes[split..]));
            assert_eq!(out, "ação 🚀", "split at byte {split}");
            assert!(pending.is_empty());
        }
    }

    #[test]
    fn exec_command_line_quotes_every_argument() {
        let argv = vec![
            "claude".to_string(),
            "--append-system-prompt".to_string(),
            "it's; rm -rf ~ $(whoami)".to_string(),
        ];
        let line = exec_command_line(&argv).expect("valid argv");
        assert_eq!(
            line,
            r#"exec 'claude' '--append-system-prompt' 'it'\''s; rm -rf ~ $(whoami)'"#
        );
    }

    #[test]
    fn exec_command_line_rejects_empty_program_and_nul() {
        assert!(exec_command_line(&[]).is_err());
        assert!(exec_command_line(&["  ".to_string()]).is_err());
        assert!(exec_command_line(&["a".to_string(), "b\0c".to_string()]).is_err());
    }
}
