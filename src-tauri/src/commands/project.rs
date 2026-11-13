use std::sync::Arc;
use tauri::State;

use crate::db::{DbState, Project};
use crate::error::{HelmError, HelmResult};

pub type DbHandle = Arc<DbState>;

#[tauri::command]
pub fn upsert_project(
    state: State<'_, DbHandle>,
    id: String,
    name: String,
    path: String,
) -> HelmResult<Project> {
    if id.trim().is_empty() || name.trim().is_empty() {
        return Err(HelmError::invalid("O projeto precisa de identificador e nome"));
    }
    if !std::path::Path::new(&path).is_dir() {
        return Err(HelmError::not_found("A pasta do projeto não existe"));
    }
    state.upsert_project(&id, &name, &path)
}

#[tauri::command]
pub fn list_recent_projects(
    state: State<'_, DbHandle>,
    limit: Option<usize>,
) -> HelmResult<Vec<Project>> {
    state.list_recent_projects(limit.unwrap_or(20).min(200))
}

#[tauri::command]
pub fn delete_project(state: State<'_, DbHandle>, id: String) -> HelmResult<bool> {
    state.delete_project(&id)
}
