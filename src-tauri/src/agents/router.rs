//! In-memory A2A router: who is in each swarm, and delivery of messages to their terminals.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use super::protocol::{
    next_message_id, now_millis, sanitize_content, A2AMessage, A2AMessageType,
    BROADCAST_RECIPIENT_ID, HUMAN_SENDER_ID,
};
use crate::db::DbState;
use crate::error::{HelmError, HelmResult};
use crate::security::ShieldState;
use crate::terminal::PtyManager;

const MAX_HISTORY_PER_SWARM: usize = 500;
/// Agent TUIs need a beat between receiving text and the Enter that submits it.
const SUBMIT_DELAY: Duration = Duration::from_millis(120);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PeerKind {
    /// An agent CLI owns the terminal: messages are typed into it as prompts.
    Agent,
    /// A plain shell: messages from agents are only displayed, never executed.
    Shell,
}

/// A panel of a swarm that can send and receive messages.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Peer {
    /// Panel key, unique inside the swarm.
    pub id: String,
    pub name: String,
    pub role: Option<String>,
    /// Persona id (e.g. `qa-security-auditor`), accepted as an alias when addressing.
    pub agent_id: Option<String>,
    pub session_id: String,
    pub kind: PeerKind,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutgoingMessage {
    pub swarm_id: String,
    /// Panel key of the sender, or `user` for the human.
    pub sender_id: String,
    /// Panel key, persona id, panel title, `orchestrator` or `all`.
    pub recipient: String,
    pub content: String,
    pub message_type: Option<A2AMessageType>,
}

pub type EventEmitter = Arc<dyn Fn(&str, serde_json::Value) + Send + Sync>;

#[derive(Default)]
pub struct MessageRouter {
    peers: Mutex<HashMap<String, Vec<Peer>>>,
    history: Mutex<HashMap<String, VecDeque<A2AMessage>>>,
}

pub type MessageRouterState = Arc<MessageRouter>;

fn matches_alias(peer: &Peer, target: &str) -> bool {
    peer.id.eq_ignore_ascii_case(target)
        || peer.name.eq_ignore_ascii_case(target)
        || peer
            .agent_id
            .as_deref()
            .is_some_and(|agent_id| agent_id.eq_ignore_ascii_case(target))
}

impl MessageRouter {
    pub fn new() -> Self {
        Self::default()
    }

    /// Replaces the roster of a swarm (called on launch, restore and panel changes).
    pub fn set_peers(&self, swarm_id: &str, peers: Vec<Peer>) -> HelmResult<()> {
        self.peers.lock()?.insert(swarm_id.to_string(), peers);
        Ok(())
    }

    pub fn remove_swarm(&self, swarm_id: &str) -> HelmResult<()> {
        self.peers.lock()?.remove(swarm_id);
        self.history.lock()?.remove(swarm_id);
        Ok(())
    }

    pub fn peers(&self, swarm_id: &str) -> Vec<Peer> {
        self.peers
            .lock()
            .ok()
            .and_then(|map| map.get(swarm_id).cloned())
            .unwrap_or_default()
    }

    /// Resolves an address to the peers that should receive the message.
    pub fn resolve_recipients(
        &self,
        swarm_id: &str,
        sender_id: &str,
        recipient: &str,
    ) -> HelmResult<Vec<Peer>> {
        let roster = self.peers(swarm_id);
        if roster.is_empty() {
            return Err(HelmError::not_found("Este enxame não tem agentes ativos"));
        }
        let target = recipient.trim().trim_start_matches('@');

        if matches!(target, "all" | "*") {
            return Ok(roster.into_iter().filter(|p| p.id != sender_id).collect());
        }
        if let Some(peer) = roster.iter().find(|p| matches_alias(p, target)) {
            return Ok(vec![peer.clone()]);
        }
        // `orchestrator` always resolves to the lead: the first agent panel of the swarm.
        if target.eq_ignore_ascii_case("orchestrator") {
            if let Some(lead) = roster.iter().find(|p| p.kind == PeerKind::Agent) {
                return Ok(vec![lead.clone()]);
            }
        }
        let known: Vec<&str> = roster.iter().map(|p| p.id.as_str()).collect();
        Err(HelmError::not_found(format!(
            "Destinatário desconhecido: {target}. Disponíveis: {}",
            known.join(", ")
        )))
    }

