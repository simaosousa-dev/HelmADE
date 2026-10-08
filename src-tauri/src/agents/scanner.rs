use crate::agents::parser::{parse_agent_markdown, AgentDefinition};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

fn resolve_global_agent_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(home) = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
    {
        dirs.push(home.join(".gemini").join("config").join("agents"));
        dirs.push(home.join(".helm").join("agents"));
    }
    dirs
}

fn scan_directory_agents(dir: &Path, source: &str, collected: &mut Vec<AgentDefinition>) {
    if !dir.is_dir() {
        return;
    }

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    let mut entries: Vec<_> = entries.filter_map(|e| e.ok()).collect();
    entries.sort_by_key(|e| e.path());

    for entry in entries {
        let path = entry.path();
        if path.is_file() {
            let is_md = path
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext.eq_ignore_ascii_case("md"))
                .unwrap_or(false);

            if is_md {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(agent) = parse_agent_markdown(&path, &content, source) {
                        collected.push(agent);
                    }
                }
            }
        } else if path.is_dir() {
            // Check for AGENT.md or agent.md in the subdirectory
            let agent_upper = path.join("AGENT.md");
            let agent_lower = path.join("agent.md");

            if agent_upper.is_file() {
                if let Ok(content) = fs::read_to_string(&agent_upper) {
                    if let Ok(agent) = parse_agent_markdown(&agent_upper, &content, source) {
                        collected.push(agent);
                    }
                }
            } else if agent_lower.is_file() {
                if let Ok(content) = fs::read_to_string(&agent_lower) {
                    if let Ok(agent) = parse_agent_markdown(&agent_lower, &content, source) {
                        collected.push(agent);
                    }
                }
            } else if let Ok(sub_entries) = fs::read_dir(&path) {
                // Otherwise scan all *.md files in this folder
                let mut sub_entries: Vec<_> = sub_entries.filter_map(|e| e.ok()).collect();
                sub_entries.sort_by_key(|e| e.path());

                for sub in sub_entries {
                    let sub_path = sub.path();
                    if sub_path.is_file()
                        && sub_path
                            .extension()
                            .and_then(|ext| ext.to_str())
                            .map(|ext| ext.eq_ignore_ascii_case("md"))
                            .unwrap_or(false)
                    {
                        if let Ok(content) = fs::read_to_string(&sub_path) {
                            if let Ok(agent) = parse_agent_markdown(&sub_path, &content, source) {
                                collected.push(agent);
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Internal discovery function supporting custom directory lists for testing.
pub fn scan_directories_internal(
    global_dirs: &[PathBuf],
    project_path: Option<&Path>,
) -> Vec<AgentDefinition> {
    let mut project_agents = Vec::new();
    if let Some(p) = project_path {
        let project_dir = p.join(".helm").join("agents");
        scan_directory_agents(&project_dir, "project", &mut project_agents);
    }

    let mut global_agents = Vec::new();
    for gdir in global_dirs {
        scan_directory_agents(gdir, "global", &mut global_agents);
    }

    let mut result = Vec::new();
    let mut seen_ids = HashSet::new();

    // Project agents take precedence over global agents
    for agent in project_agents {
        let id_key = agent.id.to_lowercase();
        let name_key = agent.metadata.name.to_lowercase().replace(' ', "-");
        if !seen_ids.contains(&id_key) && !seen_ids.contains(&name_key) {
            seen_ids.insert(id_key);
            seen_ids.insert(name_key);
            result.push(agent);
        }
    }

    // Global agents are included only if not overridden by project agents
    for agent in global_agents {
        let id_key = agent.id.to_lowercase();
        let name_key = agent.metadata.name.to_lowercase().replace(' ', "-");
        if !seen_ids.contains(&id_key) && !seen_ids.contains(&name_key) {
            seen_ids.insert(id_key);
            seen_ids.insert(name_key);
            result.push(agent);
        }
    }

    result
}

/// Scans global and project-specific directories for agent personas (`.md` and `AGENT.md`).
/// Duplicate agent identifiers prioritize project-level configurations over global system ones.
pub fn scan_agent_directories(project_path: Option<&Path>) -> Vec<AgentDefinition> {
    let global_dirs = resolve_global_agent_dirs();
    scan_directories_internal(&global_dirs, project_path)
}

/// Retrieves a specific agent definition by ID or name, respecting project overrides.
pub fn get_agent_by_id(agent_id: &str, project_path: Option<&Path>) -> Option<AgentDefinition> {
    let agents = scan_agent_directories(project_path);
    agents.into_iter().find(|a| {
        a.id.eq_ignore_ascii_case(agent_id)
            || a.metadata.name.eq_ignore_ascii_case(agent_id)
            || a.metadata
                .name
                .to_lowercase()
                .replace(' ', "-")
                .eq_ignore_ascii_case(agent_id)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn make_test_temp_dir(prefix: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("helmade_test_{prefix}_{nanos}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn test_scan_and_project_precedence() {
        let global_dir = make_test_temp_dir("global");
        let project_dir = make_test_temp_dir("project");

        // 1. Create global agent 1 in subdirectory: global_dir/devops-release/AGENT.md
        let global_agent1_dir = global_dir.join("devops-release");
        fs::create_dir_all(&global_agent1_dir).unwrap();
        fs::write(
            global_agent1_dir.join("AGENT.md"),
            r#"---
name: devops-release
description: Global DevOps Release Engineer
---
Global devops prompt
"#,
        )
        .unwrap();

        // 2. Create global agent 2 directly: global_dir/qa-security-auditor.md
        fs::write(
            global_dir.join("qa-security-auditor.md"),
            r#"---
name: qa-security-auditor
description: Global QA Auditor
---
Global QA prompt
"#,
        )
        .unwrap();

        // 3. Create project agent override for devops-release in project_dir/.helm/agents/devops-release/AGENT.md
        let proj_agents = project_dir.join(".helm").join("agents").join("devops-release");
        fs::create_dir_all(&proj_agents).unwrap();
        fs::write(
            proj_agents.join("AGENT.md"),
            r#"---
name: devops-release
description: Project Overridden DevOps
default_model: claude-3-7-sonnet
---
Project devops prompt
"#,
        )
        .unwrap();

        // Perform internal scan
        let results = scan_directories_internal(&[global_dir.clone()], Some(&project_dir));

        assert_eq!(results.len(), 2, "Should discover exactly 2 distinct agents");

        // Find devops-release
        let devops = results
            .iter()
            .find(|a| a.id == "devops-release")
            .expect("devops-release must exist");
        assert_eq!(devops.source, "project", "Project version must take precedence");
        assert_eq!(
            devops.metadata.description, "Project Overridden DevOps",
            "Project description must override global"
        );
        assert_eq!(
            devops.metadata.default_model,
            Some("claude-3-7-sonnet".to_string())
        );

        // Find qa-security-auditor
        let qa = results
            .iter()
            .find(|a| a.id == "qa-security-auditor")
            .expect("qa-security-auditor must exist");
        assert_eq!(qa.source, "global");
        assert_eq!(qa.metadata.description, "Global QA Auditor");

        // Cleanup
        let _ = fs::remove_dir_all(global_dir);
        let _ = fs::remove_dir_all(project_dir);
    }
}
