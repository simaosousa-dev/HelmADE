pub mod schema;

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::agents::protocol::{A2AMessage, A2AMessageType};
use crate::error::{HelmError, HelmResult};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub created_at: i64,
    pub last_opened_at: i64,
    pub settings_json: Option<String>,
}

/// One agent panel of a swarm, with the workspace it owns.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PanelRecord {
    pub key: String,
    pub title: String,
    pub agent_id: String,
    pub role: String,
    pub color: String,
    /// `agent` or `shell`.
    pub kind: String,
    /// Agent CLI that runs in the panel (`claude`, `codex`, …); `None` for a shell.
    pub cli: Option<String>,
    pub model_id: String,
    pub worktree_id: String,
    pub worktree_path: String,
    pub branch: String,
    pub port: u16,
}

/// A swarm: one grid tab of a project.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SwarmRecord {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub preset_id: Option<String>,
    pub layout: String,
    pub base_branch: String,
    pub auto_approve: bool,
    pub position: i64,
    pub created_at: i64,
    pub panels: Vec<PanelRecord>,
}

pub struct DbState {
    conn: Mutex<Connection>,
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

fn project_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Project> {
    Ok(Project {
        id: row.get(0)?,
        name: row.get(1)?,
        path: row.get(2)?,
        created_at: row.get(3)?,
        last_opened_at: row.get(4)?,
        settings_json: row.get(5)?,
    })
}

impl DbState {
    pub fn open(path: &Path) -> HelmResult<Self> {
        let mut conn = Connection::open(path)?;
        schema::init_database(&mut conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn open_in_memory() -> HelmResult<Self> {
        let mut conn = Connection::open_in_memory()?;
        schema::init_database(&mut conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    fn conn(&self) -> HelmResult<MutexGuard<'_, Connection>> {
        Ok(self.conn.lock()?)
    }

    // ── Projects ────────────────────────────────────────────────────────────

    pub fn upsert_project(&self, id: &str, name: &str, path: &str) -> HelmResult<Project> {
        let now = now_secs();
        let conn = self.conn()?;
        conn.execute(
            "INSERT INTO projects (id, name, path, created_at, last_opened_at, settings_json)
             VALUES (?1, ?2, ?3, ?4, ?4, NULL)
             ON CONFLICT(path) DO UPDATE SET last_opened_at = ?4, name = ?2;",
            params![id, name, path, now],
        )?;
        Ok(conn.query_row(
            "SELECT id, name, path, created_at, last_opened_at, settings_json
             FROM projects WHERE path = ?1;",
            params![path],
            project_from_row,
        )?)
    }

    pub fn list_recent_projects(&self, limit: usize) -> HelmResult<Vec<Project>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, path, created_at, last_opened_at, settings_json
             FROM projects ORDER BY last_opened_at DESC LIMIT ?1;",
        )?;
        let projects = stmt
            .query_map(params![limit as i64], project_from_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(projects)
    }

    pub fn delete_project(&self, id: &str) -> HelmResult<bool> {
        let affected = self
            .conn()?
            .execute("DELETE FROM projects WHERE id = ?1;", params![id])?;
        Ok(affected > 0)
    }

    // ── Swarms ──────────────────────────────────────────────────────────────

    /// Inserts or replaces a swarm and its panels atomically.
    pub fn save_swarm(&self, swarm: &SwarmRecord) -> HelmResult<()> {
        let now = now_secs();
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        tx.execute(
            "INSERT INTO sessions
                (id, project_id, name, layout, created_at, updated_at, preset_id, base_branch, position, auto_approve)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(id) DO UPDATE SET
                name = ?3, layout = ?4, updated_at = ?6, preset_id = ?7,
                base_branch = ?8, position = ?9, auto_approve = ?10;",
            params![
                swarm.id,
                swarm.project_id,
                swarm.name,
                swarm.layout,
                swarm.created_at,
                now,
                swarm.preset_id,
                swarm.base_branch,
                swarm.position,
                swarm.auto_approve,
            ],
        )?;
        tx.execute("DELETE FROM grid_panels WHERE session_id = ?1;", params![swarm.id])?;
        for (index, panel) in swarm.panels.iter().enumerate() {
            tx.execute(
                "INSERT INTO grid_panels
                    (id, session_id, panel_index, agent_role, model_id, worktree_path, worktree_branch,
                     status, created_at, panel_key, title, agent_id, color, kind, cli, port)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'idle', ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15);",
                params![
                    panel.worktree_id,
                    swarm.id,
                    index as i64,
                    panel.role,
                    panel.model_id,
                    panel.worktree_path,
                    panel.branch,
                    now,
                    panel.key,
                    panel.title,
                    panel.agent_id,
                    panel.color,
                    panel.kind,
                    panel.cli,
                    panel.port,
                ],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    fn panels_of(conn: &Connection, swarm_id: &str) -> rusqlite::Result<Vec<PanelRecord>> {
        let mut stmt = conn.prepare(
            "SELECT panel_key, title, agent_id, agent_role, color, kind, cli, model_id, id,
                    worktree_path, worktree_branch, port
             FROM grid_panels WHERE session_id = ?1 ORDER BY panel_index;",
        )?;
        let panels = stmt
            .query_map(params![swarm_id], |row| {
                Ok(PanelRecord {
                    key: row.get(0)?,
                    title: row.get(1)?,
                    agent_id: row.get(2)?,
                    role: row.get(3)?,
                    color: row.get(4)?,
                    kind: row.get(5)?,
                    cli: row.get(6)?,
                    model_id: row.get(7)?,
                    worktree_id: row.get(8)?,
                    worktree_path: row.get::<_, Option<String>>(9)?.unwrap_or_default(),
                    branch: row.get::<_, Option<String>>(10)?.unwrap_or_default(),
                    port: row.get::<_, Option<u16>>(11)?.unwrap_or(0),
                })
            })?
            .collect();
        panels
    }

    /// Swarms of a project in tab order.
    pub fn list_swarms(&self, project_id: &str) -> HelmResult<Vec<SwarmRecord>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, preset_id, layout, base_branch, auto_approve, position, created_at
             FROM sessions WHERE project_id = ?1 ORDER BY position, created_at;",
        )?;
        let mut swarms = stmt
            .query_map(params![project_id], |row| {
                Ok(SwarmRecord {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    name: row.get(2)?,
                    preset_id: row.get(3)?,
                    layout: row.get(4)?,
                    base_branch: row.get(5)?,
                    auto_approve: row.get(6)?,
                    position: row.get(7)?,
                    created_at: row.get(8)?,
                    panels: Vec::new(),
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        for swarm in &mut swarms {
            swarm.panels = Self::panels_of(&conn, &swarm.id)?;
        }
        Ok(swarms)
    }

    /// Worktree ids owned by any swarm of the project (used to spot orphans).
    pub fn list_worktree_ids(&self, project_id: &str) -> HelmResult<Vec<String>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT p.id FROM grid_panels p JOIN sessions s ON s.id = p.session_id
             WHERE s.project_id = ?1;",
        )?;
        let ids = stmt
            .query_map(params![project_id], |row| row.get(0))?
            .collect::<rusqlite::Result<Vec<String>>>()?;
        Ok(ids)
    }

    /// Deletes a swarm, its panels and its Team Wire history.
    pub fn delete_swarm(&self, swarm_id: &str) -> HelmResult<bool> {
        let mut conn = self.conn()?;
        let tx = conn.transaction()?;
        tx.execute("DELETE FROM a2a_messages WHERE swarm_id = ?1;", params![swarm_id])?;
        let affected = tx.execute("DELETE FROM sessions WHERE id = ?1;", params![swarm_id])?;
        tx.commit()?;
        Ok(affected > 0)
    }

    // ── Team Wire history ───────────────────────────────────────────────────

    pub fn insert_a2a_message(&self, message: &A2AMessage) -> HelmResult<()> {
        self.conn()?.execute(
            "INSERT OR REPLACE INTO a2a_messages
                (id, swarm_id, sender_id, sender_name, sender_role, recipient_id, recipient_name,
                 content, message_type, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10);",
            params![
                message.id,
                message.swarm_id,
                message.sender_id,
                message.sender_name,
                message.sender_role,
                message.recipient_id,
                message.recipient_name,
                message.content,
                message.message_type.as_str(),
                message.timestamp,
            ],
        )?;
        Ok(())
    }

    /// Most recent messages of a swarm, oldest first.
    pub fn list_a2a_messages(&self, swarm_id: &str, limit: usize) -> HelmResult<Vec<A2AMessage>> {
        let conn = self.conn()?;
        let mut stmt = conn.prepare(
            "SELECT id, swarm_id, sender_id, sender_name, sender_role, recipient_id, recipient_name,
                    content, message_type, timestamp
             FROM (SELECT *, rowid AS seq FROM a2a_messages WHERE swarm_id = ?1
                   ORDER BY timestamp DESC, rowid DESC LIMIT ?2)
             ORDER BY timestamp, seq;",
        )?;
        let messages = stmt
            .query_map(params![swarm_id, limit as i64], |row| {
                let kind: String = row.get(8)?;
                Ok(A2AMessage {
                    id: row.get(0)?,
                    swarm_id: row.get(1)?,
                    sender_id: row.get(2)?,
                    sender_name: row.get(3)?,
                    sender_role: row.get(4)?,
                    recipient_id: row.get(5)?,
                    recipient_name: row.get(6)?,
                    content: row.get(7)?,
                    message_type: A2AMessageType::parse(&kind).unwrap_or(A2AMessageType::Task),
                    timestamp: row.get(9)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(messages)
    }

    // ── Settings ────────────────────────────────────────────────────────────

    pub fn get_setting(&self, key: &str) -> HelmResult<Option<String>> {
        Ok(self
            .conn()?
            .query_row("SELECT value FROM settings WHERE key = ?1;", params![key], |row| {
                row.get(0)
            })
            .optional()?)
    }

    pub fn set_setting(&self, key: &str, value: &str) -> HelmResult<()> {
        if key.is_empty() || key.len() > 128 {
            return Err(HelmError::invalid("Chave de definição inválida"));
        }
        self.conn()?.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = ?2;",
            params![key, value],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn panel(key: &str, swarm_id: &str, port: u16) -> PanelRecord {
        PanelRecord {
            key: key.to_string(),
            title: format!("Panel {key}"),
            agent_id: "fullstack-engineer".to_string(),
            role: "fullstack".to_string(),
            color: "blue".to_string(),
            kind: "agent".to_string(),
            cli: Some("claude".to_string()),
            model_id: "claude-sonnet".to_string(),
            worktree_id: format!("{swarm_id}-{key}"),
            worktree_path: format!("/repo/.helm/worktrees/{swarm_id}-{key}"),
            branch: format!("helm/swarm-{swarm_id}-{key}"),
            port,
        }
    }

    fn swarm(id: &str, position: i64) -> SwarmRecord {
        SwarmRecord {
            id: id.to_string(),
            project_id: "p1".to_string(),
            name: format!("Swarm {id}"),
            preset_id: Some("quartet".to_string()),
            layout: "2x2".to_string(),
            base_branch: "main".to_string(),
            auto_approve: false,
            position,
            created_at: 100,
            panels: vec![panel("orchestrator", id, 3001), panel("qa", id, 3002)],
        }
    }

    fn message(id: &str, swarm_id: &str, timestamp: i64) -> A2AMessage {
        A2AMessage {
            id: id.to_string(),
            swarm_id: swarm_id.to_string(),
            sender_id: "orchestrator".to_string(),
            sender_name: "Orchestrator".to_string(),
            sender_role: Some("architect".to_string()),
            recipient_id: "qa".to_string(),
            recipient_name: "QA".to_string(),
            content: format!("message {id}"),
            message_type: A2AMessageType::Report,
            timestamp,
        }
    }

    fn db_with_project() -> DbState {
        let db = DbState::open_in_memory().expect("db");
        db.upsert_project("p1", "Project", "/repo").expect("project");
        db
    }

    #[test]
    fn test_project_crud_in_memory() {
        let db = DbState::open_in_memory().expect("db");
        let p1 = db.upsert_project("p1", "HelmADE Core", "/path/to/helmade").expect("insert");
        assert_eq!(p1.name, "HelmADE Core");
        assert_eq!(db.list_recent_projects(10).expect("list").len(), 1);

        let updated = db.upsert_project("p1_alt", "HelmADE Updated", "/path/to/helmade").expect("update");
        assert_eq!(updated.name, "HelmADE Updated");
        assert_eq!(updated.id, "p1", "the original id survives an upsert by path");
        assert_eq!(db.list_recent_projects(10).expect("list").len(), 1);

        assert!(db.delete_project(&updated.id).expect("delete"));
        assert!(db.list_recent_projects(10).expect("list").is_empty());
    }

    #[test]
    fn swarms_round_trip_with_panels_in_order() {
        let db = db_with_project();
        db.save_swarm(&swarm("s2", 1)).expect("save s2");
        db.save_swarm(&swarm("s1", 0)).expect("save s1");

        let loaded = db.list_swarms("p1").expect("list");
        assert_eq!(loaded, vec![swarm("s1", 0), swarm("s2", 1)]);
        assert!(db.list_swarms("other").expect("list").is_empty());
        let mut ids = db.list_worktree_ids("p1").expect("ids");
        ids.sort();
        assert_eq!(ids, vec!["s1-orchestrator", "s1-qa", "s2-orchestrator", "s2-qa"]);
    }

    #[test]
    fn saving_again_replaces_panels_and_metadata() {
        let db = db_with_project();
        db.save_swarm(&swarm("s1", 0)).expect("save");

        let mut changed = swarm("s1", 3);
        changed.name = "Renamed".to_string();
        changed.layout = "1x2".to_string();
        changed.auto_approve = true;
        changed.panels.remove(0);
        changed.panels[0].title = "QA renamed".to_string();
        db.save_swarm(&changed).expect("save again");

        assert_eq!(db.list_swarms("p1").expect("list"), vec![changed]);
    }

    #[test]
    fn deleting_a_swarm_removes_panels_and_history() {
        let db = db_with_project();
        db.save_swarm(&swarm("s1", 0)).expect("save");
        db.insert_a2a_message(&message("m1", "s1", 1)).expect("message");

        assert!(db.delete_swarm("s1").expect("delete"));
        assert!(!db.delete_swarm("s1").expect("second delete"));
        assert!(db.list_swarms("p1").expect("list").is_empty());
        assert!(db.list_worktree_ids("p1").expect("ids").is_empty());
        assert!(db.list_a2a_messages("s1", 10).expect("history").is_empty());
    }

    #[test]
    fn deleting_a_project_cascades_to_its_swarms() {
        let db = db_with_project();
        db.save_swarm(&swarm("s1", 0)).expect("save");
        assert!(db.delete_project("p1").expect("delete"));
        assert!(db.list_swarms("p1").expect("list").is_empty());
    }

    #[test]
    fn a2a_history_returns_the_latest_messages_oldest_first() {
        let db = db_with_project();
        for i in 0..5 {
            db.insert_a2a_message(&message(&format!("m{i}"), "s1", i)).expect("insert");
        }
        db.insert_a2a_message(&message("other", "s2", 9)).expect("insert");

        let latest = db.list_a2a_messages("s1", 3).expect("history");
        let ids: Vec<&str> = latest.iter().map(|m| m.id.as_str()).collect();
        assert_eq!(ids, vec!["m2", "m3", "m4"]);
        assert_eq!(latest[0], message("m2", "s1", 2));
    }

    #[test]
    fn settings_are_upserted() {
        let db = DbState::open_in_memory().expect("db");
        assert_eq!(db.get_setting("shield").expect("get"), None);
        db.set_setting("shield", "a").expect("set");
        db.set_setting("shield", "b").expect("overwrite");
        assert_eq!(db.get_setting("shield").expect("get"), Some("b".to_string()));
        assert!(db.set_setting("", "x").is_err());
    }

    #[test]
    fn state_survives_reopening_the_database_file() {
        let path = std::env::temp_dir().join(format!("helmade_db_{}.sqlite", std::process::id()));
        let _ = std::fs::remove_file(&path);
        {
            let db = DbState::open(&path).expect("open");
            db.upsert_project("p1", "Project", "/repo").expect("project");
            db.save_swarm(&swarm("s1", 0)).expect("save");
            db.insert_a2a_message(&message("m1", "s1", 1)).expect("message");
        }
        let reopened = DbState::open(&path).expect("reopen");
        assert_eq!(reopened.list_swarms("p1").expect("list"), vec![swarm("s1", 0)]);
        assert_eq!(reopened.list_a2a_messages("s1", 10).expect("history").len(), 1);
        for suffix in ["", "-wal", "-shm"] {
            let _ = std::fs::remove_file(format!("{}{suffix}", path.display()));
        }
    }
}
