//! Swarm lifecycle: every agent gets its own worktree, branch and port.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::Mutex;

use crate::error::{HelmError, HelmResult};
use crate::git::{self, worktree};
use crate::network::port_allocator::PortAllocator;

/// A grid holds at most 16 panels (4x4).
pub const MAX_PANELS: usize = 16;
const MAX_SWARM_ID_LEN: usize = 16;
const MAX_PANEL_KEY_LEN: usize = 40;

/// The isolated workspace of one agent.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentWorkspace {
    pub panel_key: String,
    /// Also the PTY session id and the port allocation key.
    pub worktree_id: String,
    pub branch: String,
    pub path: String,
    pub port: u16,
    pub env: HashMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProvisionedSwarm {
    pub swarm_id: String,
    pub base_branch: String,
    pub agents: Vec<AgentWorkspace>,
}

pub fn worktree_id(swarm_id: &str, panel_key: &str) -> String {
    format!("{swarm_id}-{panel_key}")
}

fn validate_request(swarm_id: &str, panel_keys: &[String]) -> HelmResult<()> {
    git::validate_id(swarm_id).map_err(HelmError::invalid)?;
    if swarm_id.len() > MAX_SWARM_ID_LEN {
        return Err(HelmError::invalid("Identificador de enxame demasiado longo"));
    }
    if panel_keys.is_empty() || panel_keys.len() > MAX_PANELS {
        return Err(HelmError::invalid("Um enxame tem entre 1 e 16 painéis"));
    }
    let mut seen = HashSet::new();
    for key in panel_keys {
        git::validate_id(key).map_err(HelmError::invalid)?;
        if key.len() > MAX_PANEL_KEY_LEN {
            return Err(HelmError::invalid("Identificador de painel demasiado longo"));
        }
        if !seen.insert(key.as_str()) {
            return Err(HelmError::invalid("Os painéis de um enxame têm de ter identificadores únicos"));
        }
    }
    Ok(())
}

fn allocate_port(ports: &Mutex<PortAllocator>, id: &str) -> HelmResult<(u16, HashMap<String, String>)> {
    let mut allocator = ports.lock()?;
    let port = allocator.allocate(id).map_err(HelmError::unavailable)?;
    let mut env = allocator.get_env_vars(id);
    env.insert("HELM_SWARM_PORT".to_string(), port.to_string());
    Ok((port, env))
}

fn provision_agent(
    repo_path: &str,
    swarm_id: &str,
    panel_key: &str,
    base_branch: &str,
    ports: &Mutex<PortAllocator>,
) -> HelmResult<AgentWorkspace> {
    let id = worktree_id(swarm_id, panel_key);
    let info = worktree::create_worktree(repo_path, &id, Some(base_branch)).map_err(HelmError::git)?;
    let (port, env) = match allocate_port(ports, &id) {
        Ok(allocation) => allocation,
        Err(err) => {
            if let Err(cleanup) = worktree::remove_worktree(repo_path, &id, true) {
                eprintln!("[helmade] rollback of worktree failed: {cleanup}");
            }
            return Err(err);
        }
    };
    Ok(AgentWorkspace {
        panel_key: panel_key.to_string(),
        worktree_id: id,
        branch: info.branch,
        path: info.path,
        port,
        env,
    })
}

/// Creates one workspace per panel on top of the branch currently checked out.
/// All or nothing: a failure removes every workspace created so far.
pub fn provision_swarm(
    repo_path: &str,
    swarm_id: &str,
    panel_keys: &[String],
    ports: &Mutex<PortAllocator>,
) -> HelmResult<ProvisionedSwarm> {
    validate_request(swarm_id, panel_keys)?;
    let repo = git::require_repo(repo_path).map_err(HelmError::invalid)?;
    let base_branch = git::current_branch(repo).map_err(HelmError::git)?;

    let mut agents = Vec::with_capacity(panel_keys.len());
    for key in panel_keys {
        match provision_agent(repo_path, swarm_id, key, &base_branch, ports) {
            Ok(workspace) => agents.push(workspace),
            Err(err) => {
                for created in &agents {
                    if let Err(cleanup) = release_agent(repo_path, &created.worktree_id, true, ports) {
                        eprintln!("[helmade] rollback of agent workspace failed: {cleanup}");
                    }
                }
                return Err(err);
            }
        }
    }

    Ok(ProvisionedSwarm {
        swarm_id: swarm_id.to_string(),
        base_branch,
        agents,
    })
}

/// Releases the port and removes the worktree (and its branch when asked).
pub fn release_agent(
    repo_path: &str,
    worktree_id: &str,
    delete_branch: bool,
    ports: &Mutex<PortAllocator>,
) -> HelmResult<()> {
    git::validate_id(worktree_id).map_err(HelmError::invalid)?;
    ports.lock()?.release(worktree_id);
    worktree::remove_worktree(repo_path, worktree_id, delete_branch).map_err(HelmError::git)?;
    Ok(())
}

