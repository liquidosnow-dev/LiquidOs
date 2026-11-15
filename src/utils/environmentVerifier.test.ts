import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  evaluateVitestNdjsonStream,
  validateManifestPayload,
  validateAssetLinksPayload,
  runLiveEnvironmentVerification,
} from './environmentVerifier';

test('evaluateVitestNdjsonStream extracts summary and per-module coverage hotspots from NDJSON', () => {
  const sampleStream = [
    JSON.stringify({ type: 'start', command: 'vitest run --coverage' }),
    JSON.stringify({ type: 'log', line: 'PASS src/utils/testMetricsStore.test.ts' }),
    JSON.stringify({
      type: 'result',
      durationMs: 412,
      summary: { passedTests: 12, failedTests: 0, totalTests: 12 },
      coverage: {
        files: [
          {
            file: 'src/utils/contractRegistry.ts',
            lines: { pct: 91.2 },
            statements: { pct: 90.0 },
            functions: { pct: 95.0 },
            branches: { pct: 86.0 },
            uncoveredLines: [],
            uncoveredBranches: [],
          },
          {
            file: 'src/utils/piPipeline.ts',
            lines: { pct: 52.0 },
            statements: { pct: 50.0 },
            functions: { pct: 60.0 },
            branches: { pct: 44.0 },
            uncoveredLines: [32, 41],
            uncoveredBranches: [{ line: 32, type: 'if', pathsMissed: 2 }],
          },
        ],
      },
    }),
  ].join('\n');

  const res = evaluateVitestNdjsonStream(sampleStream);
  assert.equal(res.hasStartEvent, true);
  assert.equal(res.hasResultEvent, true);
  assert.equal(res.passedTests, 12);
  assert.equal(res.failedTests, 0);
  assert.equal(res.coverageFileCount, 2);
  assert.equal(res.hotspotCount, 1);
});

test('validateManifestPayload and validateAssetLinksPayload enforce Play Store PWA invariants', () => {
  const goodManifest = validateManifestPayload({
    name: 'LiquidOS ONE',
    short_name: 'LiquidOS',
    icons: [
      { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  });
  assert.equal(goodManifest.valid, true);

  const badManifest = validateManifestPayload({ name: 'Broken App', icons: [] });
  assert.equal(badManifest.valid, false);

  const goodAssetLinks = validateAssetLinksPayload([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'dev.liquidos.one.twa',
        sha256_cert_fingerprints: ['AB:CD:EF'],
      },
    },
  ]);
  assert.equal(goodAssetLinks.valid, true);

  const badAssetLinks = validateAssetLinksPayload([]);
  assert.equal(badAssetLinks.valid, false);
});

test('runLiveEnvironmentVerification executes all 7 environment probes cleanly against HTTP contract', async () => {
  const mockFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    const makeJson = (body: unknown, status = 200, contentType = 'application/json') =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': contentType },
      });

    if (url.endsWith('/api/health')) {
      return makeJson({ status: 'ok', runtime: 'node-v22' });
    }
    if (url.endsWith('/api/tests/vitest/files')) {
      return makeJson({ files: new Array(7).fill({ path: 'src/utils/a.test.ts' }) });
    }
    if (url.endsWith('/api/tests/vitest/run-stream')) {
      const ndjson = [
        JSON.stringify({ type: 'start' }),
        JSON.stringify({
          type: 'result',
          summary: { passedTests: 4, failedTests: 0 },
          coverage: {
            files: [
              {
                file: 'src/utils/testMetricsStore.ts',
                lines: { pct: 95 },
                statements: { pct: 95 },
                functions: { pct: 100 },
                branches: { pct: 88 },
              },
            ],
          },
        }),
      ].join('\n');
      return new Response(ndjson, { status: 200 });
    }
    if (url.endsWith('/api/audit/playstore')) {
      return makeJson({
        report: {
          checks: new Array(18).fill({ id: 'c', passed: true }),
          summary: { passedCount: 18, totalChecks: 18, releaseReady: true },
        },
      });
    }
    if (url.endsWith('/api/substrate/sql-guard')) {
      const headers = (init?.headers as Record<string, string>) || {};
      if (headers.Authorization === 'Bearer invalid-probe-token') {
        return makeJson({ error: 'Unauthorized', tokenVerified: false }, 401);
      }
      return makeJson({ allowed: true, tokenVerified: true });
    }
    if (url.endsWith('/.well-known/assetlinks.json')) {
      return makeJson([
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: {
            namespace: 'android_app',
            package_name: 'dev.liquidos.one.twa',
            sha256_cert_fingerprints: ['00:11:22'],
          },
        },
      ]);
    }
    if (url.endsWith('/manifest.webmanifest')) {
      return makeJson({
        name: 'LiquidOS ONE',
        short_name: 'LiquidOS',
        icons: [
          { sizes: '192x192' },
          { sizes: '512x512' },
          { sizes: '512x512', purpose: 'maskable' },
        ],
      });
    }
    return new Response('Not found', { status: 404 });
  };

  const report = await runLiveEnvironmentVerification('http://127.0.0.1:3000', mockFetch);
  assert.equal(report.totalCount, 7);
  assert.equal(report.passedCount, 7);
  assert.equal(report.allPassed, true);
});
