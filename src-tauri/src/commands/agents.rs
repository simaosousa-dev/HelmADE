use crate::agents::{get_agent_by_id, scan_agent_directories, AgentDefinition};
use serde::{Deserialize, Serialize};
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
) -> Result<Vec<AgentDefinition>, String> {
    let path_ref = project_path.as_deref().map(Path::new);
    Ok(scan_agent_directories(path_ref))
}

#[tauri::command]
pub fn get_agent_details(
    agent_id: String,
    project_path: Option<String>,
) -> Result<AgentDefinition, String> {
    let path_ref = project_path.as_deref().map(Path::new);
    get_agent_by_id(&agent_id, path_ref)
        .ok_or_else(|| format!("Agente '{}' não foi encontrado", agent_id))
}

#[tauri::command]
pub fn check_ollama_status(endpoint: Option<String>) -> Result<OllamaStatus, String> {
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

    let _ = stream.set_read_timeout(Some(timeout));
    let _ = stream.set_write_timeout(Some(timeout));

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
    let _ = stream.read_to_end(&mut response_buf);
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
        message: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

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
