use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, State};

use super::browser::BrowserState;
use crate::cli;
use crate::error::{HelmError, HelmResult};
use crate::git::validate_id;
use crate::notifications::macos::send_macos_notification as send_macos_notif;
use crate::security::ShieldHandle;
use crate::terminal::idle_detector::{IdleDetectorState, SessionStatusPayload};
use crate::terminal::manager::PtyManager;
use crate::terminal::pty::SpawnOptions;
use crate::terminal::sink::TauriSink;

pub type PtyState = Arc<PtyManager>;
pub type SinkState = Arc<TauriSink>;

/// Where the A2A socket and the `helmade` shim live for this app instance.
pub struct RuntimeInfo {
    pub socket: PathBuf,
    pub bin_dir: PathBuf,
    pub cli: PathBuf,
}

const MAX_ENV_VARS: usize = 64;
const MAX_ENV_VALUE_BYTES: usize = 64 * 1024;

fn is_env_name(name: &str) -> bool {
    let mut chars = name.chars();
    chars
        .next()
        .is_some_and(|c| c.is_ascii_alphabetic() || c == '_')
        && chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
        && name.len() <= 128
}

/// Validates the environment sent by the frontend and adds what every panel needs
/// to reach the A2A channel.
fn panel_env(
    requested: Option<HashMap<String, String>>,
    runtime: &RuntimeInfo,
) -> HelmResult<HashMap<String, String>> {
    let mut env = requested.unwrap_or_default();
    if env.len() > MAX_ENV_VARS {
        return Err(HelmError::invalid("Demasiadas variáveis de ambiente"));
    }
    for (name, value) in &env {
        if !is_env_name(name) || value.len() > MAX_ENV_VALUE_BYTES || value.contains('\0') {
            return Err(HelmError::invalid("Variável de ambiente inválida"));
        }
    }
    env.insert(
        cli::ENV_SOCKET.to_string(),
        runtime.socket.to_string_lossy().to_string(),
    );
    env.insert(
        "HELMADE_CLI".to_string(),
        runtime.cli.to_string_lossy().to_string(),
    );
    let inherited = std::env::var("PATH").unwrap_or_default();
    env.insert(
        "PATH".to_string(),
        format!("{}:{inherited}", runtime.bin_dir.to_string_lossy()),
    );
    Ok(env)
}

/// Starts a terminal. With `command`, the panel runs that program directly (an agent CLI);
/// without it, an interactive login shell.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub fn spawn_pty(
    state: State<'_, PtyState>,
    sink: State<'_, SinkState>,
    runtime: State<'_, RuntimeInfo>,
    session_id: String,
    cwd: Option<String>,
    command: Option<Vec<String>>,
    cols: Option<u16>,
    rows: Option<u16>,
    env: Option<HashMap<String, String>>,
) -> HelmResult<()> {
    validate_id(&session_id).map_err(HelmError::invalid)?;
    #[cfg(feature = "e2e-bridge")]
    let command = command.map(crate::e2e_bridge::stub_agent_command);
    let opts = SpawnOptions {
        session_id,
        cwd,
        shell: None,
        command,
        cols,
        rows,
        env: Some(panel_env(env, &runtime)?),
    };
    let sink: SinkState = Arc::clone(&sink);
    state.spawn(opts, Some(sink)).map_err(HelmError::pty)
}

#[tauri::command]
pub fn write_pty(
    state: State<'_, PtyState>,
    idle_detector: State<'_, IdleDetectorState>,
    app_handle: AppHandle,
    session_id: String,
    data: String,
) -> HelmResult<()> {
    idle_detector.notify_input(&session_id, &app_handle);
    state.write(&session_id, &data).map_err(HelmError::pty)
}

#[tauri::command]
pub fn resize_pty(
    state: State<'_, PtyState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> HelmResult<()> {
    if cols == 0 || rows == 0 {
        return Err(HelmError::invalid("Dimensões de terminal inválidas"));
    }
    state.resize(&session_id, cols, rows).map_err(HelmError::pty)
}

