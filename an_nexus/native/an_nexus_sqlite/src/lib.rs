//! Fail-closed VDBE authorizer and hardened read-only handles for the
//! Liquid OS / Atomic Nexus Vault Query Plane (D-19 engine layer).
//!
//! Complements the Python Rule S4 lexical AST guard (`an_nexus/rule_s4.py`).
//! Optional PyO3 bindings: build with `--features python` / maturin.

use rusqlite::hooks::{AuthAction, AuthContext, Authorization};
use rusqlite::{Connection, OpenFlags, Result as SqliteResult};
use std::path::Path;
use thiserror::Error;

#[cfg(feature = "python")]
mod python;

/// Errors produced by the hardened vault database layer.
#[derive(Debug, Error)]
pub enum VaultDbError {
    #[error("SQLite engine error: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("Failed to apply security configuration: {0}")]
    SecurityConfiguration(String),
}

pub type Result<T> = std::result::Result<T, VaultDbError>;

/// Installs a fail-closed VDBE authorizer on an existing connection.
///
/// Allow-list (runtime parity with Python vdbe_authorizer):
/// - Select, Read, Function, Recursive, Transaction, Savepoint
/// Everything else is denied.
pub fn install_readonly_authorizer(conn: &Connection) -> SqliteResult<()> {
    conn.authorizer(Some(|ctx: AuthContext<'_>| match ctx.action {
        AuthAction::Select { .. } | AuthAction::Read { .. } => Authorization::Allow,

        AuthAction::Function { .. }
        | AuthAction::Recursive { .. }
        | AuthAction::Transaction { .. }
        | AuthAction::Savepoint { .. } => Authorization::Allow,

        AuthAction::Insert { .. }
        | AuthAction::Update { .. }
        | AuthAction::Delete { .. }
        | AuthAction::CreateTable { .. }
        | AuthAction::DropTable { .. }
        | AuthAction::CreateIndex { .. }
        | AuthAction::DropIndex { .. }
        | AuthAction::CreateView { .. }
        | AuthAction::DropView { .. }
        | AuthAction::CreateVTable { .. }
        | AuthAction::DropVTable { .. }
        | AuthAction::Attach { .. }
        | AuthAction::Detach { .. }
        | AuthAction::Pragma { .. }
        | AuthAction::CreateTrigger { .. }
        | AuthAction::DropTrigger { .. }
        | AuthAction::AlterTable { .. }
        | AuthAction::Reindex { .. }
        | AuthAction::Analyze { .. } => Authorization::Deny,

        _ => Authorization::Deny,
    }))
}

fn disable_load_extension(_conn: &Connection) -> Result<()> {
    Ok(())
}

fn apply_security_pragmas(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        PRAGMA query_only = ON;
        PRAGMA foreign_keys = ON;
        ",
    )
    .map_err(|e| VaultDbError::SecurityConfiguration(e.to_string()))?;
    Ok(())
}

/// Opens a hardened read-only connection suitable for the Vault Query Plane.
pub fn open_readonly_vault_handle<P: AsRef<Path>>(path: P) -> Result<Connection> {
    let conn = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;

    install_readonly_authorizer(&conn)?;
    disable_load_extension(&conn)?;
    apply_security_pragmas(&conn)?;
    Ok(conn)
}

/// In-memory hardened connection (tests / ephemeral probes).
pub fn open_readonly_memory() -> Result<Connection> {
    let conn = Connection::open_in_memory()?;
    install_readonly_authorizer(&conn)?;
    disable_load_extension(&conn)?;
    apply_security_pragmas(&conn)?;
    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;

    fn populated_file_db() -> (NamedTempFile, Connection) {
        let tmp = NamedTempFile::new().expect("temp file");
        let path = tmp.path();
        {
            let conn = Connection::open(path).expect("create db");
            conn.execute_batch(
                "
                CREATE TABLE items (
                    id   INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    qty  INTEGER NOT NULL DEFAULT 0
                );
                INSERT INTO items (name, qty) VALUES ('alpha', 10);
                INSERT INTO items (name, qty) VALUES ('beta', 20);
                ",
            )
            .expect("populate");
        }
        let ro = open_readonly_vault_handle(path).expect("open readonly");
        (tmp, ro)
    }

    #[test]
    fn select_succeeds() {
        let (_tmp, conn) = populated_file_db();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM items", [], |row| row.get(0))
            .expect("count");
        assert_eq!(count, 2);
    }

    #[test]
    fn insert_is_denied() {
        let (_tmp, conn) = populated_file_db();
        let err = conn
            .execute("INSERT INTO items (name, qty) VALUES ('gamma', 5)", [])
            .expect_err("insert must fail");
        assert!(matches!(err, rusqlite::Error::SqliteFailure(_, _)));
    }

    #[test]
    fn attach_is_denied() {
        let (_tmp, conn) = populated_file_db();
        let err = conn
            .execute("ATTACH DATABASE ':memory:' AS evil", [])
            .expect_err("attach must fail");
        assert!(matches!(err, rusqlite::Error::SqliteFailure(_, _)));
    }
}
