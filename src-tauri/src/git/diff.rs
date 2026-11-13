use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Component, Path};

use super::worktree::{branch_name, worktree_dir};
use super::{current_branch, require_repo, run_git, validate_branch, validate_id};

/// Untracked files larger than this are listed but not rendered as a patch.
const MAX_UNTRACKED_PATCH_BYTES: u64 = 1024 * 1024;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct DiffFile {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String, // "added", "modified", "deleted"
    pub additions: usize,
    pub deletions: usize,
    pub binary: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct DiffSummary {
    pub swarm_id: String,
    pub branch: String,
    pub base_branch: String,
    pub files: Vec<DiffFile>,
    pub total_files: usize,
    pub total_additions: usize,
    pub total_deletions: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct FileDiffDetail {
    pub path: String,
    pub patch: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct MergeResult {
    pub success: bool,
    pub strategy: String,
    pub merged_branch: String,
    pub target_branch: String,
    pub commit_sha: Option<String>,
    pub conflicts: Vec<String>,
    pub message: String,
}

fn resolve_base(repo: &Path, base_branch: Option<&str>) -> Result<String, String> {
    match base_branch {
        Some(name) => validate_branch(name).map(str::to_string),
        None => current_branch(repo),
    }
}

/// Where the diff is computed: the agent's worktree (so uncommitted work is included)
/// or, once the worktree is gone, the branch itself.
struct DiffScope {
    cwd: std::path::PathBuf,
    /// Commit the agent's work is compared against.
    merge_base: String,
    /// `Some(branch)` when comparing commits only; `None` compares the working tree.
    branch: Option<String>,
}

impl DiffScope {
    fn resolve(repo: &Path, id: &str, base: &str) -> Result<Self, String> {
        let branch = branch_name(id);
        let merge_base = run_git(repo, ["merge-base", base, &branch])
            .map_err(|_| "A branch do agente já não existe ou não partilha histórico com a base".to_string())?;
        let dir = worktree_dir(repo, id);
        if dir.is_dir() {
            return Ok(Self {
                cwd: dir,
                merge_base,
                branch: None,
            });
        }
        Ok(Self {
            cwd: repo.to_path_buf(),
            merge_base,
            branch: Some(branch),
        })
    }

    fn diff(&self, extra: &[&str]) -> Result<String, String> {
        // ponytail: renames are reported as delete + add; enable `-M` and parse `R` records
        // if rename tracking ever matters in the review UI.
        let mut args = vec!["-c", "core.quotepath=false", "diff", "--no-renames"];
        args.extend_from_slice(extra);
        args.push(&self.merge_base);
        if let Some(branch) = &self.branch {
            args.push(branch);
        }
        run_git(&self.cwd, args)
    }

    fn untracked(&self) -> Vec<String> {
        if self.branch.is_some() {
            return Vec::new();
        }
        run_git(
            &self.cwd,
            ["-c", "core.quotepath=false", "ls-files", "--others", "--exclude-standard"],
        )
        .map(|out| out.lines().map(str::to_string).collect())
        .unwrap_or_default()
    }
}

/// Rejects absolute paths and `..` so a file request can never leave the worktree.
fn validate_relative_path(file_path: &str) -> Result<&Path, String> {
    let path = Path::new(file_path);
    let safe = !file_path.is_empty()
        && path
            .components()
            .all(|component| matches!(component, Component::Normal(_)));
    if !safe {
        return Err("Caminho de ficheiro inválido".to_string());
    }
    Ok(path)
}

/// Summary of everything the agent changed relative to the base branch,
/// including work it has not committed yet.
pub fn get_worktree_diff(
    repo_path: &str,
    worktree_id: &str,
    base_branch: Option<&str>,
) -> Result<DiffSummary, String> {
    let id = validate_id(worktree_id)?;
    let repo = require_repo(repo_path)?;
    let base = resolve_base(repo, base_branch)?;
    let scope = DiffScope::resolve(repo, id, &base)?;

    let mut stats: HashMap<String, (usize, usize, bool)> = HashMap::new();
    for line in scope.diff(&["--numstat"])?.lines() {
        let mut parts = line.splitn(3, '\t');
        let (Some(added), Some(deleted), Some(path)) = (parts.next(), parts.next(), parts.next())
        else {
            continue;
        };
        let binary = added == "-" && deleted == "-";
        stats.insert(
            path.to_string(),
            (added.parse().unwrap_or(0), deleted.parse().unwrap_or(0), binary),
        );
    }

    let mut files = Vec::new();
    for line in scope.diff(&["--name-status"])?.lines() {
        let Some((code, path)) = line.split_once('\t') else {
            continue;
        };
        let status = match code.chars().next() {
            Some('A') => "added",
            Some('D') => "deleted",
            _ => "modified",
        };
        let (additions, deletions, binary) = stats.get(path).copied().unwrap_or((0, 0, false));
        files.push(DiffFile {
            path: path.to_string(),
            old_path: None,
            status: status.to_string(),
            additions,
            deletions,
            binary,
        });
    }

    for path in scope.untracked() {
        let full_path = scope.cwd.join(&path);
        let content = fs::read(&full_path).unwrap_or_default();
        let binary = content.contains(&0);
        let additions = if binary {
            0
        } else {
            String::from_utf8_lossy(&content).lines().count()
        };
        files.push(DiffFile {
            path,
            old_path: None,
            status: "added".to_string(),
            additions,
            deletions: 0,
            binary,
        });
    }

    files.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(DiffSummary {
        swarm_id: id.to_string(),
        branch: branch_name(id),
        base_branch: base,
        total_files: files.len(),
        total_additions: files.iter().map(|f| f.additions).sum(),
        total_deletions: files.iter().map(|f| f.deletions).sum(),
        files,
    })
}

/// Unified diff of a single file relative to the base branch.
pub fn get_file_diff(
    repo_path: &str,
    worktree_id: &str,
    file_path: &str,
    base_branch: Option<&str>,
) -> Result<FileDiffDetail, String> {
    let id = validate_id(worktree_id)?;
    let repo = require_repo(repo_path)?;
    let base = resolve_base(repo, base_branch)?;
    let relative = validate_relative_path(file_path)?;
    let scope = DiffScope::resolve(repo, id, &base)?;

    let mut patch = scope.diff(&["-U3", "--", file_path]).unwrap_or_default();
    if !patch.is_empty() {
        patch.push('\n');
    }

    // An untracked file has no git diff yet: render its content as an addition.
    if patch.trim().is_empty() && scope.branch.is_none() {
        let full_path = scope.cwd.join(relative);
        let size = fs::metadata(&full_path).map(|m| m.len()).unwrap_or(0);
        if full_path.is_file() && size <= MAX_UNTRACKED_PATCH_BYTES {
            let bytes = fs::read(&full_path).unwrap_or_default();
            if !bytes.contains(&0) {
                let content = String::from_utf8_lossy(&bytes);
                patch = format!(
                    "--- /dev/null\n+++ b/{file_path}\n@@ -0,0 +1,{} @@\n",
                    content.lines().count()
                );
                for line in content.lines() {
                    patch.push('+');
                    patch.push_str(line);
                    patch.push('\n');
                }
            }
        }
    }

    Ok(FileDiffDetail {
        path: file_path.to_string(),
        patch,
    })
}

/// Commits whatever the agent left uncommitted, so a merge never drops work.
fn commit_pending_changes(worktree: &Path, id: &str) -> Result<bool, String> {
    if run_git(worktree, ["status", "--porcelain"])?.is_empty() {
        return Ok(false);
    }
    run_git(worktree, ["add", "-A"])?;
    run_git(
        worktree,
        [
            "commit",
            "--quiet",
            "--no-verify",
            "-m",
            &format!("chore(swarm): snapshot uncommitted work from {id}"),
        ],
    )
    .map_err(|stderr| format!("Falha ao guardar o trabalho pendente do agente: {stderr}"))?;
    Ok(true)
}

fn unmerged_files(cwd: &Path) -> Vec<String> {
    run_git(cwd, ["diff", "--name-only", "--diff-filter=U"])
        .map(|out| {
            out.lines()
                .map(|line| line.trim().to_string())
                .filter(|line| !line.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

fn conflict_result(
    strategy: &str,
    branch: String,
    base: String,
    conflicts: Vec<String>,
    message: &str,
) -> MergeResult {
    MergeResult {
        success: false,
        strategy: strategy.to_string(),
        merged_branch: branch,
        target_branch: base,
        commit_sha: None,
        conflicts,
        message: message.to_string(),
    }
}

/// Integrates an agent branch into the base branch. The main checkout must be clean;
/// on conflict everything is rolled back and the conflicting files are reported.
pub fn merge_worktree(
    repo_path: &str,
    worktree_id: &str,
    strategy: &str,
    commit_message: Option<&str>,
    base_branch: Option<&str>,
) -> Result<MergeResult, String> {
    let id = validate_id(worktree_id)?;
    let repo = require_repo(repo_path)?;
    let base = resolve_base(repo, base_branch)?;
    if !matches!(strategy, "squash" | "rebase") {
        return Err("Estratégia de fusão não suportada. Usa 'squash' ou 'rebase'.".to_string());
    }
    let branch = branch_name(id);
    let agent_dir = worktree_dir(repo, id);

    if !run_git(repo, ["status", "--porcelain"])?.is_empty() {
        return Err("O repositório principal contém alterações locais não commitadas. Conclui ou descarta essas alterações antes de fundir.".to_string());
    }
    if agent_dir.is_dir() {
        commit_pending_changes(&agent_dir, id)?;
    }
    let ahead = run_git(repo, ["rev-list", "--count", &format!("{base}..{branch}")])
        .map_err(|_| "A branch do agente já não existe".to_string())?;
    if ahead == "0" {
        return Err("Este agente não tem alterações para fundir.".to_string());
    }
    if current_branch(repo)? != base {
        run_git(repo, ["checkout", "--quiet", &base])
            .map_err(|stderr| format!("Falha ao mudar para a branch base: {stderr}"))?;
    }

    if strategy == "squash" {
        if run_git(repo, ["merge", "--squash", "--quiet", &branch]).is_err() {
            let conflicts = unmerged_files(repo);
            // Safe: the main checkout was verified clean above.
            run_git(repo, ["reset", "--hard", "--quiet", "HEAD"])?;
            return Ok(conflict_result(
                strategy,
                branch,
                base,
                conflicts,
                "Conflitos detetados durante o Squash & Merge. A operação foi revertida em segurança.",
            ));
        }
        let default_message = format!("feat(swarm): integrate changes from {id}");
        let message = commit_message
            .map(str::trim)
            .filter(|m| !m.is_empty())
            .unwrap_or(&default_message);
        if let Err(stderr) = run_git(repo, ["commit", "--quiet", "-m", message]) {
            run_git(repo, ["reset", "--hard", "--quiet", "HEAD"])?;
            return Err(format!("Falha ao concluir o commit de fusão: {stderr}"));
        }
    } else {
        // Replay the agent's commits on top of the base inside its own worktree, then fast-forward.
        if agent_dir.is_dir() && run_git(&agent_dir, ["rebase", "--quiet", &base]).is_err() {
            let conflicts = unmerged_files(&agent_dir);
            run_git(&agent_dir, ["rebase", "--abort"])?;
            return Ok(conflict_result(
                strategy,
                branch,
                base,
                conflicts,
                "Conflitos detetados durante o Rebase. A operação foi revertida em segurança.",
            ));
        }
        if run_git(repo, ["merge", "--ff-only", "--quiet", &branch]).is_err() {
            return Ok(conflict_result(
                strategy,
                branch,
                base,
                Vec::new(),
                "Não foi possível avançar a branch base (histórico divergente).",
            ));
        }
    }

    let sha = run_git(repo, ["rev-parse", "HEAD"])?;
    Ok(MergeResult {
        success: true,
        strategy: strategy.to_string(),
        merged_branch: branch,
        target_branch: base,
        commit_sha: Some(sha),
        conflicts: Vec::new(),
        message: "Alterações integradas na branch base com sucesso.".to_string(),
    })
}

/// Aborts an in-progress merge in the main checkout. Never discards unrelated local changes.
pub fn abort_merge(repo_path: &str) -> Result<bool, String> {
    let repo = require_repo(repo_path)?;
    if run_git(repo, ["rev-parse", "--verify", "--quiet", "MERGE_HEAD"]).is_err() {
        return Ok(false);
    }
    run_git(repo, ["merge", "--abort"])?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::test_support::TempRepo;
    use crate::git::worktree::{create_worktree, remove_worktree};

    fn commit_all(dir: &Path, message: &str) {
        run_git(dir, ["add", "-A"]).expect("add");
        run_git(dir, ["commit", "--quiet", "-m", message]).expect("commit");
    }

    #[test]
    fn test_diff_and_merge_lifecycle_in_temp_repo() {
        let repo = TempRepo::new("diff");
        let id = "test-grid-merge";
        let wt = create_worktree(repo.path_str(), id, Some("main")).expect("worktree");
        let wt_path = Path::new(&wt.path);

        // One committed change, one uncommitted change and one untracked file.
        fs::write(wt_path.join("README.md"), "# Test\nInitial line\nAdded line in swarm\n").expect("write");
        commit_all(wt_path, "feat: committed change");
        fs::write(wt_path.join("README.md"), "# Test\nInitial line\nAdded line in swarm\nPending line\n")
            .expect("write");
        fs::write(wt_path.join("feature.txt"), "New feature created in swarm grid\n").expect("write");

        let summary = get_worktree_diff(repo.path_str(), id, Some("main")).expect("diff");
        assert_eq!(summary.swarm_id, id);
        assert_eq!(summary.branch, "helm/swarm-test-grid-merge");
        assert_eq!(summary.total_files, 2);
        let readme = summary.files.iter().find(|f| f.path == "README.md").expect("readme");
        assert_eq!((readme.status.as_str(), readme.additions), ("modified", 2));
        let feature = summary.files.iter().find(|f| f.path == "feature.txt").expect("feature");
        assert_eq!((feature.status.as_str(), feature.additions), ("added", 1));

        let untracked = get_file_diff(repo.path_str(), id, "feature.txt", Some("main")).expect("patch");
        assert!(untracked.patch.contains("+New feature created in swarm grid"));
        let tracked = get_file_diff(repo.path_str(), id, "README.md", Some("main")).expect("patch");
        assert!(tracked.patch.contains("+Pending line"));

        let merge = merge_worktree(
            repo.path_str(),
            id,
            "squash",
            Some("feat(merge): integrate swarm grid"),
            Some("main"),
        )
        .expect("merge");
        assert!(merge.success, "{}", merge.message);
        assert!(merge.commit_sha.is_some());

        // Uncommitted and untracked work made it into main.
        assert!(repo.path.join("feature.txt").exists());
        let merged = fs::read_to_string(repo.path.join("README.md")).expect("read");
        assert!(merged.contains("Pending line"));
        assert_eq!(
            run_git(&repo.path, ["log", "-1", "--format=%s"]).expect("log"),
            "feat(merge): integrate swarm grid"
        );

        remove_worktree(repo.path_str(), id, true).expect("cleanup");
    }

    #[test]
    fn squash_conflict_is_reported_and_leaves_main_clean() {
        let repo = TempRepo::new("diff_conflict");
        let id = "conflict";
        let wt = create_worktree(repo.path_str(), id, Some("main")).expect("worktree");
        fs::write(Path::new(&wt.path).join("README.md"), "# Agent version\n").expect("write");
        fs::write(repo.path.join("README.md"), "# Main version\n").expect("write");
        commit_all(&repo.path, "docs: change readme on main");
        let head_before = run_git(&repo.path, ["rev-parse", "HEAD"]).expect("head");

        let merge = merge_worktree(repo.path_str(), id, "squash", None, Some("main")).expect("merge");
        assert!(!merge.success);
        assert_eq!(merge.conflicts, vec!["README.md".to_string()]);
        assert_eq!(run_git(&repo.path, ["rev-parse", "HEAD"]).expect("head"), head_before);
        assert_eq!(run_git(&repo.path, ["status", "--porcelain"]).expect("status"), "");
        // The agent's work is still there, now committed on its branch.
        let agent_readme = fs::read_to_string(Path::new(&wt.path).join("README.md")).expect("read");
        assert_eq!(agent_readme, "# Agent version\n");
    }

    #[test]
    fn rebase_strategy_replays_commits_on_top_of_a_moved_base() {
        let repo = TempRepo::new("diff_rebase");
        let id = "rebase";
        let wt = create_worktree(repo.path_str(), id, Some("main")).expect("worktree");
        fs::write(Path::new(&wt.path).join("agent.txt"), "agent\n").expect("write");
        fs::write(repo.path.join("main.txt"), "main\n").expect("write");
        commit_all(&repo.path, "feat: main moved on");

        let merge = merge_worktree(repo.path_str(), id, "rebase", None, Some("main")).expect("merge");
        assert!(merge.success, "{}", merge.message);
        assert!(repo.path.join("agent.txt").exists());
        assert!(repo.path.join("main.txt").exists());
        // Linear history: no merge commit was created.
        assert_eq!(run_git(&repo.path, ["rev-list", "--merges", "--count", "HEAD"]).expect("count"), "0");
    }

    #[test]
    fn merge_refuses_a_dirty_main_checkout_and_empty_branches() {
        let repo = TempRepo::new("diff_dirty");
        let id = "dirty";
        create_worktree(repo.path_str(), id, Some("main")).expect("worktree");

        let empty = merge_worktree(repo.path_str(), id, "squash", None, Some("main")).expect_err("nothing");
        assert!(empty.contains("não tem alterações"));

        fs::write(repo.path.join("README.md"), "local edit\n").expect("write");
        let dirty = merge_worktree(repo.path_str(), id, "squash", None, Some("main")).expect_err("dirty");
        assert!(dirty.contains("alterações locais"));
        assert_eq!(fs::read_to_string(repo.path.join("README.md")).expect("read"), "local edit\n");

        assert!(merge_worktree(repo.path_str(), id, "octopus", None, Some("main")).is_err());
    }

    #[test]
    fn file_diff_rejects_paths_outside_the_worktree() {
        let repo = TempRepo::new("diff_traversal");
        let id = "traversal";
        create_worktree(repo.path_str(), id, Some("main")).expect("worktree");
        for bad in ["../../README.md", "/etc/passwd", "", "a/../../b"] {
            assert!(
                get_file_diff(repo.path_str(), id, bad, Some("main")).is_err(),
                "accepted {bad:?}"
            );
        }
    }

    #[test]
    fn abort_merge_never_discards_unrelated_local_changes() {
        let repo = TempRepo::new("diff_abort");
        fs::write(repo.path.join("README.md"), "work in progress\n").expect("write");
        assert!(!abort_merge(repo.path_str()).expect("abort"));
        assert_eq!(
            fs::read_to_string(repo.path.join("README.md")).expect("read"),
            "work in progress\n"
        );
    }

    #[test]
    fn diff_survives_removal_of_the_worktree_directory() {
        let repo = TempRepo::new("diff_branch_only");
        let id = "branch-only";
        let wt = create_worktree(repo.path_str(), id, Some("main")).expect("worktree");
        fs::write(Path::new(&wt.path).join("kept.txt"), "kept\n").expect("write");
        commit_all(Path::new(&wt.path), "feat: keep");
        remove_worktree(repo.path_str(), id, false).expect("remove dir only");

        let summary = get_worktree_diff(repo.path_str(), id, Some("main")).expect("diff");
        assert_eq!(summary.total_files, 1);
        assert_eq!(summary.files[0].path, "kept.txt");
    }
}
