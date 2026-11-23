# Liquid OS & Atomic Nexus Sovereign Substrate

**Version**: 2026-11-23  
**Status**: Canonical source of truth for the local-first operating substrate  
**Supersedes**: Informal NotebookLM synthesis of the same date

This document defines the non-bypassable foundation on which the 10-layer agentic architecture operates. Higher layers (skills, evaluation, Plannotator, LoopForge) are bound by the invariants declared here.

---

## 1. Executive Architectural Paradigm

Modern autonomous AI systems frequently rely on cloud-dependent API wrappers that introduce network latency, subscription tollbooths, and severe privacy vulnerabilities. The Liquid OS and Atomic Nexus Routing Architecture establish a deterministic, local-first operating substrate engineered for sovereign execution.

Designed to operate within tight hardware constraints—such as an iPad A16 or edge node bound by a 2.8 GB peak RAM envelope under Apple's increased-memory-limit entitlement—Liquid OS decouples userland interaction from raw storage through kernel-level identity verification, static memory alignment, and lexical Abstract Syntax Tree (AST) query allowlisting.

### Five Operational Planes

System capabilities are organized across five discrete operational planes that communicate through explicit, versioned contracts:

1. **Ingestion Plane** — Raw DOM extraction, visual text normalization, Readability parsing, and deduplication over short temporal windows using SHA-256 content hashing.
2. **Vault Query Plane** — Full-text trigram substring searching, structural schema extraction, and read-only SQL queries over specialized database handles.
3. **Egress Proxy Plane** — Native network routing, round-robin proxy rotation, decentralized WebRTC exit nodes via the Adrift protocol, and ephemeral port hopping through `listen(0)`.
4. **Agent Orchestration Plane** — Agent thread lifecycles, Git worktree isolation, automated feedback loops, and human-in-the-loop approval gating.
5. **Cross-Plane Composite Plane** — Blends low-level primitives into compound workflows (e.g., querying the local vault and injecting context directly into an active agent thread window).

To eliminate micro-architectural CPU bottlenecks caused by false sharing across Symmetric Multiprocessing (SMP) cores, Liquid OS isolates single-producer single-consumer (SPSC) queue head and tail pointers onto distinct 64-byte hardware cache lines using explicit alignment annotations (`#[repr(align(64))]`). Network frames entering the edge interface are bound by a rigid 16 MB `MAX_FRAME` ceiling and a 4-byte big-endian length prefix state machine, ensuring that malformed payloads trigger clean connection drops rather than system-wide daemon panics or heap-spraying vulnerabilities.

---

## 2. Kernel-Anchored Identity & Rule S4 Ingress Shield

System security enforces a strict zero-trust posture where network identity claims are rejected in favor of kernel-anchored hardware credentials.

### Kernel-Anchored Credential Verification (SO_PEERCRED)

When a process initiates a connection over the UNIX domain socket (`/var/run/liquidos.sock`), the runtime issues a `getsockopt` call with `SOL_SOCKET` and `SO_PEERCRED` to extract the `ucred` structure directly from kernel memory. The capability registry (LOS-CAP-REG-001) verifies that the calling process's effective User ID matches the authorized non-root user context:

```
UID_peer = 1000
```

Any socket request originating from an unprivileged or mismatched UID is terminated instantly at the transport boundary before payload parsing occurs. For Apple XNU environments where `SO_PEERCRED` is unavailable, authentication remediates to native Secure Enclave biometric verification (FaceID/TouchID), routing challenge tokens through the local `nexusBridge` daemon.

### Constant-Time Bearer Authentication

For HTTP and WebSocket IPC bound strictly to loopback IP (`127.0.0.1:17373`), transport authentication enforces constant-time Bearer token verification using `crypto.timingSafeEqual`.

### Rule S4 Lexical AST SQL Guard

To defend against SQL injection and database exfiltration, Liquid OS implements Rule S4 AST allowlisting across user-facing query interfaces:

1. Comment & String Stripping
2. Tokenizer Normalization
3. Single-Statement Enforcement
4. Opcode Allowlisting — root verb must be `SELECT` or `WITH...SELECT`. Mutation opcodes and exfiltration clauses are denied.

