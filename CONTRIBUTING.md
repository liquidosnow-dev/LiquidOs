# Contributing

Thank you for helping improve LiquidOS and Atomic Nexus. Changes should be small enough to review, reproducible, and explicit about their security and evidence impact.

## Before changing code

1. Read the [README](README.md), [Repository Map](docs/REPOSITORY_MAP.md), and relevant architecture or contract documents.
2. Identify the owning subsystem and the expected behavior.
3. Record assumptions, scope, and acceptance criteria.
4. For agent-generated or multi-agent changes, preserve the source, rationale, and handoff provenance.

## Change discipline

- Prefer focused changes over broad refactors.
- Do not silently change normative contract meaning or version.
- Do not weaken fail-closed behavior to make a test pass.
- Do not use a Git commit, local signature, or producer-authored report as a substitute for an independently administered trust anchor or independent review.
- Preserve existing evidence and history. Never rewrite shared history as a cleanup shortcut.
- Do not commit secrets, private keys, access tokens, personal data, or live customer evidence.
- Add or update tests for changed behavior and document any untested boundary.

## Validation

Run checks relevant to the files changed. Common commands:

```bash
npm run lint
npm test
npm run build
python -m unittest discover -s tests -v
```

Record the exact revision, command, environment, and result. If a check was not run, say **NOT RUN**. If a result cannot be reproduced, do not report it as PASS.

## Pull requests

A pull request should explain:

- What changed and why.
- Which components and contracts are affected.
- Tests run and their results.
- Known limitations, open dependencies, and migration considerations.
- Whether evidence or security boundaries changed.
- Any human action still required.

Security-sensitive changes should include a threat-model update or a clear explanation of why one is unnecessary. A producer must not approve their own work as an independent security review.
