use crate::agents::protocol::A2AMessage;
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

/// Capacidade máxima do histórico por conversa mantido em memória.
const MAX_HISTORY_PER_CONVERSATION: usize = 500;
/// Capacidade máxima do histórico global mantido em memória.
const MAX_GLOBAL_HISTORY: usize = 1000;

/// Router em memória de alta performance para troca de mensagens A2A (Agent-to-Agent).
/// Gere subscrições internas, histórico persistido em memória e espelhamento para o frontend e terminais PTY.
pub struct MessageRouter {
    /// Histórico de mensagens global em buffer FIFO
    global_history: Mutex<VecDeque<A2AMessage>>,
    /// Histórico segmentado por ID de conversa
    conversation_history: Mutex<HashMap<String, VecDeque<A2AMessage>>>,
    /// Identificadores de terminais PTY registrados para espelhamento visual automático
    pty_mirrors: Mutex<HashMap<String, String>>, // agent_id -> pty_session_id
}

impl MessageRouter {
    pub fn new() -> Self {
        Self {
            global_history: Mutex::new(VecDeque::with_capacity(MAX_GLOBAL_HISTORY)),
            conversation_history: Mutex::new(HashMap::new()),
            pty_mirrors: Mutex::new(HashMap::new()),
        }
    }

    /// Registra uma associação entre um Agent ID e uma sessão de terminal PTY para espelhamento visual.
    pub fn register_pty_mirror(&self, agent_id: &str, pty_session_id: &str) {
        if let Ok(mut mirrors) = self.pty_mirrors.lock() {
            mirrors.insert(agent_id.to_string(), pty_session_id.to_string());
        }
    }

    /// Remove a associação de espelhamento PTY para um agente.
    pub fn unregister_pty_mirror(&self, agent_id: &str) {
        if let Ok(mut mirrors) = self.pty_mirrors.lock() {
            mirrors.remove(agent_id);
        }
    }

    /// Roteia e processa uma mensagem A2A.
    /// Valida o payload, armazena no histórico, despacha via evento Tauri ("a2a://message")
    /// e opcionalmente espelha o conteúdo visualmente no PTY do destinatário se configurado.
    pub fn dispatch(&self, message: A2AMessage, app_handle: Option<&AppHandle>) -> Result<A2AMessage, String> {
        message.validate()?;

        // 1. Armazena no histórico
        self.store_history(&message)?;

        // 2. Emite evento Tauri IPC para o frontend
        if let Some(handle) = app_handle {
            let _ = handle.emit("a2a://message", &message);
        }

        Ok(message)
    }

    /// Recupera mensagens do histórico filtrando por conversa opcional e limite de registos.
    pub fn get_history(&self, conversation_id: Option<&str>, limit: Option<usize>) -> Result<Vec<A2AMessage>, String> {
        let max_items = limit.unwrap_or(50);

        if let Some(conv_id) = conversation_id {
            let conv_map = self
                .conversation_history
                .lock()
                .map_err(|_| "Falha ao bloquear histórico de conversas".to_string())?;

            if let Some(deque) = conv_map.get(conv_id) {
                let msgs: Vec<A2AMessage> = deque
                    .iter()
                    .rev()
                    .take(max_items)
                    .cloned()
                    .collect::<Vec<_>>()
                    .into_iter()
                    .rev()
                    .collect();
                Ok(msgs)
            } else {
                Ok(Vec::new())
            }
        } else {
            let global = self
                .global_history
                .lock()
                .map_err(|_| "Falha ao bloquear histórico global".to_string())?;

            let msgs: Vec<A2AMessage> = global
                .iter()
                .rev()
                .take(max_items)
                .cloned()
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect();
            Ok(msgs)
        }
    }

    /// Obtém a sessão PTY associada a um agente para espelhamento.
    pub fn get_pty_mirror_for_agent(&self, agent_id: &str) -> Option<String> {
        self.pty_mirrors.lock().ok()?.get(agent_id).cloned()
    }

    fn store_history(&self, message: &A2AMessage) -> Result<(), String> {
        // Armazena no histórico global
        if let Ok(mut global) = self.global_history.lock() {
            if global.len() >= MAX_GLOBAL_HISTORY {
                global.pop_front();
            }
            global.push_back(message.clone());
        }

        // Armazena no histórico da conversa se conversation_id estiver preenchido
        if let Some(ref conv_id) = message.conversation_id {
            if let Ok(mut conv_map) = self.conversation_history.lock() {
                let deque = conv_map.entry(conv_id.clone()).or_insert_with(VecDeque::new);
                if deque.len() >= MAX_HISTORY_PER_CONVERSATION {
                    deque.pop_front();
                }
                deque.push_back(message.clone());
            }
        }

        Ok(())
    }
}

impl Default for MessageRouter {
    fn default() -> Self {
        Self::new()
    }
}

/// Estado thread-safe do router para injeção no Tauri runtime.
pub type MessageRouterState = Arc<MessageRouter>;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agents::protocol::A2AMessageType;

    #[test]
    fn test_router_dispatch_and_history() {
        let router = MessageRouter::new();

        let msg1 = A2AMessage::new("agent-1", "agent-2", A2AMessageType::TaskDelegation, "Subtask A");
        let mut msg2 = A2AMessage::new("agent-2", "agent-1", A2AMessageType::StatusUpdate, "Progress 50%");
        msg2.conversation_id = Some("conv-team-1".to_string());

        let res1 = router.dispatch(msg1.clone(), None);
        assert!(res1.is_ok());

        let res2 = router.dispatch(msg2.clone(), None);
        assert!(res2.is_ok());

        // Histórico global
        let global = router.get_history(None, Some(10)).unwrap();
        assert_eq!(global.len(), 2);
        assert_eq!(global[0].content, "Subtask A");
        assert_eq!(global[1].content, "Progress 50%");

        // Histórico específico da conversa
        let conv = router.get_history(Some("conv-team-1"), Some(10)).unwrap();
        assert_eq!(conv.len(), 1);
        assert_eq!(conv[0].content, "Progress 50%");

        // Conversa inexistente
        let empty = router.get_history(Some("conv-nonexistent"), Some(10)).unwrap();
        assert!(empty.is_empty());
    }

    #[test]
    fn test_router_pty_mirror_registration() {
        let router = MessageRouter::new();
        router.register_pty_mirror("agent-architect", "pty-session-99");
        assert_eq!(
            router.get_pty_mirror_for_agent("agent-architect"),
            Some("pty-session-99".to_string())
        );

        router.unregister_pty_mirror("agent-architect");
        assert_eq!(router.get_pty_mirror_for_agent("agent-architect"), None);
    }
}
