"""Atomic Nexus v4.2 portable evidence-integrity, continuity, and access-transfer toolchain."""

__version__ = "4.2.0"

# Public substrate surfaces for higher-layer agentic dispatch
from .jcs import canonical_bytes, canonicalize
from .rule_s4 import RuleS4Result, RuleS4Violation, is_safe, validate_sql
from .gates import GateResult, gate_jcs_payload, gate_sql, gate_sql_and_jcs

__all__ = [
    "__version__",
    "canonicalize",
    "canonical_bytes",
    "validate_sql",
    "is_safe",
    "RuleS4Result",
    "RuleS4Violation",
    "GateResult",
    "gate_sql",
    "gate_jcs_payload",
    "gate_sql_and_jcs",
]
