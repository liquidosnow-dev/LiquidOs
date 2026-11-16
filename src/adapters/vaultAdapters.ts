import { Project, ProjectFile } from '../types';
import {
  hydrateVectorVault,
  replaceUrlChunks,
  similaritySearch,
  getVectorVaultStats,
  VectorSearchHit,
} from '../services/vectorStore';
import { generateDeterministicEmbedding } from '../services/snapshotPipeline';
import { validateSqlRuleS4, ASTGuardResult } from '../utils/sovereignSubstrate';
import { sha256Hex } from '../utils/securityCrypto';
import { canonicalize } from '../utils/contractRegistry';
import { createInitialLiquidChromeOsDb, queryLiquidChromeOsDb } from '../utils/liquidChromeOs';

export interface DuckDbVaultQueryResult {
  adapter: 'duckdb';
  sql: string;
  astGuard: ASTGuardResult;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  payloadDigest: string;
  source: 'workspace_columnar' | 'substrate_endpoint';
  executedAt: number;
}

export interface LanceDbVaultSearchResult {
  adapter: 'lancedb';
  query: string;
  topK: number;
  hits: VectorSearchHit[];
  totalIndexedChunks: number;
  payloadDigest: string;
  executedAt: number;
}

export interface VaultReadSnapshot {
  duckdb: DuckDbVaultQueryResult;
  lancedb: LanceDbVaultSearchResult;
  vaultDigest: string;
}

/**
 * Evaluates a read-only Rule S4 SQL query against workspace columnar analytics
 * (simulating DuckDB OLAP projection over project files and commit history)
 * and optionally verifies with the server `/api/substrate/sql-guard` when reachable.
 */
