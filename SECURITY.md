# Security Policy

LiquidOS and Atomic Nexus include security-sensitive code and evolving architecture. Treat the repository as an active development project; do not assume that documented controls are deployed or production-qualified.

## Reporting a vulnerability

Please do not publish exploit details, credentials, private keys, customer data, or sensitive evidence in a public issue or pull request.

Use GitHub's private vulnerability reporting feature if it is enabled for this repository. Otherwise, contact the repository maintainer through a private channel and provide a concise report with:

- Affected component and revision or commit.
- Impact and realistic attack prerequisites.
- Minimal reproduction steps or a safe proof of concept.
- Relevant logs or artifacts with secrets and personal data removed.
- Any suggested mitigation, if known.

Do not access, modify, or exfiltrate data that does not belong to you while investigating.

## Secret and key handling

- Never commit API keys, access tokens, signing private keys, seed phrases, or production credentials.
- Keep local signing custody material outside version control.
- If a secret may have been committed, assume it is exposed: revoke or rotate it, assess access logs, and preserve incident evidence. Removing the file from the current branch does not remove it from Git history.
- Do not publish private customer or operational evidence in this public repository.

## Scope and status

A documented design, passing unit test, local signature, or hash-linked local log does not by itself establish security assurance, external immutability, independent verification, or production acceptance. Security findings and readiness claims should be tied to a specific revision and reproducible evidence.
