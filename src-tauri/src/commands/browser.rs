use std::sync::Arc;
use tauri::State;

use crate::browser::{DetectedDevServer, PortSniffer};
use crate::error::{HelmError, HelmResult};

/// Tipo de estado compartilhado para o sniffer de navegador gerenciado pelo runtime Tauri.
pub type BrowserState = Arc<PortSniffer>;

/// Retorna a lista de servidores de desenvolvimento detetados (filtrado por session_id opcional ou todos).
#[tauri::command]
pub fn get_detected_servers(
    state: State<'_, BrowserState>,
    session_id: Option<String>,
) -> HelmResult<Vec<DetectedDevServer>> {
    Ok(state.get_servers(session_id.as_deref()))
}

/// Limpa os servidores de desenvolvimento detetados (para uma sessão específica ou todas).
#[tauri::command]
pub fn clear_detected_servers(
    state: State<'_, BrowserState>,
    session_id: Option<String>,
) -> HelmResult<()> {
    state.clear(session_id.as_deref());
    Ok(())
}

/// Opens an http(s) URL in the system browser. The URL is passed as a single argument
/// to `open`, never through a shell.
#[tauri::command]
pub fn open_in_external_browser(url: String) -> HelmResult<bool> {
    let trimmed = url.trim();
    let is_web = trimmed.starts_with("http://") || trimmed.starts_with("https://");
    if !is_web || trimmed.len() > 2048 || trimmed.chars().any(|c| c.is_control()) {
        return Err(HelmError::invalid("Só é possível abrir URLs http:// ou https://"));
    }
    std::process::Command::new("open")
        .arg(trimmed)
        .spawn()
        .map_err(|e| HelmError::unavailable(format!("Falha ao abrir o navegador: {e}")))?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ErrorCode;

    #[test]
    fn only_plain_web_urls_are_accepted() {
        for bad in ["file:///etc/passwd", "javascript:alert(1)", "", "http://a\nb", "-a Calculator"] {
            let err = open_in_external_browser(bad.to_string()).expect_err(bad);
            assert_eq!(err.code, ErrorCode::InvalidInput);
        }
    }
}
