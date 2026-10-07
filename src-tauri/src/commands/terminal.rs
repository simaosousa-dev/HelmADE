use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, State};

use crate::terminal::manager::PtyManager;
use crate::terminal::pty::SpawnOptions;

/// Estado compartilhado do gerenciador de PTYs gerenciado pelo runtime Tauri.
pub type PtyState = Arc<PtyManager>;

#[tauri::command]
pub fn spawn_pty(
    state: State<PtyState>,
    app_handle: AppHandle,
    session_id: String,
    cwd: Option<String>,
    shell: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
    env: Option<HashMap<String, String>>,
) -> Result<(), String> {
    let opts = SpawnOptions {
        session_id,
        cwd,
        shell,
        cols,
        rows,
        env,
    };
    state.spawn(opts, Some(app_handle))
}

#[tauri::command]
pub fn write_pty(
    state: State<PtyState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    state.write(&session_id, &data)
}

#[tauri::command]
pub fn resize_pty(
    state: State<PtyState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    state.resize(&session_id, cols, rows)
}

#[tauri::command]
pub fn kill_pty(
    state: State<PtyState>,
    session_id: String,
) -> Result<bool, String> {
    state.kill(&session_id)
}

#[tauri::command]
pub fn get_pty_scrollback(
    state: State<PtyState>,
    session_id: String,
) -> Result<Vec<String>, String> {
    state.get_scrollback(&session_id)
}
