---
name: selfhosted-discover
description: Search and recommend self-hostable services from the Awesome-Selfhosted catalog based on user needs, licenses, and platforms.
---

# selfhosted-discover

Use the Knowledge/selfhosted catalog (sourced from awesome-selfhosted.net) to find suitable self-hostable alternatives or tools.

## Behavior

- Prefer MIT, Apache-2.0, AGPL, GPL, BSD licenses unless otherwise specified
- Prefer Docker / Kubernetes ready options when possible
- Surface stars, last update, and platform support
- Never recommend non-free software unless explicitly asked
- Return structured recommendations with rationale

## Success Criteria

- At least one relevant, actively maintained option is returned (or a clear “none found”)
- License and platform constraints are respected
- Recommendations include enough context for the user to decide
