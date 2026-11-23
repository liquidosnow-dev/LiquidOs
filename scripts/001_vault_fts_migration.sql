-- 001_vault_fts_migration.sql
-- Liquid Mercury Vault: NotebookLM-oriented documents + FTS5 + optional vector slot
-- Idempotent-friendly: uses IF NOT EXISTS where supported.

PRAGMA foreign_keys = ON;

-- Source of truth for uploaded / ingested documents (NotebookLM sources, notes, audits)
CREATE TABLE IF NOT EXISTS vault_docs (
  id              INTEGER PRIMARY KEY,
  doc_id          TEXT    UNIQUE,
  title           TEXT    NOT NULL DEFAULT '',
  heading         TEXT    NOT NULL DEFAULT '',
  body            TEXT    NOT NULL DEFAULT '',
  source          TEXT,
  source_type     TEXT,                 -- e.g. notebooklm, manual, agent_pad
  created_at_utc  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at_utc  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vault_docs_source ON vault_docs(source);
CREATE INDEX IF NOT EXISTS idx_vault_docs_source_type ON vault_docs(source_type);
CREATE INDEX IF NOT EXISTS idx_vault_docs_updated ON vault_docs(updated_at_utc);

-- FTS5 external-content index
-- Tokenizer: unicode61 + diacritic folding. Porter stemming is optional; see docs/FTS5_TOKENIZATION.md
CREATE VIRTUAL TABLE IF NOT EXISTS vault_fts USING fts5(
  title,
  heading,
  body,
  source UNINDEXED,
  content='vault_docs',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);

-- Keep FTS in sync with vault_docs
CREATE TRIGGER IF NOT EXISTS vault_docs_ai AFTER INSERT ON vault_docs BEGIN
  INSERT INTO vault_fts(rowid, title, heading, body, source)
  VALUES (new.id, new.title, new.heading, new.body, new.source);
END;

CREATE TRIGGER IF NOT EXISTS vault_docs_ad AFTER DELETE ON vault_docs BEGIN
  INSERT INTO vault_fts(vault_fts, rowid, title, heading, body, source)
  VALUES ('delete', old.id, old.title, old.heading, old.body, old.source);
END;

CREATE TRIGGER IF NOT EXISTS vault_docs_au AFTER UPDATE ON vault_docs BEGIN
  INSERT INTO vault_fts(vault_fts, rowid, title, heading, body, source)
  VALUES ('delete', old.id, old.title, old.heading, old.body, old.source);
  INSERT INTO vault_fts(rowid, title, heading, body, source)
  VALUES (new.id, new.title, new.heading, new.body, new.source);
END;

-- Optional embedding metadata (vector blob stored when sqlite-vec / external embedder is available)
CREATE TABLE IF NOT EXISTS vault_embeddings (
  doc_id     INTEGER PRIMARY KEY REFERENCES vault_docs(id) ON DELETE CASCADE,
  model      TEXT    NOT NULL,
  dims       INTEGER NOT NULL,
  embedding  BLOB    NOT NULL,
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Schema migrations ledger is created/owned by an_nexus.db_migration
