pub mod agents;
pub mod audio;
pub mod browser;
pub mod cli;
pub mod commands;
pub mod db;
#[cfg(feature = "e2e-bridge")]
pub mod e2e_bridge;
pub mod error;
pub mod events;
pub mod git;
pub mod network;
pub mod notifications;
pub mod paths;
pub mod security;
pub mod swarm;
pub mod terminal;

use std::sync::{Arc, Mutex};
use std::time::Duration;

use tauri::{Emitter, Manager, RunEvent};

use agents::router::{Delivery, MessageRouter, MessageRouterState};
use audio::VoiceManager;
use browser::PortSniffer;
use commands::browser::BrowserState;
use commands::project::DbHandle;
use commands::settings::SHIELD_SETTING_KEY;
use commands::shortcuts::{ShortcutConfig, ShortcutSettings, SHORTCUT_SETTING_KEY};
use commands::swarm::PortState;
use commands::terminal::{PtyState, RuntimeInfo, SinkState};
use commands::voice::VoiceState;
use db::DbState;
use security::{ShieldConfig, ShieldHandle, ShieldState};
use terminal::idle_detector::{IdleDetector, IdleDetectorState};
use terminal::sink::TauriSink;
use terminal::PtyManager;

/// How often idle terminals are checked for standby.
const IDLE_SWEEP_INTERVAL: Duration = Duration::from_secs(5);

fn load_shield_config(db: &DbState) -> ShieldConfig {
    match db.get_setting(SHIELD_SETTING_KEY) {
        Ok(Some(raw)) => serde_json::from_str(&raw).unwrap_or_default(),
        Ok(None) => ShieldConfig::default(),
        Err(err) => {
            eprintln!("[helmade] could not read shield settings: {err}");
            ShieldConfig::default()
        }
    }
}

