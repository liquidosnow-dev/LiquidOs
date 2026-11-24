# LiquidOS ONE

**LiquidOS ONE** is an AI-assisted application-building workspace developed alongside **Atomic Nexus**, its evidence-integrity and control-plane foundation.

The repository combines a Vite/React/TypeScript application, a Python Atomic Nexus package, security and evidence contracts, agent skills, operating procedures, and architecture documentation. The project is evolving; documented designs, implemented code, tested behavior, and production readiness are deliberately treated as separate states.

> **Project status:** Active development. This repository does not claim production readiness. See [Production Readiness](docs/PRODUCTION_READINESS.md) for the current verification claims and outstanding founder-controlled gates.

## Start here

- [Repository map](docs/REPOSITORY_MAP.md) — where to find application code, the Atomic Nexus package, contracts, tests, and project guidance.
- [Documentation index](docs/README.md) — architecture, security, decisions, operations, and readiness records.
- [Architecture](docs/ARCHITECTURE.md) — the intended layered system design.
- [Sovereign Substrate](docs/SOVEREIGN_SUBSTRATE.md) — core planes and declared invariants.
- [Trust Zones](docs/TRUST_ZONES.md) — trust boundaries and policy enforcement points.
- [Production Readiness](docs/PRODUCTION_READINESS.md) — verified claims, open gates, and limitations.
- [Changelog](CHANGELOG.md) — notable repository changes.

## Repository at a glance

| Area | Purpose |
|---|---|
| `src/` | LiquidOS web application, UI components, services, utilities, and client-side tests |
| `an_nexus/` | Python Atomic Nexus package: canonicalization, signing, evidence, access-state, continuity, and search primitives |
| `an_nexus/contracts/` | Machine-readable JSON contract schemas |
| `an_nexus/native/` | Rust/Python native SQLite extension |
| `tests/` | Python test suite |
| `docs/` | Architecture, trust, substrate, decisions, readiness, and integration documents |
| `Methodology/` | Development and agent-behavior guidance |
| `Skills/`, `Skill/`, `Knowledge/` | Skill instructions and curated reference scaffolding |
| `SOPs/`, `scripts/` | Operating procedures and project utilities |
| `dark_gpt/` | Separate Python desktop/chat application component |
| `public/` | Static web assets |

## Requirements

- Node.js 22 or a compatible version supported by the installed Vite toolchain.
- Python 3.10 or newer.
- Rust toolchain only if building the optional native component in `an_nexus/native/`.

## Local development

1. Install JavaScript dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file and set only the credentials needed for the features you intend to use:

   ```bash
   cp .env.example .env
   ```

   Review [`.env.example`](.env.example). Never commit real API keys, signing keys, tokens, or production credentials.

3. Install the Python package:

   ```bash
   python -m pip install -e .
   ```

4. Start the application:

   ```bash
   npm run dev
   ```

## Validation commands

Run the relevant checks for the area you changed:

```bash
# TypeScript type-check
npm run lint

# Frontend tests
npm test

# Production frontend build
npm run build

# Python unit tests
python -m unittest discover -s tests -v
```

A passing local check is evidence only for the command, revision, environment, and scope actually tested. It is not an independent security review or production acceptance.

## Security and evidence handling

- Do not place secrets, private signing keys, access tokens, personal data, or live customer evidence in Git.
- Treat repository fixtures and control-plane snapshots as data, not as proof that an external trust anchor or production control exists.
- Preserve original evidence and provenance when reorganizing files; do not silently rewrite history or discard audit artifacts.
- Report claims as **implemented**, **tested**, **independently verified**, or **production accepted** only when the corresponding evidence exists.
- See [Security Policy](SECURITY.md) and [Trust Zones](docs/TRUST_ZONES.md).

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Changes should be scoped, reviewable, tested, and documented. Security-sensitive changes require explicit threat and evidence considerations.

## License

No repository-wide license file is currently declared. Unless and until a license is added, do not assume that the project is offered under an open-source license.
