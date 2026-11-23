# FTS5 Context-Aware Full-Text Search & Semantic Chaining

**Version**: 2026-11-23  
**Status**: Canonical design for Liquid Mercury Vault / Vault Query Plane  
**Related**: `docs/SOVEREIGN_SUBSTRATE.md` §3, Pi Pipeline VECTOR_INDEX_BARRIER, `an_nexus/fts5_search.py`

This document specifies a production-grade full-text layer on SQLite FTS5 with
**intuitive context awareness** (snippets, highlights, proximity) and
**semantic chaining** (hybrid fusion of BM25 ranks with vector ranks via
Reciprocal Rank Fusion).

FTS5 itself is implemented as a **virtual table**. No custom VTab module is
required for standard vault search; custom rusqlite `VTab` implementations are
reserved for specialized sources (e.g. live agent pads, external adapters).

---

## 1. Virtual Table: FTS5 as the Index

### 1.1 Recommended Schema (External Content)

Keep authoritative rows in a normal table; index them with an external-content
FTS5 virtual table so highlights/snippets can still resolve text and storage
stays normalized.

```sql
CREATE TABLE vault_docs (
  id         INTEGER PRIMARY KEY,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  source     TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE vault_fts USING fts5(
  title,
  body,
  source UNINDEXED,
  content='vault_docs',
  content_rowid='id',
  tokenize='porter unicode61 remove_diacritics 2'
);
```

**Tokenizer rationale**

| Option | Role |
|--------|------|
| `porter` | English stemming (`connect` ↔ `connecting`) |
| `unicode61` | Robust Unicode tokenization |
| `remove_diacritics 2` | Accent folding |

Optional: a second FTS table with `tokenize='trigram'` for substring / code-identifier search.

### 1.2 Sync Triggers

```sql
CREATE TRIGGER vault_docs_ai AFTER INSERT ON vault_docs BEGIN
  INSERT INTO vault_fts(rowid, title, body, source)
  VALUES (new.id, new.title, new.body, new.source);
END;

CREATE TRIGGER vault_docs_ad AFTER DELETE ON vault_docs BEGIN
  INSERT INTO vault_fts(vault_fts, rowid, title, body, source)
  VALUES ('delete', old.id, old.title, old.body, old.source);
END;

CREATE TRIGGER vault_docs_au AFTER UPDATE ON vault_docs BEGIN
  INSERT INTO vault_fts(vault_fts, rowid, title, body, source)
  VALUES ('delete', old.id, old.title, old.body, old.source);
  INSERT INTO vault_fts(rowid, title, body, source)
  VALUES (new.id, new.title, new.body, new.source);
END;
```

Initial backfill:

```sql
INSERT INTO vault_fts(rowid, title, body, source)
SELECT id, title, body, source FROM vault_docs;
```

---

## 2. Context Awareness (Intuitive Results)

### 2.1 Ranking — BM25 with Column Weights

Lower BM25 is better. Weight title higher than body:

```sql
SELECT
  d.id,
  d.title,
  bm25(vault_fts, 5.0, 1.0) AS score,
  snippet(vault_fts, 1, '[', ']', '…', 12) AS excerpt
FROM vault_fts
JOIN vault_docs AS d ON d.id = vault_fts.rowid
WHERE vault_fts MATCH :q
ORDER BY score
LIMIT :k;
```

`ORDER BY rank` is equivalent to unweighted `bm25(vault_fts)` and can be slightly faster with `LIMIT`.

### 2.2 Snippets & Highlights

| Function | Use |
|----------|-----|
| `snippet(fts, col, open, close, ellipsis, nTokens)` | Short window around the best match (UI cards, RAG context) |
| `highlight(fts, col, open, close)` | Full column with match markers |

Recommended defaults for agent / UI context:

- Body column index `1`
- Markers `[` / `]` or `<mark>` / `</mark>`
- `nTokens` in **8–16** for list views; **24–32** for detail panes

### 2.3 Proximity & Phrase Context

```sql
-- Phrase
WHERE vault_fts MATCH '"sovereign substrate"'

-- Proximity: terms within N tokens
WHERE vault_fts MATCH 'NEAR(rule authorizer, 6)'

-- Column filter
WHERE vault_fts MATCH 'title: nexus'

-- Prefix
WHERE vault_fts MATCH 'auth*'
```

These operators give **structural context** beyond bag-of-words BM25.

