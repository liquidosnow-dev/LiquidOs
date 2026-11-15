import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  recordTestRun,
  getTestHistory,
  resetTestHistory,
  classifyHotspot,
  formatModuleLabel,
  buildModuleBreakdownFromCoverage,
  getSortedHotspotModules,
  buildCoverageRadarData,
  analyzeModuleProgression,
} from './testMetricsStore';

test('testMetricsStore records runs with moduleBreakdown and caps ring buffer at 10 snapshots', () => {
  resetTestHistory(false);
  assert.equal(getTestHistory().length, 0);

  const sampleBreakdown = buildModuleBreakdownFromCoverage([
    {
      file: 'src/utils/contractRegistry.ts',
      lines: { pct: 92.4 },
      statements: { pct: 91.0 },
      functions: { pct: 100.0 },
      branches: { pct: 86.2 },
      uncoveredLines: [120],
      uncoveredBranches: [],
    },
    {
      file: 'src/utils/storage.ts',
      lines: { pct: 48.0 },
      statements: { pct: 47.2 },
      functions: { pct: 50.0 },
      branches: { pct: 38.5 },
      uncoveredLines: [12, 19, 25],
      uncoveredBranches: [{ line: 19, type: 'if', pathsMissed: 1 }],
    },
  ]);

  for (let i = 1; i <= 13; i++) {
    recordTestRun({
      passed: 30 + (i % 5),
      failed: 4 - (i % 5),
      total: 34,
      durationMs: 300 + i * 10,
      coverageLines: 75 + i * 0.25,
      trigger: i % 2 === 0 ? 'watch' : 'manual',
      suiteFilter: 'all',
      moduleBreakdown: sampleBreakdown,
    });
  }

  const history = getTestHistory();
  assert.equal(history.length, 10);
  assert.equal(history[history.length - 1].durationMs, 430);
  assert.ok(history[history.length - 1].runId.startsWith('run-'));
  assert.equal(history[history.length - 1].moduleBreakdown?.length, 2);

  const seeded = resetTestHistory(true);
  assert.equal(seeded.length, 3);
  assert.ok((seeded[0].moduleBreakdown?.length ?? 0) >= 4);
});

test('classifyHotspot accurately categorizes CRITICAL, WATCH, and HEALTHY thresholds', () => {
  assert.equal(classifyHotspot(42.0, 78.0), 'CRITICAL');
  assert.equal(classifyHotspot(88.0, 54.9), 'CRITICAL');
  assert.equal(classifyHotspot(55.0, 81.9), 'WATCH');
  assert.equal(classifyHotspot(81.9, 95.0), 'WATCH');
  assert.equal(classifyHotspot(82.0, 82.0), 'HEALTHY');
  assert.equal(classifyHotspot(100, 99.2), 'HEALTHY');
  assert.equal(classifyHotspot(150, -10), 'CRITICAL');
});

test('formatModuleLabel strips directory prefixes and TypeScript suffixes cleanly', () => {
  assert.equal(formatModuleLabel('src/utils/playStoreAudit.ts'), 'playStoreAudit');
  assert.equal(formatModuleLabel('src\\utils\\testMetricsStore.test.ts'), 'testMetricsStore');
  assert.equal(formatModuleLabel('components/TestingTab.tsx'), 'TestingTab');
});

