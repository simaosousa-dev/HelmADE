use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

/// Estrutura de dados que representa um servidor de desenvolvimento local detetado.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DetectedDevServer {
    pub session_id: String,
    pub url: String,
    pub port: u16,
    pub detected_at: u64,
}

/// Gestor de estado para portas e servidores de desenvolvimento detetados via PTY.
pub struct PortSniffer {
    servers: Mutex<HashMap<String, Vec<DetectedDevServer>>>,
}

impl Default for PortSniffer {
    fn default() -> Self {
        Self::new()
    }
}

impl PortSniffer {
    /// Cria uma nova instância de `PortSniffer`.
    pub fn new() -> Self {
        Self {
            servers: Mutex::new(HashMap::new()),
        }
    }

    /// Analisa um chunk de texto bruto e extrai URLs de servidores de dev locais.
    pub fn sniff_chunk(chunk: &str, session_id: &str) -> Vec<DetectedDevServer> {
        let clean = strip_ansi(chunk);
        extract_dev_servers(&clean, session_id)
    }

    /// Regista o servidor se for novo para a sessão especificada.
    /// Retorna `true` se o servidor foi adicionado pela primeira vez.
    pub fn record_if_new(&self, session_id: &str, server: DetectedDevServer) -> bool {
        let mut map = match self.servers.lock() {
            Ok(g) => g,
            Err(_) => return false,
        };

        let list = map.entry(session_id.to_string()).or_default();
        if list.iter().any(|s| s.port == server.port && s.url == server.url) {
            false
        } else {
            list.push(server);
            true
        }
    }

    /// Retorna servidores detetados (filtrados por session_id ou todos se None).
    pub fn get_servers(&self, session_id: Option<&str>) -> Vec<DetectedDevServer> {
        let map = match self.servers.lock() {
            Ok(g) => g,
            Err(_) => return Vec::new(),
        };

        if let Some(id) = session_id {
            map.get(id).cloned().unwrap_or_default()
        } else {
            let mut all = Vec::new();
            for list in map.values() {
                all.extend(list.clone());
            }
            all.sort_by_key(|s| s.detected_at);
            all
        }
    }

    /// Limpa servidores detetados (de uma sessão específica ou de todas).
    pub fn clear(&self, session_id: Option<&str>) {
        if let Ok(mut map) = self.servers.lock() {
            if let Some(id) = session_id {
                map.remove(id);
            } else {
                map.clear();
            }
        }
    }
}

/// Remove sequências de escape ANSI de terminal (CSI, OSC, etc.) de forma ultra-rápida e sem alocações pesadas.
pub fn strip_ansi(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '\x1b' {
            if let Some(&next) = chars.peek() {
                if next == '[' {
                    // CSI sequence: \x1b[ ... [0x40..=0x7E]
                    chars.next();
                    for param in chars.by_ref() {
                        if (param as u32) >= 0x40 && (param as u32) <= 0x7E {
                            break;
                        }
                    }
                    continue;
                } else if next == ']' {
                    // OSC sequence: \x1b] ... (\x07 ou \x1b\)
                    chars.next();
                    while let Some(osc_c) = chars.next() {
                        if osc_c == '\x07' {
                            break;
                        }
                        if osc_c == '\x1b' && chars.peek() == Some(&'\\') {
                            chars.next();
                            break;
                        }
                    }
                    continue;
                } else if next == '(' || next == ')' || next == '*' || next == '+' {
                    chars.next();
                    chars.next(); // consome character set code
                    continue;
                } else {
                    chars.next(); // consome escape de 2 bytes simples
                    continue;
                }
            }
        }
        out.push(c);
    }
    out
}

