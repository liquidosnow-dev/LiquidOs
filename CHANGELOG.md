# Changelog

All notable changes to LiquidOs are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Fail-closed NexusBridge** (`src/services/nexusBridge.ts`) — TypeScript bridge to Python an-nexus. Never invents cryptographic material; throws on gateway failure.
- **Hardened recursiveEngine** (`src/engine/recursiveEngine.ts`) — Policy → mutate → test → attest loop. Git is recovery only.
- **CommandHUD** (`src/components/CommandHUD.tsx`) — Live ledger head telemetry (Obsidian Carbon / Vibranium Cyan).
- **docs/NEXUS_BRIDGE.md** — Formal contract and security invariants between TypeScript orchestrator and Python cryptographic core.
- **Knowledge/selfhosted/catalog.json** — Machine-readable catalog schema + example entries for selfhosted-discover.
- **10-layer agentic architecture** establishing LiquidOs as a sovereign, evidence-backed builder platform.
- `docs/ARCHITECTURE.md` — canonical layer map and data/control flow.
- `Methodology/LIQUIDOS_DEVELOPMENT_CONTRACT.md` — binding contract for all agents (Karpathy Guidelines always-on + Superpowers for non-trivial work).
- `Methodology/KARPATHY.md` and `Methodology/SUPERPOWERS.md` — methodology reference documents.
- Core skills:
  - `karpathy-guidelines` (always-on behavioral guardrails)
  - `selfhosted-discover`
  - `selfhosted-scaffold`
  - `selfhosted-audit`
  - `browseract`
- Knowledge layer scaffolding for:
  - Awesome-Selfhosted
  - Awesome Python
  - Awesome Scalability
  - Awesome Flutter
  - clawskills.sh (OpenClaw skill discovery)
  - Unwind AI (high-signal agent/RAG intelligence)
- Reference SOPs:
  - `deploy-selfhosted-service`
  - `build-feature`
- Full rewritten root `README.md` reflecting the new architecture.

### Security
- Enforced fail-closed posture for all autonomous mutation paths.
- Offline mode explicitly unsupported for code mutation.
- Git commit hashes treated as recovery checkpoints only; never the root of trust.

### Architecture Integration
- Wired an-nexus (cryptographic integrity core) as Layer 1.
- Established evaluation path via NVIDIA SkillEvaluator.
- Defined live verification dual path: Chrome DevTools for agents + BrowserAct.
- Positioned Plannotator (human ownership), AG-UI (protocol), and LoopForge (orchestration) in the upper layers.
- Made Karpathy Guidelines permanent context and Superpowers the default process for non-trivial delivery.

### Notes
- Existing `an_nexus` implementation remains the integrity foundation and is unchanged by this drop.
- Skills and Knowledge directories are intentionally minimal scaffolds ready for population.
- All new agent behavior is governed by the LiquidOs Development Contract.
- The Python an-nexus CLI must still expose `policy-check`, `sign-and-anchor`, and `audit-head` subcommands before the recursive engine can authorize mutations.

---

## [Previous]

- an-nexus v4.2 hardening (see prior commit history and an-nexus documentation).
