export type HotspotSeverity = 'CRITICAL' | 'WATCH' | 'HEALTHY';

export interface RawCoverageMetricInput {
  total?: number;
  covered?: number;
  skipped?: number;
  pct: number;
}

export interface RawCoverageFileInput {
  file: string;
  lines: RawCoverageMetricInput;
  statements: RawCoverageMetricInput;
  functions: RawCoverageMetricInput;
  branches: RawCoverageMetricInput;
  uncoveredLines?: number[];
  uncoveredBranches?: { line: number; type: string; pathsMissed: number }[];
}

export interface ModuleCoverageBreakdown {
  file: string;
  moduleLabel: string;
  linesPct: number;
  statementsPct: number;
  functionsPct: number;
  branchesPct: number;
  uncoveredLines: number[];
  uncoveredBranchesCount: number;
  hotspotSeverity: HotspotSeverity;
}

export interface CoverageRadarPoint {
  module: string;
  file: string;
  Lines: number;
  Branches: number;
  Functions: number;
  Statements: number;
  fullMark: number;
  severity: HotspotSeverity;
}

export interface TestRunSnapshot {
  runId: string;
  timestamp: number;
  passed: number;
  failed: number;
  total: number;
  durationMs: number;
  coverageLines: number;
  trigger?: 'manual' | 'watch' | 'initial';
  suiteFilter?: string;
  moduleBreakdown?: ModuleCoverageBreakdown[];
}

const STORAGE_KEY = 'liquidos_vitest_execution_history_v1';
const MAX_HISTORY_RUNS = 10;

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(Math.max(0, Math.min(100, value)).toFixed(1));
}

export function classifyHotspot(branchesPct: number, linesPct: number): HotspotSeverity {
  const lowest = Math.min(clampPct(branchesPct), clampPct(linesPct));
  if (lowest < 55) return 'CRITICAL';
  if (lowest < 82) return 'WATCH';
  return 'HEALTHY';
}

export function formatModuleLabel(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').trim();
  const base = normalized.split('/').pop() || normalized;
  return base.replace(/\.(test\.)?(ts|tsx|js|jsx)$/, '');
}

export function buildModuleBreakdownFromCoverage(
  files: RawCoverageFileInput[]
): ModuleCoverageBreakdown[] {
  if (!Array.isArray(files) || files.length === 0) return [];
  return files
    .filter((entry) => Boolean(entry && typeof entry.file === 'string'))
    .map((entry) => {
      const linesPct = clampPct(entry.lines?.pct ?? 0);
      const statementsPct = clampPct(entry.statements?.pct ?? 0);
      const functionsPct = clampPct(entry.functions?.pct ?? 0);
      const branchesPct = clampPct(entry.branches?.pct ?? 0);
      const uncoveredLines = Array.isArray(entry.uncoveredLines)
        ? entry.uncoveredLines.filter((n) => Number.isFinite(n)).slice(0, 24)
        : [];
      const uncoveredBranchesCount = Array.isArray(entry.uncoveredBranches)
        ? entry.uncoveredBranches.length
        : 0;

      return {
        file: entry.file,
        moduleLabel: formatModuleLabel(entry.file),
        linesPct,
        statementsPct,
        functionsPct,
        branchesPct,
        uncoveredLines,
        uncoveredBranchesCount,
        hotspotSeverity: classifyHotspot(branchesPct, linesPct),
      };
    });
}

export function getSortedHotspotModules(
  modules: ModuleCoverageBreakdown[]
): ModuleCoverageBreakdown[] {
  if (!Array.isArray(modules) || modules.length === 0) return [];
  return [...modules].sort((a, b) => {
    const minA = Math.min(a.branchesPct, a.linesPct);
    const minB = Math.min(b.branchesPct, b.linesPct);
    if (minA !== minB) return minA - minB;
    if (a.branchesPct !== b.branchesPct) return a.branchesPct - b.branchesPct;
    if (a.linesPct !== b.linesPct) return a.linesPct - b.linesPct;
    return a.file.localeCompare(b.file);
  });
}

export function buildCoverageRadarData(
  modules: ModuleCoverageBreakdown[],
  maxModules = 8
): CoverageRadarPoint[] {
  const sorted = getSortedHotspotModules(modules).slice(0, Math.max(3, maxModules));
  return sorted.map((mod) => ({
    module: mod.moduleLabel,
    file: mod.file,
    Lines: mod.linesPct,
    Branches: mod.branchesPct,
    Functions: mod.functionsPct,
    Statements: mod.statementsPct,
    fullMark: 100,
    severity: mod.hotspotSeverity,
  }));
}

function makeSeedModule(
  file: string,
  linesPct: number,
  branchesPct: number,
  functionsPct: number,
  statementsPct: number,
  uncoveredLines: number[],
  uncoveredBranchesCount: number
): ModuleCoverageBreakdown {
  return {
    file,
    moduleLabel: formatModuleLabel(file),
    linesPct: clampPct(linesPct),
    statementsPct: clampPct(statementsPct),
    functionsPct: clampPct(functionsPct),
    branchesPct: clampPct(branchesPct),
    uncoveredLines,
    uncoveredBranchesCount,
    hotspotSeverity: classifyHotspot(branchesPct, linesPct),
  };
}

