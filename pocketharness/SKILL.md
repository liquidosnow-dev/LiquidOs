---
name: pocketharness-bridge
version: 2.0.0
description: Local-first AI orchestration bridge with token-by-token SSE streaming, human-in-the-loop approval gates, and Ed25519 cryptographic audit receipts.
---

# PocketHarness Bridge v2.0 (`SKILL.md`)

## 1. Runtime & Endpoint Contract

* **Base URL:** `http://127.0.0.1:8787` (loopback-isolated)
* **Authentication:** `Authorization: Bearer <HARNESS_BRIDGE_TOKEN>` (required on all `/v1/*` routes)
* **Allowed Models:**
  * `anthropic/claude-sonnet-4-5`
  * `openai/gpt-4o`
  * `google/gemini-2.5-pro`
  * `xai/grok-3`

## 2. API Surface

| Method | Endpoint | Purpose | Response Mode |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Bridge version, `gatewayMode` (`VERCEL_AI_GATEWAY` \| `NETLIFY_AI_GATEWAY` \| `SIMULATION_DRY_RUN`), `signingKeyFingerprint` | `application/json` |
| `GET` | `/v1/harness/public-key` | Active Ed25519 SPKI public key PEM + 16-char SHA-256 fingerprint | `application/json` |
| `GET` | `/v1/harness/tasks` | Queued / streaming / executed / rejected tasks (reverse chronological) | `application/json` |
| `POST` | `/v1/harness/propose` | Body `{ prompt, model, requiresApproval, stream }`. Streams immediately if `requiresApproval: false` and `stream: true` | `202 JSON` or `200 SSE` |
| `POST` | `/v1/harness/approve/:taskId/stream` | Approve `PENDING_APPROVAL` and stream tokens; terminal `done` carries signed receipt | `text/event-stream` |
| `POST` | `/v1/harness/approve/:taskId` | Approve and return complete signed JSON synchronously | `application/json` |
| `POST` | `/v1/harness/reject/:taskId` | Reject and append Ed25519-signed rejection to `audit.jsonl` | `application/json` |

## 3. SSE Streaming Wire Protocol

Consume frames in order from `/v1/harness/approve/:taskId/stream` or propose-with-stream:

1. `event: start` — `{"taskId":"...","model":"...","gatewayMode":"..."}`
2. `event: delta` — `{"taskId":"...","delta":"<token chunk>"}` (zero or more)
3. `event: done` — full task object including `output` and `audit` (`canonicalPayload`, `ed25519Signature`, `publicKeyFingerprint`, `responseSha256`)
4. `event: error` — `{"taskId":"...","error":"<reason>"}`

## 4. Ed25519 Audit Verification Protocol

Every terminal state (`EXECUTED` or `REJECTED`) is canonicalized into `canonicalPayload`, signed with the bridge PKCS#8 Ed25519 private key (`.ed25519_key.pem`, mode `0600`), and appended to `bridge/audit.jsonl`.

**Independent verify:**

1. Fetch public key: `GET /v1/harness/public-key` (or read `bridge/.ed25519_pub.pem`).
2. Verify `ed25519Signature` (Base64) over UTF-8 bytes of `canonicalPayload` (Ed25519).
3. Confirm `sha256(output) === audit.responseSha256`.
4. Prefer RFC 8785 JCS for `canonicalPayload` when interoperating with AN-EVC / LIQ ledger (sorted top-level keys is minimum; full JCS is target).

## 5. Trust Boundary

PocketHarness is a **semi-trusted evaluation zone**. It must not open vault SQL or bypass Rule S4 / VDBE. Side effects remain under substrate gates (`sql-guard`, Pi barriers). MCP dispatch may be proposed here; enforcement stays below.

## 6. Key Rotation (minimum)

1. Generate new Ed25519 keypair.
2. Publish new public key via `/v1/harness/public-key`.
3. Append a signed revocation record for the prior fingerprint to `audit.jsonl`.
4. Update `signingKeyFingerprint` on `/health`.
