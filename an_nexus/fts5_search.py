"""FTS5 context-aware search and semantic chaining (RRF).

Complements the Vault Query Plane:
- Safe MATCH query construction (no raw operator injection)
- BM25-ranked search with snippet/highlight context
- Reciprocal Rank Fusion for lexical + semantic rank lists

All SQL emitted for execution should still pass through Rule S4 / gates when
originating from agent or tool dispatch paths.
"""
from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass
from typing import Any, Iterable, Sequence

# Tokens safe to pass unquoted into FTS5 after light normalization.
_SAFE_TOKEN = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_\-./]*$")
_WHITESPACE = re.compile(r"\s+")


@dataclass(frozen=True, slots=True)
class SearchHit:
    doc_id: int
    title: str
    score: float
    excerpt: str
    source: str | None = None


def quote_fts_token(token: str) -> str:
    """Quote a single token for FTS5 MATCH so operators are treated as literals."""
    t = token.strip()
    if not t:
        return '""'
    # Escape embedded double-quotes per FTS5 string rules.
    escaped = t.replace('"', '""')
    return f'"{escaped}"'


def build_match_query(
    text: str,
    *,
    mode: str = "and",
    prefix: bool = False,
    column: str | None = None,
) -> str:
    """Build a safe FTS5 MATCH expression from free-form user/model text.

    mode:
      - "and": all tokens required (default)
      - "or": any token
      - "phrase": entire string as one phrase
    prefix: append * to each token (prefix search)
    column: optional column filter (e.g. "title")
    """
    text = _WHITESPACE.sub(" ", (text or "").strip())
    if not text:
        raise ValueError("empty search text")

    if mode == "phrase":
        body = quote_fts_token(text)
    else:
        parts = text.split(" ")
        quoted: list[str] = []
        for p in parts:
            if not p:
                continue
            q = quote_fts_token(p)
            if prefix:
                # Prefix applies outside quotes in FTS5: token*
                # For safety we only prefix clearly safe identifiers.
                raw = p.strip('"')
                if _SAFE_TOKEN.match(raw):
                    q = f"{raw}*"
                # else keep quoted literal without prefix
            quoted.append(q)
        if not quoted:
            raise ValueError("no tokens after parsing")
        joiner = " OR " if mode == "or" else " "
        body = joiner.join(quoted)

    if column:
        if not _SAFE_TOKEN.match(column):
            raise ValueError(f"invalid FTS column name: {column!r}")
        return f"{column}: {body}"
    return body


def search_fts(
    conn: sqlite3.Connection,
    query_text: str,
    *,
    fts_table: str = "vault_fts",
    docs_table: str = "vault_docs",
    limit: int = 10,
    title_weight: float = 5.0,
    body_weight: float = 1.0,
    snippet_tokens: int = 12,
    mode: str = "and",
    prefix: bool = False,
) -> list[SearchHit]:
    """Run BM25-ranked FTS5 search with context snippets.

    Expects external-content schema described in docs/FTS5_CONTEXT_SEMANTIC.md.
    """
    if not _SAFE_TOKEN.match(fts_table) or not _SAFE_TOKEN.match(docs_table):
        raise ValueError("invalid table name")

    match_expr = build_match_query(query_text, mode=mode, prefix=prefix)
    sql = f"""
        SELECT
          d.id,
          d.title,
          bm25({fts_table}, ?, ?) AS score,
          snippet({fts_table}, 1, '[', ']', '…', ?) AS excerpt,
          d.source
        FROM {fts_table}
        JOIN {docs_table} AS d ON d.id = {fts_table}.rowid
        WHERE {fts_table} MATCH ?
        ORDER BY score
        LIMIT ?
    """
    cur = conn.execute(
        sql,
        (title_weight, body_weight, snippet_tokens, match_expr, limit),
    )
    hits: list[SearchHit] = []
    for row in cur.fetchall():
        hits.append(
            SearchHit(
                doc_id=int(row[0]),
                title=str(row[1] or ""),
                score=float(row[2]),
                excerpt=str(row[3] or ""),
                source=row[4] if row[4] is not None else None,
            )
        )
    return hits


def reciprocal_rank_fusion(
    ranked_lists: Sequence[Sequence[int]],
    *,
    weights: Sequence[float] | None = None,
    k: int = 60,
) -> list[tuple[int, float]]:
    """Fuse multiple ranked id lists with weighted RRF.

    Returns list of (doc_id, score) sorted by score descending (higher is better).
    """
    if k < 1:
        raise ValueError("k must be >= 1")
    if not ranked_lists:
        return []

    w = list(weights) if weights is not None else [1.0] * len(ranked_lists)
    if len(w) != len(ranked_lists):
        raise ValueError("weights length must match ranked_lists")

    scores: dict[int, float] = {}
    for list_weight, ids in zip(w, ranked_lists):
        for rank, doc_id in enumerate(ids, start=1):
            scores[doc_id] = scores.get(doc_id, 0.0) + list_weight / (k + rank)

    return sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))


def chain_lexical_and_semantic(
    lexical_ids: Sequence[int],
    semantic_ids: Sequence[int],
    *,
    lexical_weight: float = 1.0,
    semantic_weight: float = 1.0,
    k: int = 60,
    limit: int | None = None,
) -> list[tuple[int, float]]:
    """Semantic chaining: RRF over FTS rank list + vector rank list."""
    fused = reciprocal_rank_fusion(
        [list(lexical_ids), list(semantic_ids)],
        weights=[lexical_weight, semantic_weight],
        k=k,
    )
    if limit is not None:
        return fused[:limit]
    return fused


def hits_to_context(
    hits: Iterable[SearchHit],
    *,
    max_chars: int = 4000,
) -> str:
    """Assemble a single context block for agent prompts (MEMORY_MTU friendly)."""
    parts: list[str] = []
    used = 0
    for h in hits:
        block = f"# {h.title} (id={h.doc_id})\n{h.excerpt}\n"
        if used + len(block) > max_chars:
            break
        parts.append(block)
        used += len(block)
    return "\n".join(parts)


__all__ = [
    "SearchHit",
    "quote_fts_token",
    "build_match_query",
    "search_fts",
    "reciprocal_rank_fusion",
    "chain_lexical_and_semantic",
    "hits_to_context",
]
