# FTS5 / BM25 Tokenization Strategies

**Version**: 2026-11-23  
**Related**: `docs/FTS5_CONTEXT_SEMANTIC.md`, `scripts/001_vault_fts_migration.sql`

Guidance for NotebookLM-style corpora (mixed prose, headings, technical terms).

---

## 1. Strategy Matrix

| Tokenizer | Strengths | Weaknesses | Use when |
|-----------|-----------|------------|----------|
| `unicode61` | Stable Unicode word breaks | No stemming | Default multilingual / mixed |
| `unicode61 remove_diacritics 2` | Accent folding | Same | **Default for vault_fts** |
| `porter unicode61 ...` | English stemming | Over-stems rare terms / brands | English-only help corpora |
| `trigram` | Substring / code identifiers | Larger index, noisy | API names, error strings, CJK assist |
| Dual index (porter + exact) | Stemmed recall + exact precision | Two indexes to maintain | High-value knowledge bases |

**Vault default** (`001_vault_fts_migration.sql`):

```sql
tokenize='unicode61 remove_diacritics 2'
```

Rationale: NotebookLM sources mix product names, architecture terms, and proper nouns. Aggressive Porter stemming often collapses distinct tokens (`authorizer` / `authority`). Prefer no stem + strong BM25 column weights; add a trigram secondary index only if substring recall is measured as weak.

---

## 2. BM25 Column Weights (NotebookLM docs)

| Column | Weight | Why |
|--------|--------|-----|
| title | 5.0 | Document / source title |
| heading | 2.0 | Section context inside long sources |
| body | 1.0 | Full text |

Implemented in `search_fts(..., title_weight=5.0, heading_weight=2.0, body_weight=1.0)`.

---

## 3. Query-Side Token Policy

1. **Untrusted input** → `escape_fts5_query` (quote tokens, strip AND/OR/NOT/NEAR/`*`/`:`).
2. **Prefix search** → only on safe `[A-Za-z0-9_]+` tokens via `build_match_query(..., prefix=True)`.
3. **Phrase intent** → `mode="phrase"` when the UI explicitly requests exact phrase.

Never pass raw model text into `MATCH`.

---

## 4. Semantic Chaining

Lexical ranks from FTS5 and semantic ranks from `search_vector_knn` are fused with RRF (`k=60`). Vector-only hits are hydrated from `vault_docs` so context blocks remain available even when FTS misses paraphrase matches.

---

## 5. Migration

```python
from an_nexus.db_migration import apply_default_vault_migrations

apply_default_vault_migrations(conn)
```

Applies `scripts/001_vault_fts_migration.sql` once and records it in `schema_migrations`.
