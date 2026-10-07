pub mod commands;
pub mod db;
pub mod git;
pub mod network;
pub mod terminal;

use commands::network::PortState;
use commands::terminal::PtyState;
use db::DbState;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
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
    let pty_state: PtyState = Arc::new(PtyManager::new());

    tauri::Builder::default()
        .manage(db_state)
        .manage(port_state)
        .manage(pty_state)
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
