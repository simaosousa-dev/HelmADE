use crate::agents::protocol::A2AMessage;
use crate::agents::router::MessageRouterState;
use crate::commands::terminal::PtyState;
use tauri::{AppHandle, State};

/// Despacha uma mensagem A2A através do router, emite o evento IPC "a2a://message"
/// e opcionalmente espelha o conteúdo visualmente no PTY de destino se configurado.
#[tauri::command]
pub fn send_a2a_message(
    router_state: State<MessageRouterState>,
    pty_state: State<PtyState>,
    app_handle: AppHandle,
    payload: A2AMessage,
    mirror_to_pty: Option<bool>,
) -> Result<A2AMessage, String> {
    // 1. Processa e despacha a mensagem via MessageRouter
    let dispatched = router_state.dispatch(payload, Some(&app_handle))?;

    // 2. Se o espelhamento visual no PTY estiver solicitado (ou se houver mirror registado)
    let should_mirror = mirror_to_pty.unwrap_or(false);
    if should_mirror {
        if let Some(pty_session_id) = router_state.get_pty_mirror_for_agent(&dispatched.recipient_id) {
            let mirror_text = format!(
                "\r\n\x1b[36m[A2A Message from @{}]\x1b[0m {}\r\n",
                dispatched.sender_id, dispatched.content
            );
            let _ = pty_state.write(&pty_session_id, &mirror_text);
        }
    }

    Ok(dispatched)
}

/// Recupera o histórico de mensagens A2A (global ou filtrado por ID de conversa).
#[tauri::command]
pub fn get_a2a_history(
    router_state: State<MessageRouterState>,
    conversation_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<A2AMessage>, String> {
    router_state.get_history(conversation_id.as_deref(), limit)
}

/// Regista o mapeamento entre um agente e uma sessão PTY para espelhamento visual no terminal.
#[tauri::command]
pub fn register_a2a_pty_mirror(
    router_state: State<MessageRouterState>,
    agent_id: String,
    pty_session_id: String,
) -> Result<(), String> {
    if agent_id.trim().is_empty() || pty_session_id.trim().is_empty() {
        return Err("agent_id e pty_session_id não podem ser vazios".to_string());
    }
    router_state.register_pty_mirror(&agent_id, &pty_session_id);
    Ok(())
}

/// Remove o registo de espelhamento visual no terminal para um agente.
#[tauri::command]
pub fn unregister_a2a_pty_mirror(
    router_state: State<MessageRouterState>,
    agent_id: String,
) -> Result<(), String> {
    router_state.unregister_pty_mirror(&agent_id);
    Ok(())
}
