//! Local channel through which an agent CLI process reaches the router.
//!
//! A Unix domain socket (owner-only) speaking one JSON request line and one JSON
//! response line per connection. The `helmade` CLI is the client.

use serde::Deserialize;
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Read, Write};
use std::os::unix::fs::PermissionsExt;
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;

use super::protocol::A2AMessageType;
use super::router::{Delivery, OutgoingMessage};

/// A request line may carry a 16 KB message plus JSON escaping overhead.
const MAX_REQUEST_BYTES: u64 = 64 * 1024;
const IO_TIMEOUT: Duration = Duration::from_secs(5);
/// macOS limits `sun_path` to 104 bytes.
const MAX_SOCKET_PATH_BYTES: usize = 100;
const DEFAULT_INBOX_LIMIT: usize = 20;

#[derive(Debug, Deserialize)]
#[serde(tag = "op", rename_all = "lowercase", rename_all_fields = "camelCase")]
enum Request {
    Send {
        swarm_id: String,
        from: String,
        to: String,
        content: String,
        #[serde(rename = "type")]
        kind: Option<A2AMessageType>,
    },
    Peers {
        swarm_id: String,
    },
    Inbox {
        swarm_id: String,
        agent: String,
        limit: Option<usize>,
    },
}

/// Per-process socket path, short enough for `sun_path` even with a long `HELMADE_HOME`.
pub fn socket_path() -> PathBuf {
    let name = format!("helmade-{}.sock", std::process::id());
    let preferred = crate::paths::run_dir().join(&name);
    if preferred.as_os_str().len() <= MAX_SOCKET_PATH_BYTES {
        return preferred;
    }
    std::env::temp_dir().join(name)
}

/// Handles one request line and returns the response document.
pub fn handle_request(delivery: &Delivery, line: &str) -> Value {
    let request: Request = match serde_json::from_str(line) {
        Ok(request) => request,
        Err(_) => return json!({ "ok": false, "error": "Pedido inválido" }),
    };
    match request {
        Request::Send {
            swarm_id,
            from,
            to,
            content,
            kind,
        } => {
            let outgoing = OutgoingMessage {
                swarm_id,
                sender_id: from,
                recipient: to,
                content,
                message_type: kind,
            };
            match delivery.deliver(outgoing) {
                Ok(message) => json!({ "ok": true, "data": message }),
                Err(err) => json!({ "ok": false, "error": err.message }),
            }
        }
        Request::Peers { swarm_id } => {
            json!({ "ok": true, "data": delivery.router.peers(&swarm_id) })
        }
        Request::Inbox {
            swarm_id,
            agent,
            limit,
        } => {
            let limit = limit.unwrap_or(DEFAULT_INBOX_LIMIT).min(200);
            json!({ "ok": true, "data": delivery.router.inbox(&swarm_id, &agent, limit) })
        }
    }
}

fn serve_connection(delivery: &Delivery, stream: UnixStream) -> std::io::Result<()> {
    stream.set_read_timeout(Some(IO_TIMEOUT))?;
    stream.set_write_timeout(Some(IO_TIMEOUT))?;
    let mut line = String::new();
    BufReader::new((&stream).take(MAX_REQUEST_BYTES)).read_line(&mut line)?;
    let response = handle_request(delivery, line.trim());
    let mut writer = &stream;
    writer.write_all(response.to_string().as_bytes())?;
    writer.write_all(b"\n")?;
    writer.flush()
}

/// Binds the socket and serves requests on background threads.
pub fn start(delivery: Delivery, path: &Path) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    if path.exists() {
        std::fs::remove_file(path)?;
    }
    let listener = UnixListener::bind(path)?;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))?;

    thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(stream) = stream else { continue };
            let delivery = delivery.clone();
            thread::spawn(move || {
                if let Err(err) = serve_connection(&delivery, stream) {
                    eprintln!("[helmade] A2A socket connection failed: {err}");
                }
            });
        }
    });
    Ok(())
}

