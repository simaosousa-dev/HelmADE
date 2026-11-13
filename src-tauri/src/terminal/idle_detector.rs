use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::browser::sniffer::strip_ansi;
use crate::notifications::macos::send_macos_notification;

/// Tipos de confirmação ou bloqueio interativo detetados nos processos PTY.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PromptType {
    YesNo,
    Password,
    Input,
}

/// Detalhes de um prompt interativo bloqueado à espera de intervenção humana.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockedPromptInfo {
    pub session_id: String,
    pub prompt_text: String,
    pub prompt_type: PromptType,
    pub default_choice: Option<String>,
    pub suggested_options: Vec<String>,
    pub timestamp: u64,
}

/// Estados operacionais de atividade e poupança de energia da sessão PTY.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionIdleState {
    Active,
    Idle,
    Standby,
    Blocked,
}

/// Payload reativo emitido para o frontend com o estado de atividade da sessão.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStatusPayload {
    pub session_id: String,
    pub state: SessionIdleState,
    pub blocked_prompt: Option<BlockedPromptInfo>,
    pub last_active_at: u64,
}

/// Dados internos de rastreio de inatividade por sessão PTY.
#[derive(Debug, Clone)]
struct SessionTracking {
    state: SessionIdleState,
    blocked_prompt: Option<BlockedPromptInfo>,
    last_active_at: u64,
    recent_tail: String,
}

/// Retorna a marca temporal atual em milissegundos desde a época UNIX.
fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Analisador heurístico ultra-leve para deteção de buffers bloqueados em prompts interativos.
pub fn detect_prompt_heuristic(chunk: &str, session_id: &str) -> Option<BlockedPromptInfo> {
    let clean = strip_ansi(chunk);
    let trimmed = clean.trim();

    if trimmed.is_empty() {
        return None;
    }

    // Heurística de guarda: não analisa linhas geradas por compiladores ou logs comuns
    if trimmed.starts_with("Compiling ")
        || trimmed.starts_with("Building ")
        || trimmed.starts_with("Finished ")
        || trimmed.starts_with("[INFO]")
        || trimmed.starts_with("[DEBUG]")
        || trimmed.starts_with("[WARN]")
        || trimmed.starts_with("[ERROR]")
    {
        return None;
    }

    // Obtém a última linha do chunk
    let last_line = clean
        .lines()
        .rfind(|l| !l.trim().is_empty())
        .unwrap_or("")
        .trim();

    if last_line.is_empty() {
        return None;
    }

    let lower = last_line.to_lowercase();

    // 1. Deteção de Password ou Passphrase
    if lower.ends_with("password:")
        || lower.ends_with("password: ")
        || lower.contains("password for ")
        || lower.contains("sudo password")
        || lower.contains("[sudo] password")
        || lower.contains("enter passphrase")
        || lower.contains("enter password")
    {
        return Some(BlockedPromptInfo {
            session_id: session_id.to_string(),
            prompt_text: last_line.to_string(),
            prompt_type: PromptType::Password,
            default_choice: None,
            suggested_options: vec![],
            timestamp: now_ms(),
        });
    }

    // 2. Deteção de Prompts Yes/No (y/n, Y/n, y/N, yes/no, etc.)
    let has_yn_brackets = last_line.contains("[y/n]")
        || last_line.contains("[y/N]")
        || last_line.contains("[Y/n]")
        || last_line.contains("[Y/N]")
        || last_line.contains("(y/n)")
        || last_line.contains("(y/N)")
        || last_line.contains("(Y/n)")
        || last_line.contains("(Y/N)")
        || last_line.contains("[yes/no]")
        || last_line.contains("(yes/no)")
        || last_line.contains("(y/n/d)")
        || last_line.contains("(y/n/a/q)");

    let has_question_intent = lower.contains("do you want to continue")
        || lower.contains("are you sure")
        || lower.contains("proceed with")
        || lower.contains("overwrite")
        || lower.contains("replace")
        || lower.contains("delete")
        || lower.contains("remove");

    if has_yn_brackets || (has_question_intent && last_line.contains('?')) {
        let (default_choice, suggested) = if last_line.contains("[Y/n]") || last_line.contains("(Y/n)") {
            (Some("y".to_string()), vec!["y".to_string(), "n".to_string()])
        } else if last_line.contains("[y/N]") || last_line.contains("(y/N)") {
            (Some("n".to_string()), vec!["y".to_string(), "n".to_string()])
        } else if lower.contains("yes/no") {
            (Some("yes".to_string()), vec!["yes".to_string(), "no".to_string()])
        } else {
            (Some("y".to_string()), vec!["y".to_string(), "n".to_string()])
        };

        return Some(BlockedPromptInfo {
            session_id: session_id.to_string(),
            prompt_text: last_line.to_string(),
            prompt_type: PromptType::YesNo,
            default_choice,
            suggested_options: suggested,
            timestamp: now_ms(),
        });
    }

    // 3. Deteção de Prompts de Confirmação Genéricos (Enter / Input)
    if lower.contains("press enter to continue")
        || lower.contains("press [enter] to continue")
        || lower.contains("press any key to continue")
    {
        return Some(BlockedPromptInfo {
            session_id: session_id.to_string(),
            prompt_text: last_line.to_string(),
            prompt_type: PromptType::Input,
            default_choice: Some("Enter".to_string()),
            suggested_options: vec!["Enter".to_string()],
            timestamp: now_ms(),
        });
    }

    // Prompts interativos de CLI estilo `? Select a framework: ` ou `? Project name: `
    if last_line.starts_with('?') && (last_line.contains(':') || last_line.contains('›')) {
        return Some(BlockedPromptInfo {
            session_id: session_id.to_string(),
            prompt_text: last_line.to_string(),
            prompt_type: PromptType::Input,
            default_choice: None,
            suggested_options: vec![],
            timestamp: now_ms(),
        });
    }

    None
}

