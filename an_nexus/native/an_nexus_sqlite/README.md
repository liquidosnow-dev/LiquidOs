# an_nexus_sqlite

Fail-closed VDBE authorizer and hardened read-only handles (D-19 engine layer).

## Rust

```bash
cargo test
```

## Python (PyO3 / maturin)

```bash
cd an_nexus/native/an_nexus_sqlite
pip install maturin
maturin develop --features python
```

```python
import an_nexus_sqlite as native

conn = native.open_readonly_vault("/path/to/vault.db")
print(conn.query_scalar("SELECT COUNT(*) FROM vault_docs"))
# Mutations raise at prepare/authorize time
```

Allow-list: `Select`, `Read`, `Function`, `Recursive`, `Transaction`, `Savepoint`.
