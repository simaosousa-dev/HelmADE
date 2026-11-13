//! Test-only HTTP bridge (cargo feature `e2e-bridge`).
//!
//! Playwright cannot attach to WKWebView, so end-to-end tests load the frontend in
//! Chromium and reach this process over HTTP instead of Tauri's IPC:
//!
//! * `POST /invoke {cmd, args}` runs the real command handler through the real IPC entry
//!   point of the main webview (same ACL checks, same state).
//! * `POST /listen {event}` + `GET /events` (SSE) forward backend events.
//!
//! The bridge only binds to loopback, only starts when `HELMADE_E2E_BRIDGE_PORT` is set
//! and is not compiled into release builds.

use std::collections::HashSet;
use std::io::{Read, Write};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::{json, Value};
use tauri::ipc::{CallbackFn, InvokeBody, InvokeResponse, InvokeResponseBody};
use tauri::webview::InvokeRequest;
use tauri::{AppHandle, Listener, Manager};
use tiny_http::{Header, Method, Response, Server};

const KEEP_ALIVE: Duration = Duration::from_secs(10);
const INVOKE_TIMEOUT: Duration = Duration::from_secs(60);

#[derive(Default)]
struct Hub {
    subscribers: Mutex<Vec<Sender<Vec<u8>>>>,
    listening: Mutex<HashSet<String>>,
}

impl Hub {
    fn broadcast(&self, event: &str, payload: &str) {
        let payload: Value = serde_json::from_str(payload).unwrap_or(Value::Null);
        let frame = format!("data: {}\n\n", json!({ "event": event, "payload": payload }));
        if let Ok(mut subscribers) = self.subscribers.lock() {
            subscribers.retain(|tx| tx.send(frame.clone().into_bytes()).is_ok());
        }
    }
}

/// Streams events to one SSE client. Written to the raw connection because tiny_http's
/// chunked encoder buffers 8 KB before sending, which would hold small events back.
fn stream_events(mut writer: Box<dyn Write + Send>, rx: Receiver<Vec<u8>>) -> std::io::Result<()> {
    writer.write_all(
        b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-cache\r\n\
          Access-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n: connected\n\n",
    )?;
    writer.flush()?;
    loop {
        match rx.recv_timeout(KEEP_ALIVE) {
            Ok(frame) => writer.write_all(&frame)?,
            Err(RecvTimeoutError::Timeout) => writer.write_all(b": keep-alive\n\n")?,
            Err(RecvTimeoutError::Disconnected) => return Ok(()),
        }
        writer.flush()?;
    }
}

fn header(name: &str, value: &str) -> Header {
    Header::from_bytes(name.as_bytes(), value.as_bytes()).expect("static header is valid")
}

fn cors() -> Vec<Header> {
    vec![
        header("Access-Control-Allow-Origin", "*"),
        header("Access-Control-Allow-Headers", "content-type"),
        header("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
    ]
}

fn json_response(body: Value) -> Response<std::io::Cursor<Vec<u8>>> {
    let mut response = Response::from_string(body.to_string());
    for h in cors() {
        response.add_header(h);
    }
    response.add_header(header("Content-Type", "application/json"));
    response
}

/// Runs a command through the main webview's IPC entry point and waits for its result.
fn invoke(app: &AppHandle, cmd: &str, args: Value) -> Value {
    let Some(window) = app.get_webview_window("main") else {
        return json!({ "ok": false, "error": { "code": "unavailable", "message": "main window not ready" } });
    };
    let url = match window.url() {
        Ok(url) => url,
        Err(err) => return json!({ "ok": false, "error": { "code": "unavailable", "message": err.to_string() } }),
    };
    let request = InvokeRequest {
        cmd: cmd.to_string(),
        callback: CallbackFn(0),
        error: CallbackFn(1),
        url,
        body: InvokeBody::Json(args),
        headers: Default::default(),
        invoke_key: app.invoke_key().to_string(),
    };
    let (tx, rx) = mpsc::sync_channel(1);
    let webview: &tauri::Webview = window.as_ref();
    webview.clone().on_message(
        request,
        Box::new(move |_webview, _cmd, response, _callback, _error| {
            if tx.send(response).is_err() {
                eprintln!("[e2e-bridge] caller went away before the command finished");
            }
        }),
    );
    match rx.recv_timeout(INVOKE_TIMEOUT) {
        Ok(InvokeResponse::Ok(InvokeResponseBody::Json(raw))) => {
            json!({ "ok": true, "data": serde_json::from_str::<Value>(&raw).unwrap_or(Value::Null) })
        }
        Ok(InvokeResponse::Ok(InvokeResponseBody::Raw(_))) => json!({ "ok": true, "data": null }),
        Ok(InvokeResponse::Err(err)) => json!({ "ok": false, "error": err.0 }),
        Err(_) => json!({ "ok": false, "error": { "code": "unavailable", "message": "command timed out" } }),
    }
}

fn listen(app: &AppHandle, hub: &Arc<Hub>, event: &str) {
    let valid = !event.is_empty()
        && event
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '/' | ':' | '_'));
    let Ok(mut listening) = hub.listening.lock() else {
        return;
    };
    if !valid || !listening.insert(event.to_string()) {
        return;
    }
    let hub = Arc::clone(hub);
    let name = event.to_string();
    app.listen_any(event, move |e| hub.broadcast(&name, e.payload()));
}

