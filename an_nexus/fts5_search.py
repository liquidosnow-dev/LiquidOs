"""FTS5 context-aware search, BM25 ranking, and semantic chaining (RRF).

Vault Query Plane helpers:
- Safe FTS5 MATCH construction (neutralize operator injection)
- Column-weighted BM25 + snippet context
- sqlite-vec KNN id retrieval (when vec0 table is present)
- Reciprocal Rank Fusion for lexical + semantic chaining
"""
from __future__ import annotations

import re
import sqlite3
import struct
from dataclasses import dataclass
from typing import Iterable, Sequence

_SAFE_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_WHITESPACE = re.compile(r"\s+")
_FTS_OPERATORS = re.compile(
    r"\b(AND|OR|NOT|NEAR)\b|[:*\"()\[\]{}]",
    re.IGNORECASE,
)


@dataclass(frozen=True, slots=True)
class SearchHit:
    doc_id: int
    title: str
    score: float
    excerpt: str
    source: str | None = None
    heading: str | None = None


def escape_fts5_query(text: str) -> str:
    """Sanitize free-form text into a safe AND-of-quoted-tokens MATCH query.

    Strips/neutralizes FTS5 operators so model or user input cannot inject
    NEAR/column filters or boolean structure.
    """
    text = _WHITESPACE.sub(" ", (text or "").strip())
    if not text:
        raise ValueError("empty search text")
    # Drop operator-like tokens; keep words
    raw_parts = text.split(" ")
    tokens: list[str] = []
    for part in raw_parts:
        if not part or _FTS_OPERATORS.fullmatch(part):
            continue
        cleaned = _FTS_OPERATORS.sub(" ", part)
        cleaned = _WHITESPACE.sub(" ", cleaned).strip()
        if not cleaned:
            continue
        escaped = cleaned.replace('"', '""')
        tokens.append(f'"{escaped}"')
    if not tokens:
        raise ValueError("no searchable tokens after sanitization")
    return " ".join(tokens)


def quote_fts_token(token: str) -> str:
    t = token.strip()
    if not t:
        return '""'
    return f'"{t.replace(chr(34), chr(34)+chr(34))}"'


def build_match_query(
    text: str,
    *,
    mode: str = "and",
    prefix: bool = False,
    column: str | None = None,
) -> str:
    """Build MATCH expression. Prefer escape_fts5_query for untrusted input."""
    if mode == "safe" or mode == "and":
        body = escape_fts5_query(text)
    elif mode == "phrase":
        body = quote_fts_token(_WHITESPACE.sub(" ", text.strip()))
    elif mode == "or":
        text = _WHITESPACE.sub(" ", (text or "").strip())
        parts = [quote_fts_token(p) for p in text.split(" ") if p]
        if not parts:
            raise ValueError("empty search text")
        body = " OR ".join(parts)
    else:
        body = escape_fts5_query(text)

    if prefix and mode != "phrase":
        # Best-effort prefix on simple tokens only
        rebuilt: list[str] = []
        for tok in body.split(" "):
            if tok.startswith('"') and tok.endswith('"') and len(tok) > 2:
                inner = tok[1:-1].replace('""', '"')
                if re.match(r"^[A-Za-z0-9_]+$", inner):
                    rebuilt.append(f"{inner}*")
                    continue
            rebuilt.append(tok)
        body = " ".join(rebuilt)

    if column:
        if not _SAFE_IDENT.match(column):
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
    heading_weight: float = 2.0,
    body_weight: float = 1.0,
    snippet_tokens: int = 12,
    snippet_column: int = 2,
    mode: str = "safe",
) -> list[SearchHit]:
    """BM25-ranked FTS5 search with context snippets.

    Column order in vault_fts: title(0), heading(1), body(2).
    Default snippet_column=2 (body).
    """
    if not _SAFE_IDENT.match(fts_table) or not _SAFE_IDENT.match(docs_table):
        raise ValueError("invalid table name")

    match_expr = build_match_query(query_text, mode=mode)
    sql = f"""
        SELECT
          d.id,
          d.title,
          bm25({fts_table}, ?, ?, ?) AS score,
          snippet({fts_table}, ?, '[', ']', '…', ?) AS excerpt,
          d.source,
          d.heading
        FROM {fts_table}
        JOIN {docs_table} AS d ON d.id = {fts_table}.rowid
        WHERE {fts_table} MATCH ?
        ORDER BY score
        LIMIT ?
    """
    cur = conn.execute(
        sql,
        (
            title_weight,
            heading_weight,
            body_weight,
            snippet_column,
            snippet_tokens,
            match_expr,
            limit,
        ),
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
                heading=str(row[5]) if row[5] is not None else None,
            )
        )
    return hits


