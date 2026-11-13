//! `helmade` command-line client, available on the PATH of every panel.
//!
//! It is the same binary as the app, started as `helmade cli <command>`; a shim script
//! in `~/.helmade/bin` hides that detail from agents.

use serde_json::{json, Value};
use std::io::Read;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

use crate::agents::socket;
use crate::terminal::pty::shell_quote;

pub const ENV_SOCKET: &str = "HELM_SOCK";
pub const ENV_SWARM_ID: &str = "HELM_SWARM_ID";
pub const ENV_AGENT_KEY: &str = "HELM_AGENT_KEY";

const USAGE: &str = "\
helmade — canal de comunicação entre agentes do HelmADE

  helmade send <destinatário> <mensagem…>   envia uma mensagem a um agente
  helmade send <destinatário> -             lê a mensagem do stdin
  helmade broadcast <mensagem…>             envia a todos os outros agentes
  helmade peers                             lista os agentes do enxame
  helmade inbox [n]                         mostra as últimas n mensagens recebidas
  helmade whoami                            mostra a identidade deste painel

O destinatário pode ser a chave do painel, o nome, ou 'orchestrator'.";

struct Context {
    socket: PathBuf,
    swarm_id: String,
    agent_key: String,
}

fn context(env: &dyn Fn(&str) -> Option<String>) -> Result<Context, String> {
    let missing = || "Este comando só funciona dentro de um painel do HelmADE.".to_string();
    Ok(Context {
        socket: PathBuf::from(env(ENV_SOCKET).ok_or_else(missing)?),
        swarm_id: env(ENV_SWARM_ID).ok_or_else(missing)?,
        agent_key: env(ENV_AGENT_KEY).ok_or_else(missing)?,
    })
}

fn message_text(words: &[String], stdin: &mut dyn Read) -> Result<String, String> {
    if words.len() == 1 && words[0] == "-" {
        let mut buffer = String::new();
        stdin
            .take(64 * 1024)
            .read_to_string(&mut buffer)
            .map_err(|e| format!("Falha ao ler o stdin: {e}"))?;
        return Ok(buffer);
    }
    Ok(words.join(" "))
}

