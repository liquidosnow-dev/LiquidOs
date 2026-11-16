# LiquidOs Architecture

**Version**: 2026-11-15  
**Status**: Ready for implementation

## Overview

LiquidOs is structured as a strict layered system. Lower layers provide guarantees that higher layers can rely on. No layer is allowed to bypass the integrity or methodology contracts below it.

## Layer Map

### 1. Cryptographic Integrity Core
**Component**: `an-nexus`  
**Responsibility**: Hash-linked continuity, signed audit logs, fail-closed cryptography, evidence envelopes.  
**Guarantee**: Significant artifacts can be attested with cryptographic proof of origin, content, and process.

### 2. Knowledge Layer
**Components**:
- Awesome-Selfhosted (self-hostable services catalog)
- Awesome Python
- Awesome Scalability
- Awesome Flutter
- clawskills.sh (curated OpenClaw skills index)
- Unwind AI (high-signal agent/RAG/LLM intelligence)

**Responsibility**: High-quality, curated reference material. Agents consult this layer before inventing solutions.

### 3. Domain & Specialized Skills
**Components**:
- Claude-BugHunter
- Open Code Review
- Modern Web Guidance
- Google Stitch MCP
- selfhosted-discover / scaffold / audit
- browseract
- openclaw-* skills (selectively adopted)
- Future domain skills

**Responsibility**: Specialized capabilities. All skills must pass SkillEvaluator and respect Karpathy Guidelines.

### 4. Evaluation & Reliability
**Component**: NVIDIA SkillEvaluator (Tier 1–3)  
**Responsibility**: Quality, safety, and performance gates for skills and SOPs before they become first-class.

### 5. Methodology & Behavioral Guardrails
**Components**:
- **Karpathy Guidelines** (always-on)
  - Think Before Coding
  - Simplicity First
  - Surgical Changes
  - Goal-Driven Execution
- **Superpowers** (activated for non-trivial work)
  - Intent clarification
  - Readable design
  - Human sign-off
  - Junior-friendly implementation plan
  - True red/green TDD
  - Subagent-driven execution

**Responsibility**: How the agent thinks and how it executes development cycles.

### 6. Local / Private Runtime
**Component**: ggml / llama.cpp  
**Responsibility**: Local, private, low-latency inference for sensitive or offline workloads.

The Runtime Plane executes local inference and orchestrates agentic behavior.
- **Core Substrate:** Rust/Node orchestration, local sandbox runners.
- **Governed Execution:** Autonomous code mutation is strictly bound by the `an-nexus` bridge. No mutation can occur without a signed `d_attest` receipt.
- **Workflow Library:** See [CodexFlow: Workflows 1–5](CODEXFLOW.md#1-code-generation--self-modification-runtime--governance) for self-mutation loops and AST sandboxing.

### 7. Live Verification & Browser Infrastructure
**Components**:
- Chrome DevTools for agents (interactive observation, auditing, Lighthouse)
- BrowserAct (scalable, stealth, self-healing scraping and automation)

**Responsibility**: Real-world verification and high-volume web data extraction.

### 8. Human-in-the-Loop Review Surface
**Component**: Plannotator  
**Responsibility**: Human ownership of plans, designs, and structured diffs. No significant implementation proceeds without review opportunity.

### 9. Agent ↔ User Interaction Protocol
**Component**: AG-UI  
**Responsibility**: Standardized event stream for agent-user interaction, enabling consistent frontends.

### 10. Team Orchestration & Self-Improving Workflows
**Component**: LoopForge  
**Responsibility**: Multi-role SOPs, hard quality gates, team-scale delivery, and continuous improvement loops.

## Interoperability Plane (Hardware & Device Bridges)

Hardware and device bridges.
- **Core Substrate:** MCP Gateway, OpenToys, local mDNS.
- **Physical Actuation:** Hardware commands are wrapped in signed envelopes. Unauthorized actuators are blocked at the PPE layer.
- **Workflow Library:** See [CodexFlow: Workflows 16–20](CODEXFLOW.md#4-hardware--interoperability-interoperability) for device handshakes and firmware verification.

## Data & Control Flow (Typical Non-Trivial Task)

1. User request arrives
2. Karpathy Guidelines force clarification of assumptions and success criteria
3. Superpowers produces design → Plannotator review → sign-off
4. Implementation plan generated (TDD-oriented)
5. Domain skills + Knowledge layer consulted as needed
6. Code produced under surgical + simplicity constraints
7. Live verification (Chrome DevTools / BrowserAct) as required
8. an-nexus attestation of the final artifact and process
9. LoopForge SOP records outcomes for future improvement

## Non-Goals

- Replacing human judgment on architecture or product decisions
- Automatic adoption of unvetted skills from any registry
- Bypassing cryptographic attestation for production deliverables
- Allowing agents to make orthogonal “improvements” without explicit request

## Evolution Rules

- New skills must pass SkillEvaluator before promotion
- Methodology changes require explicit human approval
- Knowledge sources are curated; raw registries are never directly trusted
- an-nexus remains fail-closed; no soft fallback cryptography

---

*This architecture is the source of truth for LiquidOs agent behavior and repository structure.*
