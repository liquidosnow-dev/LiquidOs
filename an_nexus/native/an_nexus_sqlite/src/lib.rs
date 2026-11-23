//! Fail-closed VDBE authorizer and hardened read-only handles for the
//! Liquid OS / Atomic Nexus Vault Query Plane (D-19 engine layer).
//!
//! Complements the Python Rule S4 lexical AST guard (`an_nexus/rule_s4.py`).
//! Every connection returned by this crate is opened read-only, has a strict
//! authorizer installed, has loadable extensions disabled, and runs with
//! `PRAGMA query_only = ON`.

use rusqlite::hooks::{AuthAction, AuthContext, Authorization};
use rusqlite::{Connection, OpenFlags, Result as SqliteResult};
use std::path::Path;
use thiserror::Error;

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
/// Allowed actions (required for ordinary SELECT / CTE evaluation):
/// - `Select`, `Read`
/// - `Function`, `Recursive`
/// - `Transaction`, `Savepoint`
///
/// Everything else (DML, DDL, ATTACH/DETACH, PRAGMA, etc.) is denied.
pub fn install_readonly_authorizer(conn: &Connection) -> SqliteResult<()> {
    conn.authorizer(Some(|ctx: AuthContext<'_>| match ctx.action {
        // Core query path
        AuthAction::Select { .. } | AuthAction::Read { .. } => Authorization::Allow,

        // Required supporting constructs
        AuthAction::Function { .. }
        | AuthAction::Recursive { .. }
        | AuthAction::Transaction { .. }
        | AuthAction::Savepoint { .. } => Authorization::Allow,

        // Explicit denials for clarity and auditability
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

        // Fail closed for any future / unknown action codes
        _ => Authorization::Deny,
    }))
}

/// Explicitly document that loadable extensions remain disabled.
///
/// The `load_extension` Cargo feature is intentionally omitted from this crate.
/// The default SQLite posture is "extensions off". This function exists so the
/// security intent is visible in the call chain of every hardened handle.
fn disable_load_extension(_conn: &Connection) -> Result<()> {
    Ok(())
}

/// Opens a hardened read-only connection suitable for the Vault Query Plane.
///
/// Security properties enforced on every returned handle:
/// 1. `SQLITE_OPEN_READ_ONLY | SQLITE_OPEN_NO_MUTEX`
/// 2. Strict VDBE authorizer (Select/Read + minimal support only)
/// 3. Loadable extensions remain disabled
/// 4. `PRAGMA query_only = ON`
/// 5. `PRAGMA foreign_keys = ON`
pub fn open_readonly_vault_handle<P: AsRef<Path>>(path: P) -> Result<Connection> {
    let conn = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;

    install_readonly_authorizer(&conn)?;
    disable_load_extension(&conn)?;

    conn.execute_batch(
        "
        PRAGMA query_only = ON;
        PRAGMA foreign_keys = ON;
        ",
    )
    .map_err(|e| VaultDbError::SecurityConfiguration(e.to_string()))?;

    Ok(conn)
}

/// Convenience: open an in-memory hardened connection (useful for tests).
pub fn open_readonly_memory() -> Result<Connection> {
    let conn = Connection::open_in_memory()?;
    install_readonly_authorizer(&conn)?;
    disable_load_extension(&conn)?;
    conn.execute_batch(
        "
        PRAGMA query_only = ON;
        PRAGMA foreign_keys = ON;
        ",
    )
    .map_err(|e| VaultDbError::SecurityConfiguration(e.to_string()))?;
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

        let name: String = conn
            .query_row("SELECT name FROM items WHERE id = 1", [], |row| row.get(0))
            .expect("name");
        assert_eq!(name, "alpha");
    }

    #[test]
    fn cte_select_succeeds() {
        let (_tmp, conn) = populated_file_db();
        let total: i64 = conn
            .query_row(
                "WITH q AS (SELECT qty FROM items) SELECT SUM(qty) FROM q",
                [],
                |row| row.get(0),
            )
            .expect("cte sum");
        assert_eq!(total, 30);
    }

    #[test]
    fn insert_is_denied() {
        let (_tmp, conn) = populated_file_db();
        let err = conn
            .execute("INSERT INTO items (name, qty) VALUES ('gamma', 5)", [])
            .expect_err("insert must fail");
        assert!(
            matches!(err, rusqlite::Error::SqliteFailure(_, _)),
            "expected authorization failure, got: {err:?}"
        );
    }

    #[test]
    fn update_is_denied() {
        let (_tmp, conn) = populated_file_db();
        let err = conn
            .execute("UPDATE items SET qty = 99 WHERE id = 1", [])
            .expect_err("update must fail");
        assert!(matches!(err, rusqlite::Error::SqliteFailure(_, _)));
    }

    #[test]
    fn delete_is_denied() {
        let (_tmp, conn) = populated_file_db();
        let err = conn
            .execute("DELETE FROM items WHERE id = 1", [])
            .expect_err("delete must fail");
        assert!(matches!(err, rusqlite::Error::SqliteFailure(_, _)));
    }

    #[test]
    fn drop_table_is_denied() {
        let (_tmp, conn) = populated_file_db();
        let err = conn
            .execute("DROP TABLE items", [])
            .expect_err("drop must fail");
        assert!(matches!(err, rusqlite::Error::SqliteFailure(_, _)));
    }

    #[test]
    fn create_table_is_denied() {
        let (_tmp, conn) = populated_file_db();
        let err = conn
            .execute("CREATE TABLE evil (id INTEGER)", [])
            .expect_err("create must fail");
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

    #[test]
    fn multi_statement_mutation_is_denied() {
        let (_tmp, conn) = populated_file_db();
        let err = conn
            .execute_batch("SELECT 1; INSERT INTO items (name, qty) VALUES ('x', 1);")
            .expect_err("stacked mutation must fail");
        assert!(matches!(err, rusqlite::Error::SqliteFailure(_, _)));
    }
}
