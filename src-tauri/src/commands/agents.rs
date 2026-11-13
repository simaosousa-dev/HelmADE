use crate::agents::{get_agent_by_id, scan_agent_directories, AgentDefinition};
use crate::error::{HelmError, HelmResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::Path;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OllamaStatus {
    pub is_running: bool,
    pub endpoint: String,
    pub models: Vec<String>,
    pub message: Option<String>,
}

#[tauri::command]
pub fn list_discovered_agents(
    project_path: Option<String>,
) -> HelmResult<Vec<AgentDefinition>> {
    let path_ref = project_path.as_deref().map(Path::new);
    Ok(scan_agent_directories(path_ref))
}

#[tauri::command]
pub fn get_agent_details(
    agent_id: String,
    project_path: Option<String>,
) -> HelmResult<AgentDefinition> {
    let path_ref = project_path.as_deref().map(Path::new);
    get_agent_by_id(&agent_id, path_ref)
        .ok_or_else(|| HelmError::not_found("Persona de agente não encontrada"))
}

/// Marker printed for every binary found, so shell start-up noise cannot be mistaken for a result.
const FOUND_MARKER: &str = "HELM_FOUND:";

fn is_binary_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 32
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

/// Checks which executables exist on the PATH of the user's login shell (the same PATH
/// the panels get), so the launcher only offers agent CLIs that can actually start.
pub fn detect_binaries(binaries: &[String]) -> Result<HashMap<String, bool>, String> {
    if binaries.len() > 16 || !binaries.iter().all(|name| is_binary_name(name)) {
        return Err("Lista de executáveis inválida".to_string());
    }
    let script = format!(
        "for b in {}; do command -v \"$b\" >/dev/null 2>&1 && echo \"{FOUND_MARKER}$b\"; done",
        binaries.join(" ")
    );
    let output = std::process::Command::new(crate::terminal::pty::login_shell())
        .args(["-lic", &script])
        .stdin(std::process::Stdio::null())
        .output()
        .map_err(|e| format!("Falha ao consultar a shell de login: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let found: Vec<&str> = stdout
        .lines()
        .filter_map(|line| line.trim().strip_prefix(FOUND_MARKER))
        .collect();
    Ok(binaries
        .iter()
        .map(|name| (name.clone(), found.contains(&name.as_str())))
        .collect())
}

#[tauri::command]
pub fn detect_agent_clis(binaries: Vec<String>) -> HelmResult<HashMap<String, bool>> {
    // End-to-end tests replace every agent CLI with a stub, so all of them count as installed.
    #[cfg(feature = "e2e-bridge")]
    if crate::e2e_bridge::agent_stub().is_some() {
        return Ok(binaries.into_iter().map(|name| (name, true)).collect());
    }
    detect_binaries(&binaries).map_err(HelmError::unavailable)
}

#[tauri::command]
pub fn check_ollama_status(endpoint: Option<String>) -> HelmResult<OllamaStatus> {
    let raw_endpoint = endpoint.unwrap_or_else(|| "http://127.0.0.1:11434".to_string());
    let clean_addr = raw_endpoint
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .trim_end_matches('/');

    let target_addr = if !clean_addr.contains(':') {
        format!("{}:11434", clean_addr)
    } else {
        clean_addr.to_string()
    };

    let addrs = match target_addr.to_socket_addrs() {
        Ok(mut a) => match a.next() {
            Some(addr) => addr,
            None => {
                return Ok(OllamaStatus {
                    is_running: false,
                    endpoint: raw_endpoint,
                    models: vec![],
                    message: Some("Não foi possível resolver o endereço do Ollama".to_string()),
                });
            }
        },
        Err(e) => {
            return Ok(OllamaStatus {
                is_running: false,
                endpoint: raw_endpoint,
                models: vec![],
                message: Some(format!("Endereço inválido: {}", e)),
            });
        }
    };

    let timeout = Duration::from_millis(800);
    let mut stream = match TcpStream::connect_timeout(&addrs, timeout) {
        Ok(s) => s,
        Err(e) => {
            return Ok(OllamaStatus {
                is_running: false,
                endpoint: raw_endpoint,
                models: vec![],
                message: Some(format!("Ollama offline ({})", e)),
            });
        }
    };

    if stream.set_read_timeout(Some(timeout)).is_err() || stream.set_write_timeout(Some(timeout)).is_err() {
        return Ok(OllamaStatus {
            is_running: true,
            endpoint: raw_endpoint,
            models: vec![],
            message: Some("Ligação estabelecida, mas não foi possível configurá-la".to_string()),
        });
    }

    let request = format!(
        "GET /api/tags HTTP/1.1\r\nHost: {}\r\nUser-Agent: HelmADE\r\nConnection: close\r\n\r\n",
        target_addr
    );

    if stream.write_all(request.as_bytes()).is_err() {
        return Ok(OllamaStatus {
            is_running: true,
            endpoint: raw_endpoint,
            models: vec![],
            message: Some("Ligação estabelecida, mas falha ao transmitir pedido".to_string()),
        });
    }

    let mut response_buf = Vec::new();
    // A timeout still leaves whatever arrived in the buffer; the model list is parsed from that.
    let incomplete = stream.read_to_end(&mut response_buf).is_err();
    let response_str = String::from_utf8_lossy(&response_buf);

    let mut models = Vec::new();
    if let Some(body_start) = response_str.find("\r\n\r\n") {
        let body = &response_str[body_start + 4..];
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(body) {
            if let Some(model_list) = json.get("models").and_then(|m| m.as_array()) {
                for m in model_list {
                    if let Some(name) = m.get("name").and_then(|n| n.as_str()) {
                        models.push(name.to_string());
                    }
                }
            }
        }
    }

    Ok(OllamaStatus {
        is_running: true,
        endpoint: raw_endpoint,
        models,
        message: incomplete.then(|| "Resposta incompleta do Ollama".to_string()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_binaries_reports_present_and_missing_executables() {
        let names = vec!["sh".to_string(), "definitely-not-installed-xyz".to_string()];
        let found = detect_binaries(&names).expect("detect");
        assert_eq!(found.get("sh"), Some(&true));
        assert_eq!(found.get("definitely-not-installed-xyz"), Some(&false));
    }

    #[test]
    fn detect_binaries_rejects_names_that_could_inject_shell() {
        for bad in ["a;b", "$(x)", "a b", "", "../x"] {
            assert!(detect_binaries(&[bad.to_string()]).is_err(), "accepted {bad:?}");
        }
    }

    #[test]
    fn test_check_ollama_status_offline() {
        let status = check_ollama_status(Some("http://127.0.0.1:59999".to_string())).unwrap();
        assert!(!status.is_running);
        assert_eq!(status.endpoint, "http://127.0.0.1:59999");
        assert!(status.models.is_empty());
        assert!(status.message.is_some());
    }

    #[test]
    fn test_check_ollama_status_invalid_addr() {
        let status = check_ollama_status(Some("invalid::address:::99999".to_string())).unwrap();
        assert!(!status.is_running);
        assert!(status.models.is_empty());
        assert!(status.message.is_some());
    }
}