/// Gestor thread-safe de deteção de inatividade, hibernação de PTYs e prompts bloqueados.
pub struct IdleDetector {
    sessions: Mutex<HashMap<String, SessionTracking>>,
    standby_timeout_ms: u64,
}

pub type IdleDetectorState = Arc<IdleDetector>;

impl Default for IdleDetector {
    fn default() -> Self {
        Self::new()
    }
}

impl IdleDetector {
    /// Cria uma nova instância do detetor com tempo limite padrão de 30 segundos de inatividade.
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            standby_timeout_ms: 30_000,
        }
    }

    /// Processa um novo chunk de saída recebido pelo leitor PTY.
    pub fn process_chunk(&self, session_id: &str, chunk: &str, app_handle: &AppHandle) {
        let detected = detect_prompt_heuristic(chunk, session_id);
        let now = now_ms();

        let mut sessions = match self.sessions.lock() {
            Ok(s) => s,
            Err(_) => return,
        };

        let tracking = sessions.entry(session_id.to_string()).or_insert_with(|| SessionTracking {
            state: SessionIdleState::Active,
            blocked_prompt: None,
            last_active_at: now,
            recent_tail: String::new(),
        });

        tracking.last_active_at = now;
        tracking.recent_tail = chunk.chars().take(256).collect();

        if let Some(prompt) = detected {
            let was_already_blocked = tracking.state == SessionIdleState::Blocked
                && tracking
                    .blocked_prompt
                    .as_ref()
                    .map(|p| p.prompt_text == prompt.prompt_text)
                    .unwrap_or(false);

            tracking.state = SessionIdleState::Blocked;
            tracking.blocked_prompt = Some(prompt.clone());

            // Emite evento IPC e notificação nativa apenas se for um bloqueio novo
            if !was_already_blocked {
                let _ = app_handle.emit("pty-blocked-prompt", &prompt);

                let sub = format!("Terminal [{}] à espera de confirmação", session_id);
                let _ = send_macos_notification(
                    "HelmADE • Ação Necessária",
                    Some(&sub),
                    &prompt.prompt_text,
                    true,
                );
            }
        } else if tracking.state == SessionIdleState::Blocked {
            // Se já estava bloqueado mas o novo chunk não é um prompt e tem quebras de linha normais,
            // significa que o processo avançou
            let clean = strip_ansi(chunk);
            if clean.contains('\n') {
                tracking.state = SessionIdleState::Active;
                tracking.blocked_prompt = None;
                let _ = app_handle.emit("pty-blocked-cleared", serde_json::json!({ "sessionId": session_id }));
            }
        } else if tracking.state == SessionIdleState::Standby {
            // Sai do standby automaticamente ao receber nova saída
            tracking.state = SessionIdleState::Active;
            let _ = app_handle.emit("pty-standby-changed", serde_json::json!({
                "sessionId": session_id,
                "state": "active",
                "isStandby": false
            }));
        }
    }

    /// Notifica que o utilizador ou um agente enviou dados de entrada para o PTY.
    pub fn notify_input(&self, session_id: &str, app_handle: &AppHandle) {
        let now = now_ms();
        let mut sessions = match self.sessions.lock() {
            Ok(s) => s,
            Err(_) => return,
        };

        if let Some(tracking) = sessions.get_mut(session_id) {
            tracking.last_active_at = now;

            if tracking.state == SessionIdleState::Blocked {
                tracking.state = SessionIdleState::Active;
                tracking.blocked_prompt = None;
                let _ = app_handle.emit("pty-blocked-cleared", serde_json::json!({ "sessionId": session_id }));
            } else if tracking.state == SessionIdleState::Standby {
                tracking.state = SessionIdleState::Active;
                let _ = app_handle.emit("pty-standby-changed", serde_json::json!({
                    "sessionId": session_id,
                    "state": "active",
                    "isStandby": false
                }));
            }
        } else {
            sessions.insert(session_id.to_string(), SessionTracking {
                state: SessionIdleState::Active,
                blocked_prompt: None,
                last_active_at: now,
                recent_tail: String::new(),
            });
        }
    }

    /// Responde explicitamente ao prompt bloqueado e desativa o estado de alerta.
    pub fn respond_to_prompt(&self, session_id: &str, app_handle: &AppHandle) {
        let mut sessions = match self.sessions.lock() {
            Ok(s) => s,
            Err(_) => return,
        };

        if let Some(tracking) = sessions.get_mut(session_id) {
            tracking.state = SessionIdleState::Active;
            tracking.blocked_prompt = None;
            tracking.last_active_at = now_ms();
            let _ = app_handle.emit("pty-blocked-cleared", serde_json::json!({ "sessionId": session_id }));
        }
    }

    /// Define manualmente o estado de standby/hibernação de uma sessão PTY.
    pub fn set_standby(&self, session_id: &str, standby: bool, app_handle: &AppHandle) {
        let mut sessions = match self.sessions.lock() {
            Ok(s) => s,
            Err(_) => return,
        };

        let now = now_ms();
        let tracking = sessions.entry(session_id.to_string()).or_insert_with(|| SessionTracking {
            state: SessionIdleState::Active,
            blocked_prompt: None,
            last_active_at: now,
            recent_tail: String::new(),
        });

        tracking.state = if standby {
            SessionIdleState::Standby
        } else {
            SessionIdleState::Active
        };

        let _ = app_handle.emit("pty-standby-changed", serde_json::json!({
            "sessionId": session_id,
            "state": if standby { "standby" } else { "active" },
            "isStandby": standby
        }));
    }

    /// Obtém o estado completo de inatividade de uma sessão.
    pub fn get_session_status(&self, session_id: &str) -> SessionStatusPayload {
        let sessions = match self.sessions.lock() {
            Ok(s) => s,
            Err(_) => {
                return SessionStatusPayload {
                    session_id: session_id.to_string(),
                    state: SessionIdleState::Active,
                    blocked_prompt: None,
                    last_active_at: now_ms(),
                }
            }
        };

        if let Some(tracking) = sessions.get(session_id) {
            SessionStatusPayload {
                session_id: session_id.to_string(),
                state: tracking.state,
                blocked_prompt: tracking.blocked_prompt.clone(),
                last_active_at: tracking.last_active_at,
            }
        } else {
            SessionStatusPayload {
                session_id: session_id.to_string(),
                state: SessionIdleState::Active,
                blocked_prompt: None,
                last_active_at: now_ms(),
            }
        }
    }

    /// Retorna a lista de status de todas as sessões registadas.
    pub fn list_all_sessions(&self) -> Vec<SessionStatusPayload> {
        let sessions = match self.sessions.lock() {
            Ok(s) => s,
            Err(_) => return vec![],
        };

        sessions
            .iter()
            .map(|(id, t)| SessionStatusPayload {
                session_id: id.clone(),
                state: t.state,
                blocked_prompt: t.blocked_prompt.clone(),
                last_active_at: t.last_active_at,
            })
            .collect()
    }

    /// Varredura periódica de inatividade para colocar terminais ociosos em standby.
    pub fn sweep_idle_standby(&self, app_handle: &AppHandle) {
        let now = now_ms();
        let timeout = self.standby_timeout_ms;

        let mut to_standby = Vec::new();
        if let Ok(mut sessions) = self.sessions.lock() {
            for (id, tracking) in sessions.iter_mut() {
                if tracking.state == SessionIdleState::Active
                    && now.saturating_sub(tracking.last_active_at) > timeout
                {
                    tracking.state = SessionIdleState::Standby;
                    to_standby.push(id.clone());
                }
            }
        }

        for id in to_standby {
            let _ = app_handle.emit("pty-standby-changed", serde_json::json!({
                "sessionId": id,
                "state": "standby",
                "isStandby": true
            }));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_yes_no_brackets() {
        let chunk1 = "Do you want to continue? [Y/n] ";
        let p1 = detect_prompt_heuristic(chunk1, "sess-1").expect("deve detetar [Y/n]");
        assert_eq!(p1.prompt_type, PromptType::YesNo);
        assert_eq!(p1.default_choice, Some("y".to_string()));
        assert_eq!(p1.suggested_options, vec!["y", "n"]);

        let chunk2 = "Proceed with deployment? [y/N]";
        let p2 = detect_prompt_heuristic(chunk2, "sess-2").expect("deve detetar [y/N]");
        assert_eq!(p2.prompt_type, PromptType::YesNo);
        assert_eq!(p2.default_choice, Some("n".to_string()));

        let chunk3 = "Are you sure you want to continue connecting (yes/no/[fingerprint])? ";
        let p3 = detect_prompt_heuristic(chunk3, "sess-3").expect("deve detetar (yes/no)");
        assert_eq!(p3.prompt_type, PromptType::YesNo);
        assert_eq!(p3.suggested_options, vec!["yes", "no"]);
    }

    #[test]
    fn test_detect_password_prompts() {
        let chunk1 = "[sudo] password for dev: ";
        let p1 = detect_prompt_heuristic(chunk1, "sess-pass-1").expect("deve detetar sudo password");
        assert_eq!(p1.prompt_type, PromptType::Password);
        assert!(p1.default_choice.is_none());

        let chunk2 = "Enter passphrase for key '/Users/simaosousa/.ssh/id_rsa': ";
        let p2 = detect_prompt_heuristic(chunk2, "sess-pass-2").expect("deve detetar passphrase");
        assert_eq!(p2.prompt_type, PromptType::Password);

        let chunk3 = "Password: ";
        let p3 = detect_prompt_heuristic(chunk3, "sess-pass-3").expect("deve detetar Password:");
        assert_eq!(p3.prompt_type, PromptType::Password);
    }

    #[test]
    fn test_detect_input_prompts() {
        let chunk1 = "Press Enter to continue...";
        let p1 = detect_prompt_heuristic(chunk1, "sess-input-1").expect("deve detetar Press Enter");
        assert_eq!(p1.prompt_type, PromptType::Input);
        assert_eq!(p1.default_choice, Some("Enter".to_string()));

        let chunk2 = "? Select a framework: › Vue";
        let p2 = detect_prompt_heuristic(chunk2, "sess-input-2").expect("deve detetar prompt de CLI");
        assert_eq!(p2.prompt_type, PromptType::Input);
    }

    #[test]
    fn test_ansi_escape_sequences_stripping_and_detection() {
        let ansi_chunk = "\x1b[33m? Overwrite existing file?\x1b[0m \x1b[36m[y/N]\x1b[0m ";
        let prompt = detect_prompt_heuristic(ansi_chunk, "sess-ansi").expect("deve detetar mesmo com ANSI");
        assert_eq!(prompt.prompt_type, PromptType::YesNo);
        assert_eq!(prompt.default_choice, Some("n".to_string()));
    }

    #[test]
    fn test_false_positive_rejection() {
        // Compilador logs
        assert!(detect_prompt_heuristic("Compiling y/n v0.1.0\n", "sess-neg").is_none());
        assert!(detect_prompt_heuristic("Finished dev [unoptimized + debuginfo] target(s)\n", "sess-neg").is_none());

        // Log regular
        assert!(detect_prompt_heuristic("[INFO] User responded with [y/n]\n", "sess-neg").is_none());

        // Texto em linha normal terminada
        assert!(detect_prompt_heuristic("echo 'all tests ok'\n", "sess-neg").is_none());
    }

    #[test]
    fn test_idle_detector_state_lifecycle() {
        let detector = IdleDetector::new();
        let status = detector.get_session_status("test-sess");
        assert_eq!(status.state, SessionIdleState::Active);
        assert!(status.blocked_prompt.is_none());
    }
}
