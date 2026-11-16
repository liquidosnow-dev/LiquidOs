---
name: selfhosted-audit
description: Audit a self-hosted deployment or proposed scaffold for security, license, maintainability, and readiness for an-nexus attestation.
---

# selfhosted-audit

Review a self-hosted service configuration or running instance against LiquidOs standards.

## Checks

- License compatibility
- Exposure surface (ports, auth, TLS)
- Update and backup posture
- Secret handling
- Alignment with Awesome Scalability patterns where relevant
- Readiness for an-nexus evidence envelope

## Output

Structured findings with severity and recommended actions.  
Optionally produce an attestation-ready summary for an-nexus.

## Success Criteria

- Clear pass / fail / needs-work status
- Actionable recommendations
- No silent acceptance of critical issues