/// Re-attaches to a workspace after an app restart. The worktree must still exist;
/// its port is allocated again (ports are not reserved across restarts).
pub fn restore_agent(
    repo_path: &str,
    swarm_id: &str,
    panel_key: &str,
    ports: &Mutex<PortAllocator>,
) -> HelmResult<AgentWorkspace> {
    validate_request(swarm_id, std::slice::from_ref(&panel_key.to_string()))?;
    let repo = git::require_repo(repo_path).map_err(HelmError::invalid)?;
    let id = worktree_id(swarm_id, panel_key);
    let dir = worktree::worktree_dir(repo, &id);
    if !Path::new(&dir).is_dir() {
        return Err(HelmError::not_found("O worktree deste agente já não existe"));
    }
    let (port, env) = allocate_port(ports, &id)?;
    Ok(AgentWorkspace {
        panel_key: panel_key.to_string(),
        branch: worktree::branch_name(&id),
        path: dir.to_string_lossy().to_string(),
        worktree_id: id,
        port,
        env,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ErrorCode;
    use crate::git::test_support::TempRepo;
    use crate::git::run_git;

    fn keys(names: &[&str]) -> Vec<String> {
        names.iter().map(|n| n.to_string()).collect()
    }

    #[test]
    fn four_agent_swarm_gets_isolated_worktrees_branches_and_ports() {
        let repo = TempRepo::new("swarm");
        let ports = Mutex::new(PortAllocator::new(21000, 21050));
        let panel_keys = keys(&["orchestrator", "fullstack", "frontend", "qa"]);

        let swarm = provision_swarm(repo.path_str(), "s1a2b3", &panel_keys, &ports).expect("provision");
        assert_eq!(swarm.base_branch, "main");
        assert_eq!(swarm.agents.len(), 4);

        let mut seen_ports = HashSet::new();
        for (agent, key) in swarm.agents.iter().zip(&panel_keys) {
            assert_eq!(&agent.panel_key, key);
            assert_eq!(agent.worktree_id, format!("s1a2b3-{key}"));
            assert_eq!(agent.branch, format!("helm/swarm-s1a2b3-{key}"));
            let dir = Path::new(&agent.path);
            assert!(dir.join("README.md").exists());
            assert!(dir.join("node_modules").is_symlink());
            assert!(dir.join("node_modules").join("pkg.json").exists());
            assert_eq!(
                run_git(dir, ["rev-parse", "--abbrev-ref", "HEAD"]).expect("branch"),
                agent.branch
            );
            assert_eq!(agent.env.get("PORT"), Some(&agent.port.to_string()));
            assert!(seen_ports.insert(agent.port), "port {} reused", agent.port);
        }

        // An edit in one agent's worktree is invisible to the others and to main.
        std::fs::write(Path::new(&swarm.agents[0].path).join("only-here.txt"), "x").expect("write");
        assert!(!Path::new(&swarm.agents[1].path).join("only-here.txt").exists());
        assert!(!repo.path.join("only-here.txt").exists());

        for agent in &swarm.agents {
            release_agent(repo.path_str(), &agent.worktree_id, true, &ports).expect("release");
        }
        assert!(worktree::list_managed_worktrees(repo.path_str()).expect("list").is_empty());
        assert!(run_git(&repo.path, ["branch", "--list", "helm/*"]).expect("branches").is_empty());
        assert!(ports.lock().expect("ports").list_allocations().is_empty());
        assert_eq!(run_git(&repo.path, ["status", "--porcelain"]).expect("status"), "");
    }

    #[test]
    fn a_failure_rolls_back_every_workspace_already_created() {
        let repo = TempRepo::new("swarm_rollback");
        let ports = Mutex::new(PortAllocator::new(21100, 21150));
        // Occupy the id the third agent would use so its creation fails.
        worktree::create_worktree(repo.path_str(), "s2-qa", None).expect("pre-existing");

        let err = provision_swarm(repo.path_str(), "s2", &keys(&["a", "b", "qa"]), &ports).expect_err("fails");
        assert_eq!(err.code, ErrorCode::Git);
        let remaining = worktree::list_managed_worktrees(repo.path_str()).expect("list");
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].swarm_id, "s2-qa");
        assert!(ports.lock().expect("ports").list_allocations().is_empty());
    }

    #[test]
    fn invalid_requests_are_rejected_before_touching_git() {
        let repo = TempRepo::new("swarm_invalid");
        let ports = Mutex::new(PortAllocator::new(21200, 21250));
        let cases: Vec<(&str, Vec<String>)> = vec![
            ("ok", vec![]),
            ("ok", keys(&["a", "a"])),
            ("../x", keys(&["a"])),
            ("ok", keys(&["a/b"])),
            ("ok", (0..17).map(|i| format!("p{i}")).collect()),
        ];
        for (swarm_id, panel_keys) in cases {
            let err = provision_swarm(repo.path_str(), swarm_id, &panel_keys, &ports).expect_err("invalid");
            assert_eq!(err.code, ErrorCode::InvalidInput);
        }
        assert!(worktree::list_managed_worktrees(repo.path_str()).expect("list").is_empty());
    }

    #[test]
    fn restore_reattaches_to_a_surviving_worktree() {
        let repo = TempRepo::new("swarm_restore");
        let ports = Mutex::new(PortAllocator::new(21300, 21350));
        let swarm = provision_swarm(repo.path_str(), "s3", &keys(&["dev"]), &ports).expect("provision");

        // Simulates an app restart: allocations are gone, the worktree is not.
        let fresh_ports = Mutex::new(PortAllocator::new(21300, 21350));
        let restored = restore_agent(repo.path_str(), "s3", "dev", &fresh_ports).expect("restore");
        assert_eq!(restored.path, swarm.agents[0].path);
        assert_eq!(restored.branch, swarm.agents[0].branch);

        release_agent(repo.path_str(), &restored.worktree_id, true, &fresh_ports).expect("release");
        let missing = restore_agent(repo.path_str(), "s3", "dev", &fresh_ports).expect_err("gone");
        assert_eq!(missing.code, ErrorCode::NotFound);
    }
}
