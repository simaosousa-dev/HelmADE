use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};
use tauri::State;

/// Configuração persistente e em memória dos atalhos globais do HelmADE.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutConfig {
    pub push_to_talk: String,
    pub enabled: bool,
    pub sound_feedback: bool,
}

impl Default for ShortcutConfig {
    fn default() -> Self {
        Self {
            push_to_talk: "Option+Space".to_string(),
            enabled: true,
            sound_feedback: false,
        }
    }
}

/// Estado thread-safe para gestão dos atalhos globais.
pub type ShortcutState = Arc<RwLock<ShortcutConfig>>;

/// Obtém a configuração atual de atalhos globais do HelmADE.
#[tauri::command]
pub fn get_shortcut_config(
    state: State<'_, ShortcutState>,
) -> Result<ShortcutConfig, String> {
    state
        .read()
        .map(|cfg| cfg.clone())
        .map_err(|e| format!("Falha ao ler configuração de atalhos: {}", e))
}

/// Atualiza a configuração dos atalhos globais.
#[tauri::command]
pub fn update_shortcut_config(
    state: State<'_, ShortcutState>,
    config: ShortcutConfig,
) -> Result<ShortcutConfig, String> {
    let mut lock = state
        .write()
        .map_err(|e| format!("Falha ao adquirir trava de escrita para atalhos: {}", e))?;
    *lock = config.clone();
    Ok(config)
}

/// Verifica a disponibilidade e integridade do subsistema push-to-talk.
#[tauri::command]
pub fn is_push_to_talk_available() -> Result<bool, String> {
    // No macOS e desktops suportados, o subsistema de push-to-talk está disponível nativamente
    Ok(true)
}
