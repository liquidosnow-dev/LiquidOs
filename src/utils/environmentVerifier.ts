import { buildModuleBreakdownFromCoverage, RawCoverageFileInput } from './testMetricsStore';

export interface EnvironmentProbeCheck {
  id: string;
  label: string;
  passed: boolean;
  statusCode?: number;
  durationMs: number;
  detail: string;
}

export interface EnvironmentVerificationReport {
  baseUrl: string;
  timestamp: number;
  passedCount: number;
  totalCount: number;
  allPassed: boolean;
  checks: EnvironmentProbeCheck[];
}

export function evaluateVitestNdjsonStream(ndjsonText: string): {
  hasStartEvent: boolean;
  hasResultEvent: boolean;
  passedTests: number;
  failedTests: number;
  coverageFileCount: number;
  hotspotCount: number;
} {
  const lines = ndjsonText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let hasStartEvent = false;
  let hasResultEvent = false;
  let passedTests = 0;
  let failedTests = 0;
  let coverageFiles: RawCoverageFileInput[] = [];

  for (const line of lines) {
    try {
      const evt = JSON.parse(line);
      if (evt.type === 'start') hasStartEvent = true;
      if (evt.type === 'result') {
        hasResultEvent = true;
        passedTests = Number(evt.summary?.passedTests ?? 0);
        failedTests = Number(evt.summary?.failedTests ?? 0);
        if (Array.isArray(evt.coverage?.files)) {
          coverageFiles = evt.coverage.files;
        }
      }
    } catch {
      // Ignore non-JSON trailing diagnostic lines
    }
  }

  const breakdown = buildModuleBreakdownFromCoverage(coverageFiles);
  const hotspotCount = breakdown.filter((m) => m.hotspotSeverity !== 'HEALTHY').length;

  return {
    hasStartEvent,
    hasResultEvent,
    passedTests,
    failedTests,
    coverageFileCount: breakdown.length,
    hotspotCount,
  };
}

export function validateManifestPayload(manifest: unknown): { valid: boolean; reason: string } {
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, reason: 'Manifest is not a JSON object' };
  }
  const m = manifest as Record<string, unknown>;
  const icons = Array.isArray(m.icons) ? m.icons : [];
  const has192 = icons.some((ic: any) => String(ic?.sizes || '').includes('192x192'));
  const has512 = icons.some((ic: any) => String(ic?.sizes || '').includes('512x512'));
  const hasMaskable = icons.some((ic: any) => String(ic?.purpose || '').includes('maskable'));

  if (!m.name || !m.short_name) {
    return { valid: false, reason: 'Manifest missing name or short_name' };
  }
  if (!has192 || !has512 || !hasMaskable) {
    return {
      valid: false,
      reason: `Missing required icons (192:${has192}, 512:${has512}, maskable:${hasMaskable})`,
    };
  }
  return {
    valid: true,
    reason: `Manifest '${String(m.short_name)}' valid with ${icons.length} icons`,
  };
}

export function validateAssetLinksPayload(payload: unknown): { valid: boolean; reason: string } {
  if (!Array.isArray(payload) || payload.length === 0) {
    return { valid: false, reason: 'assetlinks.json must be a non-empty array' };
  }
  const first = payload[0] as Record<string, any>;
  const relations = Array.isArray(first?.relation) ? first.relation : [];
  const hasHandleAllUrls = relations.includes('delegate_permission/common.handle_all_urls');
  const target = first?.target;
  const hasPackage = typeof target?.package_name === 'string' && target.package_name.length > 0;
  const hasFingerprints =
    Array.isArray(target?.sha256_cert_fingerprints) && target.sha256_cert_fingerprints.length > 0;

  if (!hasHandleAllUrls || !hasPackage || !hasFingerprints) {
    return {
      valid: false,
      reason: 'assetlinks.json missing handle_all_urls relation or android_app fingerprint target',
    };
  }
  return {
    valid: true,
    reason: `Digital Asset Links verified for package ${target.package_name}`,
  };
}

