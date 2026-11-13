use std::collections::HashMap;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use super::idle_detector::IdleDetectorState;
use super::pty::OutputSink;
use crate::browser::PortSniffer;
use crate::commands::browser::BrowserState;
use crate::security::redactor::StreamRedactor;
use crate::security::ShieldHandle;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyExitPayload {
    pub session_id: String,
    pub exit_code: Option<u32>,
}

/// Bridges PTY output to the frontend: prompt detection and port sniffing run on the raw
/// text, the Streamer Shield runs last, and only shielded text is ever emitted.
pub struct TauriSink {
    app: AppHandle,
    redactors: Mutex<HashMap<String, StreamRedactor>>,
}

impl TauriSink {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            redactors: Mutex::new(HashMap::new()),
        }
    }

    fn emit_output(&self, session_id: &str, text: String) {
        if text.is_empty() {
            return;
        }
        let shielded = match self.app.try_state::<ShieldHandle>() {
            Some(shield) => shield.hide_paths(text),
            None => text,
        };
        if let Err(err) = self.app.emit(&format!("pty-output-{session_id}"), shielded) {
            eprintln!("[helmade] failed to emit terminal output: {err}");
        }
    }

    /// Runs the chunk through the session's redactor. Returns the displayable text and
    /// whether more text is being held back.
    fn shield(&self, session_id: &str, chunk: &str) -> (String, bool) {
        let masking = self
            .app
            .try_state::<ShieldHandle>()
            .map(|shield| shield.masks_secrets())
            .unwrap_or(true);
        let Ok(mut redactors) = self.redactors.lock() else {
            return (String::new(), false);
        };
        if !masking {
            let mut text = redactors
                .remove(session_id)
                .map(|mut redactor| redactor.flush())
                .unwrap_or_default();
            text.push_str(chunk);
            return (text, false);
        }
        let redactor = redactors.entry(session_id.to_string()).or_default();
        let text = redactor.push(chunk);
        (text, redactor.has_pending())
    }

    fn flush(&self, session_id: &str, forget: bool) -> String {
        let Ok(mut redactors) = self.redactors.lock() else {
            return String::new();
        };
        if forget {
            return redactors
                .remove(session_id)
                .map(|mut redactor| redactor.flush())
                .unwrap_or_default();
        }
        redactors
            .get_mut(session_id)
            .map(|redactor| redactor.flush())
            .unwrap_or_default()
    }
}

impl OutputSink for TauriSink {
    fn on_output(&self, session_id: &str, chunk: &str) -> bool {
        if let Some(idle_detector) = self.app.try_state::<IdleDetectorState>() {
            idle_detector.process_chunk(session_id, chunk, &self.app);
        }

        let servers = PortSniffer::sniff_chunk(chunk, session_id);
        if let Some(browser_state) = self.app.try_state::<BrowserState>() {
            for server in servers {
                if !browser_state.record_if_new(session_id, server.clone()) {
                    continue;
                }
                if let Err(err) = self.app.emit("devserver-detected", &server) {
                    eprintln!("[helmade] failed to emit dev server event: {err}");
                }
            }
        }

        let (text, holding) = self.shield(session_id, chunk);
        self.emit_output(session_id, text);
        holding
    }

    fn on_idle(&self, session_id: &str) {
        let text = self.flush(session_id, false);
        self.emit_output(session_id, text);
    }

    fn on_exit(&self, session_id: &str, exit_code: Option<u32>) {
        let text = self.flush(session_id, true);
        self.emit_output(session_id, text);
        let payload = PtyExitPayload {
            session_id: session_id.to_string(),
            exit_code,
        };
        if let Err(err) = self.app.emit("pty-exit", &payload) {
            eprintln!("[helmade] failed to emit terminal exit: {err}");
        }
    }
}