/// Extrai URLs de servidores de desenvolvimento locais a partir de texto limpo.
fn extract_dev_servers(text: &str, session_id: &str) -> Vec<DetectedDevServer> {
    let mut results = Vec::new();
    let schemes = ["http://", "https://"];
    let hosts = ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"];

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    for &scheme in &schemes {
        let mut search_from = 0;
        while let Some(start_pos) = text[search_from..].find(scheme) {
            let abs_pos = search_from + start_pos;
            let after_scheme = &text[abs_pos + scheme.len()..];

            for &host in &hosts {
                let host_colon = format!("{}:", host);
                if after_scheme.starts_with(&host_colon) {
                    let port_str = &after_scheme[host_colon.len()..];
                    let digits: String = port_str.chars().take_while(|c| c.is_ascii_digit()).collect();
                    if !digits.is_empty() {
                        if let Ok(port) = digits.parse::<u16>() {
                            if port > 0 {
                                let after_port = &port_str[digits.len()..];
                                let mut path = String::new();
                                if after_port.starts_with('/') {
                                    let candidate: String = after_port
                                        .chars()
                                        .take_while(|&c| {
                                            !c.is_whitespace()
                                                && c != '"'
                                                && c != '\''
                                                && c != ')'
                                                && c != '>'
                                                && c != ']'
                                                && c != ','
                                        })
                                        .collect();
                                    if candidate.len() > 1 {
                                        path = candidate;
                                    }
                                }

                                let normalized_host = if host == "0.0.0.0" { "localhost" } else { host };
                                let url = format!("{}{}:{}{}", scheme, normalized_host, port, path);

                                if !results.iter().any(|s: &DetectedDevServer| s.port == port && s.url == url) {
                                    results.push(DetectedDevServer {
                                        session_id: session_id.to_string(),
                                        url,
                                        port,
                                        detected_at: now,
                                    });
                                }
                            }
                        }
                    }
                    break;
                }
            }

            search_from = abs_pos + scheme.len();
        }
    }

    results
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;

    #[test]
    fn test_strip_ansi_sequences() {
        let raw = "\x1b[32m➜\x1b[39m  \x1b[1mLocal:\x1b[22m   \x1b[36mhttp://localhost:5173/\x1b[39m";
        let cleaned = strip_ansi(raw);
        assert_eq!(cleaned, "➜  Local:   http://localhost:5173/");
    }

    #[test]
    fn test_sniff_vite_output_latency_under_200ms() {
        let vite_output = r#"
  VITE v5.4.8  ready in 324 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
"#;
        let start = Instant::now();
        let detected = PortSniffer::sniff_chunk(vite_output, "session-vite");
        let elapsed = start.elapsed();

        assert!(elapsed < std::time::Duration::from_millis(200), "Tempo excedeu 200ms: {:?}", elapsed);
        assert_eq!(detected.len(), 1);
        assert_eq!(detected[0].session_id, "session-vite");
        assert_eq!(detected[0].port, 5173);
        assert_eq!(detected[0].url, "http://localhost:5173");
    }

    #[test]
    fn test_sniff_nextjs_output_ansi() {
        let next_output = "\x1b[1m   ▲ Next.js 14.2.3\x1b[0m\n   - Local:        \x1b[34mhttp://localhost:3000\x1b[0m\n   - Network:      http://192.168.1.5:3000\n\n \x1b[32m✓\x1b[0m Starting...\n \x1b[32m✓\x1b[0m Ready in 1250ms";
        let start = Instant::now();
        let detected = PortSniffer::sniff_chunk(next_output, "session-next");
        let elapsed = start.elapsed();

        assert!(elapsed < std::time::Duration::from_millis(200));
        assert_eq!(detected.len(), 1);
        assert_eq!(detected[0].port, 3000);
        assert_eq!(detected[0].url, "http://localhost:3000");
    }

    #[test]
    fn test_sniff_astro_output() {
        let astro_output = r#"
 astro  v4.15.0 ready in 452 ms

┃ Local    http://localhost:4321/
┃ Network  use --host to expose
"#;
        let start = Instant::now();
        let detected = PortSniffer::sniff_chunk(astro_output, "session-astro");
        let elapsed = start.elapsed();

        assert!(elapsed < std::time::Duration::from_millis(200));
        assert_eq!(detected.len(), 1);
        assert_eq!(detected[0].port, 4321);
        assert_eq!(detected[0].url, "http://localhost:4321");
    }

    #[test]
    fn test_sniff_ipv6_and_ip_loopback() {
        let chunk = "Server running on http://127.0.0.1:8080 and backup on http://[::1]:9090";
        let detected = PortSniffer::sniff_chunk(chunk, "session-multi");

        assert_eq!(detected.len(), 2);
        assert_eq!(detected[0].port, 8080);
        assert_eq!(detected[0].url, "http://127.0.0.1:8080");
        assert_eq!(detected[1].port, 9090);
        assert_eq!(detected[1].url, "http://[::1]:9090");
    }

    #[test]
    fn test_sniff_with_subpath() {
        let chunk = "Admin console ready at http://localhost:8000/admin";
        let detected = PortSniffer::sniff_chunk(chunk, "session-subpath");

        assert_eq!(detected.len(), 1);
        assert_eq!(detected[0].port, 8000);
        assert_eq!(detected[0].url, "http://localhost:8000/admin");
    }

    #[test]
    fn test_port_sniffer_state_deduplication_and_clearing() {
        let sniffer = PortSniffer::new();
        let server1 = DetectedDevServer {
            session_id: "s1".to_string(),
            url: "http://localhost:5173".to_string(),
            port: 5173,
            detected_at: 100,
        };

        // Primeira inserção deve retornar true
        assert!(sniffer.record_if_new("s1", server1.clone()));
        // Segunda inserção idêntica deve retornar false
        assert!(!sniffer.record_if_new("s1", server1.clone()));

        assert_eq!(sniffer.get_servers(Some("s1")).len(), 1);
        assert_eq!(sniffer.get_servers(None).len(), 1);

        sniffer.clear(Some("s1"));
        assert_eq!(sniffer.get_servers(Some("s1")).len(), 0);
    }
}
