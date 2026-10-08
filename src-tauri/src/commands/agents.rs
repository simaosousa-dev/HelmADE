use crate::agents::{get_agent_by_id, scan_agent_directories, AgentDefinition};
use std::path::Path;

#[tauri::command]
pub fn list_discovered_agents(
    project_path: Option<String>,
) -> Result<Vec<AgentDefinition>, String> {
    let path_ref = project_path.as_deref().map(Path::new);
    Ok(scan_agent_directories(path_ref))
}

#[tauri::command]
pub fn get_agent_details(
    agent_id: String,
    project_path: Option<String>,
) -> Result<AgentDefinition, String> {
    let path_ref = project_path.as_deref().map(Path::new);
    get_agent_by_id(&agent_id, path_ref)
        .ok_or_else(|| format!("Agente '{}' não foi encontrado", agent_id))
}
