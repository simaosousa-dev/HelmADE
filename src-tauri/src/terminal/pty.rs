use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use super::ring_buffer::RingBuffer;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpawnOptions {
    pub session_id: String,
    pub cwd: Option<String>,
    pub shell: Option<String>,
    pub cols: Option<u16>,
    pub rows: Option<u16>,
    pub env: Option<HashMap<String, String>>,
}

/// Sessão PTY individual gerenciando o processo shell, escrita e leitura assíncrona.
pub struct PtySession {
    pub id: String,
    master: Box<dyn MasterPty + Send>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    child: Box<dyn Child + Send + Sync>,
    pub ring_buffer: Arc<Mutex<RingBuffer>>,
    is_running: Arc<AtomicBool>,
    _reader_handle: Option<JoinHandle<()>>,
}

impl PtySession {
    /// Inicia uma nova sessão PTY e lança a thread de leitura contínua.
    pub fn spawn(opts: SpawnOptions, app_handle: Option<AppHandle>) -> Result<Self, String> {
        let pty_system = native_pty_system();
        let cols = opts.cols.unwrap_or(80);
        let rows = opts.rows.unwrap_or(24);

        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Falha ao abrir par PTY: {}", e))?;

        // Determina o shell a utilizar: preferência para /bin/zsh no macOS, fallback para /bin/bash ou sh
        let shell_cmd = opts.shell.unwrap_or_else(|| {
            if std::path::Path::new("/bin/zsh").exists() {
                "/bin/zsh".to_string()
            } else if std::path::Path::new("/bin/bash").exists() {
                "/bin/bash".to_string()
            } else {
                "/bin/sh".to_string()
            }
        });

        let mut cmd = CommandBuilder::new(&shell_cmd);
        if let Some(ref cwd) = opts.cwd {
            cmd.cwd(cwd);
        }

        // Configuração de variáveis padrão essenciais para terminal limpo
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        if let Some(ref env_vars) = opts.env {
            for (k, v) in env_vars {
                cmd.env(k, v);
            }
        }

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Falha ao executar shell '{}': {}", shell_cmd, e))?;

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Falha ao clonar leitor do PTY: {}", e))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Falha ao capturar escritor do PTY: {}", e))?;

        let ring_buffer = Arc::new(Mutex::new(RingBuffer::default()));
        let is_running = Arc::new(AtomicBool::new(true));

        let reader_session_id = opts.session_id.clone();
        let reader_ring_buffer = Arc::clone(&ring_buffer);
        let reader_running = Arc::clone(&is_running);

        // Thread dedicada de leitura assíncrona do PTY
        let reader_handle = thread::spawn(move || {
            let mut buf = [0u8; 4096];
            let event_name = format!("pty-output-{}", reader_session_id);

            while reader_running.load(Ordering::Relaxed) {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        // EOF atingido (o processo terminou)
                        reader_running.store(false, Ordering::Relaxed);
                        break;
                    }
                    Ok(n) => {
                        let chunk = String::from_utf8_lossy(&buf[..n]).to_string();

                        // Atualiza o ring buffer em memória
                        if let Ok(mut rb) = reader_ring_buffer.lock() {
                            rb.push_chunk(&chunk);
                        }

                        // Emite o evento IPC para o frontend via Tauri Event System
                        if let Some(ref handle) = app_handle {
                            let _ = handle.emit(&event_name, &chunk);
                        }
                    }
                    Err(err) => {
                        // Erro de I/O na leitura (ex.: PTY fechado)
                        let _ = err;
                        reader_running.store(false, Ordering::Relaxed);
                        break;
                    }
                }
            }
        });

        Ok(Self {
            id: opts.session_id,
            master: pair.master,
            writer: Arc::new(Mutex::new(writer)),
            child,
            ring_buffer,
            is_running,
            _reader_handle: Some(reader_handle),
        })
    }

    /// Escreve dados na entrada padrão (stdin) do PTY.
    pub fn write(&self, data: &str) -> Result<(), String> {
        let mut writer = self
            .writer
            .lock()
            .map_err(|_| "Falha ao bloquear escritor PTY".to_string())?;

        writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("Falha ao escrever no PTY: {}", e))?;
        writer
            .flush()
            .map_err(|e| format!("Falha ao descarregar buffer PTY: {}", e))?;

        Ok(())
    }

    /// Redimensiona as colunas e linhas da pseudo-terminal.
    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        self.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Falha ao redimensionar PTY: {}", e))
    }

    /// Encerra o processo filho e interrompe a thread de leitura.
    pub fn kill(&mut self) -> Result<bool, String> {
        self.is_running.store(false, Ordering::Relaxed);
        let kill_result = self.child.kill();
        thread::sleep(Duration::from_millis(20));
        kill_result.map(|_| true).map_err(|e| format!("Falha ao terminar processo: {}", e))
    }

    /// Retorna o histórico de scrollback acumulado.
    pub fn get_scrollback(&self) -> Result<Vec<String>, String> {
        let rb = self
            .ring_buffer
            .lock()
            .map_err(|_| "Falha ao bloquear ring buffer".to_string())?;
        Ok(rb.get_scrollback())
    }

    /// Verifica se a sessão continua ativa.
    pub fn is_alive(&self) -> bool {
        self.is_running.load(Ordering::Relaxed)
    }
}