test('getSortedHotspotModules and buildCoverageRadarData prioritize lowest-coverage hotspots and map baseline', () => {
  const previous = buildModuleBreakdownFromCoverage([
    {
      file: 'src/utils/criticalMod.ts',
      lines: { pct: 55.0 },
      statements: { pct: 54.0 },
      functions: { pct: 60.0 },
      branches: { pct: 32.0 },
      uncoveredLines: [10, 14, 18],
      uncoveredBranches: [],
    },
  ]);

  const modules = buildModuleBreakdownFromCoverage([
    {
      file: 'src/utils/healthyMod.ts',
      lines: { pct: 95.0 },
      statements: { pct: 94.0 },
      functions: { pct: 100 },
      branches: { pct: 91.5 },
      uncoveredLines: [],
      uncoveredBranches: [],
    },
    {
      file: 'src/utils/criticalMod.ts',
      lines: { pct: 62.0 },
      statements: { pct: 60.0 },
      functions: { pct: 70.0 },
      branches: { pct: 40.0 },
      uncoveredLines: [10, 14, 18],
      uncoveredBranches: [{ line: 14, type: 'if', pathsMissed: 2 }],
    },
    {
      file: 'src/utils/watchMod.ts',
      lines: { pct: 78.5 },
      statements: { pct: 77.0 },
      functions: { pct: 80.0 },
      branches: { pct: 66.2 },
      uncoveredLines: [42],
      uncoveredBranches: [{ line: 42, type: 'cond', pathsMissed: 1 }],
    },
  ]);

  const sorted = getSortedHotspotModules(modules);
  assert.deepEqual(
    sorted.map((m) => m.moduleLabel),
    ['criticalMod', 'watchMod', 'healthyMod']
  );
  assert.equal(sorted[0].hotspotSeverity, 'CRITICAL');
  assert.equal(sorted[0].uncoveredBranchesCount, 1);
  assert.equal(sorted[1].hotspotSeverity, 'WATCH');
  assert.equal(sorted[2].hotspotSeverity, 'HEALTHY');

  const radar = buildCoverageRadarData(modules, 8, previous);
  assert.equal(radar.length, 3);
  assert.equal(radar[0].module, 'criticalMod');
  assert.equal(radar[0].Branches, 40.0);
  assert.equal(radar[0].PrevBranches, 32.0);
  assert.equal(radar[0].Lines, 62.0);
  assert.equal(radar[0].fullMark, 100);
});

test('analyzeModuleProgression computes coverage deltas, healthy threshold gaps, and progressive recommendations', () => {
  const [prevMod] = buildModuleBreakdownFromCoverage([
    {
      file: 'src/utils/piPipeline.ts',
      lines: { pct: 60.0 },
      statements: { pct: 59.0 },
      functions: { pct: 70.0 },
      branches: { pct: 45.0 },
      uncoveredLines: [40, 52],
      uncoveredBranches: [],
    },
  ]);
  const [improvedMod, regressedMod, healthyMod] = buildModuleBreakdownFromCoverage([
    {
      file: 'src/utils/piPipeline.ts',
      lines: { pct: 68.5 },
      statements: { pct: 67.0 },
      functions: { pct: 75.0 },
      branches: { pct: 53.0 },
      uncoveredLines: [52],
      uncoveredBranches: [{ line: 52, type: 'if', pathsMissed: 1 }],
    },
    {
      file: 'src/utils/piPipeline.ts',
      lines: { pct: 56.0 },
      statements: { pct: 55.0 },
      functions: { pct: 65.0 },
      branches: { pct: 40.0 },
      uncoveredLines: [40, 52],
      uncoveredBranches: [],
    },
    {
      file: 'src/utils/contractRegistry.ts',
      lines: { pct: 90.0 },
      statements: { pct: 89.0 },
      functions: { pct: 95.0 },
      branches: { pct: 86.0 },
      uncoveredLines: [],
      uncoveredBranches: [],
    },
  ]);

  const imp = analyzeModuleProgression(improvedMod, prevMod);
  assert.equal(imp.deltaStatus, 'improved');
  assert.equal(imp.deltaLinesPct, 8.5);
  assert.equal(imp.deltaBranchesPct, 8.0);
  assert.equal(imp.branchGapToHealthy, 29.0);
  assert.ok(imp.recommendation.includes('Branch hotspot'));

  const reg = analyzeModuleProgression(regressedMod, prevMod);
  assert.equal(reg.deltaStatus, 'regressed');
  assert.equal(reg.deltaLinesPct, -4.0);

  const base = analyzeModuleProgression(healthyMod);
  assert.equal(base.deltaStatus, 'baseline');
  assert.equal(base.branchGapToHealthy, 0);
  assert.ok(base.recommendation.includes('Target satisfied'));
});
