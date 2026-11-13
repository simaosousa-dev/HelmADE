use tauri::State;

use super::project::DbHandle;
use crate::agents::protocol::A2AMessage;
use crate::agents::router::{Delivery, MessageRouterState, OutgoingMessage, Peer};
use crate::error::HelmResult;
use crate::security::ShieldHandle;

/// Sends a message through the router: recorded, shown in Team Wire and delivered
/// to the recipient's terminal. The same path the `helmade` CLI uses.
#[tauri::command]
pub fn send_a2a_message(
    delivery: State<'_, Delivery>,
    message: OutgoingMessage,
) -> HelmResult<A2AMessage> {
    delivery.deliver(message)
}

/// Persisted Team Wire history of a swarm, oldest first.
#[tauri::command]
pub fn get_a2a_history(
    db: State<'_, DbHandle>,
    shield: State<'_, ShieldHandle>,
    swarm_id: String,
    limit: Option<usize>,
) -> HelmResult<Vec<A2AMessage>> {
    let mut messages = db.list_a2a_messages(&swarm_id, limit.unwrap_or(200).min(1000))?;
    for message in &mut messages {
        message.content = shield.apply(&message.content);
    }
    Ok(messages)
}

/// Declares who is in a swarm so messages can be addressed and delivered.
#[tauri::command]
pub fn register_swarm_peers(
    router: State<'_, MessageRouterState>,
    swarm_id: String,
    peers: Vec<Peer>,
) -> HelmResult<()> {
    router.set_peers(&swarm_id, peers)
}
