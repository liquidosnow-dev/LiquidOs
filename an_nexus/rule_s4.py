"""Rule S4 Lexical AST SQL Guard (D-19).

Enforces a strict allowlist on user-facing SQL:
- Root verb must be SELECT or WITH ... SELECT
- Single statement only (no stacked queries)
- Comments and string literals are stripped before analysis
- Mutation / exfiltration opcodes are rejected

This is the sole SQL gate required by the Atomic Nexus Sovereign Substrate.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Final

# Allowed root verbs after normalization
_ALLOWED_ROOTS: Final[frozenset[str]] = frozenset({"SELECT", "WITH"})

# Explicitly denied opcodes / clauses (defense in depth after root check)
_DENIED_OPCODES: Final[frozenset[str]] = frozenset(
    {
        "INSERT",
        "UPDATE",
        "DELETE",
        "DROP",
        "ALTER",
        "CREATE",
        "TRUNCATE",
        "REPLACE",
        "ATTACH",
        "DETACH",
        "REINDEX",
        "VACUUM",
        "ANALYZE",
        "GRANT",
        "REVOKE",
        "INTO",  # catches SELECT ... INTO OUTFILE / INTO DUMPFILE patterns
        "OUTFILE",
        "DUMPFILE",
        "LOAD",
        "COPY",
    }
)


class RuleS4Violation(ValueError):
    """Raised when a SQL string fails Rule S4."""


@dataclass(frozen=True, slots=True)
class RuleS4Result:
    """Successful validation result."""

    root_verb: str
    normalized: str
    original_length: int


def _strip_comments_and_strings(sql: str) -> str:
    """Remove block comments, line comments, and quoted string literals.

    This prevents attackers from hiding opcodes inside comments or strings.
    The replacement preserves statement structure for subsequent tokenization.
    """
    # Remove /* ... */ block comments (non-greedy, multi-line)
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.DOTALL)
    # Remove -- line comments
    sql = re.sub(r"--[^\n]*", " ", sql)
    # Remove single-quoted strings (handle simple escaped quotes)
    sql = re.sub(r"'(?:[^']|'')*'", " '' ", sql)
    # Remove double-quoted identifiers / strings
    sql = re.sub(r'"(?:[^"]|"")*"', ' "" ', sql)
    return sql


def _normalize(sql: str) -> str:
    """Uppercase, collapse whitespace, strip."""
    cleaned = _strip_comments_and_strings(sql)
    cleaned = re.sub(r"\s+", " ", cleaned).strip().upper()
    return cleaned


def validate_sql(sql: str) -> RuleS4Result:
    """Validate a SQL string against Rule S4.

    Raises RuleS4Violation on any failure.
    Returns RuleS4Result on success.
    """
    if not isinstance(sql, str):
        raise RuleS4Violation("SQL must be a string")

    original_length = len(sql)
    if original_length == 0 or sql.isspace():
        raise RuleS4Violation("Empty SQL rejected")

    normalized = _normalize(sql)
    if not normalized:
        raise RuleS4Violation("SQL reduced to empty after comment/string stripping")

    # Single-statement enforcement: reject unquoted semicolons that would stack statements
    # (After stripping strings/comments, a remaining ';' is a statement separator.)
    if ";" in normalized.rstrip(";"):
        raise RuleS4Violation("Multi-statement SQL rejected (stacked queries forbidden)")

    # Tokenize on whitespace and common punctuation for root-verb extraction
    tokens = re.findall(r"[A-Z_][A-Z0-9_]*", normalized)
    if not tokens:
        raise RuleS4Violation("No recognizable SQL tokens")

    root = tokens[0]
    if root not in _ALLOWED_ROOTS:
        raise RuleS4Violation(
            f"Root verb {root!r} forbidden; only SELECT or WITH are permitted"
        )

    # Defense-in-depth: scan remaining tokens for denied opcodes
    for tok in tokens[1:]:
        if tok in _DENIED_OPCODES:
            raise RuleS4Violation(f"Denied opcode/clause {tok!r} present in statement")

    # WITH must eventually lead to a SELECT (basic structural check)
    if root == "WITH" and "SELECT" not in tokens:
        raise RuleS4Violation("WITH statement must contain a SELECT")

    return RuleS4Result(
        root_verb=root,
        normalized=normalized,
        original_length=original_length,
    )


def is_safe(sql: str) -> bool:
    """Convenience boolean wrapper; never raises."""
    try:
        validate_sql(sql)
        return True
    except RuleS4Violation:
        return False