    fn record(&self, message: &A2AMessage) -> HelmResult<()> {
        let mut history = self.history.lock()?;
        let entries = history.entry(message.swarm_id.clone()).or_default();
        if entries.len() >= MAX_HISTORY_PER_SWARM {
            entries.pop_front();
        }
        entries.push_back(message.clone());
        Ok(())
    }

    /// Most recent messages of a swarm, oldest first.
    pub fn history(&self, swarm_id: &str, limit: usize) -> Vec<A2AMessage> {
        let Ok(history) = self.history.lock() else {
            return Vec::new();
        };
        let Some(entries) = history.get(swarm_id) else {
            return Vec::new();
        };
        let skip = entries.len().saturating_sub(limit);
        entries.iter().skip(skip).cloned().collect()
    }

    /// Messages addressed to `agent_id` (directly or by broadcast), oldest first.
    pub fn inbox(&self, swarm_id: &str, agent_id: &str, limit: usize) -> Vec<A2AMessage> {
        let all = self.history(swarm_id, MAX_HISTORY_PER_SWARM);
        let mine: Vec<A2AMessage> = all
            .into_iter()
            .filter(|m| {
                m.sender_id != agent_id
                    && (m.recipient_id == agent_id || m.recipient_id == BROADCAST_RECIPIENT_ID)
            })
            .collect();
        let skip = mine.len().saturating_sub(limit);
        mine.into_iter().skip(skip).collect()
    }
}

/// Everything a delivery needs. Shared by the Tauri command and the socket server.
#[derive(Clone)]
pub struct Delivery {
    pub router: Arc<MessageRouter>,
    pub ptys: Arc<PtyManager>,
    pub db: Option<Arc<DbState>>,
    pub shield: Arc<ShieldState>,
    pub emit: EventEmitter,
}

/// Types `text` into a terminal and submits it with Enter after a short pause.
fn type_into_terminal(ptys: &Arc<PtyManager>, session_id: &str, text: &str) -> Result<(), String> {
    // Multi-line text goes in as one bracketed paste so inner newlines do not submit early.
    let payload = if text.contains('\n') {
        format!("\x1b[200~{text}\x1b[201~")
    } else {
        text.to_string()
    };
    ptys.write(session_id, &payload)?;

    let ptys = Arc::clone(ptys);
    let session_id = session_id.to_string();
    thread::spawn(move || {
        thread::sleep(SUBMIT_DELAY);
        if let Err(err) = ptys.write(&session_id, "\r") {
            eprintln!("[helmade] failed to submit A2A message: {err}");
        }
    });
    Ok(())
}

impl Delivery {
    fn sender_identity(&self, swarm_id: &str, sender_id: &str) -> HelmResult<(String, Option<String>)> {
        if sender_id == HUMAN_SENDER_ID {
            return Ok(("Utilizador".to_string(), Some("user".to_string())));
        }
        self.router
            .peers(swarm_id)
            .into_iter()
            .find(|p| p.id == sender_id)
            .map(|p| (p.name, p.role))
            .ok_or_else(|| HelmError::not_found("O remetente não pertence a este enxame"))
    }