/// Client side: sends one request and waits for the response.
pub fn request(path: &Path, payload: &Value) -> Result<Value, String> {
    let stream = UnixStream::connect(path)
        .map_err(|_| "Não foi possível ligar ao HelmADE (a aplicação está aberta?)".to_string())?;
    stream
        .set_read_timeout(Some(IO_TIMEOUT))
        .and_then(|_| stream.set_write_timeout(Some(IO_TIMEOUT)))
        .map_err(|e| format!("Falha ao configurar a ligação: {e}"))?;

    let mut writer = &stream;
    writer
        .write_all(format!("{payload}\n").as_bytes())
        .and_then(|_| writer.flush())
        .map_err(|e| format!("Falha ao enviar o pedido: {e}"))?;

    let mut line = String::new();
    BufReader::new((&stream).take(4 * 1024 * 1024))
        .read_line(&mut line)
        .map_err(|e| format!("Falha ao ler a resposta: {e}"))?;
    let response: Value =
        serde_json::from_str(line.trim()).map_err(|_| "Resposta inválida do HelmADE".to_string())?;

    if response["ok"].as_bool() != Some(true) {
        return Err(response["error"]
            .as_str()
            .unwrap_or("Pedido rejeitado")
            .to_string());
    }
    Ok(response["data"].clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agents::router::tests::{harness, peer};
    use crate::agents::router::PeerKind;
    use crate::terminal::manager::tests::wait_until;

    fn temp_socket(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!("hm-{label}-{}.sock", std::process::id()))
    }

    #[test]
    fn a_cli_process_can_send_list_peers_and_read_its_inbox() {
        let h = harness(
            "s1",
            vec![
                peer("orchestrator", "Orchestrator", PeerKind::Agent),
                peer("frontend", "Frontend UI", PeerKind::Agent),
            ],
        );
        let path = temp_socket("roundtrip");
        start(h.delivery.clone(), &path).expect("start");
        let mode = std::fs::metadata(&path).expect("metadata").permissions().mode();
        assert_eq!(mode & 0o777, 0o600, "socket must be owner-only");

        let sent = request(
            &path,
            &json!({ "op": "send", "swarmId": "s1", "from": "orchestrator", "to": "frontend", "content": "implement the navbar", "type": "task" }),
        )
        .expect("send");
        assert_eq!(sent["recipientId"], "frontend");
        assert!(wait_until(Duration::from_secs(5), || {
            h.delivery
                .ptys
                .get_scrollback("sess-frontend")
                .map(|s| s.contains("[A2A de @Orchestrator] implement the navbar"))
                .unwrap_or(false)
        }));

        let peers = request(&path, &json!({ "op": "peers", "swarmId": "s1" })).expect("peers");
        assert_eq!(peers.as_array().expect("array").len(), 2);

        let inbox = request(&path, &json!({ "op": "inbox", "swarmId": "s1", "agent": "frontend" }))
            .expect("inbox");
        assert_eq!(inbox[0]["content"], "implement the navbar");
        let own = request(&path, &json!({ "op": "inbox", "swarmId": "s1", "agent": "orchestrator" }))
            .expect("inbox");
        assert!(own.as_array().expect("array").is_empty());

        let events = h.events.lock().expect("events");
        assert!(events.iter().any(|(event, _)| event == "a2a://message"));
        drop(events);
        h.delivery.ptys.kill_all();
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn errors_are_reported_without_closing_the_server() {
        let h = harness("s1", vec![peer("a", "Agent A", PeerKind::Agent)]);
        let path = temp_socket("errors");
        start(h.delivery.clone(), &path).expect("start");

        let unknown = request(
            &path,
            &json!({ "op": "send", "swarmId": "s1", "from": "a", "to": "nobody", "content": "x" }),
        )
        .expect_err("unknown recipient");
        assert!(unknown.contains("Destinatário desconhecido"));

        assert_eq!(handle_request(&h.delivery, "not json")["ok"], false);
        assert_eq!(handle_request(&h.delivery, r#"{"op":"drop-tables"}"#)["ok"], false);

        // Still serving after the failures.
        assert!(request(&path, &json!({ "op": "peers", "swarmId": "s1" })).is_ok());
        h.delivery.ptys.kill_all();
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn connecting_to_a_missing_socket_explains_the_problem() {
        let err = request(Path::new("/tmp/helmade-not-running.sock"), &json!({})).expect_err("no server");
        assert!(err.contains("aplicação está aberta"));
    }

    #[test]
    fn socket_path_fits_in_sun_path() {
        assert!(socket_path().as_os_str().len() <= 104);
    }
}
