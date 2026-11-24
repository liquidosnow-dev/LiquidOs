# Documentation Index

This index separates architectural intent, security contracts, implementation notes, and readiness evidence. A document's presence or "canonical" label is not independent proof that every described control is implemented or deployed.

## Architecture and system boundaries

- [Architecture](ARCHITECTURE.md) — layered system model and component responsibilities.
- [Sovereign Substrate](SOVEREIGN_SUBSTRATE.md) — operational planes and foundational invariants.
- [Trust Zones](TRUST_ZONES.md) — trust topology, policy enforcement points, and isolation responsibilities.
- [NexusBridge](NEXUS_BRIDGE.md) — TypeScript-to-Python boundary and expected CLI contract.
- [Apple Secure Enclave](APPLE_SECURE_ENCLAVE.md) — Apple-platform identity and hardware integration notes.

## Decisions and operations

- [Architectural Decisions](DECISIONS.md) — recorded design decisions and declared invariants.
- [CodexFlow](CODEXFLOW.md) — workflow concepts and orchestration patterns.
- [Production Readiness](PRODUCTION_READINESS.md) — current verification claims, open dependencies, and human-controlled gates.

## Repository-level guidance

- [Repository Map](REPOSITORY_MAP.md) — code and artifact locations.
- [Contributing](../CONTRIBUTING.md) — change and review expectations.
- [Security Policy](../SECURITY.md) — responsible handling and reporting of security issues.
- [Changelog](../CHANGELOG.md) — notable changes.

## Evidence interpretation

When reading any project document, distinguish:

1. **Specified** — a contract or design is documented.
2. **Implemented** — code exists in the inspected revision.
3. **Tested** — a named test or check ran against a stated revision and environment.
4. **Independently verified** — a reviewer separate from the producer reproduced and assessed the evidence.
5. **Production accepted** — the authorized owner accepted deployment risks and operational prerequisites.

These states are not interchangeable. Consult the underlying evidence and current revision before relying on a status claim.
