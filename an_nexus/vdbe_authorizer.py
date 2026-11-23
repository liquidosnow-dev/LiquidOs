"""VDBE authorizer runtime parity layer (D-19 engine boundary).

Prefers the PyO3 native module `an_nexus_sqlite` when installed.
Falls back to a pure-Python sqlite3 authorizer with the same allow-list so
tests and local development remain usable without a Rust toolchain.
"""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

# SQLite authorizer action codes (subset)
SQLITE_CREATE_INDEX = 1
SQLITE_CREATE_TABLE = 2
SQLITE_CREATE_TEMP_INDEX = 3
SQLITE_CREATE_TEMP_TABLE = 4
SQLITE_CREATE_TEMP_TRIGGER = 5
SQLITE_CREATE_TEMP_VIEW = 6
SQLITE_CREATE_TRIGGER = 7
SQLITE_CREATE_VIEW = 8
SQLITE_DELETE = 9
SQLITE_DROP_INDEX = 10
SQLITE_DROP_TABLE = 11
SQLITE_DROP_TEMP_INDEX = 12
SQLITE_DROP_TEMP_TABLE = 13
SQLITE_DROP_TEMP_TRIGGER = 14
SQLITE_DROP_TEMP_VIEW = 15
SQLITE_DROP_TRIGGER = 16
SQLITE_DROP_VIEW = 17
SQLITE_INSERT = 18
SQLITE_PRAGMA = 19
SQLITE_READ = 20
SQLITE_SELECT = 21
SQLITE_TRANSACTION = 22
SQLITE_UPDATE = 23
SQLITE_ATTACH = 24
SQLITE_DETACH = 25
SQLITE_ALTER_TABLE = 26
SQLITE_REINDEX = 27
SQLITE_ANALYZE = 28
SQLITE_CREATE_VTABLE = 29
SQLITE_DROP_VTABLE = 30
SQLITE_FUNCTION = 31
SQLITE_SAVEPOINT = 32
SQLITE_RECURSIVE = 33

SQLITE_OK = 0
SQLITE_DENY = 1

ALLOW_LIST_NAMES = (
    "Select",
    "Read",
    "Function",
    "Recursive",
    "Transaction",
    "Savepoint",
)

_ALLOWED_CODES = frozenset(
    {
        SQLITE_SELECT,
        SQLITE_READ,
        SQLITE_FUNCTION,
        SQLITE_RECURSIVE,
        SQLITE_TRANSACTION,
        SQLITE_SAVEPOINT,
    }
)


def _python_authorizer(
    action: int,
    arg1: str | None,
    arg2: str | None,
    dbname: str | None,
    source: str | None,
) -> int:
    if action in _ALLOWED_CODES:
        return SQLITE_OK
    return SQLITE_DENY


def install_readonly_authorizer(conn: sqlite3.Connection) -> None:
    """Install fail-closed authorizer on a stdlib sqlite3 connection."""
    conn.set_authorizer(_python_authorizer)


def open_readonly_vault_db(path: str | Path) -> sqlite3.Connection:
    """Open a read-only vault DB with query_only + authorizer (Python path)."""
    uri = f"file:{Path(path).resolve().as_posix()}?mode=ro"
    conn = sqlite3.connect(uri, uri=True, check_same_thread=False)
    conn.execute("PRAGMA query_only = ON")
    conn.execute("PRAGMA foreign_keys = ON")
    install_readonly_authorizer(conn)
    return conn


@dataclass(frozen=True, slots=True)
class RuntimeInfo:
    backend: str  # "native" | "python"
    allow_list: tuple[str, ...]
    version: str | None = None


def probe_backend() -> RuntimeInfo:
    """Report which VDBE backend is active."""
    try:
        import an_nexus_sqlite as native  # type: ignore

        allow = tuple(native.authorizer_allow_list())
        ver = None
        if hasattr(native, "version"):
            ver = str(native.version())
        return RuntimeInfo(backend="native", allow_list=allow, version=ver)
    except Exception:
        return RuntimeInfo(backend="python", allow_list=ALLOW_LIST_NAMES, version=None)


def open_readonly_vault(path: str | Path) -> Any:
    """Open hardened vault handle; prefer native PyO3 module when available."""
    try:
        import an_nexus_sqlite as native  # type: ignore

        return native.open_readonly_vault(str(path))
    except Exception:
        return open_readonly_vault_db(path)


__all__ = [
    "ALLOW_LIST_NAMES",
    "RuntimeInfo",
    "install_readonly_authorizer",
    "open_readonly_vault_db",
    "open_readonly_vault",
    "probe_backend",
]
