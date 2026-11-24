#!/usr/bin/env bash
# PocketHarness v2.0 smoke: propose (HITL) → approve/stream → Ed25519 verify
# Requires: node, curl; bridge server at bridge/server.js
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRIDGE_DIR="$ROOT/bridge"
BASE="${POCKETHARNESS_BASE:-http://127.0.0.1:8787}"
TOKEN="${HARNESS_BRIDGE_TOKEN:-dev-token}"

cd "$ROOT"

if [[ ! -f "$BRIDGE_DIR/server.js" ]]; then
  echo "FAIL: bridge/server.js not found under $ROOT"
  echo "      Land the bridge runtime before running smoke."
  exit 2
fi

cleanup() {
  if [[ -n "${BRIDGE_PID:-}" ]] && kill -0 "$BRIDGE_PID" 2>/dev/null; then
    kill "$BRIDGE_PID" 2>/dev/null || true
    wait "$BRIDGE_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "==> starting bridge"
(
  cd "$BRIDGE_DIR"
  HARNESS_BRIDGE_TOKEN="$TOKEN" node server.js
) &amp;
BRIDGE_PID=$!

# wait for health
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf "$BASE/health" >/dev/null 2>&amp;1; then
    break
  fi
  sleep 0.3
done

if ! curl -sf "$BASE/health" >/dev/null; then
  echo "FAIL: bridge health not reachable at $BASE/health"
  exit 1
fi

echo "==> health"
curl -s "$BASE/health" | head -c 400
echo

echo "==> propose (requiresApproval)"
PROPOSE_JSON=$(curl -s -X POST "$BASE/v1/harness/propose" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"End-to-end approval stream + Ed25519 check","model":"anthropic/claude-sonnet-4-5","requiresApproval":true,"stream":false}')

TASK_ID=$(node -e 'const d=JSON.parse(process.argv[1]); if(!d.taskId) process.exit(3); console.log(d.taskId)' "$PROPOSE_JSON")
echo ">> Queued Task ID: $TASK_ID"

echo "==> approve + SSE stream"
# -N disables buffering so deltas appear live
curl -N -s -X POST "$BASE/v1/harness/approve/${TASK_ID}/stream" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: text/event-stream" | head -c 8000
echo

echo "==> Ed25519 verify last audit line"
node "$ROOT/scripts/verify_audit_line.js" \
  --audit "$BRIDGE_DIR/audit.jsonl" \
  --pub "$BRIDGE_DIR/.ed25519_pub.pem"

echo "==> smoke PASS"
