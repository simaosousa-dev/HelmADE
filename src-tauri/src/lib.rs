pub mod agents;
pub mod audio;
pub mod browser;
pub mod commands;
pub mod db;
pub mod git;
pub mod network;
pub mod terminal;

use agents::router::{MessageRouter, MessageRouterState};
use audio::VoiceManager;
use browser::PortSniffer;
use commands::browser::BrowserState;
use commands::network::PortState;
use commands::terminal::PtyState;
use commands::shortcuts::{ShortcutConfig, ShortcutState};
use commands::voice::VoiceState;
use db::DbState;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use terminal::PtyManager;


fn resolve_db_path() -> PathBuf {
    let mut dir = dirs_or_home();
    let _ = fs::create_dir_all(&dir);
    dir.push("helmade.db");
    dir
}

fn dirs_or_home() -> PathBuf {
    if let Some(mut home) = std::env::var_os("HOME").map(PathBuf::from) {
        home.push(".helmade");
        home
    } else {
        PathBuf::from(".helmade")
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = resolve_db_path();
    let db_state = DbState::new(db_path.to_str().unwrap_or("helmade.db"))
        .expect("falha crítica ao inicializar a base de dados SQLite local");
    let port_state = PortState::default();
    let browser_state: BrowserState = Arc::new(PortSniffer::new());
    let pty_state: PtyState = Arc::new(PtyManager::new());
    let router_state: MessageRouterState = Arc::new(MessageRouter::new());
    let voice_state: VoiceState = Arc::new(VoiceManager::new());
    let shortcut_state: ShortcutState = Arc::new(RwLock::new(ShortcutConfig::default()));

    tauri::Builder::default()
        .manage(db_state)
        .manage(port_state)
        .manage(browser_state)
        .manage(pty_state)
        .manage(router_state)
        .manage(voice_state)
        .manage(shortcut_state)
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // Comandos de Projetos & SQLite
            commands::project::upsert_project,
            commands::project::list_recent_projects,
            commands::project::delete_project,
            // Comandos de Git Worktree & Symlinks
            commands::worktree::create_worktree,
            commands::worktree::remove_worktree,
            commands::worktree::list_worktrees,
            commands::symlink::symlink_dependencies,
            // Comandos de Git Diff & Merge Seguro
            commands::worktree::get_worktree_diff,
            commands::worktree::get_file_diff,
            commands::worktree::merge_worktree,
            commands::worktree::abort_merge,
            // Comandos de Alocação de Rede & Portas
            commands::network::allocate_swarm_port,
            commands::network::release_swarm_port,
            commands::network::get_swarm_port,
            commands::network::get_swarm_env_vars,
            // Comandos de Terminal PTY Multiplexer
            commands::terminal::spawn_pty,
            commands::terminal::write_pty,
            commands::terminal::resize_pty,
            commands::terminal::kill_pty,
            commands::terminal::get_pty_scrollback,
            // Comandos de Personas de Agentes (.md) & Modelos
            commands::agents::list_discovered_agents,
            commands::agents::get_agent_details,
            commands::agents::check_ollama_status,
            // Comandos do Protocolo A2A Inter-Agentes
            commands::message::send_a2a_message,
            commands::message::get_a2a_history,
            commands::message::register_a2a_pty_mirror,
            commands::message::unregister_a2a_pty_mirror,
            // Comandos de Live Preview & Sniffer de Dev Servers
            commands::browser::get_detected_servers,
            commands::browser::clear_detected_servers,
            commands::browser::open_in_external_browser,
            // Comandos de Voz a Custo Zero HelmVoice (Apple Speech & AVFoundation)
            commands::voice::check_voice_permissions,
            commands::voice::request_voice_permissions,
            commands::voice::start_voice_transcription,
            commands::voice::stop_voice_transcription,
            commands::voice::get_voice_status,
            commands::voice::is_on_device_speech_supported,
            // Comandos de Gestão de Atalhos e Push-to-Talk
            commands::shortcuts::get_shortcut_config,
            commands::shortcuts::update_shortcut_config,
            commands::shortcuts::is_push_to_talk_available,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