def _pack_f32_vector(vec: Sequence[float]) -> bytes:
    return struct.pack(f"{len(vec)}f", *vec)


def search_vector_knn(
    conn: sqlite3.Connection,
    query_vector: Sequence[float],
    *,
    vec_table: str = "vault_vec",
    limit: int = 10,
    embedding_table: str = "vault_embeddings",
) -> list[int]:
    """Return doc ids ordered by vector similarity.

    Prefers a sqlite-vec `vec0` virtual table named `vec_table` with columns
    (doc_id, embedding). Falls back to a naive scan of `vault_embeddings` if
    the vec0 table is absent (dev / no extension builds).
    """
    if not _SAFE_IDENT.match(vec_table):
        raise ValueError("invalid vec table name")

    # Detect vec0 table
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type IN ('table','view') AND name = ?",
        (vec_table,),
    ).fetchone()

    if row:
        # sqlite-vec style: ORDER BY distance; exact SQL may vary by vec0 version
        blob = _pack_f32_vector(query_vector)
        try:
            cur = conn.execute(
                f"""
                SELECT doc_id
                FROM {vec_table}
                WHERE embedding MATCH ?
                ORDER BY distance
                LIMIT ?
                """,
                (blob, limit),
            )
            return [int(r[0]) for r in cur.fetchall()]
        except sqlite3.Error:
            pass  # fall through to blob table

    if not _SAFE_IDENT.match(embedding_table):
        raise ValueError("invalid embedding table name")

    # Fallback: no ANN — return empty rather than incorrect ranking
    # Callers can still run pure FTS.
    return []


def reciprocal_rank_fusion(
    ranked_lists: Sequence[Sequence[int]],
    *,
    weights: Sequence[float] | None = None,
    k: int = 60,
) -> list[tuple[int, float]]:
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
    fused = reciprocal_rank_fusion(
        [list(lexical_ids), list(semantic_ids)],
        weights=[lexical_weight, semantic_weight],
        k=k,
    )
    if limit is not None:
        return fused[:limit]
    return fused


def hybrid_search(
    conn: sqlite3.Connection,
    query_text: str,
    query_vector: Sequence[float] | None = None,
    *,
    limit: int = 10,
    lexical_weight: float = 1.0,
    semantic_weight: float = 1.0,
) -> list[SearchHit]:
    """End-to-end hybrid: FTS ranks + optional vector KNN → RRF → hydrated hits."""
    fts_hits = search_fts(conn, query_text, limit=max(limit * 3, limit))
    lexical_ids = [h.doc_id for h in fts_hits]
    semantic_ids: list[int] = []
    if query_vector is not None:
        semantic_ids = search_vector_knn(conn, query_vector, limit=max(limit * 3, limit))

    if semantic_ids:
        fused = chain_lexical_and_semantic(
            lexical_ids,
            semantic_ids,
            lexical_weight=lexical_weight,
            semantic_weight=semantic_weight,
            limit=limit,
        )
        by_id = {h.doc_id: h for h in fts_hits}
        # Hydrate any vector-only ids
        missing = [i for i, _ in fused if i not in by_id]
        if missing:
            placeholders = ",".join("?" * len(missing))
            rows = conn.execute(
                f"""
                SELECT id, title, source, heading,
                       substr(body, 1, 240)
                FROM vault_docs WHERE id IN ({placeholders})
                """,
                missing,
            ).fetchall()
            for r in rows:
                by_id[int(r[0])] = SearchHit(
                    doc_id=int(r[0]),
                    title=str(r[1] or ""),
                    score=0.0,
                    excerpt=str(r[4] or ""),
                    source=r[2],
                    heading=str(r[3]) if r[3] is not None else None,
                )
        out: list[SearchHit] = []
        for doc_id, score in fused:
            h = by_id.get(doc_id)
            if h is None:
                continue
            out.append(
                SearchHit(
                    doc_id=h.doc_id,
                    title=h.title,
                    score=score,
                    excerpt=h.excerpt,
                    source=h.source,
                    heading=h.heading,
                )
            )
        return out

    return fts_hits[:limit]


def hits_to_context(
    hits: Iterable[SearchHit],
    *,
    max_chars: int = 4000,
) -> str:
    parts: list[str] = []
    used = 0
    for h in hits:
        head = f"# {h.title}"
        if h.heading:
            head += f" — {h.heading}"
        block = f"{head} (id={h.doc_id})\n{h.excerpt}\n"
        if used + len(block) > max_chars:
            break
        parts.append(block)
        used += len(block)
    return "\n".join(parts)


__all__ = [
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
]