### 2.4 Safe Query Construction

User / model text must **not** be passed raw into `MATCH` (operators are syntax).
Always quote tokens or use a builder (see `an_nexus/fts5_search.py`).

---

## 3. Semantic Chaining (Hybrid Retrieval)

Lexical FTS and dense vectors fail on complementary cases:

- FTS: exact terms, rare identifiers, legal/code strings
- Vectors: paraphrase, conceptual match, cross-lingual drift

**Semantic chaining** here means: run both retrievers, then fuse ranks so
documents strong in *either* list survive and documents strong in *both* rise.

### 3.1 Reciprocal Rank Fusion (RRF)

\[
\mathrm{score}(d) = \sum_{\ell \in \mathrm{lists}} \frac{w_\ell}{k + \mathrm{rank}_\ell(d)}
\]

- \(k = 60\) (standard)
- No score calibration between BM25 and cosine
- Stable, deterministic, easy to audit

### 3.2 Pipeline

```
Query
  ├─► FTS5 MATCH → ranked ids (BM25)     ─┐
  │                                        ├─► RRF fuse → final ids + scores
  └─► Vector KNN (sqlite-vec / LanceDB) ─┘
                                              │
                                              ▼
                                    Fetch docs + FTS snippets
                                    (context for agent / UI)
```

This matches the substrate engine matrix (sqlite-vec, LanceDB, DuckDB-VSS)
and the existing RRF mention in `SOVEREIGN_SUBSTRATE.md`.

### 3.3 Practical Weights

| Profile | FTS weight | Vector weight | Notes |
|---------|------------|---------------|-------|
| Balanced | 1.0 | 1.0 | Default |
| Keyword-heavy | 1.5 | 0.8 | IDs, errors, API names |
| Conceptual | 0.8 | 1.5 | “how does X relate to Y” |

### 3.4 Context Assembly for Agents

After fusion, build the context window from:

1. Title + source metadata
2. FTS `snippet()` / `highlight()` for lexical hits
3. Optional neighboring chunks (same parent doc, ±1) for continuity
4. Hard token / char budget (align with MEMORY_MTU_BARRIER)

---

## 4. Security & Substrate Alignment

| Control | Application |
|---------|-------------|
| Rule S4 | All user/model SQL still passes `gate_sql` / `validate_sql` |
| VDBE authorizer | Read-only vault handles deny mutation/DDL |
| MATCH builder | Prevents operator injection via untrusted strings |
| Extensions | Remain disabled on Vault Query Plane connections |
| query_only | On for all agent-facing handles |

Search helpers emit **parameterized** SQL only; they do not accept arbitrary SQL from the model.

---

## 5. Custom Virtual Tables (When to Build One)

rusqlite supports custom modules via `VTab` + `VTabCursor` (`vtab` feature).
Use a **custom** virtual table only when:

- The source is not a static SQLite table (e.g. live notepad pads, remote adapter)
- You need predicate pushdown into a non-SQL system
- You are exposing a controlled, read-only facade over multiple backends

For ordinary vault full-text search, **FTS5 is the virtual table**. Prefer it.

---

## 6. Implementation Map

| Artifact | Role |
|----------|------|
| `docs/FTS5_CONTEXT_SEMANTIC.md` | This specification |
| `an_nexus/fts5_search.py` | Safe MATCH builder, BM25+snippet search, RRF fusion |
| `an_nexus/rule_s4.py` + `gates.py` | Pre-dispatch SQL allowlist |
| `an_nexus/native/an_nexus_sqlite` | Hardened read-only engine handles |

---

## 7. Minimal Verification Queries

```sql
-- Ranked lexical search with context
SELECT d.id, d.title,
       bm25(vault_fts, 5.0, 1.0) AS score,
       snippet(vault_fts, 1, '[', ']', '…', 12) AS excerpt
FROM vault_fts
JOIN vault_docs d ON d.id = vault_fts.rowid
WHERE vault_fts MATCH '"liquid os" OR nexus'
ORDER BY score
LIMIT 10;

-- Proximity context
SELECT snippet(vault_fts, 1, '[', ']', '…', 16)
FROM vault_fts
WHERE vault_fts MATCH 'NEAR(rule authorizer, 8)';
```

---

*FTS5 supplies lexical precision and readable context. Semantic chaining via RRF
supplies conceptual coverage. Together they form the Vault Query Plane search path.*
