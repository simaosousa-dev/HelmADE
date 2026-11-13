use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use super::{ensure_local_excludes, require_repo, run_git, symlink, validate_branch, validate_id};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct WorktreeInfo {
    pub swarm_id: String,
    pub branch: String,
    pub path: String,
    pub is_bare: bool,
    pub created_at: i64,
}

pub fn branch_name(worktree_id: &str) -> String {
    format!("helm/swarm-{worktree_id}")
}

pub fn worktree_dir(repo: &Path, worktree_id: &str) -> PathBuf {
    repo.join(".helm").join("worktrees").join(worktree_id)
}

/// Creates an isolated worktree at `.helm/worktrees/<id>` on a new `helm/swarm-<id>` branch
/// and links the repository's ignored dependency directories into it.
pub fn create_worktree(
    repo_path: &str,
    worktree_id: &str,
    base_branch: Option<&str>,
) -> Result<WorktreeInfo, String> {
    let id = validate_id(worktree_id)?;
    let repo = require_repo(repo_path)?;
    let base = match base_branch {
        Some(name) => validate_branch(name)?,
        None => "HEAD",
    };

    let branch = branch_name(id);
    let dir = worktree_dir(repo, id);
    if dir.exists() {
        return Err("Já existe um worktree com este identificador".to_string());
    }
    if let Some(parent) = dir.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Falha ao criar diretório base de worktrees: {e}"))?;
    }
    // Keep HelmADE's own directory out of the user's `git status` without touching .gitignore.
    ensure_local_excludes(repo, &[".helm/".to_string()])?;

    run_git(
        repo,
        [
            "worktree".as_ref(),
            "add".as_ref(),
            "--quiet".as_ref(),
            "-b".as_ref(),
            branch.as_ref(),
            dir.as_os_str(),
            base.as_ref(),
        ],
    )
    .map_err(|stderr| format!("Erro do Git ao criar worktree: {stderr}"))?;

    if let Err(err) = symlink::link_dependencies(repo, &dir) {
        eprintln!("[helmade] dependency symlinks skipped: {err}");
    }

    let created_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    Ok(WorktreeInfo {
        swarm_id: id.to_string(),
        branch,
        path: dir.to_string_lossy().to_string(),
        is_bare: false,
        created_at,
    })
}

/// Removes a worktree and, optionally, its branch. Dependency symlinks are unlinked first
/// so nothing in the main checkout is ever deleted through them.
pub fn remove_worktree(
    repo_path: &str,
    worktree_id: &str,
    delete_branch: bool,
) -> Result<bool, String> {
    let id = validate_id(worktree_id)?;
    let repo = require_repo(repo_path)?;
    let dir = worktree_dir(repo, id);

    if dir.exists() {
        symlink::unlink_dependencies(&dir)?;
        run_git(
            repo,
            [
                "worktree".as_ref(),
                "remove".as_ref(),
                "--force".as_ref(),
                dir.as_os_str(),
            ],
        )
        .map_err(|stderr| format!("Erro ao remover worktree: {stderr}"))?;
    }
    // Drops stale administrative entries when the directory was deleted by hand.
    if let Err(err) = run_git(repo, ["worktree", "prune"]) {
        eprintln!("[helmade] git worktree prune failed: {err}");
    }

    if delete_branch {
        let branch = branch_name(id);
        let exists = run_git(
            repo,
            ["rev-parse", "--verify", "--quiet", &format!("refs/heads/{branch}")],
        )
        .is_ok();
        if exists {
            run_git(repo, ["branch", "-D", &branch])
                .map_err(|stderr| format!("Erro ao remover branch do worktree: {stderr}"))?;
        }
    }

    Ok(true)
}

