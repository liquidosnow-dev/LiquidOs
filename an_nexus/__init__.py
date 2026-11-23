"""Atomic Nexus v4.2 portable evidence-integrity, continuity, and access-transfer toolchain."""

__version__ = "4.2.0"

from .jcs import canonical_bytes, canonicalize
from .rule_s4 import RuleS4Result, RuleS4Violation, is_safe, validate_sql
from .gates import GateResult, gate_jcs_payload, gate_sql, gate_sql_and_jcs
from .fts5_search import (
    SearchHit,
    build_match_query,
    chain_lexical_and_semantic,
    escape_fts5_query,
    hits_to_context,
    hybrid_search,
    quote_fts_token,
    reciprocal_rank_fusion,
    search_fts,
    search_vector_knn,
)
from .db_migration import (
    MigrationResult,
    apply_default_vault_migrations,
    apply_migrations,
    pending_migrations,
)

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
    "SearchHit",
    "escape_fts5_query",
    "quote_fts_token",
    "build_match_query",
    "search_fts",
    "search_vector_knn",
    "reciprocal_rank_fusion",
    "chain_lexical_and_semantic",
    "hybrid_search",
    "hits_to_context",
    "MigrationResult",
    "apply_migrations",
    "pending_migrations",
    "apply_default_vault_migrations",
]
