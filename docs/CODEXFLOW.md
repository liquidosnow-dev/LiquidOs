# CodexFlow: 25-Workflow Orchestration Library

CodexFlow is the autonomous task execution layer for LiquidOS ONE. It binds user intent, LLM generation, and hardware actions to the zero-trust `an-nexus` cryptographic substrate.

Every workflow is designed to be **fail-closed**. If `nexusBridge` cannot establish policy authorization or cryptographic attestation, the workflow halts and rolls back to the last known Git checkpoint.

---

## 1. Code Generation & Self-Modification (Runtime & Governance)

*These workflows handle autonomous AST mutation, peer review, and invariant enforcement.*

1. **`recursive-self-mutation`**
   - **Action:** Generates code diffs via LLM, runs Vitest, and requires `an-nexus` Ed25519 attestation (`d_attest`) before committing to disk.
   - **Substrate:** `recursiveEngine.ts`, `nexusBridge.ts`
2. **`ast-sandbox-execution`**
   - **Action:** Parses generated code into an AST, executes in an isolated `isolated-vm` sandbox to ensure no unauthorized system calls are made before disk write.
   - **Substrate:** `toolExecutor.ts`
3. **`multi-model-peer-review`**
   - **Action:** Routes a proposed diff to a secondary model (e.g., OpenAI/Anthropic) for security review before generating a Praxis PPE policy check.
   - **Substrate:** `freeLlmClient.ts`, `nexusBridge.ts`
4. **`rollback-on-invariant-violation`**
   - **Action:** Automatically triggers a hard `git reset --hard` to the pre-execution checkpoint if the Vitest suite returns `errorCount > 0`.
   - **Substrate:** `versionControl.ts`
5. **`dependency-graph-pruning`**
   - **Action:** Analyzes `package.json` and Python requirements; proposes deletion of unused packages to reduce attack surface, subject to CVE checks.
   - **Substrate:** `toolExecutor.ts`, `nexusBridge.ts`

## 2. Security & Cryptographic Assurance (Assurance & Evidence)

*These workflows interact directly with the hash-chained ledger and the physical hardware root of trust.*

6. **`edge-key-rotation`**
   - **Action:** Triggers a rotation of the `AUDIT_SIGNER` keypair, anchoring the new public key to the continuity chain via `d_attest`.
   - **Substrate:** `an-nexus` (`keystore.py`, `continuity.py`)
7. **`signed-audit-log-sync`**
   - **Action:** Flushes pending local telemetry to the remote endpoint, cryptographically sealing the payload with a `session_close` receipt.
   - **Substrate:** `sentimentStore.ts`, `nexusBridge.ts`
8. **`continuity-anchor-rollup`**
   - **Action:** Compresses 100 local JSONL audit entries into a single Merkle root, anchoring the root to the IPFS ledger for immutable time-proof.
   - **Substrate:** `an-nexus` (`continuity.py`)
9. **`policy-ppe-violation-alert`**
   - **Action:** Intercepts a tool invocation that violates IBM Praxis rules, blocks execution, and logs a `GLOBAL-MODE-001` lockdown event.
   - **Substrate:** `nexusBridge.ts`, `CommandHUD.tsx`
10. **`hardware-enclave-attestation`**
    - **Action:** Verifies the TPM/Secure Enclave signature of the local device against the `public_key_trust_registry.json` before allowing access state transfer.
    - **Substrate:** `an-nexus` (`assertions.py`, `access_state.py`)

## 3. Sovereign Memory & Vector (Evidence)

*These workflows manage the local-first vector store and relational caches.*

11. **`live-html-to-vector-snapshot`**
    - **Action:** Scrapes the active `PreviewCanvas`, strips HTML boilerplate, chunks the text, and generates local embeddings.
    - **Substrate:** `snapshotPipeline.ts`, `vectorStore.ts`
12. **`vector-vault-l2-optimization`**
    - **Action:** Recalculates L2 distances across 1536-dim vectors to prune memory chunks older than 30 days with cosine similarity `< 0.1`.
    - **Substrate:** `vectorStore.ts`
13. **`cross-session-memory-transfer`**
    - **Action:** Uses `an-nexus` `make_receipt()` to authorize and sign the transfer of a LanceDB snapshot between two local user profiles.
    - **Substrate:** `an-nexus` (`access_state.py`)
14. **`semantic-cache-invalidation`**
    - **Action:** Detects when the underlying source HTML has changed and purges the corresponding `chunk_id` from the vector store to prevent hallucinated stale answers.
    - **Substrate:** `vectorStore.ts`, `snapshotPipeline.ts`
15. **`duckdb-analytical-export`**
    - **Action:** Runs a heavy SQL aggregation over the local analytics data, exporting to Parquet, fully bypassing the 10,000-row scan row threshold.
    - **Substrate:** `vxdb`, `an-nexus` (`manifest.py`)

## 4. Hardware & Interoperability (Interoperability)

*These workflows bridge local agents to physical devices via the MCP gateway.*

16. **`mcp-device-handshake`**
    - **Action:** Initiates a Model Context Protocol handshake with an external device, verifying its SHA-256 fingerprint against the trusted registry.
    - **Substrate:** `nexusBridge.ts`
17. **`edge-inference-esp32-sync`**
    - **Action:** Compiles a quantized model, signs the binary with `PROJECT_ISSUER`, and pushes it to an ESP32 via OpenToys.
    - **Substrate:** `an-nexus` (`signing.py`)
18. **`actuator-command-escalation`**
    - **Action:** Requires multi-sig authorization (`AUDIT_SIGNER` + `PROJECT_ISSUER`) before unlocking physical actuators (e.g., smart locks).
    - **Substrate:** `an-nexus` (`signature.py`, `access_state.py`)
19. **`local-network-topology-discovery`**
    - **Action:** Uses mDNS to discover local IoT devices, recording their IPs and MACs in a tamper-evident ledger.
    - **Substrate:** `audit_log.py`
20. **`firmware-hash-verification`**
    - **Action:** Before executing firmware updates, verifies the SHA-256 of the binary against the `GLOBAL-MODE-001` trusted manifest.
    - **Substrate:** `an-nexus` (`digests.py`, `manifest.py`)

## 5. Experience & Telemetry (Experience)

*These workflows handle UI state, HUD rendering, and zero-latency feedback.*

21. **`sentiment-telemetry-flush`**
    - **Action:** Detects the `beforeunload` event, flushes local SQLite telemetry to the remote endpoint using `navigator.sendBeacon`.
    - **Substrate:** `useAssistantSentiment.ts`
22. **`hud-ledger-latency-probe`**
    - **Action:** Polls the `an-nexus` audit log head every 5 seconds, updating the Obsidian Carbon HUD with the latest cryptographic hash.
    - **Substrate:** `CommandHUD.tsx`, `nexusBridge.ts`
23. **`ui-state-machine-sync`**
    - **Action:** Transitions the Jarvis HUD state from `LISTENING` to `PROCESSING` based on Silero VAD triggers.
    - **Substrate:** `App.tsx`, `PreviewCanvas.tsx`
24. **`zero-latency-hotkeys`**
    - **Action:** Bypasses standard React event pooling to trigger immediate `Vox` STT capture when the spacebar is held.
    - **Substrate:** `App.tsx`
25. **`global-mode-lockdown-broadcast`**
    - **Action:** If `an-nexus` detects a `GLOBAL-MODE-001` violation, it broadcasts a WebSocket event that forces all open UI clients into `LOCKDOWN` mode.
    - **Substrate:** `nexusBridge.ts`, `CommandHUD.tsx`