fn format_inbox(messages: &Value) -> String {
    let Some(list) = messages.as_array().filter(|l| !l.is_empty()) else {
        return "Sem mensagens.".to_string();
    };
    list.iter()
        .map(|m| {
            format!(
                "🠔 [{}]: {}",
                m["senderName"].as_str().unwrap_or("?"),
                m["content"].as_str().unwrap_or("")
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn format_peers(peers: &Value, me: &str) -> String {
    let Some(list) = peers.as_array().filter(|l| !l.is_empty()) else {
        return "Sem agentes registados.".to_string();
    };
    list.iter()
        .map(|p| {
            let id = p["id"].as_str().unwrap_or("?");
            format!(
                "{id}\t{}\t{}{}",
                p["name"].as_str().unwrap_or(""),
                p["kind"].as_str().unwrap_or(""),
                if id == me { "\t(tu)" } else { "" }
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Runs a CLI command and returns what to print, or an error message.
fn execute(
    args: &[String],
    env: &dyn Fn(&str) -> Option<String>,
    stdin: &mut dyn Read,
) -> Result<String, String> {
    let command = args.first().map(String::as_str).unwrap_or("help");
    if matches!(command, "help" | "--help" | "-h") {
        return Ok(USAGE.to_string());
    }
    let ctx = context(env)?;
    let call = |payload: Value| socket::request(&ctx.socket, &payload);

    match command {
        "whoami" => Ok(format!("{} (enxame {})", ctx.agent_key, ctx.swarm_id)),
        "peers" => {
            let peers = call(json!({ "op": "peers", "swarmId": ctx.swarm_id }))?;
            Ok(format_peers(&peers, &ctx.agent_key))
        }
        "inbox" => {
            let limit = args.get(1).and_then(|n| n.parse::<usize>().ok()).unwrap_or(20);
            let messages = call(json!({
                "op": "inbox", "swarmId": ctx.swarm_id, "agent": ctx.agent_key, "limit": limit
            }))?;
            Ok(format_inbox(&messages))
        }
        "send" | "broadcast" => {
            let (recipient, words) = if command == "broadcast" {
                ("all".to_string(), &args[1..])
            } else {
                let recipient = args.get(1).ok_or("Falta o destinatário.\n\nUso: helmade send <destinatário> <mensagem…>")?;
                (recipient.clone(), &args[2..])
            };
            if words.is_empty() {
                return Err("Falta a mensagem.".to_string());
            }
            let content = message_text(words, stdin)?;
            let sent = call(json!({
                "op": "send", "swarmId": ctx.swarm_id, "from": ctx.agent_key,
                "to": recipient, "content": content
            }))?;
            Ok(format!(
                "➔ [{}]: mensagem entregue",
                sent["recipientName"].as_str().unwrap_or(&recipient)
            ))
        }
        other => Err(format!("Comando desconhecido: {other}\n\n{USAGE}")),
    }
}

/// Entry point of `helmade cli …`. Returns the process exit code.
pub fn run(args: &[String]) -> i32 {
    let env = |name: &str| std::env::var(name).ok().filter(|v| !v.is_empty());
    match execute(args, &env, &mut std::io::stdin()) {
        Ok(output) => {
            println!("{output}");
            0
        }
        Err(message) => {
            eprintln!("{message}");
            1
        }
    }
}

/// Writes the `helmade` shim that forwards to this executable in CLI mode.
pub fn install_shim(bin_dir: &Path, executable: &Path) -> std::io::Result<PathBuf> {
    std::fs::create_dir_all(bin_dir)?;
    let shim = bin_dir.join("helmade");
    let script = format!(
        "#!/bin/sh\nexec {} cli \"$@\"\n",
        shell_quote(&executable.to_string_lossy())
    );
    std::fs::write(&shim, script)?;
    std::fs::set_permissions(&shim, std::fs::Permissions::from_mode(0o755))?;
    Ok(shim)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agents::router::tests::{harness, peer};
    use crate::agents::router::PeerKind;
    use crate::terminal::manager::tests::wait_until;
    use std::collections::HashMap;
    use std::time::Duration;

    fn args(words: &[&str]) -> Vec<String> {
        words.iter().map(|w| w.to_string()).collect()
    }

    fn run_as(
        vars: &HashMap<&str, String>,
        words: &[&str],
        stdin: &str,
    ) -> Result<String, String> {
        let env = |name: &str| vars.get(name).cloned();
        execute(&args(words), &env, &mut stdin.as_bytes())
    }

    #[test]
    fn help_works_anywhere_but_commands_need_a_panel() {
        let empty = HashMap::new();
        assert!(run_as(&empty, &["help"], "").expect("help").contains("helmade send"));
        assert!(run_as(&empty, &[], "").expect("default help").contains("helmade peers"));
        let err = run_as(&empty, &["peers"], "").expect_err("outside a panel");
        assert!(err.contains("dentro de um painel"));
    }

    #[test]
    fn agents_exchange_messages_through_the_cli() {
        let h = harness(
            "s1",
            vec![
                peer("orchestrator", "Orchestrator", PeerKind::Agent),
                peer("qa", "QA", PeerKind::Agent),
            ],
        );
        let path = std::env::temp_dir().join(format!("hm-cli-{}.sock", std::process::id()));
        socket::start(h.delivery.clone(), &path).expect("start");
        let as_agent = |key: &str| {
            HashMap::from([
                (ENV_SOCKET, path.to_string_lossy().to_string()),
                (ENV_SWARM_ID, "s1".to_string()),
                (ENV_AGENT_KEY, key.to_string()),
            ])
        };
        let orchestrator = as_agent("orchestrator");
        let qa = as_agent("qa");

        assert_eq!(
            run_as(&orchestrator, &["whoami"], "").expect("whoami"),
            "orchestrator (enxame s1)"
        );
        let peers = run_as(&orchestrator, &["peers"], "").expect("peers");
        assert!(peers.contains("orchestrator\tOrchestrator\tagent\t(tu)"));
        assert!(peers.contains("qa\tQA\tagent"));

        let sent = run_as(&orchestrator, &["send", "qa", "run", "the", "suite"], "").expect("send");
        assert_eq!(sent, "➔ [QA]: mensagem entregue");
        assert!(wait_until(Duration::from_secs(5), || {
            h.delivery
                .ptys
                .get_scrollback("sess-qa")
                .map(|s| s.contains("[A2A de @Orchestrator] run the suite"))
                .unwrap_or(false)
        }));

        let piped = run_as(&qa, &["send", "orchestrator", "-"], "all green\n3 suites").expect("stdin");
        assert_eq!(piped, "➔ [Orchestrator]: mensagem entregue");
        let inbox = run_as(&orchestrator, &["inbox", "5"], "").expect("inbox");
        assert_eq!(inbox, "🠔 [QA]: all green\n3 suites");

        assert_eq!(
            run_as(&qa, &["broadcast", "done"], "").expect("broadcast"),
            "➔ [Todos os agentes]: mensagem entregue"
        );
        assert!(run_as(&qa, &["send", "qa"], "").is_err());
        assert!(run_as(&qa, &["send"], "").is_err());
        assert!(run_as(&qa, &["nonsense"], "").expect_err("unknown").contains("Comando desconhecido"));

        h.delivery.ptys.kill_all();
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn shim_forwards_every_argument_to_cli_mode() {
        let dir = std::env::temp_dir().join(format!("helmade_shim_{}", std::process::id()));
        let shim = install_shim(&dir, Path::new("/Applications/Helm ADE.app/Contents/MacOS/helmade"))
            .expect("install");
        let script = std::fs::read_to_string(&shim).expect("read");
        assert_eq!(
            script,
            "#!/bin/sh\nexec '/Applications/Helm ADE.app/Contents/MacOS/helmade' cli \"$@\"\n"
        );
        let mode = std::fs::metadata(&shim).expect("metadata").permissions().mode();
        assert_eq!(mode & 0o777, 0o755);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
