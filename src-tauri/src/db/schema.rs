use rusqlite::{Connection, Result};

/// Ordered, append-only migrations. `PRAGMA user_version` records how many have run.
/// Only additive changes are allowed here (new tables, new nullable/defaulted columns);
/// destructive changes need an expand step first and a later contract step.
const MIGRATIONS: &[&str] = &[
    // 1 — baseline (already present in databases created before versioning existed).
    "CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        last_opened_at INTEGER NOT NULL,
        settings_json TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        layout TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS grid_panels (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        panel_index INTEGER NOT NULL,
        agent_role TEXT NOT NULL,
        model_id TEXT NOT NULL,
        worktree_path TEXT,
        worktree_branch TEXT,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_projects_last_opened ON projects(last_opened_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions(project_id);
    CREATE INDEX IF NOT EXISTS idx_grid_panels_session_id ON grid_panels(session_id);",
    // 2 — swarms (one `sessions` row per swarm), per-agent workspaces, Team Wire history, settings.
    "ALTER TABLE sessions ADD COLUMN preset_id TEXT;
    ALTER TABLE sessions ADD COLUMN base_branch TEXT NOT NULL DEFAULT 'main';
    ALTER TABLE sessions ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE sessions ADD COLUMN auto_approve INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE grid_panels ADD COLUMN panel_key TEXT NOT NULL DEFAULT '';
    ALTER TABLE grid_panels ADD COLUMN title TEXT NOT NULL DEFAULT '';
    ALTER TABLE grid_panels ADD COLUMN agent_id TEXT NOT NULL DEFAULT '';
    ALTER TABLE grid_panels ADD COLUMN color TEXT NOT NULL DEFAULT 'blue';
    ALTER TABLE grid_panels ADD COLUMN kind TEXT NOT NULL DEFAULT 'agent';
    ALTER TABLE grid_panels ADD COLUMN cli TEXT;
    ALTER TABLE grid_panels ADD COLUMN port INTEGER;
    CREATE TABLE IF NOT EXISTS a2a_messages (
        id TEXT PRIMARY KEY,
        swarm_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        sender_role TEXT,
        recipient_id TEXT NOT NULL,
        recipient_name TEXT NOT NULL,
        content TEXT NOT NULL,
        message_type TEXT NOT NULL,
        timestamp INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_a2a_messages_swarm ON a2a_messages(swarm_id, timestamp);
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );",
];

pub fn init_database(conn: &mut Connection) -> Result<()> {
    // WAL + busy_timeout are SQLite's equivalent of a lock timeout: a blocked writer
    // fails after 2s instead of hanging the app.
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;
         PRAGMA busy_timeout = 2000;",
    )?;

    let applied: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    for (index, sql) in MIGRATIONS.iter().enumerate().skip(applied.max(0) as usize) {
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", index as i64 + 1)?;
        tx.commit()?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn columns(conn: &Connection, table: &str) -> Vec<String> {
        let mut stmt = conn
            .prepare(&format!("SELECT name FROM pragma_table_info('{table}')"))
            .expect("prepare");
        let names = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .expect("query")
            .collect::<Result<Vec<_>>>()
            .expect("rows");
        names
    }

    #[test]
    fn fresh_database_runs_every_migration_once() {
        let mut conn = Connection::open_in_memory().expect("open");
        init_database(&mut conn).expect("first init");
        init_database(&mut conn).expect("second init is a no-op");

        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .expect("version");
        assert_eq!(version, MIGRATIONS.len() as i64);
        assert!(columns(&conn, "sessions").contains(&"base_branch".to_string()));
        assert!(columns(&conn, "grid_panels").contains(&"panel_key".to_string()));
        assert!(!columns(&conn, "a2a_messages").is_empty());
        assert!(!columns(&conn, "settings").is_empty());
    }

    #[test]
    fn unversioned_legacy_database_is_upgraded_in_place() {
        let mut conn = Connection::open_in_memory().expect("open");
        // A database written by the pre-versioning build: baseline tables, user_version 0.
        conn.execute_batch(MIGRATIONS[0]).expect("legacy schema");
        conn.execute(
            "INSERT INTO projects (id, name, path, created_at, last_opened_at) VALUES ('p', 'P', '/p', 1, 1)",
            [],
        )
        .expect("legacy row");

        init_database(&mut conn).expect("upgrade");
        let kept: i64 = conn
            .query_row("SELECT COUNT(*) FROM projects", [], |row| row.get(0))
            .expect("count");
        assert_eq!(kept, 1);
        assert!(columns(&conn, "grid_panels").contains(&"cli".to_string()));
    }
}
