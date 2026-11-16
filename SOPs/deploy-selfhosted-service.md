# SOP — Deploy a Self-Hosted Service

**Status**: Reference pipeline  
**Orchestration**: LoopForge-compatible

## Stages

1. **Discover**  
   Use `selfhosted-discover` against Knowledge/selfhosted.  
   Human confirms candidate.

2. **Design & Plan**  
   Superpowers methodology: clarify requirements → design → Plannotator sign-off → implementation plan.

3. **Scaffold**  
   `selfhosted-scaffold` produces compose, proxy, backup, and env templates.

4. **Harden & Audit**  
   `selfhosted-audit` + Claude-BugHunter / Modern Web Guidance as needed.  
   Apply Awesome Scalability patterns where relevant.

5. **Deploy & Verify**  
   Deploy.  
   Chrome DevTools for agents and/or BrowserAct for verification and smoke tests.

6. **Attest**  
   an-nexus produces signed evidence envelope of the deployed configuration and process artifacts.

7. **Record**  
   LoopForge records outcomes for future improvement.

## Gates

- Karpathy Guidelines observed throughout
- Human sign-off on design before scaffolding proceeds
- Critical audit findings must be resolved or explicitly accepted
- Attestation required for production classification
