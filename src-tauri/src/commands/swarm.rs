use std::sync::Mutex;
use tauri::State;

use super::project::DbHandle;
use super::terminal::PtyState;
use crate::agents::router::MessageRouterState;
use crate::db::SwarmRecord;
use crate::error::{HelmError, HelmResult};
use crate::git::worktree::{self, WorktreeInfo};
use crate::network::port_allocator::PortAllocator;
use crate::swarm::{self, AgentWorkspace, ProvisionedSwarm};

#[derive(Default)]
pub struct PortState(pub Mutex<PortAllocator>);

/// Creates one isolated workspace (worktree + branch + port) per panel. All or nothing.
#[tauri::command]
pub fn provision_swarm(
    ports: State<'_, PortState>,
    repo_path: String,
    swarm_id: String,
    panel_keys: Vec<String>,
) -> HelmResult<ProvisionedSwarm> {
    swarm::provision_swarm(&repo_path, &swarm_id, &panel_keys, &ports.0)
}

/// Re-attaches a restored panel to its surviving worktree.
#[tauri::command]
pub fn restore_agent_workspace(
    ports: State<'_, PortState>,
    repo_path: String,
    swarm_id: String,
    panel_key: String,
) -> HelmResult<AgentWorkspace> {
    swarm::restore_agent(&repo_path, &swarm_id, &panel_key, &ports.0)
}

/// Ends the panel's terminal, releases its port and removes its worktree.
#[tauri::command]
pub fn release_agent_workspace(
    ports: State<'_, PortState>,
    ptys: State<'_, PtyState>,
    repo_path: String,
    worktree_id: String,
    delete_branch: bool,
) -> HelmResult<()> {
    ptys.kill(&worktree_id).map_err(HelmError::pty)?;
    swarm::release_agent(&repo_path, &worktree_id, delete_branch, &ports.0)
}

#[tauri::command]
pub fn save_swarm(db: State<'_, DbHandle>, swarm: SwarmRecord) -> HelmResult<()> {
    db.save_swarm(&swarm)
}

#[tauri::command]
pub fn list_swarms(db: State<'_, DbHandle>, project_id: String) -> HelmResult<Vec<SwarmRecord>> {
    db.list_swarms(&project_id)
}

/// Forgets a swarm: its record, its Team Wire history and its roster.
#[tauri::command]
pub fn delete_swarm(
    db: State<'_, DbHandle>,
    router: State<'_, MessageRouterState>,
    swarm_id: String,
) -> HelmResult<bool> {
    router.remove_swarm(&swarm_id)?;
    db.delete_swarm(&swarm_id)
}

/// HelmADE worktrees of the repository that no saved swarm owns any more.
#[tauri::command]
pub fn list_orphan_worktrees(
    db: State<'_, DbHandle>,
    repo_path: String,
    project_id: String,
) -> HelmResult<Vec<WorktreeInfo>> {
    let owned = db.list_worktree_ids(&project_id)?;
    let managed = worktree::list_managed_worktrees(&repo_path).map_err(HelmError::git)?;
    Ok(managed
        .into_iter()
        .filter(|info| !owned.contains(&info.swarm_id))
        .collect())
}
