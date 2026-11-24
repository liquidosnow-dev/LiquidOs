# PocketHarness Bridge v2.0

Local-first AI orchestration bridge: HITL approval, token SSE, Ed25519 audit receipts.

## Discovery

See [`SKILL.md`](./SKILL.md) for the agent-facing contract (endpoints, SSE frames, verify protocol).

## Smoke (after bridge runtime exists)

```bash
export HARNESS_BRIDGE_TOKEN=dev-token
chmod +x scripts/smoke_pocketharness_v2.sh
./scripts/smoke_pocketharness_v2.sh
```

Standalone receipt check:

```bash
node scripts/verify_audit_line.js --audit bridge/audit.jsonl --pub bridge/.ed25519_pub.pem
```

## Trust boundary

Harness proposes and signs language/tool *intent*. Vault SQL, Rule S4, and VDBE remain substrate responsibilities — do not open `dbRO` from the bridge process.
