use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

/// Sender id used for prompts typed by the human in the cockpit.
pub const HUMAN_SENDER_ID: &str = "user";
/// Recipient id of a broadcast.
pub const BROADCAST_RECIPIENT_ID: &str = "all";
pub const MAX_CONTENT_BYTES: usize = 16 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum A2AMessageType {
    Task,
    Report,
    Query,
    Response,
    Error,
    Broadcast,
}

impl A2AMessageType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Task => "task",
            Self::Report => "report",
            Self::Query => "query",
            Self::Response => "response",
            Self::Error => "error",
            Self::Broadcast => "broadcast",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        Some(match value {
            "task" => Self::Task,
            "report" => Self::Report,
            "query" => Self::Query,
            "response" => Self::Response,
            "error" => Self::Error,
            "broadcast" => Self::Broadcast,
            _ => return None,
        })
    }
}

/// A message exchanged inside one swarm, as shown in Team Wire.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct A2AMessage {
    pub id: String,
    pub swarm_id: String,
    pub sender_id: String,
    pub sender_name: String,
    pub sender_role: Option<String>,
    pub recipient_id: String,
    pub recipient_name: String,
    pub content: String,
    pub message_type: A2AMessageType,
    pub timestamp: i64,
}

pub fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn next_message_id() -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(1);
    format!(
        "a2a-{:x}-{:x}",
        now_millis(),
        COUNTER.fetch_add(1, Ordering::Relaxed)
    )
}

/// Strips control characters (terminal escape injection) and enforces the size limit.
/// Newlines and tabs are kept.
pub fn sanitize_content(raw: &str) -> Result<String, String> {
    let cleaned: String = raw
        .chars()
        .filter(|c| !c.is_control() || matches!(c, '\n' | '\t'))
        .collect();
    let trimmed = cleaned.trim();
    if trimmed.is_empty() {
        return Err("A mensagem está vazia".to_string());
    }
    if trimmed.len() > MAX_CONTENT_BYTES {
        return Err("A mensagem excede o limite de 16 KB".to_string());
    }
    Ok(trimmed.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn message_serializes_in_camel_case_with_lowercase_type() {
        let message = A2AMessage {
            id: "a2a-1".into(),
            swarm_id: "s1".into(),
            sender_id: "orchestrator".into(),
            sender_name: "Orchestrator".into(),
            sender_role: Some("architect".into()),
            recipient_id: "frontend".into(),
            recipient_name: "Frontend".into(),
            content: "hello".into(),
            message_type: A2AMessageType::Task,
            timestamp: 42,
        };
        let json = serde_json::to_value(&message).expect("serializable");
        assert_eq!(json["swarmId"], "s1");
        assert_eq!(json["senderName"], "Orchestrator");
        assert_eq!(json["messageType"], "task");
        let back: A2AMessage = serde_json::from_value(json).expect("round trip");
        assert_eq!(back, message);
    }

    #[test]
    fn sanitize_content_strips_escape_sequences_and_rejects_empty() {
        assert_eq!(
            sanitize_content("  run \x1b[31mtests\x1b[0m\x07\nnow\t!  ").expect("valid"),
            "run [31mtests[0m\nnow\t!"
        );
        assert!(sanitize_content(" \x1b\x00 ").is_err());
        assert!(sanitize_content(&"x".repeat(MAX_CONTENT_BYTES + 1)).is_err());
    }

    #[test]
    fn message_ids_are_unique() {
        assert_ne!(next_message_id(), next_message_id());
    }

    #[test]
    fn message_type_round_trips_through_its_string_form() {
        for kind in [
            A2AMessageType::Task,
            A2AMessageType::Report,
            A2AMessageType::Query,
            A2AMessageType::Response,
            A2AMessageType::Error,
            A2AMessageType::Broadcast,
        ] {
            assert_eq!(A2AMessageType::parse(kind.as_str()), Some(kind));
        }
        assert_eq!(A2AMessageType::parse("nope"), None);
    }
}