function createSeedHistory(): TestRunSnapshot[] {
  const now = Date.now();
  return [
    {
      runId: 'run-seed-01',
      timestamp: now - 3600000 * 5,
      passed: 32,
      failed: 2,
      total: 34,
      durationMs: 420,
      coverageLines: 76.2,
      trigger: 'manual',
      suiteFilter: 'all',
      moduleBreakdown: [
        makeSeedModule('src/utils/contractRegistry.ts', 88.4, 81.2, 90.0, 87.9, [142, 168], 2),
        makeSeedModule('src/utils/piPipeline.ts', 64.5, 48.0, 70.0, 63.2, [84, 92, 117, 134], 5),
        makeSeedModule('src/utils/sovereignSubstrate.ts', 71.2, 52.5, 76.0, 70.4, [55, 61, 108], 4),
        makeSeedModule('src/utils/playStoreAudit.ts', 79.0, 68.4, 83.3, 78.2, [71, 89], 3),
        makeSeedModule('src/utils/storage.ts', 58.3, 44.0, 62.5, 57.1, [29, 34, 48, 59], 6),
        makeSeedModule('src/utils/testMetricsStore.ts', 94.0, 87.5, 100.0, 93.4, [76], 1),
      ],
    },
    {
      runId: 'run-seed-02',
      timestamp: now - 3600000 * 4,
      passed: 33,
      failed: 1,
      total: 34,
      durationMs: 395,
      coverageLines: 77.0,
      trigger: 'watch',
      suiteFilter: 'all',
      moduleBreakdown: [
        makeSeedModule('src/utils/contractRegistry.ts', 89.2, 82.0, 90.0, 88.6, [168], 2),
        makeSeedModule('src/utils/piPipeline.ts', 69.0, 53.5, 74.0, 68.1, [92, 117, 134], 4),
        makeSeedModule('src/utils/sovereignSubstrate.ts', 76.8, 61.0, 82.0, 75.9, [61, 108], 3),
        makeSeedModule('src/utils/playStoreAudit.ts', 82.5, 74.0, 86.0, 81.8, [89], 2),
        makeSeedModule('src/utils/storage.ts', 61.0, 49.5, 65.0, 60.2, [34, 48, 59], 5),
        makeSeedModule('src/utils/testMetricsStore.ts', 95.1, 89.0, 100.0, 94.5, [76], 1),
      ],
    },
    {
      runId: 'run-seed-03',
      timestamp: now - 3600000 * 3,
      passed: 34,
      failed: 0,
      total: 34,
      durationMs: 380,
      coverageLines: 78.6,
      trigger: 'watch',
      suiteFilter: 'all',
      moduleBreakdown: [
        makeSeedModule('src/utils/contractRegistry.ts', 91.5, 85.4, 92.5, 90.8, [168], 1),
        makeSeedModule('src/utils/piPipeline.ts', 74.2, 60.8, 80.0, 73.5, [117, 134], 3),
        makeSeedModule('src/utils/sovereignSubstrate.ts', 84.0, 74.2, 88.0, 83.4, [108], 2),
        makeSeedModule('src/utils/playStoreAudit.ts', 88.2, 82.1, 90.0, 87.6, [89], 1),
        makeSeedModule('src/utils/storage.ts', 63.4, 51.0, 68.0, 62.5, [48, 59], 4),
        makeSeedModule('src/utils/testMetricsStore.ts', 96.2, 91.5, 100.0, 95.8, [76], 0),
      ],
    },
  ];
}

function hydrateLegacySeeds(history: TestRunSnapshot[]): TestRunSnapshot[] {
  const seedsById = new Map(createSeedHistory().map((s) => [s.runId, s]));
  return history.map((run) => {
    if ((!run.moduleBreakdown || run.moduleBreakdown.length === 0) && seedsById.has(run.runId)) {
      return {
        ...run,
        moduleBreakdown: seedsById.get(run.runId)!.moduleBreakdown,
      };
    }
    return run;
  });
}

function loadInitialHistory(): TestRunSnapshot[] {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return hydrateLegacySeeds(parsed.slice(-MAX_HISTORY_RUNS));
        }
      }
    } catch {
      // Ignore storage corruption and re-seed
    }
  }
  return createSeedHistory();
}

function persistHistory(history: TestRunSnapshot[]): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Ignore quota errors
    }
  }
}

let executionHistory: TestRunSnapshot[] = loadInitialHistory();

export function recordTestRun(
  snapshot: Omit<TestRunSnapshot, 'runId' | 'timestamp'> & { timestamp?: number }
): TestRunSnapshot[] {
  const timestamp = typeof snapshot.timestamp === 'number' ? snapshot.timestamp : Date.now();
  const newRun: TestRunSnapshot = {
    passed: snapshot.passed,
    failed: snapshot.failed,
    total: snapshot.total,
    durationMs: snapshot.durationMs,
    coverageLines: Number(snapshot.coverageLines.toFixed(1)),
    trigger: snapshot.trigger ?? 'manual',
    suiteFilter: snapshot.suiteFilter ?? 'all',
    moduleBreakdown: snapshot.moduleBreakdown ? [...snapshot.moduleBreakdown] : undefined,
    runId: `run-${timestamp.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp,
  };

  executionHistory = [...executionHistory, newRun].slice(-MAX_HISTORY_RUNS);
  persistHistory(executionHistory);
  return [...executionHistory];
}

export function getTestHistory(): TestRunSnapshot[] {
  return [...executionHistory];
}

export function resetTestHistory(seed = false): TestRunSnapshot[] {
  executionHistory = seed ? createSeedHistory() : [];
  persistHistory(executionHistory);
  return [...executionHistory];
}
