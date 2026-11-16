---
name: selfhosted-scaffold
description: Generate production-oriented docker-compose, reverse-proxy, backup, and basic hardening scaffolding for a chosen self-hosted service.
---

# selfhosted-scaffold

Given a chosen self-hosted service (from discover or user), produce ready-to-adapt deployment scaffolding.

## Outputs

- `docker-compose.yml` (or equivalent)
- Basic reverse-proxy snippet (Caddy / Traefik / nginx)
- Backup / restore notes
- Minimal hardening checklist
- Environment variable template

## Constraints

- Follow Karpathy Guidelines (simplicity, surgical)
- Prefer official or well-maintained images
- Do not invent complex orchestration unless requested
- Include clear comments for human operators

## Success Criteria

- Scaffolding is valid and runnable with minimal edits
- Secrets are not hardcoded
- Basic security posture is present (no obvious open defaults)
