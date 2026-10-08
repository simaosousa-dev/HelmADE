use std::sync::Arc;
use tauri::State;

use crate::browser::{DetectedDevServer, PortSniffer};

/// Tipo de estado compartilhado para o sniffer de navegador gerenciado pelo runtime Tauri.
pub type BrowserState = Arc<PortSniffer>;

/// Retorna a lista de servidores de desenvolvimento detetados (filtrado por session_id opcional ou todos).
#[tauri::command]
pub fn get_detected_servers(
    state: State<'_, BrowserState>,
    session_id: Option<String>,
) -> Result<Vec<DetectedDevServer>, String> {
    Ok(state.get_servers(session_id.as_deref()))
}

/// Limpa os servidores de desenvolvimento detetados (para uma sessão específica ou todas).
#[tauri::command]
pub fn clear_detected_servers(
    state: State<'_, BrowserState>,
    session_id: Option<String>,
) -> Result<(), String> {
    state.clear(session_id.as_deref());
    Ok(())
}

/// Abre uma URL de forma segura no navegador padrão do sistema operacional (macOS via `open`).
#[tauri::command]
pub fn open_in_external_browser(url: String) -> Result<bool, String> {
    let trimmed = url.trim();
    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err("Apenas URLs com protocolo http:// ou https:// são permitidos".to_string());
    }

    if trimmed.contains('\0') || trimmed.contains('\n') || trimmed.contains('\r') {
        return Err("URL contém caracteres de controle inválidos".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(trimmed)
            .spawn()
            .map_err(|e| format!("Falha ao abrir URL no macOS: {}", e))?;
        Ok(true)
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", trimmed])
            .spawn()
            .map_err(|e| format!("Falha ao abrir URL no Windows: {}", e))?;
        Ok(true)
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(trimmed)
            .spawn()
            .map_err(|e| format!("Falha ao abrir URL no Linux: {}", e))?;
        Ok(true)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        Err("Sistema operacional não suportado para abertura de navegador externo".to_string())
    }
}