fn load_shortcut_config(db: &DbState) -> ShortcutConfig {
    match db.get_setting(SHORTCUT_SETTING_KEY) {
        Ok(Some(raw)) => serde_json::from_str(&raw).unwrap_or_default(),
        Ok(None) => ShortcutConfig::default(),
        Err(err) => {
            eprintln!("[helmade] could not read shortcut settings: {err}");
            ShortcutConfig::default()
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if let Err(err) = std::fs::create_dir_all(paths::helm_home()) {
        eprintln!("[helmade] could not create the data directory: {err}");
    }

    // Startup invariant: without its database the cockpit cannot track swarms and their
    // worktrees, so refusing to start is safer than running blind.
    let db: DbHandle = Arc::new(
        DbState::open(&paths::db_path()).expect("failed to open the local HelmADE database"),
    );
    let shield: ShieldHandle = Arc::new(ShieldState::new(
        load_shield_config(&db),
        paths::user_home().map(|home| home.to_string_lossy().into_owned()),
    ));
    let ptys: PtyState = Arc::new(PtyManager::new());
    let router: MessageRouterState = Arc::new(MessageRouter::new());
    let idle_state: IdleDetectorState = Arc::new(IdleDetector::new());
    let browser_state: BrowserState = Arc::new(PortSniffer::new());
    let voice_state: VoiceState = Arc::new(VoiceManager::new());
    let shortcut_config = load_shortcut_config(&db);

    let setup_db = Arc::clone(&db);
    let setup_shield = Arc::clone(&shield);
    let setup_ptys = Arc::clone(&ptys);
    let setup_router = Arc::clone(&router);
    let setup_idle = Arc::clone(&idle_state);

    let app = tauri::Builder::default()
        .manage(db)
        .manage(shield)
        .manage(ptys)
        .manage(router)
        .manage(idle_state)
        .manage(browser_state)
        .manage(voice_state)
        .manage(ShortcutSettings(Mutex::new(shortcut_config.clone())))
        .manage(PortState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(commands::shortcuts::plugin())
        .setup(move |app| {
            let handle = app.handle().clone();
            app.manage::<SinkState>(Arc::new(TauriSink::new(handle.clone())));

            let emit_handle = handle.clone();
            let delivery = Delivery {
                router: setup_router,
                ptys: setup_ptys,
                db: Some(setup_db),
                shield: setup_shield,
                emit: Arc::new(move |event, payload| {
                    if let Err(err) = emit_handle.emit(event, payload) {
                        eprintln!("[helmade] failed to emit {event}: {err}");
                    }
                }),
            };
            let socket = agents::socket::socket_path();
            if let Err(err) = agents::socket::start(delivery.clone(), &socket) {
                eprintln!("[helmade] A2A socket unavailable: {err}");
            }
            app.manage(delivery);

            let bin_dir = paths::bin_dir();
            let cli = std::env::current_exe()
                .and_then(|exe| cli::install_shim(&bin_dir, &exe))
                .unwrap_or_else(|err| {
                    eprintln!("[helmade] could not install the helmade CLI shim: {err}");
                    bin_dir.join("helmade")
                });
            app.manage(RuntimeInfo {
                socket,
                bin_dir,
                cli,
            });

            // Test runs must not grab a system-wide key on the developer's machine.
            if std::env::var_os("HELMADE_DISABLE_GLOBAL_SHORTCUT").is_none() {
                if let Err(err) = commands::shortcuts::apply(&handle, None, &shortcut_config) {
                    eprintln!("[helmade] push-to-talk shortcut not registered: {err}");
                }
            }

            #[cfg(feature = "e2e-bridge")]
            e2e_bridge::start(handle.clone());

            std::thread::spawn(move || loop {
                std::thread::sleep(IDLE_SWEEP_INTERVAL);
                setup_idle.sweep_idle_standby(&handle);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Projects
            commands::project::upsert_project,
            commands::project::list_recent_projects,
            commands::project::delete_project,
            // Swarm lifecycle & persistence
            commands::swarm::provision_swarm,
            commands::swarm::restore_agent_workspace,
            commands::swarm::release_agent_workspace,
            commands::swarm::save_swarm,
            commands::swarm::list_swarms,
            commands::swarm::delete_swarm,
            commands::swarm::list_orphan_worktrees,
            // Review & merge
            commands::worktree::get_worktree_diff,
            commands::worktree::get_file_diff,
            commands::worktree::merge_worktree,
            commands::worktree::abort_merge,
            // Terminals
            commands::terminal::spawn_pty,
            commands::terminal::write_pty,
            commands::terminal::resize_pty,
            commands::terminal::kill_pty,
            commands::terminal::is_pty_alive,
            commands::terminal::get_pty_scrollback,
            commands::terminal::respond_to_blocked_prompt,
            commands::terminal::get_session_idle_status,
            commands::terminal::list_all_terminal_idle_statuses,
            commands::terminal::set_session_standby,
            commands::terminal::send_macos_notification,
            // Agent personas & models
            commands::agents::list_discovered_agents,
            commands::agents::get_agent_details,
            commands::agents::check_ollama_status,
            commands::agents::detect_agent_clis,
            // Team Wire (A2A)
            commands::message::send_a2a_message,
            commands::message::get_a2a_history,
            commands::message::register_swarm_peers,
            // Settings & Streamer Shield
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::get_shield_config,
            commands::settings::set_shield_config,
            // Live preview
            commands::browser::get_detected_servers,
            commands::browser::clear_detected_servers,
            commands::browser::open_in_external_browser,
            // Voice
            commands::voice::check_voice_permissions,
            commands::voice::request_voice_permissions,
            commands::voice::start_voice_transcription,
            commands::voice::stop_voice_transcription,
            commands::voice::get_voice_status,
            commands::voice::is_on_device_speech_supported,
            // Shortcuts
            commands::shortcuts::get_shortcut_config,
            commands::shortcuts::update_shortcut_config,
        ])
        .build(tauri::generate_context!())
        // Startup invariant: a broken bundle configuration cannot be recovered at runtime.
        .expect("failed to build the HelmADE application");

    app.run(|app_handle, event| {
        if !matches!(event, RunEvent::Exit) {
            return;
        }
        // No child process may outlive the cockpit.
        app_handle.state::<PtyState>().kill_all();
        let Some(runtime) = app_handle.try_state::<RuntimeInfo>() else {
            return;
        };
        if let Err(err) = std::fs::remove_file(&runtime.socket) {
            if err.kind() != std::io::ErrorKind::NotFound {
                eprintln!("[helmade] could not remove the A2A socket: {err}");
            }
        }
    });
}
