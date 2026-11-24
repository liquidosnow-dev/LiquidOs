# Repository Map

This guide describes the current high-level layout. It is a navigation aid, not a declaration that every component is production-ready.

| Path | Contents | Notes |
|---|---|---|
| `src/` | React/TypeScript application | UI, services, workers, adapters, engine, utilities, and frontend tests |
| `an_nexus/` | Python Atomic Nexus package | Evidence, canonicalization, signing, access state, continuity, query guards, and search |
| `an_nexus/contracts/` | JSON schemas | Versioned machine-readable contract definitions |
| `an_nexus/native/` | Rust/Python extension | Native SQLite component and build metadata |
| `tests/` | Python tests | Package and integration-level test sources |
| `docs/` | System documentation | Architecture, trust boundaries, substrate, decisions, readiness |
| `Methodology/` | Development contracts | Agent and engineering workflow guidance |
| `Skills/`, `Skill/` | Skill definitions | Skill-specific instructions and prompts |
| `Knowledge/` | Reference catalogs | Curated knowledge scaffolding |
| `SOPs/` | Standard operating procedures | Repeatable build and deployment procedures |
| `scripts/` | Utility scripts | Preflight, audit, manifest, access, and verification helpers |
| `dark_gpt/` | Python application | Separate desktop/chat application component |
| `pocketharness/` | Harness utilities | Scripts and instructions for harness-related work |
| `public/` | Static web assets | Icons, images, PWA assets, and public metadata |
| `.control-plane-state/` | Control-plane JSON snapshots | Tracked state data; inspect sensitivity and provenance before sharing or changing |
| `.vitest/`, `.vitest-coverage/` | Test output/coverage artifacts | Currently tracked generated outputs; retention and regeneration policy should be decided before cleanup |

## Project entry points

- JavaScript package scripts: [`package.json`](../package.json)
- Python package metadata: [`pyproject.toml`](../pyproject.toml)
- Python dependencies: [`requirements.txt`](../requirements.txt)
- Environment variable names and placeholders: [`.env.example`](../.env.example)
- Root overview: [`README.md`](../README.md)

## Organization rules

- Keep source code with its owning subsystem.
- Keep normative contracts and schemas versioned and discoverable.
- Keep evidence and generated reports separate from source implementation.
- Do not move or delete tracked state, audit records, fixtures, or release artifacts without a provenance-preserving migration plan.
- Avoid presenting local JSON state or a local hash chain as an independently administered external trust anchor.
- Prefer a single authoritative document per subject; link to it rather than maintaining conflicting copies.
