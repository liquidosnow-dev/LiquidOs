# NexusBridge Contract (TypeScript ↔ Python)

The `NexusBridge` enforces the zero-trust boundary between the autonomous orchestrator (TypeScript) and the cryptographic core (Python `an-nexus`).

## Core Principle: Fail-Closed

The TypeScript bridge **must never** manufacture authorization or cryptographic hashes.  
If the Python gateway is unreachable, the bridge throws an error, and the `recursiveEngine` rolls back the Git checkpoint.

## Security Invariants

1. The TypeScript layer never generates `d_attest` values.
2. If any CLI call fails or returns malformed data, the bridge throws.
3. The recursive engine treats any thrown error as a hard abort + rollback.
4. Git commit hashes are recovery checkpoints only; they are never the root of trust.
5. Offline mode is not supported for autonomous mutation. The gateway must be reachable.

## Subprocess Contract

The bridge invokes:

```bash
python3 an_nexus/cli.py <command> [args]
```

Payloads for `policy-check` and `sign-and-anchor` are passed via **stdin** (JSON) to avoid shell-escaping and length issues.

### 1. `policy-check <action>`

**Input (stdin):** JSON payload  
**Expected Output (stdout):**

```json
{"authorized": true, "reason": "Policy PPE-101 passed"}
```

If the payload violates IBM Praxis PPE rules (or the local policy set), `authorized` must be `false`.

### 2. `sign-and-anchor`

**Input (stdin):** JSON payload containing step metadata, diff, test results, prior commit, timestamp  
**Expected Output (stdout):**

```json
{
  "success": true,
  "d_attest": "2aba2e55c84c60bc0ed19f0873ab8cd56fdfc4ca8e8cc16f8a0814019d833fac",
  "audit_log_seq": 42
}
```

- `d_attest` must be a 64-character hex JCS digest.
- `audit_log_seq` is the monotonically increasing integer from the audit ledger.

### 3. `audit-head`

**Expected Output (stdout):**

```text
<64-character lowercase hex string of the latest audit log content hash>
```

## Environment

| Variable            | Purpose                                      | Default   |
|---------------------|----------------------------------------------|-----------|
| `NEXUS_PYTHON_PATH` | Path to Python interpreter used for an-nexus | `python3` |

The bridge resolves `an_nexus/cli.py` relative to the process working directory.

## Future CLI Wrapper Requirements

`an_nexus/cli.py` must expose the three subcommands above, wrapping the existing:

- `access_state.py`
- `audit_log.py`
- `signing.py`
- IBM Praxis PPE / tool_guard integrations (when present)

Until those subcommands exist and return real cryptographic material, the recursive engine will correctly refuse to authorize any autonomous mutation.