export async function readDuckDbVault(options: {
  sql: string;
  project: Project;
  useServerGuard?: boolean;
}): Promise<DuckDbVaultQueryResult> {
  const { sql, project, useServerGuard = false } = options;
  const astGuard = validateSqlRuleS4(sql);
  if (!astGuard.allowed) {
    throw new Error(`[DuckDB Vault Adapter] ${astGuard.reason || 'Rule S4 SQL validation failed'}`);
  }

  if (useServerGuard && typeof fetch === 'function') {
    try {
      const resp = await fetch('/api/substrate/sql-guard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });
      if (resp.ok) {
        const serverGuard = await resp.json();
        if (!serverGuard?.allowed) {
          throw new Error(
            `[DuckDB Vault Adapter] Server Rule S4 rejected query: ${serverGuard?.reason || 'denied'}`
          );
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('Server Rule S4 rejected')) {
        throw err;
      }
      // Non-fatal fallback to local Rule S4 AST guard when offline / unit tests
    }
  }

  const normalizedSql = sql.toUpperCase();
  const osTableMatch = sql.match(/\bFROM\s+(os_[a-zA-Z0-9_]+)/i);
  if (osTableMatch) {
    if (useServerGuard && typeof fetch === 'function') {
      try {
        const osResp = await fetch('/api/os/db/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql }),
        });
        if (osResp.ok) {
          const osData = await osResp.json();
          if (osData?.allowed && Array.isArray(osData.rows)) {
            return {
              adapter: 'duckdb',
              sql,
              astGuard: osData.astGuard || astGuard,
              columns: osData.columns || [],
              rows: osData.rows,
              rowCount: osData.rows.length,
              payloadDigest: osData.payloadDigest || sha256Hex(canonicalize(osData.rows)),
              source: 'substrate_endpoint',
              executedAt: osData.executedAt || Date.now(),
            };
          }
        }
      } catch {
        // Fallback to deterministic local OS DB snapshot when offline or in unit tests
      }
    }

    const localOsRes = queryLiquidChromeOsDb(createInitialLiquidChromeOsDb(), sql);
    return {
      adapter: 'duckdb',
      sql,
      astGuard: localOsRes.astGuard,
      columns: localOsRes.columns,
      rows: localOsRes.rows,
      rowCount: localOsRes.rowCount,
      payloadDigest: localOsRes.payloadDigest,
      source: 'workspace_columnar',
      executedAt: localOsRes.executedAt,
    };
  }

  const isLanguageAggregation =
    normalizedSql.includes('GROUP BY') && normalizedSql.includes('LANGUAGE');
  const isCommitQuery = normalizedSql.includes('COMMITS');

  let columns: string[];
  let rows: Array<Record<string, unknown>>;

  if (isCommitQuery) {
    columns = ['commit_id', 'message', 'author', 'file_count', 'claim_status', 'timestamp'];
    rows = project.commits.slice(0, 25).map((c) => ({
      commit_id: c.id,
      message: c.message,
      author: c.author,
      file_count: c.files.length,
      claim_status: c.provenance?.claimStatus ?? 'untested',
      timestamp: c.timestamp,
    }));
  } else if (isLanguageAggregation) {
    const counts = new Map<string, { file_count: number; total_bytes: number }>();
    for (const file of project.files) {
      const cur = counts.get(file.language) || { file_count: 0, total_bytes: 0 };
      cur.file_count += 1;
      cur.total_bytes += new TextEncoder().encode(file.content).length;
      counts.set(file.language, cur);
    }
    columns = ['language', 'file_count', 'total_bytes'];
    rows = Array.from(counts.entries())
      .map(([language, stats]) => ({
        language,
        file_count: stats.file_count,
        total_bytes: stats.total_bytes,
      }))
      .sort((a, b) => b.total_bytes - a.total_bytes);
  } else {
    columns = ['path', 'language', 'bytes', 'sha256_prefix', 'last_modified'];
    rows = project.files
      .slice()
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((f) => ({
        path: f.path,
        language: f.language,
        bytes: new TextEncoder().encode(f.content).length,
        sha256_prefix: sha256Hex(f.content).slice(0, 12),
        last_modified: f.lastModified,
      }));
  }

  const limitMatch = normalizedSql.match(/\bLIMIT\s+(\d+)\b/);
  if (limitMatch) {
    const limit = Math.max(0, Number(limitMatch[1]));
    rows = rows.slice(0, Math.min(limit, 10000));
  } else {
    // Enforce Pi Pipeline 10k row scan ceiling
    rows = rows.slice(0, 10000);
  }

  const payloadDigest = sha256Hex(canonicalize({ sql, columns, rows }));
  return {
    adapter: 'duckdb',
    sql,
    astGuard,
    columns,
    rows,
    rowCount: rows.length,
    payloadDigest,
    source: 'workspace_columnar',
    executedAt: Date.now(),
  };
}

/**
 * Indexes workspace files into the LanceDB-compatible 1536-dim vector store
 * so semantic searches return live workspace context alongside captured snapshots.
 */
export function indexWorkspaceFilesInLanceDb(files: ProjectFile[]): number {
  let indexed = 0;
  for (const file of files) {
    const url = `workspace://${file.path}`;
    const text = `[${file.path} (${file.language})]\n${file.content.slice(0, 4000)}`;
    const embedding = generateDeterministicEmbedding(text);
    replaceUrlChunks(url, [
      {
        chunkId: `ws_${sha256Hex(file.path).slice(0, 12)}`,
        content: text,
        embedding,
        timestamp: file.lastModified || Date.now(),
      },
    ]);
    indexed += 1;
  }
  return indexed;
}

/**
 * Executes a 1536-dim semantic similarity search against the LanceDB vector store.
 */
export async function readLanceDbVault(options: {
  query: string;
  topK?: number;
  projectFiles?: ProjectFile[];
  autoIndexWorkspace?: boolean;
}): Promise<LanceDbVaultSearchResult> {
  const { query, topK = 5, projectFiles = [], autoIndexWorkspace = true } = options;
  await hydrateVectorVault();

  if (autoIndexWorkspace && projectFiles.length > 0) {
    indexWorkspaceFilesInLanceDb(projectFiles);
  }

  const queryVec = generateDeterministicEmbedding(query || 'workspace architecture');
  const hits = similaritySearch(queryVec, topK);
  const stats = getVectorVaultStats();
  const payloadDigest = sha256Hex(canonicalize({ query, topK, hits }));

  return {
    adapter: 'lancedb',
    query,
    topK,
    hits,
    totalIndexedChunks: stats.totalChunks,
    payloadDigest,
    executedAt: Date.now(),
  };
}

/**
 * Reads combined DuckDB + LanceDB Vault context in parallel and returns a verifiable snapshot digest.
 */
export async function readVaultAdaptersSnapshot(options: {
  project: Project;
  query: string;
  duckdbSql?: string;
  topK?: number;
  useServerGuard?: boolean;
}): Promise<VaultReadSnapshot> {
  const sql =
    options.duckdbSql ||
    'SELECT path, language, bytes, sha256_prefix, last_modified FROM workspace_files LIMIT 100';

  const [duckdb, lancedb] = await Promise.all([
    readDuckDbVault({
      sql,
      project: options.project,
      useServerGuard: options.useServerGuard,
    }),
    readLanceDbVault({
      query: options.query,
      topK: options.topK ?? 5,
      projectFiles: options.project.files,
      autoIndexWorkspace: true,
    }),
  ]);

  const vaultDigest = sha256Hex(
    canonicalize({
      duckdbDigest: duckdb.payloadDigest,
      lancedbDigest: lancedb.payloadDigest,
    })
  );

  return {
    duckdb,
    lancedb,
    vaultDigest,
  };
}
