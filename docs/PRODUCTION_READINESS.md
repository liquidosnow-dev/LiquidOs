# Production Readiness — Cards-on-the-Table Matrix

**Version**: 2026-11-23  
**Status**: Living document

This matrix separates sandbox-verified software contracts (AI-automatable) from physical hardware and administrative gates that only the founder can close.

---

## Sandbox-Verified Software Contracts (AI-Automated / Green)

| Subsystem                        | Status                          | Evidence                                      |
|----------------------------------|---------------------------------|-----------------------------------------------|
| Rule S4 Lexical AST SQL Guard    | Verified                        | 56/56 scenarios passed                        |
| Cross-runtime RFC 8785 JCS       | Verified                        | `an_nexus/jcs.py` + parity tests              |
| SHA-256 hash-chained ledger      | Verified                        | Chain verifier + genesis anchor               |
| GLOBAL-MODE-001 state fencing    | Verified                        | Mid-flight token revocation tested            |
| Aegis RAM hygiene (`wipe.py`)    | Verified                        | Constant-time 0x00 scrub                      |
| AN-EVC-001 / PVA-001 envelopes   | Specified + schema              | Contract schemas under `an_nexus/contracts/`  |
| 5-stage state machine            | Specified                       | Documented in SOVEREIGN_SUBSTRATE.md          |

---

## Open Physical Hardware & Administrative Gates (Human Founder Only)

| Gate | Description                                                                 | Owner   |
|------|-----------------------------------------------------------------------------|---------|
| 1    | Xcode compilation and execution on physical iPad A16 hardware               | Founder |
| 2    | Apple Developer Account $99/yr provisioning for `increased-memory-limit` entitlement | Founder |
| 3    | Apple Instruments RAM profiling under peak dual-stream (`llama.cpp` + Metal) inference | Founder |
| 4    | Native Linux socket deployment for `SO_PEERCRED` credential enforcement     | Founder |
| 5    | Physical YubiKey / HSM key anchoring for Ed25519 root signatures            | Founder |
| 6    | Sustained network MTU packet stress testing under 1,232-byte framing        | Founder |

---

## Security Hygiene Status (2026-11-23)

- `.control-plane-state/signing-key.json` is blocked by `.gitignore`.
- The file no longer exists on the tip of `main`.
- If a private Ed25519 key was ever committed to a remote branch, a history rewrite (`git filter-repo`) followed by coordinated force-push is still recommended.
- Key rotation and issuance of a formal revocation attestation remain founder actions.

---

*No higher-layer feature work should claim production readiness until the six physical gates above are closed or explicitly accepted as residual risk by the founder.*