export async function runLiveEnvironmentVerification(
  baseUrl = 'http://127.0.0.1:3000',
  fetchImpl: typeof fetch = fetch
): Promise<EnvironmentVerificationReport> {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const checks: EnvironmentProbeCheck[] = [];

  async function runProbe(
    id: string,
    label: string,
    fn: () => Promise<{ passed: boolean; statusCode?: number; detail: string }>
  ) {
    const start = Date.now();
    try {
      const outcome = await fn();
      checks.push({
        id,
        label,
        passed: outcome.passed,
        statusCode: outcome.statusCode,
        durationMs: Date.now() - start,
        detail: outcome.detail,
      });
    } catch (err: any) {
      checks.push({
        id,
        label,
        passed: false,
        durationMs: Date.now() - start,
        detail: err?.message || 'Unexpected probe failure',
      });
    }
  }

  await runProbe('health', 'Server Health & Runtime Ready', async () => {
    const res = await fetchImpl(`${normalizedBase}/api/health`);
    const json = await res.json();
    const ok = res.ok && json?.status === 'ok';
    return {
      passed: ok,
      statusCode: res.status,
      detail: `status=${json?.status}, timestamp=${json?.timestamp || 'ok'}`,
    };
  });

  await runProbe('vitest-files', 'Vitest Suite Discovery (/api/tests/vitest/files)', async () => {
    const res = await fetchImpl(`${normalizedBase}/api/tests/vitest/files`);
    const json = await res.json();
    const files = Array.isArray(json?.files) ? json.files : [];
    const ok = res.ok && files.length >= 6;
    return {
      passed: ok,
      statusCode: res.status,
      detail: `${files.length} Vitest suites discovered`,
    };
  });

  await runProbe(
    'vitest-stream-coverage',
    'Live Vitest Stream + V8 Per-Module Coverage Breakdown',
    async () => {
      const res = await fetchImpl(`${normalizedBase}/api/tests/vitest/run-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testFile: 'src/utils/testMetricsStore.test.ts',
          withCoverage: true,
        }),
      });
      const text = await res.text();
      const evaluated = evaluateVitestNdjsonStream(text);
      const ok =
        res.ok &&
        evaluated.hasStartEvent &&
        evaluated.hasResultEvent &&
        evaluated.failedTests === 0 &&
        evaluated.passedTests >= 3 &&
        evaluated.coverageFileCount >= 1;
      return {
        passed: ok,
        statusCode: res.status,
        detail: `passed=${evaluated.passedTests}, failed=${evaluated.failedTests}, coverageFiles=${evaluated.coverageFileCount}`,
      };
    }
  );

  await runProbe('playstore-audit', 'Play Store Readiness Audit Engine (/api/audit/playstore)', async () => {
    const res = await fetchImpl(`${normalizedBase}/api/audit/playstore`);
    const json = await res.json();
    const checksArr = Array.isArray(json?.report?.checks) ? json.report.checks : [];
    const passed = Number(json?.report?.summary?.passedCount ?? 0);
    const total = Number(
      json?.report?.summary?.totalChecks ?? json?.report?.summary?.totalCount ?? checksArr.length
    );
    const ok = res.ok && checksArr.length >= 10 && total > 0 && passed === total;
    return {
      passed: ok,
      statusCode: res.status,
      detail: `${passed}/${total} audit checks passed, releaseReady=${Boolean(json?.report?.summary?.releaseReady)}`,
    };
  });

  await runProbe('sql-guard', 'Sovereign Substrate Constant-Time Auth + SQL Guard', async () => {
    const unauth = await fetchImpl(`${normalizedBase}/api/substrate/sql-guard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid-probe-token',
      },
      body: JSON.stringify({ sql: 'SELECT 1' }),
    });
    const authRes = await fetchImpl(`${normalizedBase}/api/substrate/sql-guard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sovereign-token-verifier',
      },
      body: JSON.stringify({
        sql: 'SELECT id, name FROM contracts LIMIT 10',
        expectedToken: 'sovereign-token-verifier',
      }),
    });
    const authJson = await authRes.json();
    const ok = unauth.status === 401 && authRes.ok && authJson?.allowed === true && authJson?.tokenVerified === true;
    return {
      passed: ok,
      statusCode: authRes.status,
      detail: `unauth=${unauth.status}, auth=${authRes.status}, allowed=${authJson?.allowed}, tokenVerified=${authJson?.tokenVerified}`,
    };
  });

  await runProbe('assetlinks', 'Android TWA Digital Asset Links (/.well-known/assetlinks.json)', async () => {
    const res = await fetchImpl(`${normalizedBase}/.well-known/assetlinks.json`);
    const json = await res.json();
    const verdict = validateAssetLinksPayload(json);
    return {
      passed: res.ok && verdict.valid,
      statusCode: res.status,
      detail: verdict.reason,
    };
  });

  await runProbe('manifest', 'PWA Web App Manifest & Shell Check', async () => {
    const res = await fetchImpl(`${normalizedBase}/manifest.webmanifest`);
    if (res.ok && res.headers.get('content-type')?.includes('json')) {
      const json = await res.json();
      const verdict = validateManifestPayload(json);
      return {
        passed: verdict.valid,
        statusCode: res.status,
        detail: verdict.reason,
      };
    }
    const htmlRes = await fetchImpl(`${normalizedBase}/`);
    const html = await htmlRes.text();
    const hasTitleAndMeta = html.includes('<title>') && html.includes('apple-touch-icon');
    return {
      passed: htmlRes.ok && hasTitleAndMeta,
      statusCode: htmlRes.status,
      detail: hasTitleAndMeta
        ? 'Dev HTML shell + apple-touch-icon served (manifest emitted in dist/ by VitePWA)'
        : 'HTML shell missing PWA head links',
    };
  });

  const passedCount = checks.filter((c) => c.passed).length;
  return {
    baseUrl: normalizedBase,
    timestamp: Date.now(),
    passedCount,
    totalCount: checks.length,
    allPassed: passedCount === checks.length,
    checks,
  };
}
