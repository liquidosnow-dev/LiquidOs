# LiquidOs

**Tomorrow’s builder app** — evidence-backed, methodology-driven, self-hosting-first.

LiquidOs is a sovereign, agentic operating system for high-reliability software construction and self-hosted infrastructure. It combines cryptographic evidence integrity, disciplined agent methodology, curated knowledge bases, specialized domain skills, live verification, human ownership, and team-scale orchestration.

## Architecture (10 Layers)

```
Team Orchestration          →  LoopForge
Agent ↔ User Protocol       →  AG-UI
Human-in-the-Loop           →  Plannotator
Live Verification           →  Chrome DevTools for agents + BrowserAct
Local / Private Runtime     →  ggml / llama.cpp
Methodology & Guardrails    →  Superpowers + Karpathy Guidelines
Evaluation & Reliability    →  NVIDIA SkillEvaluator
Domain Skills               →  BugHunter, Open Code Review, Stitch MCP, selfhosted-*, …
Knowledge Layer             →  Awesome-Selfhosted, Python, Scalability, Flutter, clawskills, Unwind AI
Cryptographic Core          →  an-nexus
```

## Core Principles

- **Karpathy Guidelines (always-on)**: Think before coding · Simplicity first · Surgical changes · Goal-driven execution
- **Superpowers (non-trivial work)**: Clarify intent → Design → Human sign-off → Implementation plan → TDD subagents
- **Fail-closed integrity**: Every significant delivery can be attested with an-nexus
- **Self-hosting first**: Prefer sovereign, auditable infrastructure
- **Human ownership**: Plans and designs surface in Plannotator before implementation proceeds

## Orchestration & Autonomous Workflows

LiquidOS ONE does not just execute prompts; it runs bounded, deterministic workflows.
We maintain a library of **25 core workflows** that handle everything from AST self-modification to TPM hardware attestation.

Every workflow is governed by the `an-nexus` zero-trust substrate:
- **Policy First:** IBM Praxis PPE evaluates the intent.
- **Test Second:** Vitest ensures no regressions.
- **Attest Last:** Ed25519 signature and audit ledger append.

👉 **[Read the CodexFlow Workflow Library](docs/CODEXFLOW.md)**

## Quick Start

```bash
# Clone
git clone https://github.com/liquidosnow-dev/LiquidOs.git
cd LiquidOs

# Python integrity core
pip install -e .
an-smoke
an-demo

# (Future) Agent session with LiquidOs Development Contract loaded
```

## Repository Layout

```
LiquidOs/
├── an_nexus/                 # Cryptographic integrity core
├── Skills/                   # Domain + methodology skills
│   ├── karpathy-guidelines/
│   ├── selfhosted-discover/
│   ├── selfhosted-scaffold/
│   ├── selfhosted-audit/
│   └── browseract/
├── Knowledge/                # Curated catalogs
│   ├── selfhosted/
│   ├── python/
│   ├── scalability/
│   ├── flutter/
│   ├── openclaw-skills/
│   └── unwind-ai/
├── Methodology/
│   ├── SUPERPOWERS.md
│   ├── KARPATHY.md
│   └── LIQUIDOS_DEVELOPMENT_CONTRACT.md
├── SOPs/                     # LoopForge-compatible pipelines
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CODEXFLOW.md
│   └── NEXUS_BRIDGE.md
└── README.md
```

## Development Contract

Every agent operating inside LiquidOs inherits:

1. **Karpathy Guidelines** as permanent behavioral base
2. **Superpowers** methodology for any non-trivial task
3. **SkillEvaluator** gates for new skill adoption
4. **an-nexus** attestation for significant deliverables
5. **Plannotator** human review for designs and plans

See [`Methodology/LIQUIDOS_DEVELOPMENT_CONTRACT.md`](Methodology/LIQUIDOS_DEVELOPMENT_CONTRACT.md) for the full contract.

## Status

- **an-nexus**: Active (v4.2 hardening)
- **Architecture & Methodology**: Documented and ready for implementation
- **Skills & Knowledge**: Scaffolded — ready for population
- **SOPs**: Stubs ready
- **CodexFlow**: 25-workflow orchestration library live

## License

See repository license files. Individual skills and knowledge sources retain their original licenses.

---

*Built for reliability. Attested by design.*
