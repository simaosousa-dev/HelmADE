use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, State};

use crate::notifications::macos::send_macos_notification as send_macos_notif;
use crate::terminal::idle_detector::{IdleDetectorState, SessionStatusPayload};
use crate::terminal::manager::PtyManager;
use crate::terminal::pty::SpawnOptions;

/// Estado compartilhado do gerenciador de PTYs gerenciado pelo runtime Tauri.
pub type PtyState = Arc<PtyManager>;

#[allow(clippy::too_many_arguments)]
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
    idle_detector: State<IdleDetectorState>,
    app_handle: AppHandle,
    session_id: String,
    data: String,
) -> Result<(), String> {
    idle_detector.notify_input(&session_id, &app_handle);
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

#[tauri::command]
pub fn respond_to_blocked_prompt(
    state: State<PtyState>,
    idle_detector: State<IdleDetectorState>,
    app_handle: AppHandle,
    session_id: String,
    response: String,
) -> Result<(), String> {
    // Escreve a resposta com nova linha no terminal
    let payload = format!("{}\n", response);
    state.write(&session_id, &payload)?;

    // Atualiza o estado no detector de inatividade
    idle_detector.respond_to_prompt(&session_id, &app_handle);
    Ok(())
}

#[tauri::command]
pub fn get_session_idle_status(
    idle_detector: State<IdleDetectorState>,
    session_id: String,
) -> Result<SessionStatusPayload, String> {
    Ok(idle_detector.get_session_status(&session_id))
}

#[tauri::command]
pub fn list_all_terminal_idle_statuses(
    idle_detector: State<IdleDetectorState>,
) -> Result<Vec<SessionStatusPayload>, String> {
    Ok(idle_detector.list_all_sessions())
}

#[tauri::command]
pub fn set_session_standby(
    idle_detector: State<IdleDetectorState>,
    app_handle: AppHandle,
    session_id: String,
    standby: bool,
) -> Result<(), String> {
    idle_detector.set_standby(&session_id, standby, &app_handle);
    Ok(())
}

#[tauri::command]
pub fn send_macos_notification(
    title: String,
    subtitle: Option<String>,
    body: String,
    sound: Option<bool>,
) -> Result<(), String> {
    send_macos_notif(&title, subtitle.as_deref(), &body, sound.unwrap_or(true))
}

