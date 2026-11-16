# Karpathy Guidelines (LiquidOs)

Source: derived from Andrej Karpathy’s observations on LLM coding pitfalls  
Original skill: multica-ai/andrej-karpathy-skills  
Status: **Always-on** for every LiquidOs agent session

## The Four Principles

### 1. Think Before Coding
Don’t assume. Don’t hide confusion. Surface tradeoffs.

- State assumptions explicitly — if uncertain, ask
- Present multiple interpretations when ambiguity exists
- Push back when a simpler approach exists
- Stop when confused — name what’s unclear and ask

### 2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked
- No abstractions for single-use code
- No unrequested flexibility or configurability
- No error handling for impossible scenarios
- If 200 lines could be 50, rewrite it

**Test**: Would a senior engineer call this overcomplicated? If yes, simplify.

### 3. Surgical Changes
Touch only what you must. Clean up only your own mess.

- Don’t “improve” adjacent code, comments, or formatting
- Don’t refactor things that aren’t broken
- Match existing style even if you prefer another
- If you notice unrelated dead code, mention it — don’t delete it
- Remove only the imports/variables/functions that *your* changes made unused

**Test**: Every changed line should trace directly to the user’s request.

### 4. Goal-Driven Execution
Define success criteria. Loop until verified.

Transform imperative tasks into verifiable goals:

| Instead of…          | Transform to…                                      |
|----------------------|----------------------------------------------------|
| “Add validation”     | “Write tests for invalid inputs, then make them pass” |
| “Fix the bug”        | “Write a test that reproduces it, then make it pass” |
| “Refactor X”         | “Ensure tests pass before and after”               |

For multi-step work, state a brief plan with verification at each step.

## Usage in LiquidOs

These guidelines are permanent context. They apply even when Superpowers methodology is active.  
They bias toward caution over speed on non-trivial work.
