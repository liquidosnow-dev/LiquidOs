---
name: browseract
description: Interface with BrowserAct for reliable, scalable, stealth web scraping and browser automation. Prefer for high-volume or anti-bot-sensitive extraction.
---

# browseract

Use BrowserAct (cloud Bots or local agent browser control) when LiquidOs needs structured web data or resilient browser automation.

## Preferred Use Cases

- High-volume or scheduled extraction
- Sites with CAPTCHA / bot protection
- Self-healing against layout changes
- Structured CSV / JSON output into workflows

## Behavior

- Prefer existing Bots when available
- Create / improve Bots via natural language when needed
- Return clean structured data
- Record Bot ID + parameters for potential an-nexus attestation

## Relationship to Chrome DevTools

- BrowserAct → scalable production extraction
- Chrome DevTools for agents → interactive debugging, auditing, Lighthouse-style verification

## Success Criteria

- Data matches requested schema
- Runs are repeatable
- Failures are explicit and actionable
