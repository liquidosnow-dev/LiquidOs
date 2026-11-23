# LiquidOs Development Contract

**Status**: Binding for all agents operating inside LiquidOs  
**Version**: 2026-11-23

This contract defines the mandatory behavior of every agent session.

---

## 1. Always-On Base: Karpathy Guidelines

Every agent inherits these four principles with no exception:

### 1.1 Think Before Coding
- State assumptions explicitly
- Surface ambiguity and trade-offs
- Ask rather than guess
- Push back when a simpler approach exists
- Stop and name confusion when it arises

### 1.2 Simplicity First
- Minimum code that solves the actual requested problem
- No speculative features
- No premature abstractions
- No configurability that was not requested
- If it can be significantly shorter, rewrite it

### 1.3 Surgical Changes
- Touch only what the request requires
- Do not “improve” adjacent code, comments, or formatting
- Do not refactor unrelated code
- Clean up only the mess created by the current change
- Mention unrelated dead code; do not delete it unless asked

### 1.4 Goal-Driven Execution
- Convert imperative requests into verifiable success criteria
- Prefer “write the failing test, then make it pass”
- State brief plans with verification steps for multi-step work
- Loop against clear goals rather than vague instructions

---

## 2. Non-Trivial Work: Superpowers Methodology

When the task is non-trivial (new feature, non-obvious bug, architectural change, multi-file work), the agent **must**:

1. Clarify true intent with the user
2. Produce a readable design (chunked for human digestion)
3. Obtain explicit human sign-off (via Plannotator or equivalent)
4. Produce an implementation plan suitable for a junior engineer with poor taste and no project context
5. Emphasize true red/green TDD, YAGNI, and DRY
6. Execute via subagent-driven development where appropriate
7. Inspect and review work before marking complete

Trivial tasks (typo fixes, obvious one-liners) may use lighter process, but still obey Karpathy Guidelines.

Methodology sign-off in this section covers the design and the plan. It does not authorize field execution. See section 7.

---

## 3. Skill & Knowledge Rules

- Prefer existing Knowledge layer sources (Awesome-*, selfhosted catalog, etc.) over invention
- New skills may only be adopted after SkillEvaluator review
- OpenClaw / external skills discovered via clawskills.sh still require evaluation
- BrowserAct is preferred for high-volume or anti-bot extraction; Chrome DevTools for interactive verification

---

## 4. Integrity & Attestation

- Significant deliverables **should** be attested with an-nexus
- Attestation includes relevant process artifacts (design, plan, test evidence) where practical
- Fail-closed cryptography remains mandatory; no soft fallbacks
- The manifest schema is `an-nexus.manifest.v4`. Do not invent a parallel manifest.
- A status flag is not an attestation.

---

## 5. Human Ownership

- Designs and implementation plans surface for human review (Plannotator)
- Agents do not silently proceed past unresolved ambiguity on important decisions
- Humans retain final authority on architecture, product direction, and risk acceptance
- Plannotator annotation is required before execution of deployment plans, compose files, and model selections. Methodology sign-off does not replace it.

---

## 6. Enforcement

This contract is loaded as permanent context for LiquidOs agent sessions.  
Violations (especially of Karpathy Guidelines or skipping human sign-off on non-trivial work) are treated as process failures.

---

## 7. Spec 10 decisions

Binding detail lives in `docs/DECISIONS.md`. The short form:

1. **Signature.** `d_manifest` plus a continuity anchor (`prev_hash`, `signer_id`, `sig`). Deploy attestations must include container config, source revision, and each loaded weight file as manifest entries. Checksums are SHA-256 of the file bytes.
2. **Authority.** Methodology signs the design and the plan. Plannotator signs plans, compose, and model selections before they run. Continuity signatures may be produced only by `AUDIT_SIGNER`, `CONTINUITY_AUTHORITY`, or `AUDIT_AND_ISSUER`.
3. **Canon.** `Knowledge/` has one writer. LoopForge appends a delta only after `verify_chain` accepts the new anchor. Last-write-wins between two runs is rejected.

If this section and an earlier section disagree, this section wins.

---

*Reliability is not optional. This contract exists to make it the default.*
