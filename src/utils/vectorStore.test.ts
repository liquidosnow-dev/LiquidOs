import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearVectorVault,
  getVectorVaultStats,
  insertVectorChunk,
  similaritySearch,
  VECTOR_DIMENSION,
} from '../services/vectorStore';
import {
  chunkText,
  extractCleanTextFromHtml,
  generateDeterministicEmbedding,
  snapshotAndVectorizeUrl,
} from '../services/snapshotPipeline';

describe('Sovereign Offline Vector Snapshot Engine', () => {
  beforeEach(() => {
    clearVectorVault();
  });

  it('strips script/style/HTML boilerplate cleanly and chunks overlapping text', () => {
    const html = `
      <html>
        <head><style>body { color: red; }</style></head>
        <body>
          <script>window.__secret = "skip";</script>
          <h1>Unified Evidence & Edge Sandbox</h1>
          <p>Hono v4 Edge API bound to Cloudflare D1 SQLite and AN-EVC-001 Registry.</p>
        </body>
      </html>
    `;
    const clean = extractCleanTextFromHtml(html);
    expect(clean).not.toContain('window.__secret');
    expect(clean).not.toContain('color: red');
    expect(clean).toContain('Unified Evidence & Edge Sandbox');

    const longWords = Array.from({ length: 180 }, (_, idx) => `token${idx}`).join(' ');
    const chunks = chunkText(longWords, 80, 20);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[1].split(/\s+/)[0]).toBe('token60');
  });

  it('generates L2-normalized 1536-dim embeddings and ranks relevant snapshots first', async () => {
    const emb = generateDeterministicEmbedding('RFC 8785 Canonicalizer UTF-16 key sort');
    expect(emb.length).toBe(VECTOR_DIMENSION);
    const norm = Math.sqrt(emb.reduce((acc, v) => acc + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 4);

    await snapshotAndVectorizeUrl(
      'https://app.preview/ledger',
      '<div><h1>Cloudflare D1 Ledger</h1><p>Interactive Evidence Chain storing SHA-256 hashes in DB_PROD SQLite.</p></div>'
    );
    await snapshotAndVectorizeUrl(
      'https://app.preview/canonicalizer',
      '<div><h1>RFC 8785 JCS Canonicalizer</h1><p>Eliminates 7 runtime serialization divergences across UTF-16 key sort and 2^53 safe integer guards.</p></div>'
    );

    const stats = getVectorVaultStats();
    expect(stats.totalChunks).toBe(2);
    expect(stats.distinctUrls).toBe(2);

    const queryVec = generateDeterministicEmbedding('RFC 8785 UTF-16 canonicalizer safe integer');
    const hits = similaritySearch(queryVec, 2);
    expect(hits.length).toBe(2);
    expect(hits[0].url).toBe('https://app.preview/canonicalizer');
    expect(hits[0].similarity).toBeGreaterThan(hits[1].similarity);
  });

  it('replaces chunks cleanly when re-indexing the same URL and handles empty vault', async () => {
    expect(similaritySearch(generateDeterministicEmbedding('anything'), 5)).toEqual([]);

    insertVectorChunk('manual-1', 'https://app.preview/', 'Initial seed chunk', generateDeterministicEmbedding('seed'));
    expect(getVectorVaultStats().totalChunks).toBe(1);

    await snapshotAndVectorizeUrl(
      'https://app.preview/',
      '<main><h2>Updated Snapshot State</h2><p>Fresh Hono edge telemetry captured live.</p></main>'
    );

    const stats = getVectorVaultStats();
    expect(stats.totalChunks).toBe(1);
    const hits = similaritySearch(generateDeterministicEmbedding('Updated Snapshot Hono edge telemetry'), 3);
    expect(hits[0].content).toContain('Updated Snapshot State');
  });
});
