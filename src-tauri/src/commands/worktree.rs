use crate::error::{HelmError, HelmResult};
use crate::git::diff::{self, DiffSummary, FileDiffDetail, MergeResult};

#[tauri::command]
pub fn get_worktree_diff(
    repo_path: String,
    swarm_id: String,
    base_branch: Option<String>,
) -> HelmResult<DiffSummary> {
    diff::get_worktree_diff(&repo_path, &swarm_id, base_branch.as_deref()).map_err(HelmError::git)
}

#[tauri::command]
pub fn get_file_diff(
    repo_path: String,
    swarm_id: String,
    file_path: String,
    base_branch: Option<String>,
) -> HelmResult<FileDiffDetail> {
    diff::get_file_diff(&repo_path, &swarm_id, &file_path, base_branch.as_deref())
        .map_err(HelmError::git)
}

#[tauri::command]
pub fn merge_worktree(
    repo_path: String,
    swarm_id: String,
    strategy: String,
    commit_message: Option<String>,
    base_branch: Option<String>,
) -> HelmResult<MergeResult> {
    diff::merge_worktree(
        &repo_path,
        &swarm_id,
        &strategy,
        commit_message.as_deref(),
        base_branch.as_deref(),
    )
    .map_err(HelmError::git)
}

#[tauri::command]
pub fn abort_merge(repo_path: String) -> HelmResult<bool> {
    diff::abort_merge(&repo_path).map_err(HelmError::git)
}
