# an_nexus_sqlite

Fail-closed VDBE authorizer and hardened read-only database handles for the **Liquid OS / Atomic Nexus Vault Query Plane** (engine-level half of Decision D-19).

This crate complements the Python Rule S4 lexical AST guard (`an_nexus/rule_s4.py` + `gates.py`).

## Security Properties

Every connection returned by `open_readonly_vault_handle` enforces:

1. `SQLITE_OPEN_READ_ONLY | SQLITE_OPEN_NO_MUTEX`
2. Strict VDBE authorizer (`sqlite3_set_authorizer`)  
   - **Allow**: `Select`, `Read`, `Function`, `Recursive`, `Transaction`, `Savepoint`  
   - **Deny**: all DML, DDL, `ATTACH`/`DETACH`, `PRAGMA`, and everything else
3. Loadable extensions remain disabled (no `load_extension` feature; intent documented in code)
4. `PRAGMA query_only = ON`
5. `PRAGMA foreign_keys = ON`

## Usage

```rust
use an_nexus_sqlite::open_readonly_vault_handle;

let conn = open_readonly_vault_handle("/path/to/vault.db")?;

// SELECT / WITH ... SELECT succeed
let count: i64 = conn.query_row("SELECT COUNT(*) FROM items", [], |r| r.get(0))?;

// INSERT / UPDATE / DELETE / DROP / ATTACH → authorization error at prepare time
```

## Relationship to Substrate

| Layer | Component | Status |
|-------|-----------|--------|
| Lexical | `an_nexus/rule_s4.py` + `gates.py` | Verified 56/56 |
| Engine  | **this crate** | Implemented |
| Connection flags | `READ_ONLY` + `query_only` | Implemented |

## Build & Test

```bash
cd an_nexus/native/an_nexus_sqlite
cargo test
```

Requires a Rust toolchain (1.70+ recommended) and a C compiler for the bundled SQLite build.

## Design Notes

- The authorizer callback is pure and never issues nested SQL on the same connection.
- Extension loading is intentionally not enabled in `Cargo.toml` (`load_extension` feature omitted).
- Future work: optional PyO3 bindings so Python orchestration can obtain these handles directly.