/// Ends a terminal and forgets everything tracked about it.
#[tauri::command]
pub fn kill_pty(
    state: State<'_, PtyState>,
    idle_detector: State<'_, IdleDetectorState>,
    browser: State<'_, BrowserState>,
    session_id: String,
) -> HelmResult<bool> {
    idle_detector.forget_session(&session_id);
    browser.clear(Some(&session_id));
    state.kill(&session_id).map_err(HelmError::pty)
}

#[tauri::command]
pub fn is_pty_alive(state: State<'_, PtyState>, session_id: String) -> HelmResult<bool> {
    Ok(state.is_alive(&session_id))
}

/// Raw scrollback to replay into a re-mounted terminal, with the Streamer Shield applied.
#[tauri::command]
pub fn get_pty_scrollback(
    state: State<'_, PtyState>,
    shield: State<'_, ShieldHandle>,
    session_id: String,
) -> HelmResult<String> {
    let raw = state.get_scrollback(&session_id).map_err(HelmError::pty)?;
    Ok(shield.apply(&raw))
}

#[tauri::command]
pub fn respond_to_blocked_prompt(
    state: State<'_, PtyState>,
    idle_detector: State<'_, IdleDetectorState>,
    app_handle: AppHandle,
    session_id: String,
    response: String,
) -> HelmResult<()> {
    if response.len() > 4096 || response.chars().any(|c| c.is_control()) {
        return Err(HelmError::invalid("Resposta inválida"));
    }
    state
        .write(&session_id, &format!("{response}\n"))
        .map_err(HelmError::pty)?;
    idle_detector.respond_to_prompt(&session_id, &app_handle);
    Ok(())
}

#[tauri::command]
pub fn get_session_idle_status(
    idle_detector: State<'_, IdleDetectorState>,
    session_id: String,
) -> HelmResult<SessionStatusPayload> {
    Ok(idle_detector.get_session_status(&session_id))
}

#[tauri::command]
pub fn list_all_terminal_idle_statuses(
    idle_detector: State<'_, IdleDetectorState>,
) -> HelmResult<Vec<SessionStatusPayload>> {
    Ok(idle_detector.list_all_sessions())
}

#[tauri::command]
pub fn set_session_standby(
    idle_detector: State<'_, IdleDetectorState>,
    app_handle: AppHandle,
    session_id: String,
    standby: bool,
) -> HelmResult<()> {
    idle_detector.set_standby(&session_id, standby, &app_handle);
    Ok(())
}

#[tauri::command]
pub fn send_macos_notification(
    title: String,
    subtitle: Option<String>,
    body: String,
    sound: Option<bool>,
) -> HelmResult<()> {
    send_macos_notif(&title, subtitle.as_deref(), &body, sound.unwrap_or(true))
        .map_err(HelmError::unavailable)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn runtime() -> RuntimeInfo {
        RuntimeInfo {
            socket: PathBuf::from("/tmp/helm.sock"),
            bin_dir: PathBuf::from("/home/.helmade/bin"),
            cli: PathBuf::from("/home/.helmade/bin/helmade"),
        }
    }

    #[test]
    fn panel_env_adds_the_a2a_channel_and_puts_the_shim_first_on_path() {
        let requested = HashMap::from([("HELM_SWARM_ID".to_string(), "s1".to_string())]);
        let env = panel_env(Some(requested), &runtime()).expect("env");
        assert_eq!(env["HELM_SWARM_ID"], "s1");
        assert_eq!(env["HELM_SOCK"], "/tmp/helm.sock");
        assert_eq!(env["HELMADE_CLI"], "/home/.helmade/bin/helmade");
        assert!(env["PATH"].starts_with("/home/.helmade/bin:"));
    }

    #[test]
    fn panel_env_rejects_malformed_variables() {
        for (name, value) in [("1BAD", "x"), ("A B", "x"), ("A=B", "x"), ("", "x"), ("OK", "a\0b")] {
            let requested = HashMap::from([(name.to_string(), value.to_string())]);
            assert!(panel_env(Some(requested), &runtime()).is_err(), "accepted {name:?}");
        }
        let too_many: HashMap<String, String> =
            (0..=MAX_ENV_VARS).map(|i| (format!("V{i}"), String::new())).collect();
        assert!(panel_env(Some(too_many), &runtime()).is_err());
    }
}
