use std::path::Path;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
pub struct AgentMetadata {
    pub name: String,
    pub description: String,
    pub role: Option<String>,
    #[serde(default)]
    pub enable_write_tools: bool,
    #[serde(default)]
    pub enable_mcp_tools: bool,
    #[serde(default)]
    pub tools: Vec<String>,
    #[serde(default)]
    pub skills: Vec<String>,
    #[serde(default)]
    pub default_model: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
pub struct AgentDefinition {
    pub id: String,
    pub metadata: AgentMetadata,
    pub system_prompt: String,
    pub file_path: String,
    pub source: String, // "global" ou "project"
}

#[derive(Copy, Clone, PartialEq)]
enum ListField {
    Tools,
    Skills,
}

fn unquote(s: &str) -> String {
    let trimmed = s.trim();
    if (trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() >= 2)
        || (trimmed.starts_with('\'') && trimmed.ends_with('\'') && trimmed.len() >= 2)
    {
        trimmed[1..trimmed.len() - 1].trim().to_string()
    } else {
        trimmed.to_string()
    }
}

fn parse_bool(s: &str) -> bool {
    let lower = s.trim().to_lowercase();
    matches!(lower.as_str(), "true" | "1" | "yes" | "on")
}

fn parse_inline_list(val: &str) -> Vec<String> {
    let trimmed = val.trim();
    if trimmed.starts_with('[') && trimmed.ends_with(']') && trimmed.len() >= 2 {
        let inner = &trimmed[1..trimmed.len() - 1];
        inner
            .split(',')
            .map(|item| unquote(item.trim()))
            .filter(|item| !item.is_empty())
            .collect()
    } else if trimmed.contains(',') {
        trimmed
            .split(',')
            .map(|item| unquote(item.trim()))
            .filter(|item| !item.is_empty())
            .collect()
    } else if !trimmed.is_empty() {
        vec![unquote(trimmed)]
    } else {
        Vec::new()
    }
}

/// Parses an Agent Markdown file, extracting YAML frontmatter between `---` boundaries
/// and using the remaining content as the system prompt.
///
/// # Ponytail Note:
/// Uses zero external dependencies for YAML parsing. The hand-crafted parser is resilient,
/// never panics on syntax errors or invalid fields, and provides clean fallbacks.
pub fn parse_agent_markdown(
    file_path: &Path,
    content: &str,
    source: &str,
) -> Result<AgentDefinition, String> {
    let lines: Vec<&str> = content.lines().collect();

    let mut open_idx = None;
    let mut close_idx = None;

    // Locate the opening and closing `---` markers
    for (i, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        if open_idx.is_none() {
            if trimmed == "---" {
                open_idx = Some(i);
            } else if !trimmed.is_empty() {
                // If we encounter non-empty text before `---`, frontmatter is missing
                break;
            }
        } else if trimmed == "---" || trimmed == "..." {
            close_idx = Some(i);
            break;
        }
    }

    let mut name: Option<String> = None;
    let mut description: Option<String> = None;
    let mut role: Option<String> = None;
    let mut enable_write_tools = false;
    let mut enable_mcp_tools = false;
    let mut tools: Vec<String> = Vec::new();
    let mut skills: Vec<String> = Vec::new();
    let mut default_model: Option<String> = None;

    let system_prompt = match (open_idx, close_idx) {
        (Some(start), Some(end)) if end > start => {
            let mut current_list: Option<ListField> = None;

            for line in &lines[start + 1..end] {
                let trimmed = line.trim();
                if trimmed.is_empty() || trimmed.starts_with('#') {
                    continue;
                }

                // Check for bullet list item: `- item` or `* item`
                if let Some(bullet_item) = trimmed
                    .strip_prefix("- ")
                    .or_else(|| trimmed.strip_prefix("* "))
                {
                    let cleaned = unquote(bullet_item.trim());
                    if !cleaned.is_empty() {
                        match current_list {
                            Some(ListField::Tools) => tools.push(cleaned),
                            Some(ListField::Skills) => skills.push(cleaned),
                            None => {}
                        }
                    }
                    continue;
                }

                // Reset list mode for standard key-value pairs
                current_list = None;

                if let Some((k, v)) = line.split_once(':') {
                    let key = k.trim().to_lowercase();
                    let raw_val = v.trim();

                    match key.as_str() {
                        "name" => {
                            let val = unquote(raw_val);
                            if !val.is_empty() {
                                name = Some(val);
                            }
                        }
                        "description" => {
                            let val = unquote(raw_val);
                            if !val.is_empty() {
                                description = Some(val);
                            }
                        }
                        "role" => {
                            let val = unquote(raw_val);
                            if !val.is_empty() {
                                role = Some(val);
                            }
                        }
                        "enable_write_tools" => {
                            enable_write_tools = parse_bool(raw_val);
                        }
                        "enable_mcp_tools" => {
                            enable_mcp_tools = parse_bool(raw_val);
                        }
                        "default_model" => {
                            let val = unquote(raw_val);
                            if !val.is_empty() {
                                default_model = Some(val);
                            }
                        }
                        "tools" => {
                            if raw_val.is_empty() {
                                current_list = Some(ListField::Tools);
                            } else {
                                tools.extend(parse_inline_list(raw_val));
                            }
                        }
                        "skills" => {
                            if raw_val.is_empty() {
                                current_list = Some(ListField::Skills);
                            } else {
                                skills.extend(parse_inline_list(raw_val));
                            }
                        }
                        _ => {
                            // Graciously ignore unrecognized keys
                        }
                    }
                }
            }

            // Extract everything after the closing `---` line
            if end + 1 < lines.len() {
                lines[end + 1..].join("\n").trim().to_string()
            } else {
                String::new()
            }
        }
        _ => {
            // No frontmatter found or unclosed `---`; whole content is system prompt
            content.trim().to_string()
        }
    };

    // Determine fallback name if not specified in frontmatter
    let resolved_name = name.unwrap_or_else(|| {
        let mut stem = file_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("agent");

        if stem.eq_ignore_ascii_case("agent") {
            if let Some(parent) = file_path.parent().and_then(|p| p.file_name()).and_then(|s| s.to_str()) {
                if !parent.eq_ignore_ascii_case("agents") && !parent.is_empty() {
                    stem = parent;
                }
            }
        }
        stem.to_string()
    });

    let resolved_description = description.unwrap_or_else(|| {
        format!("Agent persona for {}", resolved_name)
    });

    let id = resolved_name
        .to_lowercase()
        .replace(' ', "-");
    let id = if id.is_empty() { "unknown-agent".to_string() } else { id };

    Ok(AgentDefinition {
        id,
        metadata: AgentMetadata {
            name: resolved_name,
            description: resolved_description,
            role,
            enable_write_tools,
            enable_mcp_tools,
            tools,
            skills,
            default_model,
        },
        system_prompt,
        file_path: file_path.to_string_lossy().to_string(),
        source: source.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_valid_full_frontmatter() {
        let content = r#"---
name: Full-Stack Engineer
description: Senior fullstack developer with Rust & TypeScript experience
role: specialist
enable_write_tools: true
enable_mcp_tools: true
tools:
  - bash
  - git
skills:
  - rust-patterns
  - ponytail
default_model: claude-3-5-sonnet
---

# Full-Stack Engineer Prompt
You are a senior full-stack engineer. Build robust minimal systems.
"#;
        let path = PathBuf::from("/Users/test/.gemini/config/agents/fullstack-engineer/AGENT.md");
        let result = parse_agent_markdown(&path, content, "global").expect("parsing should succeed");

        assert_eq!(result.id, "full-stack-engineer");
        assert_eq!(result.metadata.name, "Full-Stack Engineer");
        assert_eq!(
            result.metadata.description,
            "Senior fullstack developer with Rust & TypeScript experience"
        );
        assert_eq!(result.metadata.role, Some("specialist".to_string()));
        assert!(result.metadata.enable_write_tools);
        assert!(result.metadata.enable_mcp_tools);
        assert_eq!(result.metadata.tools, vec!["bash", "git"]);
        assert_eq!(result.metadata.skills, vec!["rust-patterns", "ponytail"]);
        assert_eq!(
            result.metadata.default_model,
            Some("claude-3-5-sonnet".to_string())
        );
        assert_eq!(result.source, "global");
        assert!(result.system_prompt.contains("You are a senior full-stack engineer."));
    }

    #[test]
    fn test_partial_frontmatter() {
        let content = r#"---
name: minimal-agent
---

Only minimal instructions here.
"#;
        let path = PathBuf::from("/test/agents/minimal.md");
        let result = parse_agent_markdown(&path, content, "project").expect("parsing should succeed");

        assert_eq!(result.id, "minimal-agent");
        assert_eq!(result.metadata.name, "minimal-agent");
        assert_eq!(result.metadata.description, "Agent persona for minimal-agent");
        assert_eq!(result.metadata.role, None);
        assert!(!result.metadata.enable_write_tools);
        assert!(!result.metadata.enable_mcp_tools);
        assert!(result.metadata.tools.is_empty());
        assert!(result.metadata.skills.is_empty());
        assert_eq!(result.metadata.default_model, None);
        assert_eq!(result.source, "project");
        assert_eq!(result.system_prompt, "Only minimal instructions here.");
    }

    #[test]
    fn test_malformed_frontmatter_resilience() {
        let content = r#"---
<<< malformed syntax >>>
unparsed garbage without colon
name: resilient-agent
enable_write_tools: unknown_boolean_value
tools: [bash, "fs_tool"]
---

System prompt after corrupt yaml lines.
"#;
        let path = PathBuf::from("/test/agents/resilient.md");
        let result = parse_agent_markdown(&path, content, "global").expect("should gracefully parse");

        assert_eq!(result.id, "resilient-agent");
        assert_eq!(result.metadata.name, "resilient-agent");
        assert!(!result.metadata.enable_write_tools);
        assert_eq!(result.metadata.tools, vec!["bash", "fs_tool"]);
        assert_eq!(result.system_prompt, "System prompt after corrupt yaml lines.");
    }

    #[test]
    fn test_empty_or_no_frontmatter_fallback() {
        let content = "# Header\nDirect system prompt with no frontmatter block.";
        let path = PathBuf::from("/Users/test/.gemini/config/agents/orchestrator/AGENT.md");
        let result = parse_agent_markdown(&path, content, "global").expect("fallback should succeed");

        // Derived from parent folder "orchestrator" because stem is "AGENT"
        assert_eq!(result.id, "orchestrator");
        assert_eq!(result.metadata.name, "orchestrator");
        assert_eq!(result.metadata.description, "Agent persona for orchestrator");
        assert_eq!(result.system_prompt, content);
    }

    #[test]
    fn test_inline_lists_parsing() {
        let content = r#"---
name: list-test
tools: [tool1, "tool2", 'tool3']
skills: [skill1, skill2]
---
Prompt body
"#;
        let path = PathBuf::from("/test/agents/list-test.md");
        let result = parse_agent_markdown(&path, content, "project").unwrap();

        assert_eq!(result.metadata.tools, vec!["tool1", "tool2", "tool3"]);
        assert_eq!(result.metadata.skills, vec!["skill1", "skill2"]);
    }
}
