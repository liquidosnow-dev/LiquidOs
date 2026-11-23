"""Ordered SQL schema migration runner for the Liquid Mercury Vault.

Applies versioned .sql files (e.g. scripts/001_vault_fts_migration.sql) exactly
once per database, recording success in schema_migrations.
"""
from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

_MIGRATION_NAME = re.compile(r"^(\d+)_([\w\-]+)\.sql$")


@dataclass(frozen=True, slots=True)
class MigrationResult:
    applied: list[str]
    skipped: list[str]
    path: str


def _ensure_ledger(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id          INTEGER PRIMARY KEY,
          name        TEXT    NOT NULL UNIQUE,
          applied_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        )
        """
    )


def _list_migration_files(directory: Path) -> list[Path]:
    files: list[tuple[int, Path]] = []
    if not directory.is_dir():
        return []
    for p in directory.iterdir():
        if not p.is_file():
            continue
        m = _MIGRATION_NAME.match(p.name)
        if not m:
            continue
        files.append((int(m.group(1)), p))
    files.sort(key=lambda t: (t[0], t[1].name))
    return [p for _, p in files]


def _applied_names(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute("SELECT name FROM schema_migrations").fetchall()
    return {str(r[0]) for r in rows}


def apply_migrations(
    conn: sqlite3.Connection,
    migrations_dir: str | Path,
    *,
    dry_run: bool = False,
) -> MigrationResult:
    """Apply all pending numbered SQL migrations in order.

    Each file runs inside a transaction. On success the migration name is
    recorded in schema_migrations. Failures roll back that migration only.
    """
    directory = Path(migrations_dir)
    _ensure_ledger(conn)
    done = _applied_names(conn)
    applied: list[str] = []
    skipped: list[str] = []

    for path in _list_migration_files(directory):
        name = path.name
        if name in done:
            skipped.append(name)
            continue
        sql = path.read_text(encoding="utf-8")
        if dry_run:
            applied.append(name)
            continue
        try:
            conn.execute("BEGIN")
            conn.executescript(sql)
            conn.execute(
                "INSERT INTO schema_migrations(name) VALUES (?)",
                (name,),
            )
            conn.execute("COMMIT")
            applied.append(name)
        except Exception:
            conn.execute("ROLLBACK")
            raise

    return MigrationResult(
        applied=applied,
        skipped=skipped,
        path=str(directory.resolve()),
    )


def pending_migrations(
    conn: sqlite3.Connection,
    migrations_dir: str | Path,
) -> list[str]:
    """Return migration file names not yet applied."""
    _ensure_ledger(conn)
    done = _applied_names(conn)
    return [
        p.name
        for p in _list_migration_files(Path(migrations_dir))
        if p.name not in done
    ]


def apply_default_vault_migrations(
    conn: sqlite3.Connection,
    *,
    repo_root: str | Path | None = None,
) -> MigrationResult:
    """Apply migrations from <repo>/scripts relative to this package or repo_root."""
    if repo_root is not None:
        root = Path(repo_root)
    else:
        # an_nexus/db_migration.py -> repo root is parents[1]
        root = Path(__file__).resolve().parents[1]
    return apply_migrations(conn, root / "scripts")


__all__ = [
    "MigrationResult",
    "apply_migrations",
    "pending_migrations",
    "apply_default_vault_migrations",
]