/// Lists every worktree of the repository (the main checkout included).
pub fn list_worktrees(repo_path: &str) -> Result<Vec<WorktreeInfo>, String> {
    let repo = require_repo(repo_path)?;
    let stdout = run_git(repo, ["worktree", "list", "--porcelain"])
        .map_err(|stderr| format!("Erro ao obter lista de worktrees: {stderr}"))?;

    let mut list = Vec::new();
    // Entries are separated by blank lines; a trailing sentinel flushes the last one.
    let mut path: Option<String> = None;
    let mut branch: Option<String> = None;
    let mut is_bare = false;
    for line in stdout.lines().chain(std::iter::once("")) {
        if let Some(value) = line.strip_prefix("worktree ") {
            path = Some(value.trim().to_string());
            branch = None;
            is_bare = false;
            continue;
        }
        if let Some(value) = line.strip_prefix("branch ") {
            let value = value.trim();
            branch = Some(value.strip_prefix("refs/heads/").unwrap_or(value).to_string());
            continue;
        }
        if line.trim() == "bare" {
            is_bare = true;
            continue;
        }
        if !line.is_empty() {
            continue;
        }
        let Some(entry_path) = path.take() else {
            continue;
        };
        let swarm_id = Path::new(&entry_path)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("unknown")
            .to_string();
        list.push(WorktreeInfo {
            swarm_id,
            branch: branch.take().unwrap_or_else(|| "detached".to_string()),
            path: entry_path,
            is_bare,
            created_at: 0,
        });
    }

    Ok(list)
}

/// Worktrees under `.helm/worktrees` (HelmADE-managed only).
pub fn list_managed_worktrees(repo_path: &str) -> Result<Vec<WorktreeInfo>, String> {
    let repo = require_repo(repo_path)?;
    let managed_root = repo.join(".helm").join("worktrees");
    let canonical_root = managed_root.canonicalize().unwrap_or(managed_root);
    Ok(list_worktrees(repo_path)?
        .into_iter()
        .filter(|info| {
            let path = Path::new(&info.path);
            let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
            canonical.parent() == Some(canonical_root.as_path())
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::TempRepo;

    #[test]
    fn test_worktree_lifecycle_in_temp_repo() {
        let repo = TempRepo::new("worktree");
        let id = "agent-alpha-1";

        let wt = create_worktree(repo.path_str(), id, None).expect("create worktree");
        assert_eq!(wt.swarm_id, id);
        assert_eq!(wt.branch, "helm/swarm-agent-alpha-1");
        let wt_path = Path::new(&wt.path);
        assert!(wt_path.join("README.md").exists());
        assert!(wt_path.join("node_modules").join("pkg.json").exists());

        // Neither `.helm/` nor the dependency symlink pollute git status.
        assert_eq!(run_git(&repo.path, ["status", "--porcelain"]).expect("status"), "");
        assert_eq!(run_git(wt_path, ["status", "--porcelain"]).expect("status"), "");

        let managed = list_managed_worktrees(repo.path_str()).expect("list");
        assert_eq!(managed.len(), 1);
        assert_eq!(managed[0].swarm_id, id);
        assert!(list_worktrees(repo.path_str()).expect("list all").len() >= 2);

        assert!(remove_worktree(repo.path_str(), id, true).expect("remove"));
        assert!(!wt_path.exists());
        assert!(repo.path.join("node_modules").join("pkg.json").exists());
        assert!(run_git(&repo.path, ["branch", "--list", "helm/*"])
            .expect("branches")
            .is_empty());
        assert!(list_managed_worktrees(repo.path_str()).expect("list").is_empty());
    }

    #[test]
    fn create_rejects_duplicate_and_invalid_ids() {
        let repo = TempRepo::new("worktree_dup");
        create_worktree(repo.path_str(), "dup", None).expect("first");
        assert!(create_worktree(repo.path_str(), "dup", None).is_err());
        assert!(create_worktree(repo.path_str(), "../escape", None).is_err());
        assert!(create_worktree(repo.path_str(), "ok", Some("--force")).is_err());
    }

    #[test]
    fn remove_is_idempotent_when_the_directory_was_deleted_by_hand() {
        let repo = TempRepo::new("worktree_gone");
        let wt = create_worktree(repo.path_str(), "gone", None).expect("create");
        std::fs::remove_dir_all(&wt.path).expect("manual delete");
        assert!(remove_worktree(repo.path_str(), "gone", true).expect("remove"));
        assert!(remove_worktree(repo.path_str(), "gone", true).expect("second remove"));
        assert!(run_git(&repo.path, ["branch", "--list", "helm/*"])
            .expect("branches")
            .is_empty());
    }

    #[test]
    fn non_repository_is_rejected_with_a_clear_message() {
        let dir = std::env::temp_dir().join(format!("helmade_norepo_{}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("dir");
        let err = create_worktree(dir.to_str().expect("utf-8"), "x", None).expect_err("not a repo");
        assert!(err.contains("não é um repositório Git"));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