fn handle(app: &AppHandle, hub: &Arc<Hub>, mut request: tiny_http::Request) -> std::io::Result<()> {
    let path = request.url().split('?').next().unwrap_or("").to_string();
    if *request.method() == Method::Options {
        let mut response = Response::empty(204);
        for h in cors() {
            response.add_header(h);
        }
        return request.respond(response);
    }
    if *request.method() == Method::Get && path == "/events" {
        let (tx, rx) = mpsc::channel();
        if let Ok(mut subscribers) = hub.subscribers.lock() {
            subscribers.push(tx);
        }
        return stream_events(request.into_writer(), rx);
    }

    let mut body = String::new();
    request.as_reader().take(4 * 1024 * 1024).read_to_string(&mut body)?;
    let payload: Value = serde_json::from_str(&body).unwrap_or(Value::Null);
    let reply = match (request.method(), path.as_str()) {
        (Method::Post, "/invoke") => invoke(
            app,
            payload["cmd"].as_str().unwrap_or(""),
            payload.get("args").cloned().unwrap_or_else(|| json!({})),
        ),
        (Method::Post, "/listen") => {
            listen(app, hub, payload["event"].as_str().unwrap_or(""));
            json!({ "ok": true })
        }
        (Method::Get, "/health") => json!({ "ok": true }),
        _ => json!({ "ok": false, "error": { "code": "not_found", "message": "unknown route" } }),
    };
    request.respond(json_response(reply))
}

/// Script that stands in for every agent CLI during end-to-end tests, so a test run
/// never starts (or pays for) a real model. Set through `HELMADE_E2E_AGENT_STUB`.
pub fn agent_stub() -> Option<String> {
    std::env::var("HELMADE_E2E_AGENT_STUB").ok().filter(|path| !path.is_empty())
}

/// Wraps an agent command line so the stub runs instead, receiving the original argv.
pub fn stub_agent_command(command: Vec<String>) -> Vec<String> {
    match agent_stub() {
        Some(stub) => std::iter::once(stub).chain(command).collect(),
        None => command,
    }
}

/// Starts the bridge when `HELMADE_E2E_BRIDGE_PORT` is set.
pub fn start(app: AppHandle) {
    let Some(port) = std::env::var("HELMADE_E2E_BRIDGE_PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
    else {
        return;
    };
    let server = match Server::http(("127.0.0.1", port)) {
        Ok(server) => Arc::new(server),
        Err(err) => {
            eprintln!("[e2e-bridge] could not bind 127.0.0.1:{port}: {err}");
            return;
        }
    };
    eprintln!("[e2e-bridge] listening on http://127.0.0.1:{port}");
    let hub = Arc::new(Hub::default());
    std::thread::spawn(move || {
        for request in server.incoming_requests() {
            let app = app.clone();
            let hub = Arc::clone(&hub);
            std::thread::spawn(move || {
                if let Err(err) = handle(&app, &hub, request) {
                    eprintln!("[e2e-bridge] request failed: {err}");
                }
            });
        }
    });
}
