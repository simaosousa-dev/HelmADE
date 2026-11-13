//! Event emission to the frontend. A failed emit is logged, never silently dropped.

use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub fn emit<S: Serialize + Clone>(app: &AppHandle, event: &str, payload: S) {
    if let Err(err) = app.emit(event, payload) {
        eprintln!("[helmade] failed to emit {event}: {err}");
    }
}
