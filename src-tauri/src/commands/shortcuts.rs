use serde::{Deserialize, Serialize};
use std::str::FromStr;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use super::project::DbHandle;
use crate::error::{HelmError, HelmResult};

pub const SHORTCUT_SETTING_KEY: &str = "shortcuts";
pub const PTT_PRESSED_EVENT: &str = "ptt://pressed";
pub const PTT_RELEASED_EVENT: &str = "ptt://released";

/// System-wide push-to-talk shortcut (works while another app has focus).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutConfig {
    /// Accelerator in the form `Alt+Space`, `Control+Alt+Space`, `Command+Shift+V`…
    pub push_to_talk: String,
    pub enabled: bool,
}

impl Default for ShortcutConfig {
    fn default() -> Self {
        Self {
            push_to_talk: "Alt+Space".to_string(),
            enabled: true,
        }
    }
}

#[derive(Default)]
pub struct ShortcutSettings(pub Mutex<ShortcutConfig>);

/// Parses an accelerator; push-to-talk must include a modifier so it never eats plain typing.
pub fn parse_accelerator(accelerator: &str) -> HelmResult<Shortcut> {
    let shortcut = Shortcut::from_str(accelerator)
        .map_err(|_| HelmError::invalid("Atalho inválido. Exemplo: Alt+Space"))?;
    if shortcut.mods.is_empty() {
        return Err(HelmError::invalid(
            "O atalho de voz tem de incluir um modificador (⌥, ⌃ ou ⌘).",
        ));
    }
    Ok(shortcut)
}

/// Global shortcut plugin whose only job is to turn key down/up into push-to-talk events.
pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, _shortcut, event| {
            let name = match event.state() {
                ShortcutState::Pressed => PTT_PRESSED_EVENT,
                ShortcutState::Released => PTT_RELEASED_EVENT,
            };
            if let Err(err) = app.emit(name, ()) {
                eprintln!("[helmade] failed to emit {name}: {err}");
            }
        })
        .build()
}

/// Moves the system registration from `previous` to `next`.
pub fn apply(
    app: &AppHandle,
    previous: Option<&ShortcutConfig>,
    next: &ShortcutConfig,
) -> HelmResult<()> {
    let next_shortcut = parse_accelerator(&next.push_to_talk)?;
    let registry = app.global_shortcut();
    if let Some(previous) = previous.filter(|p| p.enabled) {
        if let Ok(old) = Shortcut::from_str(&previous.push_to_talk) {
            if registry.is_registered(old) {
                registry.unregister(old).map_err(|e| {
                    HelmError::unavailable(format!("Não foi possível libertar o atalho anterior: {e}"))
                })?;
            }
        }
    }
    if next.enabled {
        registry.register(next_shortcut).map_err(|e| {
            HelmError::unavailable(format!(
                "Não foi possível registar o atalho global (pode estar em uso por outra aplicação): {e}"
            ))
        })?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_shortcut_config(state: State<'_, ShortcutSettings>) -> HelmResult<ShortcutConfig> {
    Ok(state.0.lock()?.clone())
}

/// Re-registers the push-to-talk shortcut and remembers it. On failure the previous one stays active.
#[tauri::command]
pub fn update_shortcut_config(
    app: AppHandle,
    state: State<'_, ShortcutSettings>,
    db: State<'_, DbHandle>,
    config: ShortcutConfig,
) -> HelmResult<ShortcutConfig> {
    let mut current = state.0.lock()?;
    if let Err(err) = apply(&app, Some(&current), &config) {
        // Best effort: put the previous registration back before reporting the failure.
        if let Err(restore) = apply(&app, None, &current) {
            eprintln!("[helmade] could not restore the previous shortcut: {restore}");
        }
        return Err(err);
    }
    let serialized = serde_json::to_string(&config)
        .map_err(|_| HelmError::internal("Falha ao serializar a configuração"))?;
    db.set_setting(SHORTCUT_SETTING_KEY, &serialized)?;
    *current = config.clone();
    Ok(config)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ErrorCode;

    #[test]
    fn accelerators_need_a_modifier_and_a_valid_key() {
        assert!(parse_accelerator("Alt+Space").is_ok());
        assert!(parse_accelerator("Control+Alt+Space").is_ok());
        assert!(parse_accelerator("Command+Shift+V").is_ok());
        for bad in ["Space", "V", "", "Alt+NotAKey", "Alt+"] {
            let err = parse_accelerator(bad).expect_err(bad);
            assert_eq!(err.code, ErrorCode::InvalidInput);
        }
    }

    #[test]
    fn config_round_trips_in_camel_case() {
        let json = serde_json::to_string(&ShortcutConfig::default()).expect("serializable");
        assert_eq!(json, r#"{"pushToTalk":"Alt+Space","enabled":true}"#);
        let parsed: ShortcutConfig = serde_json::from_str(&json).expect("parse");
        assert_eq!(parsed, ShortcutConfig::default());
    }
}
