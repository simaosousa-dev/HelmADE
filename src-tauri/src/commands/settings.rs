use tauri::State;

use super::project::DbHandle;
use crate::error::{HelmError, HelmResult};
use crate::security::{ShieldConfig, ShieldHandle};

pub const SHIELD_SETTING_KEY: &str = "shield";

#[tauri::command]
pub fn get_setting(db: State<'_, DbHandle>, key: String) -> HelmResult<Option<String>> {
    db.get_setting(&key)
}

#[tauri::command]
pub fn set_setting(db: State<'_, DbHandle>, key: String, value: String) -> HelmResult<()> {
    if value.len() > 256 * 1024 {
        return Err(HelmError::invalid("Valor de definição demasiado grande"));
    }
    db.set_setting(&key, &value)
}

#[tauri::command]
pub fn get_shield_config(shield: State<'_, ShieldHandle>) -> HelmResult<ShieldConfig> {
    Ok(shield.config())
}

/// Applies the Streamer Shield switches immediately and remembers them.
#[tauri::command]
pub fn set_shield_config(
    shield: State<'_, ShieldHandle>,
    db: State<'_, DbHandle>,
    config: ShieldConfig,
) -> HelmResult<ShieldConfig> {
    shield.set_config(config);
    let serialized = serde_json::to_string(&config)
        .map_err(|_| HelmError::internal("Falha ao serializar a configuração"))?;
    db.set_setting(SHIELD_SETTING_KEY, &serialized)?;
    Ok(config)
}