    fn deliver_to_peer(&self, peer: &Peer, from_human: bool, sender_name: &str, content: &str) {
        let outcome = match (from_human, peer.kind) {
            // The human's prompt is typed verbatim, whatever runs in the panel.
            (true, _) => type_into_terminal(&self.ptys, &peer.session_id, content),
            (false, PeerKind::Agent) => type_into_terminal(
                &self.ptys,
                &peer.session_id,
                &format!("[A2A de @{sender_name}] {content}"),
            ),
            // Never let an agent execute text in someone else's shell: display only.
            (false, PeerKind::Shell) => {
                let line = format!(
                    "\r\n\x1b[36m\x1b[1m🠔 [{sender_name}]\x1b[0m {}\r\n",
                    self.shield.apply(content).replace('\n', "\r\n")
                );
                (self.emit)(
                    &format!("pty-output-{}", peer.session_id),
                    serde_json::Value::String(line),
                );
                Ok(())
            }
        };
        if let Err(err) = outcome {
            eprintln!("[helmade] A2A delivery to a terminal failed: {err}");
        }
    }

    /// Validates, records, announces and delivers a message.
    pub fn deliver(&self, outgoing: OutgoingMessage) -> HelmResult<A2AMessage> {
        let content = sanitize_content(&outgoing.content).map_err(HelmError::invalid)?;
        let (sender_name, sender_role) =
            self.sender_identity(&outgoing.swarm_id, &outgoing.sender_id)?;
        let recipients = self.router.resolve_recipients(
            &outgoing.swarm_id,
            &outgoing.sender_id,
            &outgoing.recipient,
        )?;
        if recipients.is_empty() {
            return Err(HelmError::not_found("Não há outros agentes neste enxame"));
        }

        let is_broadcast = matches!(outgoing.recipient.trim(), "all" | "*");
        let (recipient_id, recipient_name) = if is_broadcast {
            (BROADCAST_RECIPIENT_ID.to_string(), "Todos os agentes".to_string())
        } else {
            (recipients[0].id.clone(), recipients[0].name.clone())
        };
        let message = A2AMessage {
            id: next_message_id(),
            swarm_id: outgoing.swarm_id,
            sender_id: outgoing.sender_id,
            sender_name,
            sender_role,
            recipient_id,
            recipient_name,
            // What is stored and shown is shielded; the recipient still gets the original.
            content: self.shield.apply(&content),
            message_type: if is_broadcast {
                A2AMessageType::Broadcast
            } else {
                outgoing.message_type.unwrap_or(A2AMessageType::Task)
            },
            timestamp: now_millis(),
        };

        self.router.record(&message)?;
        if let Some(db) = &self.db {
            db.insert_a2a_message(&message)?;
        }
        match serde_json::to_value(&message) {
            Ok(payload) => (self.emit)("a2a://message", payload),
            Err(err) => eprintln!("[helmade] failed to serialize A2A message: {err}"),
        }

        let from_human = message.sender_id == HUMAN_SENDER_ID;
        for peer in &recipients {
            self.deliver_to_peer(peer, from_human, &message.sender_name, &content);
        }
        Ok(message)
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use crate::error::ErrorCode;
    use crate::security::ShieldConfig;
    use crate::terminal::manager::tests::{sh, wait_until};

    pub fn peer(id: &str, name: &str, kind: PeerKind) -> Peer {
        Peer {
            id: id.to_string(),
            name: name.to_string(),
            role: Some("fullstack".to_string()),
            agent_id: Some(format!("{id}-persona")),
            session_id: format!("sess-{id}"),
            kind,
        }
    }

    pub struct Harness {
        pub delivery: Delivery,
        pub events: Arc<Mutex<Vec<(String, serde_json::Value)>>>,
    }

    /// A router with real PTYs (running `cat`, so typed text is echoed back) behind it.
    pub fn harness(swarm_id: &str, peers: Vec<Peer>) -> Harness {
        let ptys = Arc::new(PtyManager::new());
        for p in &peers {
            let mut opts = sh(&p.session_id);
            opts.command = Some(vec!["/bin/cat".to_string()]);
            ptys.spawn(opts, None).expect("spawn cat");
        }
        let router = Arc::new(MessageRouter::new());
        router.set_peers(swarm_id, peers).expect("peers");
        let events = Arc::new(Mutex::new(Vec::new()));
        let sink = Arc::clone(&events);
        Harness {
            delivery: Delivery {
                router,
                ptys,
                db: None,
                shield: Arc::new(ShieldState::new(ShieldConfig::default(), None)),
                emit: Arc::new(move |event, payload| {
                    if let Ok(mut log) = sink.lock() {
                        log.push((event.to_string(), payload));
                    }
                }),
            },
            events,
        }
    }

    fn outgoing(sender: &str, recipient: &str, content: &str) -> OutgoingMessage {
        OutgoingMessage {
            swarm_id: "s1".to_string(),
            sender_id: sender.to_string(),
            recipient: recipient.to_string(),
            content: content.to_string(),
            message_type: None,
        }
    }

    fn scrollback_contains(h: &Harness, session: &str, needle: &str) -> bool {
        wait_until(Duration::from_secs(5), || {
            h.delivery
                .ptys
                .get_scrollback(session)
                .map(|s| s.contains(needle))
                .unwrap_or(false)
        })
    }

    #[test]
    fn agent_message_is_typed_into_the_recipient_agent_and_announced() {
        let h = harness(
            "s1",
            vec![
                peer("orchestrator", "Orchestrator", PeerKind::Agent),
                peer("frontend", "Frontend UI", PeerKind::Agent),
            ],
        );
        let message = h
            .delivery
            .deliver(outgoing("orchestrator", "frontend", "build the login form"))
            .expect("deliver");

        assert_eq!(message.recipient_id, "frontend");
        assert_eq!(message.sender_name, "Orchestrator");
        assert_eq!(message.message_type, A2AMessageType::Task);
        assert!(scrollback_contains(
            &h,
            "sess-frontend",
            "[A2A de @Orchestrator] build the login form"
        ));
        // The sender's own terminal is left alone.
        assert!(!h
            .delivery
            .ptys
            .get_scrollback("sess-orchestrator")
            .expect("scrollback")
            .contains("build the login form"));

        let events = h.events.lock().expect("events");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].0, "a2a://message");
        assert_eq!(events[0].1["content"], "build the login form");
        assert_eq!(h.delivery.router.history("s1", 10), vec![message]);
        h.delivery.ptys.kill_all();
    }

    #[test]
    fn agent_message_to_a_shell_is_displayed_but_never_executed() {
        let h = harness(
            "s1",
            vec![
                peer("orchestrator", "Orchestrator", PeerKind::Agent),
                peer("shell", "Dev Server", PeerKind::Shell),
            ],
        );
        h.delivery
            .deliver(outgoing("orchestrator", "shell", "rm -rf ~"))
            .expect("deliver");

        // Nothing reached the shell's stdin…
        thread::sleep(SUBMIT_DELAY * 3);
        assert!(!h
            .delivery
            .ptys
            .get_scrollback("sess-shell")
            .expect("scrollback")
            .contains("rm -rf"));
        // …it was only painted on the terminal.
        let events = h.events.lock().expect("events");
        let display = events
            .iter()
            .find(|(event, _)| event == "pty-output-sess-shell")
            .expect("display event");
        assert!(display.1.as_str().expect("text").contains("rm -rf ~"));
        h.delivery.ptys.kill_all();
    }

    #[test]
    fn human_prompt_is_typed_verbatim_and_broadcast_reaches_everyone_else() {
        let h = harness(
            "s1",
            vec![
                peer("a", "Agent A", PeerKind::Agent),
                peer("b", "Agent B", PeerKind::Agent),
                peer("sh", "Shell", PeerKind::Shell),
            ],
        );
        let direct = h
            .delivery
            .deliver(outgoing(HUMAN_SENDER_ID, "orchestrator", "ship it"))
            .expect("direct");
        assert_eq!(direct.recipient_id, "a", "orchestrator resolves to the lead agent");
        assert!(scrollback_contains(&h, "sess-a", "ship it"));
        assert!(!h
            .delivery
            .ptys
            .get_scrollback("sess-a")
            .expect("scrollback")
            .contains("[A2A de"));

        let broadcast = h
            .delivery
            .deliver(outgoing(HUMAN_SENDER_ID, "all", "stop everything"))
            .expect("broadcast");
        assert_eq!(broadcast.recipient_id, BROADCAST_RECIPIENT_ID);
        assert_eq!(broadcast.message_type, A2AMessageType::Broadcast);
        for session in ["sess-a", "sess-b", "sess-sh"] {
            assert!(scrollback_contains(&h, session, "stop everything"), "{session}");
        }
        h.delivery.ptys.kill_all();
    }

    #[test]
    fn broadcast_from_an_agent_skips_the_sender() {
        let h = harness(
            "s1",
            vec![
                peer("a", "Agent A", PeerKind::Agent),
                peer("b", "Agent B", PeerKind::Agent),
            ],
        );
        h.delivery.deliver(outgoing("a", "all", "status?")).expect("broadcast");
        assert!(scrollback_contains(&h, "sess-b", "[A2A de @Agent A] status?"));
        assert!(!h
            .delivery
            .ptys
            .get_scrollback("sess-a")
            .expect("scrollback")
            .contains("status?"));
        assert_eq!(h.delivery.router.inbox("s1", "b", 10).len(), 1);
        assert!(h.delivery.router.inbox("s1", "a", 10).is_empty());
        h.delivery.ptys.kill_all();
    }

    #[test]
    fn addressing_accepts_aliases_and_explains_unknown_recipients() {
        let h = harness("s1", vec![peer("qa", "QA & Integrity", PeerKind::Agent)]);
        for alias in ["qa", "QA", "@qa", "qa & integrity", "qa-persona"] {
            let resolved = h
                .delivery
                .router
                .resolve_recipients("s1", "x", alias)
                .expect(alias);
            assert_eq!(resolved[0].id, "qa");
        }
        let err = h
            .delivery
            .deliver(outgoing(HUMAN_SENDER_ID, "nobody", "hi"))
            .expect_err("unknown");
        assert_eq!(err.code, ErrorCode::NotFound);
        assert!(err.message.contains("qa"));

        let stranger = h.delivery.deliver(outgoing("ghost", "qa", "hi")).expect_err("stranger");
        assert_eq!(stranger.code, ErrorCode::NotFound);
        let empty = h.delivery.deliver(outgoing(HUMAN_SENDER_ID, "qa", "  ")).expect_err("empty");
        assert_eq!(empty.code, ErrorCode::InvalidInput);
        h.delivery.ptys.kill_all();
    }

    #[test]
    fn team_wire_copy_is_shielded_but_the_recipient_gets_the_original() {
        let h = harness(
            "s1",
            vec![
                peer("a", "Agent A", PeerKind::Agent),
                peer("b", "Agent B", PeerKind::Agent),
            ],
        );
        let secret = format!("ghp_{}", "Zx9K".repeat(9));
        let message = h
            .delivery
            .deliver(outgoing("a", "b", &format!("use token {secret}")))
            .expect("deliver");
        assert!(!message.content.contains(&secret));
        assert!(scrollback_contains(&h, "sess-b", &secret));
        h.delivery.ptys.kill_all();
    }

    #[test]
    fn history_is_bounded_and_scoped_per_swarm() {
        let router = MessageRouter::new();
        for i in 0..(MAX_HISTORY_PER_SWARM + 20) {
            router
                .record(&A2AMessage {
                    id: format!("m{i}"),
                    swarm_id: "s1".into(),
                    sender_id: "a".into(),
                    sender_name: "A".into(),
                    sender_role: None,
                    recipient_id: "b".into(),
                    recipient_name: "B".into(),
                    content: "x".into(),
                    message_type: A2AMessageType::Task,
                    timestamp: i as i64,
                })
                .expect("record");
        }
        let history = router.history("s1", 1000);
        assert_eq!(history.len(), MAX_HISTORY_PER_SWARM);
        assert_eq!(history[0].id, "m20");
        assert!(router.history("other", 10).is_empty());
        router.remove_swarm("s1").expect("remove");
        assert!(router.history("s1", 10).is_empty());
    }
}
