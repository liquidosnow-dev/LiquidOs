"""Higher-layer dispatch gates for the Atomic Nexus Sovereign Substrate.

These gates are the intended call-sites for agentic / LoopForge / skill code.
They combine Rule S4 (D-19) and JCS readiness (D-20) so that higher layers
cannot accidentally bypass substrate invariants.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .jcs import canonical_bytes, canonicalize
from .rule_s4 import RuleS4Result, RuleS4Violation, validate_sql


@dataclass(frozen=True, slots=True)
class GateResult:
    ok: bool
    stage: str
    detail: str | None = None
    rule_s4: RuleS4Result | None = None
    jcs_digest_preview: str | None = None


def gate_sql(sql: str) -> GateResult:
    """Run Rule S4 before any database handle is acquired."""
    try:
        result = validate_sql(sql)
        return GateResult(
            ok=True,
            stage="rule_s4",
            detail=f"root={result.root_verb}",
            rule_s4=result,
        )
    except RuleS4Violation as exc:
        return GateResult(ok=False, stage="rule_s4", detail=str(exc))


def gate_jcs_payload(payload: Any) -> GateResult:
    """Canonicalize a payload and confirm it is JCS-legal (D-20).

    Returns a short digest preview so callers can bind the canonical form
    into evidence envelopes without re-canonicalizing.
    """
    try:
        canon = canonicalize(payload)
        digest_preview = canonical_bytes(payload)[:8].hex()
        return GateResult(
            ok=True,
            stage="jcs",
            detail=f"canonical_length={len(canon)}",
            jcs_digest_preview=digest_preview,
        )
    except (TypeError, ValueError) as exc:
        return GateResult(ok=False, stage="jcs", detail=str(exc))


def gate_sql_and_jcs(sql: str, payload: Any | None = None) -> GateResult:
    """Combined gate used by higher-layer dispatch before tool / query execution."""
    sql_result = gate_sql(sql)
    if not sql_result.ok:
        return sql_result
    if payload is None:
        return sql_result
    jcs_result = gate_jcs_payload(payload)
    if not jcs_result.ok:
        return jcs_result
    # Both passed — return the richer of the two
    return GateResult(
        ok=True,
        stage="rule_s4+jcs",
        detail=f"{sql_result.detail}; {jcs_result.detail}",
        rule_s4=sql_result.rule_s4,
        jcs_digest_preview=jcs_result.jcs_digest_preview,
    )
