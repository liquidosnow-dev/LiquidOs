# Superpowers Methodology (LiquidOs)

Source: obra/superpowers  
Status: Activated for **non-trivial** work inside LiquidOs

## Core Flow

1. **Clarify intent**  
   Agent does not jump into code. It first extracts what the user is really trying to achieve.

2. **Produce a readable design**  
   Design is shown in digestible chunks for human review.

3. **Human sign-off**  
   Explicit approval required (Plannotator or equivalent) before implementation planning.

4. **Implementation plan**  
   Written so that an enthusiastic junior engineer with poor taste, no judgement, no project context, and an aversion to testing can still follow it.  
   Emphasizes true red/green TDD, YAGNI, and DRY.

5. **Subagent-driven execution**  
   Tasks are executed (often by subagents), inspected, and reviewed before proceeding.

6. **Continuous verification**  
   The agent works against the plan and success criteria rather than improvising.

## Relationship to Karpathy Guidelines

Superpowers supplies the *process*.  
Karpathy Guidelines supply the *moment-to-moment discipline* inside that process.

Both are required for non-trivial LiquidOs work.

## Integration Notes

- Install / vendor Superpowers skills under `Skills/superpowers/` or load via supported harness plugins.
- The `using-superpowers` skill (or equivalent) should be available so agents know how to activate the methodology.
- LoopForge SOPs can treat Superpowers as the core engineering stage of a larger delivery pipeline.