At the database engine layer, SQLite read-only connection handles install native VDBE authorizer callbacks via `sqlite3_set_authorizer`. Native extension loading is permanently disabled.

---

## 3. Pi Pipeline Hook Router & Embedded Vector Engines

The Pi Pipeline Hook Router evaluates incoming queries against four deterministic execution barriers before routing to specialized storage engines:

- **SECURITY_BARRIER** — ACLs, socket credentials, Rule S4 compliance
- **MEMORY_MTU_BARRIER** — Offloads scans exceeding 10,000 rows to DuckDB
- **VECTOR_INDEX_BARRIER** — Latency and hop limits for dense vector retrieval
- **SQLITE_BUSY_BARRIER** — Redirects under WAL write-lock contention

### Comparative Engine Matrix

| Engine     | Architecture                  | Memory Profile                  | Optimal Workload                  |
|------------|-------------------------------|---------------------------------|-----------------------------------|
| LanceDB    | Arrow + IVF-PQ, zero-copy     | 2–4 GB for 10M+ 1536-d vectors  | High-dimensional dense retrieval  |
| sqlite-vec | Pure C virtual table, 1-bit   | ~19.2 MB for 100k vectors       | Edge mobile (iOS / Android)       |
| DuckDB-VSS | Columnar + usearch HNSW       | Low overhead on multi-core      | Analytical OLAP + vector joins    |
| Chroma     | In-memory hnswlib             | 60–80 GB at 10M scale           | Cloud prototypes only             |

Hybrid search uses Reciprocal Rank Fusion (RRF) over sqlite-vec ranks and FTS5 BM25 ranks.

### On-Device Inference Constraints

- Focused Stream: Temperature 0.10, locked seed
- Exploratory Stream: Temperature 0.85, randomized seed
- Notepad Constraint: 30–40 resident daemons, each writing only to its own 100–250 KB pad (total swarm footprint 3–7 MB)

---

## 4. Deterministic State Machine & Handoff Rollback

Container state transitions follow a strict 5-stage linear sequence:

```
PREPARED → SIGNED → PERSISTED → READ → CONFIRMED
```

Any failure before CONFIRMED branches to FAILED / RECOVERY_PENDING and executes `ROLLBACK_TO_SOURCE`, wiping only handoff-owned staging files while preserving primary tables and the historical ledger.

Every transition emits a Wayopen Claim Ledger record (MANIFEST.json v1.1) containing the ten mandatory fields.

---

## 5. Cryptographic Provenance & Canonical Verification Contracts

### RFC 8785 JSON Canonicalization Scheme (JCS)

All payload hashes, evidence envelopes, and audit ledger blocks must undergo RFC 8785 JCS formatting prior to SHA-256 calculation to guarantee bit-exact cross-runtime parity (Python / TypeScript / Rust). Implementation lives in `an_nexus/jcs.py`.

### Hash-Chained Audit Ledger

```
H_i = SHA-256(seq_i ∥ T_i ∥ H_{i-1} ∥ JCS(P_i))
```

Genesis block anchors with sixty-four zero characters. Startup runs `verifyChain()`; any mismatch triggers fail-closed lockdown.

Contracts:
- AN-EVC-001 Canonical Evidence Envelope
- PVA-001 Production Verification Attestation
- LIQ-LEDGER-CONTRACT-v1.0

---

## 6. Governance Control Plane & Pre-Tool-Call Assurance

### GLOBAL-MODE-001 Fencing

Operational states: ACTIVE → DEGRADED → MISSING_VARIABLE → QUARANTINED → LOCKDOWN.

Entering LOCKDOWN immediately invalidates all active session tokens and capability leases. Recovery requires fresh authentication.

### AIT-PIP-001 Pre-Tool-Call Prompt Injection Resistance Probe

Evaluates five attack vectors before tool dispatch. Decouples model detection/resistance from runtime barrier enforcement.

---

## Related Documents

- `docs/ARCHITECTURE.md` — 10-layer agentic stack that sits on this substrate
- `docs/DECISIONS.md` — Hard invariants D-18 through D-23
- `docs/PRODUCTION_READINESS.md` — Cards-on-the-Table matrix
- `an_nexus/contracts/` — Machine-readable schema definitions

---

*This substrate is non-bypassable. Higher layers exist only by its permission.*
