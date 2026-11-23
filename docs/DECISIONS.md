# Liquid OS Architectural Decisions

**Status**: Binding  
**Last Updated**: 2026-11-23

This file records hard invariants that higher layers and agents may not violate.

---

## D-18 — Kernel-Anchored Identity

**Date**: 2026-11-23  
**Status**: Accepted

All process-level authentication must query OS kernel socket buffers (`SO_PEERCRED` effective UID 1000) or Apple Secure Enclave biometrics. Wire-asserted identity claims are permanently rejected.

---

## D-19 — Rule S4 SQL Boundary

**Date**: 2026-11-23  
**Status**: Accepted

All database queries must pass the Rule S4 lexical AST parser and VDBE authorizer (`sqlite3_set_authorizer`). Root SQL verbs are restricted exclusively to `SELECT` and `WITH...SELECT`. Mutation opcodes and exfiltration clauses are denied at the transport boundary.

---

## D-20 — RFC 8785 JCS Canonicalization

**Date**: 2026-11-23  
**Status**: Accepted

All payload hashes, evidence envelopes, and audit ledger blocks must undergo RFC 8785 JSON Canonicalization Scheme formatting prior to SHA-256 calculation. This guarantees bit-exact cross-runtime parity across Python, TypeScript, and Rust. Implementation lives in `an_nexus/jcs.py`.

---

## D-21 — 5-Stage State Machine & Rollback

**Date**: 2026-11-23  
**Status**: Accepted

Container handoffs must follow the linear 5-stage stepper:

```
PREPARED → SIGNED → PERSISTED → READ → CONFIRMED
```

Any stage failure executes `ROLLBACK_TO_SOURCE`, discarding temporary staging files without altering primary database state or the historical ledger.

---

## D-22 — GLOBAL-MODE-001 Fencing & Token Revocation

**Date**: 2026-11-23  
**Status**: Accepted

Entering `LOCKDOWN` mode immediately invalidates all active session tokens and capability leases. Session recovery requires fresh re-authentication. Previously issued tokens are never revived.

---

## D-23 — Notepad Constraint Isolation

**Date**: 2026-11-23  
**Status**: Accepted

Resident background daemons are limited to 30–40 instances. Each daemon writes strictly to its own 100–250 KB notepad. Total swarm memory footprint is capped at **3–7 MB** RAM under the IMY 2026 GDPR guidelines.

---

*Earlier decisions (D1, D12, D17 and predecessors) remain in force and are referenced from the development contract and prior commits.*
