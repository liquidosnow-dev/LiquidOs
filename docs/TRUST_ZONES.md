# Trust Zones & Policy Enforcement Points

**Version**: 2026-11-23  
**Status**: Canonical  
**Related**: `docs/SOVEREIGN_SUBSTRATE.md`, GLOBAL-MODE-001, D-18–D-23

This document defines the multi-layered trust topology of Liquid OS / Atomic Nexus. All control flows that cross zone boundaries must pass through the designated Policy Enforcement Points (PEPs).

---

## 1. Taxonomy of Architectural Trust Zones

The architecture separates system components into seven operational zones so that untrusted models and sandboxed executions remain isolated from credentials and control keys.

| Trust Zone | Core Components | Primary Responsibilities & Enforcement |
|------------|-----------------|----------------------------------------|
| **Trusted Zone** | User Initial Input (Trigger), Human-In-The-Loop (HITL) | Originates execution triggers and processes mandatory human approval requests for sensitive tool executions. |
| **Bootstrapped Trusted Zone** | Identity Provider (Bootstrapping) | Manages root bootstrapping and issue-time workload identity assertion across system boundaries. |
| **Semi-Trusted Evaluation Zone** | Harness | Parses untrusted model output, enforces tool-call policy rules, and requests capped authorization tokens. |
| **Untrusted Execution Zone** | Sandbox Manager, Sandboxes | Executes untrusted code within isolated sandboxes monitored by OS-level controls and sandbox isolation PEPs. |
| **Trusted Control Plane** | Token Service, Vault, Broker Service, Policy Service | Holds root keys and secrets, enforces L7 outbound filtering, dynamically evaluates access rules, and issues capped tokens. |
| **Untrusted Zone** | External LLM, Internet-based Services | External environments where raw model inferences and outbound web traffic take place under strict L7 filtering. |
| **Enhanced Semi-Trusted Zone** | Internal Services | Internal backend services accessed via Broker Service credential injection and Layer-3 network isolation. |

**Key Architectural Takeaway**  
The Trusted Control Plane acts as an unbypassable gateway between evaluation, execution, and external networks. Raw credentials held in the Vault are never exposed directly to the Semi-Trusted Evaluation Zone or the Untrusted Execution Zone.

---

## 2. Policy Enforcement Points (PEPs)

Control flows moving between trust zones pass through specialized Policy Enforcement Points to prevent privilege escalation.

### 2.1 Human-In-The-Loop (HITL) Flow
When the Harness evaluates high-risk model outputs or tool requests, execution pauses and routes a Human Approval Request to the HITL component in the Trusted Zone before command dispatch.

### 2.2 Token & Credential Access
The Harness obtains capped authorization tokens from the Token Service in the Trusted Control Plane. The Broker Service mediates access to the Vault (holding application credentials) and performs L7 outbound filtering and credential injection before communicating with External LLMs, Internet-based Services, or Internal Services.

### 2.3 Policy Decision & Versioning
The Policy Service functions as the Policy Decision Point (PDP) and AuthZ engine. It dynamically loads rules and versioning policies from a Policy Repository, incorporating real-time inputs from Threat Intelligence and Vulnerability Updates.

### 2.4 Sandbox Isolation
Code commands, tokens, and execution policies launched from the Harness to the Sandbox Manager are isolated at both the PEP layer and via OS-level controls within containerized sandboxes.

---

## 3. Relationship to Operational Planes & Substrate Invariants

The seven Trust Zones sit orthogonally to the five Operational Planes defined in `docs/SOVEREIGN_SUBSTRATE.md`:

- **Ingestion / Vault Query / Egress / Agent Orchestration / Cross-Plane** describe *what* the system does.
- **Trust Zones** describe *who is allowed to do it* and under what isolation guarantees.

Critical substrate invariants remain binding across all zones:

- Kernel-anchored identity (D-18) — `SO_PEERCRED` or Secure Enclave.
- Rule S4 lexical AST + VDBE authorizer (D-19) on every Vault Query Plane handle.
- RFC 8785 JCS canonicalization (D-20).
- GLOBAL-MODE-001 fencing and irrevocable token revocation on LOCKDOWN (D-22).
- Notepad Constraint (D-23).

No zone is permitted to bypass these invariants.

---

## 4. Implementation Notes

- The Harness (Semi-Trusted Evaluation Zone) is the primary consumer of `gate_sql` / `gate_sql_and_jcs` before any database or tool dispatch.
- The Trusted Control Plane corresponds to the an-nexus control surface, Token/Vault services, and the Broker that performs L7 filtering.
- Sandbox isolation PEPs must be enforced both in policy and at the OS/container boundary.
- Mobile KMP clients operate with a read-only replica of the vault and are treated as Enhanced Semi-Trusted or Untrusted depending on the specific surface.

---

## Related Documents

- `docs/SOVEREIGN_SUBSTRATE.md` — Five operational planes and hard invariants
- `docs/ARCHITECTURE.md` — 10-layer agentic stack
- `docs/DECISIONS.md` — D-18 through D-23
- `docs/PRODUCTION_READINESS.md` — Open hardware and founder gates
- `docs/APPLE_SECURE_ENCLAVE.md` — Apple-platform identity path for D-18

---

*Trust Zones define the isolation topology. The Sovereign Substrate defines the non-bypassable rules that every zone must obey.*
