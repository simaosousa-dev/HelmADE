use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Tipos de mensagem suportados pelo protocolo de comunicação A2A (Agent-to-Agent).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum A2AMessageType {
    TaskDelegation,
    StatusUpdate,
    ToolResult,
    PromptInjection,
    Broadcast,
}

/// Representação normalizada de uma mensagem trocada entre agentes/terminais.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct A2AMessage {
    pub id: String,
    pub sender_id: String,
    pub recipient_id: String,
    pub conversation_id: Option<String>,
    pub message_type: A2AMessageType,
    pub content: String,
    pub timestamp: i64,
    #[serde(default)]
    pub metadata: HashMap<String, serde_json::Value>,
}

impl A2AMessage {
    /// Construtor helper para novas mensagens com validação de campos essenciais.
    pub fn new(
        sender_id: impl Into<String>,
        recipient_id: impl Into<String>,
        message_type: A2AMessageType,
        content: impl Into<String>,
    ) -> Self {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);

        Self {
            id: generate_message_id(),
            sender_id: sender_id.into(),
            recipient_id: recipient_id.into(),
            conversation_id: None,
            message_type,
            content: content.into(),
            timestamp,
            metadata: HashMap::new(),
        }
    }

    /// Valida se a mensagem possui os parâmetros mínimos exigidos.
    pub fn validate(&self) -> Result<(), String> {
        if self.id.trim().is_empty() {
            return Err("O id da mensagem A2A não pode ser vazio".to_string());
        }
        if self.sender_id.trim().is_empty() {
            return Err("O sender_id da mensagem A2A não pode ser vazio".to_string());
        }
        if self.recipient_id.trim().is_empty() {
            return Err("O recipient_id da mensagem A2A não pode ser vazio".to_string());
        }
        Ok(())
    }

    /// Retorna se a mensagem é endereçada como broadcast geral ("*").
    pub fn is_broadcast(&self) -> bool {
        self.recipient_id == "*" || self.message_type == A2AMessageType::Broadcast
    }
}

/// Gera um identificador único para a mensagem (baseado em timestamp monotónico + contador aleatório/nanos).
fn generate_message_id() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(1);
    let count = COUNTER.fetch_add(1, Ordering::Relaxed);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("a2a-{:x}-{:x}", now, count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_a2a_message_serialization() {
        let mut msg = A2AMessage::new(
            "agent-alpha",
            "agent-beta",
            A2AMessageType::TaskDelegation,
            "Executar tarefa 3.3",
        );
        msg.conversation_id = Some("conv-123".to_string());
        msg.metadata.insert("priority".to_string(), serde_json::json!("high"));

        let serialized = serde_json::to_string(&msg).expect("Falha ao serializar A2AMessage");
        let deserialized: A2AMessage = serde_json::from_str(&serialized).expect("Falha ao desserializar A2AMessage");

        assert_eq!(msg.id, deserialized.id);
        assert_eq!(msg.sender_id, deserialized.sender_id);
        assert_eq!(msg.recipient_id, deserialized.recipient_id);
        assert_eq!(msg.message_type, deserialized.message_type);
        assert_eq!(msg.content, deserialized.content);
        assert_eq!(msg.conversation_id, deserialized.conversation_id);
        assert_eq!(deserialized.metadata.get("priority").unwrap(), "high");
        assert!(!deserialized.is_broadcast());
    }

    #[test]
    fn test_a2a_broadcast_flag() {
        let msg = A2AMessage::new("leader", "*", A2AMessageType::StatusUpdate, "Sync all");
        assert!(msg.is_broadcast());

        let msg2 = A2AMessage::new("worker", "agent-x", A2AMessageType::Broadcast, "All stop");
        assert!(msg2.is_broadcast());
    }

    #[test]
    fn test_a2a_validation() {
        let mut msg = A2AMessage::new("", "recipient", A2AMessageType::ToolResult, "data");
        assert!(msg.validate().is_err());

        msg.sender_id = "sender".to_string();
        msg.recipient_id = "".to_string();
        assert!(msg.validate().is_err());

        msg.recipient_id = "target".to_string();
        assert!(msg.validate().is_ok());
    }
}
