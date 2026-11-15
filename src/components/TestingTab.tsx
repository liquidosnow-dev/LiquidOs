import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Square,
  CheckCircle2,
  XCircle,
  Clock,
  FileCode2,
  Search,
  Save,
  RotateCcw,
  Terminal,
  BarChart3,
  ListChecks,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Radio,
} from 'lucide-react';
import {
  recordTestRun,
  getTestHistory,
  TestRunSnapshot,
  buildModuleBreakdownFromCoverage,
  ModuleCoverageBreakdown,
} from '../utils/testMetricsStore';
import { TestTrendAnalytics } from './TestTrendAnalytics';

interface VitestAssertion {
  id: string;
  suiteFile: string;
  targetModule: string;
  title: string;
  fullName: string;
  ancestorTitles: string[];
  status: 'passed' | 'failed' | 'skipped' | 'pending' | string;
  durationMs: number;
  failureMessages: string[];
}

interface VitestSuiteResult {
  file: string;
  targetModule: string;
  status: string;
  durationMs: number;
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  message: string;
}

interface CoverageMetric {
  total: number;
  covered: number;
  skipped?: number;
  pct: number;
}

interface CoverageFileEntry {
  file: string;
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
  uncoveredLines: number[];
  uncoveredBranches: { line: number; type: string; pathsMissed: number }[];
}

interface VitestRunSummary {
  totalSuites: number;
  passedSuites: number;
  failedSuites: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  success: boolean;
}

interface TestingTabProps {
  projectName: string;
  onAskAiForTest?: (prompt: string) => void;
  watchMode: boolean;
  onToggleWatchMode: () => void;
  lastModifiedFile?: { path: string; action: string; timestamp: number } | null;
  onStatusChange?: (status: {
    isRunning: boolean;
    passed: number;
    failed: number;
    total: number;
  }) => void;
}

export const TestingTab: React.FC<TestingTabProps> = ({
  projectName,
  onAskAiForTest,
  watchMode,
  onToggleWatchMode,
  lastModifiedFile,
  onStatusChange,
}) => {
  const [availableFiles, setAvailableFiles] = useState<
    { path: string; targetModule: string | null; testCount: number; testTitles: string[] }[]
  >([]);
  const [selectedSuiteFilter, setSelectedSuiteFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [withCoverage, setWithCoverage] = useState(true);

  const [isRunning, setIsRunning] = useState(false);
  const [lastCommand, setLastCommand] = useState<string>('');
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);
  const [summary, setSummary] = useState<VitestRunSummary | null>(null);
  const [suites, setSuites] = useState<VitestSuiteResult[]>([]);
  const [tests, setTests] = useState<VitestAssertion[]>([]);
  const [coverageTotal, setCoverageTotal] = useState<{
    lines: CoverageMetric;
    statements: CoverageMetric;
    functions: CoverageMetric;
    branches: CoverageMetric;
  } | null>(null);
  const [coverageFiles, setCoverageFiles] = useState<CoverageFileEntry[]>([]);
  const [streamLogs, setStreamLogs] = useState<string[]>([]);
  const [executionHistory, setExecutionHistory] = useState<TestRunSnapshot[]>(() =>
    getTestHistory()
  );
  const [lastWatchTrigger, setLastWatchTrigger] = useState<{
    source: 'workspace' | 'filesystem';
    file: string;
    timestamp: number;
  } | null>(null);

  const [expandedSuites, setExpandedSuites] = useState<Record<string, boolean>>({});
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [inspectorView, setInspectorView] = useState<'inspector' | 'coverage' | 'console'>('inspector');

  // Test source inspection & adjustment state
  const [loadedTestFile, setLoadedTestFile] = useState<string>('');
  const [testSourceCode, setTestSourceCode] = useState<string>('');
  const [savedOriginalSource, setSavedOriginalSource] = useState<string>('');
  const [isSavingTest, setIsSavingTest] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const lastInlineSaveRef = useRef<number>(0);
  const watchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProcessedModTimestampRef = useRef<number>(lastModifiedFile?.timestamp || 0);
  const runVitestLatestRef = useRef<() => void>(() => {});
  const lastCoverageLinesRef = useRef<number>(
    getTestHistory()[getTestHistory().length - 1]?.coverageLines ?? 78.6
  );

  useEffect(() => {
    fetch('/api/tests/vitest/files')
      .then((r) => r.json())
      .then((data) => {
        if (data?.files) {
          setAvailableFiles(data.files);
          const initialExpanded: Record<string, boolean> = {};
          for (const f of data.files) initialExpanded[f.path] = true;
          setExpandedSuites(initialExpanded);
        }
      })
      .catch(() => {});

    // Run full Vitest suite + V8 coverage automatically on mount for immediate live results
    runVitestStream('all', undefined, true, 'initial');

    return () => {
      abortControllerRef.current?.abort();
      if (watchDebounceRef.current) clearTimeout(watchDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamLogs]);

  const loadTestSourceFile = async (filePath: string) => {
    try {
      const res = await fetch(`/api/tests/vitest/file?path=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const data = await res.json();
        setLoadedTestFile(data.path);
        setTestSourceCode(data.content);
        setSavedOriginalSource(data.content);
      }
    } catch {
      // Ignore transient errors
    }
  };

  const selectedTest = useMemo(
    () => tests.find((t) => t.id === selectedTestId) || tests[0] || null,
    [tests, selectedTestId]
  );

  useEffect(() => {
    if (selectedTest?.suiteFile && selectedTest.suiteFile !== loadedTestFile) {
      loadTestSourceFile(selectedTest.suiteFile);
    }
  }, [selectedTest?.suiteFile]);

  const runVitestStream = async (
    testFile = selectedSuiteFilter,
    testNamePattern?: string,
    includeCov = withCoverage,
    trigger: 'manual' | 'watch' | 'initial' = 'manual'
  ) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsRunning(true);
    setStreamLogs([]);
    setSaveNotice(null);

    try {
      const res = await fetch('/api/tests/vitest/run-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testFile,
          testNamePattern,
          withCoverage: includeCov,
        }),
        signal: controller.signal,
      });

      if (!res.body) {
        throw new Error('ReadableStream not supported by response');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === 'start') {
              setLastCommand(evt.command || 'vitest run');
              setStreamLogs((prev) => [...prev, `$ ${evt.command}`]);
            } else if (evt.type === 'log') {
              setStreamLogs((prev) => [...prev.slice(-300), evt.line]);
            } else if (evt.type === 'result') {
              setLastDurationMs(evt.durationMs ?? null);
              setSummary(evt.summary ?? null);

              if (Array.isArray(evt.suites)) {
                if (testFile === 'all' && !testNamePattern) {
                  setSuites(evt.suites);
                } else if (evt.suites.length > 0) {
                  // Merge scoped run into existing suites cleanly
                  setSuites((prev) => {
                    if (prev.length === 0) return evt.suites;
                    const map = new Map<string, VitestSuiteResult>();
                    for (const s of prev) map.set(s.file, s);
                    for (const s of evt.suites) map.set(s.file, s);
                    return Array.from(map.values()).sort((a, b) => a.file.localeCompare(b.file));
                  });
                }
              }

              if (Array.isArray(evt.tests)) {
                if (testFile === 'all' && !testNamePattern) {
                  setTests(evt.tests);
                  if (evt.tests.length > 0) {
                    setSelectedTestId((prev) =>
                      prev && evt.tests.some((t: VitestAssertion) => t.id === prev)
                        ? prev
                        : evt.tests[0].id
                    );
                  }
                } else if (evt.tests.length > 0) {
                  // Merge scoped/single-test run results into live test list
                  setTests((prev) => {
                    if (prev.length === 0) return evt.tests;
                    const byKey = new Map<string, VitestAssertion>();
                    for (const t of prev) byKey.set(`${t.suiteFile}::${t.fullName}`, t);
                    for (const t of evt.tests) byKey.set(`${t.suiteFile}::${t.fullName}`, t);
                    return Array.from(byKey.values());
                  });
                }
              }

              if (evt.coverage) {
                if (evt.coverage.total) {
                  setCoverageTotal(evt.coverage.total);
                  if (typeof evt.coverage.total.lines?.pct === 'number') {
                    lastCoverageLinesRef.current = evt.coverage.total.lines.pct;
                  }
                }
                if (Array.isArray(evt.coverage.files)) setCoverageFiles(evt.coverage.files);
              }

              if (evt.summary) {
                const covPct =
                  typeof evt.coverage?.total?.lines?.pct === 'number'
                    ? evt.coverage.total.lines.pct
                    : lastCoverageLinesRef.current;
                const totalCount =
                  evt.summary.passedTests + evt.summary.failedTests || evt.summary.totalTests || 0;
                const snapshotFiles: CoverageFileEntry[] = Array.isArray(evt.coverage?.files)
                  ? evt.coverage.files
                  : coverageFiles;
                const moduleBreakdown: ModuleCoverageBreakdown[] =
                  buildModuleBreakdownFromCoverage(snapshotFiles);
                const updated = recordTestRun({
                  passed: evt.summary.passedTests,
                  failed: evt.summary.failedTests,
                  total: totalCount,
                  durationMs: Math.round(evt.durationMs ?? 0),
                  coverageLines: covPct,
                  trigger,
                  suiteFilter: testFile,
                  moduleBreakdown,
                });
                setExecutionHistory(updated);
              }
            }
          } catch {
            // Skip malformed NDJSON chunk
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setStreamLogs((prev) => [...prev, `[ERROR] ${err?.message || 'Vitest run failed'}`]);
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveAndRerun = async (singleTestOnly: boolean) => {
    if (!loadedTestFile) return;
    setIsSavingTest(true);
    setSaveNotice(null);
    try {
      const saveRes = await fetch('/api/tests/vitest/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: loadedTestFile, content: testSourceCode }),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json();
        setSaveNotice(`Save error: ${err.error || 'Failed'}`);
        setIsSavingTest(false);
        return;
      }
      setSavedOriginalSource(testSourceCode);
      setSaveNotice(`Saved ${loadedTestFile} — streaming Vitest verification...`);
      setIsSavingTest(false);
      lastInlineSaveRef.current = Date.now();

      await runVitestStream(
        loadedTestFile,
        singleTestOnly && selectedTest ? selectedTest.title : undefined,
        true
      );
    } catch (err: any) {
      setSaveNotice(`Error: ${err?.message || 'Save failed'}`);
      setIsSavingTest(false);
    }
  };

  // Keep latest runner callback fresh for Watch Mode triggers
  useEffect(() => {
    runVitestLatestRef.current = () => {
      runVitestStream(selectedSuiteFilter, undefined, withCoverage, 'watch');
    };
  });

  // Notify parent Workspace tab badge when status updates
  useEffect(() => {
    if (!onStatusChange) return;
    onStatusChange({
      isRunning,
      passed: summary?.passedTests ?? 0,
      failed: summary?.failedTests ?? 0,
      total: summary ? Math.max(summary.passedTests + summary.failedTests, 1) : 0,
    });
  }, [isRunning, summary, onStatusChange]);

  // Watch Mode Part 1: Trigger re-run whenever a workspace project file is modified
  useEffect(() => {
    if (!watchMode || !lastModifiedFile) return;
    if (lastModifiedFile.timestamp <= lastProcessedModTimestampRef.current) return;
    lastProcessedModTimestampRef.current = lastModifiedFile.timestamp;

    setLastWatchTrigger({
      source: 'workspace',
      file: lastModifiedFile.path,
      timestamp: lastModifiedFile.timestamp,
    });

    if (watchDebounceRef.current) clearTimeout(watchDebounceRef.current);
    watchDebounceRef.current = setTimeout(() => {
      runVitestLatestRef.current();
    }, 550);
  }, [watchMode, lastModifiedFile]);

  const loadedTestFileRef = useRef<string>(loadedTestFile);
  useEffect(() => {
    loadedTestFileRef.current = loadedTestFile;
  }, [loadedTestFile]);

  // Watch Mode Part 2: Subscribe to server SSE watcher for real src/utils/*.ts changes
  useEffect(() => {
    if (!watchMode || typeof EventSource === 'undefined') return;
    const es = new EventSource('/api/tests/vitest/watch');
    es.addEventListener('change', (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        // Skip duplicate trigger immediately after inline Save & Re-Run
        if (Date.now() - lastInlineSaveRef.current < 1600) return;

        setLastWatchTrigger({
          source: 'filesystem',
          file: data.file || 'src/utils/',
          timestamp: data.timestamp || Date.now(),
        });
        if (data.file && data.file === loadedTestFileRef.current) {
          loadTestSourceFile(data.file);
        }
        if (watchDebounceRef.current) clearTimeout(watchDebounceRef.current);
        watchDebounceRef.current = setTimeout(() => {
          runVitestLatestRef.current();
        }, 350);
      } catch {
        // ignore malformed SSE payload
      }
    });
    return () => {
      es.close();
    };
  }, [watchMode]);

  const handleAppendProgressiveProbe = (targetModulePath: string, uncoveredLines: number[]) => {
    const lineRef = uncoveredLines.slice(0, 4).join(', ');
    const snippet = `\n\ntest('Progressive path guard for ${targetModulePath.split('/').pop()} (lines ${lineRef || 'edge'})', () => {\n  // Covers previously unexercised progressive edge path\n  assert.ok(true, 'Replace with assertion targeting lines ${lineRef || 'uncovered'}');\n});\n`;
    setTestSourceCode((prev) => prev.trimEnd() + snippet);
    setInspectorView('inspector');
    setSaveNotice(`Added progressive test scaffold targeting ${targetModulePath} (lines ${lineRef || 'edge'}). Review and click "Save & Re-Run Suite".`);
  };

  const filteredTests = useMemo(() => {
    return tests.filter((t) => {
      if (selectedSuiteFilter !== 'all' && t.suiteFile !== selectedSuiteFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (
        searchQuery.trim() &&
        !t.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) &&
        !t.suiteFile.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [tests, selectedSuiteFilter, statusFilter, searchQuery]);

  const testsGroupedBySuite = useMemo(() => {
    const map = new Map<string, VitestAssertion[]>();
    for (const t of filteredTests) {
      const arr = map.get(t.suiteFile) || [];
      arr.push(t);
      map.set(t.suiteFile, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredTests]);

  const activeTargetCoverage = useMemo(() => {
    if (!selectedTest?.targetModule) return null;
    return coverageFiles.find((c) => c.file === selectedTest.targetModule) || null;
  }, [coverageFiles, selectedTest]);

  const liveModuleBreakdown = useMemo(
    () => buildModuleBreakdownFromCoverage(coverageFiles),
    [coverageFiles]
  );

  const hasUnsavedChanges = testSourceCode !== savedOriginalSource;

  const getPctColor = (pct: number) => {
    if (pct >= 80) return 'text-emerald-400';
    if (pct >= 50) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getBarColor = (pct: number) => {
    if (pct >= 80) return 'bg-emerald-500';
    if (pct >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="flex flex-col h-full bg-transparent text-slate-100 overflow-hidden">
      {/* Top Runner Controls (Tier 1 Glass) */}
      <div className="px-4 py-3 glass-surface-1 border-x-0 border-t-0 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <div className="text-[11px] font-mono text-cyan-300/90 uppercase tracking-wide flex items-center gap-2 flex-wrap">
            <span>Vitest Unit Runner · @vitest/coverage-v8</span>
            {watchMode && lastWatchTrigger && (
              <>
                <span className="text-slate-500">·</span>
                <span className="text-violet-300 normal-case">
                  Watch triggered by {lastWatchTrigger.file} ({new Date(lastWatchTrigger.timestamp).toLocaleTimeString()})
                </span>
              </>
            )}
          </div>
          <div className="text-sm font-bold text-white truncate">
            {projectName} · Live Test &amp; Progressive Path Analysis
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Watch Mode Toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={watchMode}
            onClick={onToggleWatchMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              watchMode
                ? 'glass-surface-3 text-violet-200'
                : 'glass-surface-1 text-slate-400 hover:text-slate-200'
            }`}
            title="Automatically re-run unit tests whenever any project or utility file changes"
          >
            <Radio className={`w-3.5 h-3.5 ${watchMode ? 'text-violet-300' : 'text-slate-500'}`} />
            <span>Watch Mode: {watchMode ? 'ON' : 'OFF'}</span>
          </button>

          <select
            value={selectedSuiteFilter}
            onChange={(e) => setSelectedSuiteFilter(e.target.value)}
            className="glass-surface-1 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-400 cursor-pointer"
          >
            <option value="all" className="bg-slate-950">All Suites ({availableFiles.length || 6} files)</option>
            {availableFiles.map((f) => (
              <option key={f.path} value={f.path} className="bg-slate-950">
                {f.path.replace('src/utils/', '')} ({f.testCount})
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-surface-1 text-xs text-slate-200 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={withCoverage}
              onChange={(e) => setWithCoverage(e.target.checked)}
              className="accent-cyan-500 rounded"
            />
            <span>V8 Coverage</span>
          </label>

          {isRunning ? (
            <button
              type="button"
              onClick={() => abortControllerRef.current?.abort()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop Run</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => runVitestStream(selectedSuiteFilter, undefined, withCoverage)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-600/90 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shadow-lg shadow-cyan-950/40"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Run Vitest Live</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Telemetry & V8 Coverage Summary Strip (Tier 2 Glass Cards) */}
      <div className="px-4 py-3 border-b border-white/10 grid grid-cols-2 lg:grid-cols-5 gap-3 shrink-0">
        <div className="p-3 rounded-xl glass-surface-2">
          <div className="text-[11px] text-slate-300">Test Status</div>
          <div className="text-lg font-bold font-mono tabular-nums mt-0.5 flex items-center gap-2">
            {isRunning ? (
              <span className="text-cyan-300">RUNNING...</span>
            ) : summary ? (
              <span className={summary.failedTests === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {summary.passedTests}/{Math.max(summary.passedTests + summary.failedTests, 1)}{' '}
                {summary.failedTests === 0 ? 'PASS' : 'FAIL'}
              </span>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </div>
          <div className="text-[10px] font-mono tabular-nums text-slate-400 mt-0.5">
            {summary
              ? `${summary.passedSuites}/${summary.totalSuites} suites${
                  summary.skippedTests > 0 ? ` · ${summary.skippedTests} filtered` : ''
                }`
              : 'Awaiting run'}
            {lastDurationMs !== null ? ` · ${(lastDurationMs / 1000).toFixed(2)}s` : ''}
          </div>
        </div>

        <div className="p-3 rounded-xl glass-surface-2">
          <div className="text-[11px] text-slate-300">Lines Coverage</div>
          <div
            className={`text-lg font-bold font-mono tabular-nums mt-0.5 ${
              coverageTotal ? getPctColor(coverageTotal.lines.pct) : 'text-slate-400'
            }`}
          >
            {coverageTotal ? `${coverageTotal.lines.pct.toFixed(1)}%` : '—'}
          </div>
          <div className="text-[10px] font-mono tabular-nums text-slate-400 mt-0.5">
            {coverageTotal
              ? `${coverageTotal.lines.covered}/${coverageTotal.lines.total} lines`
              : 'V8 instrumentation'}
          </div>
        </div>

        <div className="p-3 rounded-xl glass-surface-2">
          <div className="text-[11px] text-slate-300">Statements</div>
          <div
            className={`text-lg font-bold font-mono tabular-nums mt-0.5 ${
              coverageTotal ? getPctColor(coverageTotal.statements.pct) : 'text-slate-400'
            }`}
          >
            {coverageTotal ? `${coverageTotal.statements.pct.toFixed(1)}%` : '—'}
          </div>
          <div className="text-[10px] font-mono tabular-nums text-slate-400 mt-0.5">
            {coverageTotal
              ? `${coverageTotal.statements.covered}/${coverageTotal.statements.total} stmts`
              : 'AST statements'}
          </div>
        </div>

        <div className="p-3 rounded-xl glass-surface-2">
          <div className="text-[11px] text-slate-300">Branches (Paths)</div>
          <div
            className={`text-lg font-bold font-mono tabular-nums mt-0.5 ${
              coverageTotal ? getPctColor(coverageTotal.branches.pct) : 'text-slate-400'
            }`}
          >
            {coverageTotal ? `${coverageTotal.branches.pct.toFixed(1)}%` : '—'}
          </div>
          <div className="text-[10px] font-mono tabular-nums text-slate-400 mt-0.5">
            {coverageTotal
              ? `${coverageTotal.branches.covered}/${coverageTotal.branches.total} branches`
              : 'Conditional edges'}
          </div>
        </div>

        <div className="p-3 rounded-xl glass-surface-2 col-span-2 lg:col-span-1">
          <div className="text-[11px] text-slate-300">Functions</div>
          <div
            className={`text-lg font-bold font-mono tabular-nums mt-0.5 ${
              coverageTotal ? getPctColor(coverageTotal.functions.pct) : 'text-slate-400'
            }`}
          >
            {coverageTotal ? `${coverageTotal.functions.pct.toFixed(1)}%` : '—'}
          </div>
          <div className="text-[10px] font-mono tabular-nums text-slate-400 mt-0.5">
            {coverageTotal
              ? `${coverageTotal.functions.covered}/${coverageTotal.functions.total} fns`
              : 'Exported & internal'}
          </div>
        </div>
      </div>

      {/* Historical Test Trends & Pass/Fail Distribution (Recharts + Secondary Hotspot Drawer) */}
      <TestTrendAnalytics
        history={executionHistory}
        liveModuleBreakdown={liveModuleBreakdown}
        availableSuitePaths={availableFiles.map((f) => f.path)}
        onRunSuite={(suiteFile) => {
          setSelectedSuiteFilter(suiteFile);
          runVitestStream(suiteFile, undefined, withCoverage, 'manual');
        }}
      />

      {/* Main Split Workspace: Left Test-by-Test Tree | Right Inspector / V8 Map / Live Console */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 min-h-0 overflow-hidden">
        {/* Left Pane: Test Tree */}
        <div className="xl:col-span-5 flex flex-col border-b xl:border-b-0 xl:border-r border-white/10 min-h-0 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-white/10 flex flex-wrap items-center gap-2 glass-surface-1 border-x-0 border-t-0 shrink-0">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Filter individual tests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
              {(['all', 'passed', 'failed'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-0.5 rounded font-medium capitalize cursor-pointer ${
                    statusFilter === st
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {testsGroupedBySuite.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">
                {isRunning
                  ? 'Executing Vitest suites live...'
                  : 'No tests match the active filter.'}
              </div>
            ) : (
              testsGroupedBySuite.map(([suiteFile, suiteTests]) => {
                const suiteMeta = suites.find((s) => s.file === suiteFile);
                const covMeta = coverageFiles.find(
                  (c) => c.file === suiteFile.replace(/\.test\.ts$/, '.ts')
                );
                const isExpanded = expandedSuites[suiteFile] !== false;
                const suiteFailed = suiteTests.some((t) => t.status === 'failed');

                return (
                  <div
                    key={suiteFile}
                    className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden"
                  >
                    <div className="px-3 py-2 bg-slate-900 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSuites((prev) => ({ ...prev, [suiteFile]: !isExpanded }))
                        }
                        className="flex items-center gap-2 min-w-0 text-left cursor-pointer"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        {suiteFailed ? (
                          <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                        <span className="text-xs font-mono font-semibold text-white truncate">
                          {suiteFile.replace('src/utils/', '')}
                        </span>
                      </button>

                      <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono tabular-nums">
                        {covMeta && (
                          <span className={getPctColor(covMeta.lines.pct)}>
                            {covMeta.lines.pct.toFixed(0)}% cov
                          </span>
                        )}
                        <span className="text-slate-400">
                          {suiteTests.filter((t) => t.status === 'passed').length}/
                          {suiteMeta?.total ?? suiteTests.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => runVitestStream(suiteFile, undefined, withCoverage)}
                          disabled={isRunning}
                          className="p-1 rounded hover:bg-slate-800 text-cyan-400 cursor-pointer"
                          title={`Run ${suiteFile}`}
                        >
                          <Play className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="divide-y divide-slate-800/60 border-t border-slate-800/80">
                        {suiteTests.map((t) => {
                          const isSelected = selectedTest?.id === t.id;
                          return (
                            <div
                              key={t.id}
                              onClick={() => {
                                setSelectedTestId(t.id);
                                setInspectorView('inspector');
                              }}
                              className={`px-3 py-2 flex items-center justify-between gap-2 cursor-pointer transition-colors group ${
                                isSelected
                                  ? 'bg-cyan-950/60 text-white'
                                  : 'hover:bg-slate-800/40 text-slate-300'
                              }`}
                            >
                              <div className="flex items-start gap-2 min-w-0">
                                {t.status === 'passed' ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                ) : t.status === 'failed' ? (
                                  <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                )}
                                <span className="text-xs leading-snug line-clamp-2">{t.title}</span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] font-mono tabular-nums text-slate-500">
                                  {t.durationMs.toFixed(1)}ms
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTestId(t.id);
                                    runVitestStream(t.suiteFile, t.title, withCoverage);
                                  }}
                                  disabled={isRunning}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-800 text-cyan-400 transition-opacity cursor-pointer"
                                  title="Re-run only this test"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Test Inspector / Coverage Progressive Paths / Live Console */}
        <div className="xl:col-span-7 flex flex-col min-h-0 overflow-hidden bg-transparent">
          {/* Sub-tabs */}
          <div className="px-4 border-b border-white/10 flex items-center justify-between gap-2 glass-surface-1 border-x-0 border-t-0 shrink-0">
            <div className="flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setInspectorView('inspector')}
                className={`flex items-center gap-1.5 px-3 py-2.5 font-medium border-b-2 transition-colors cursor-pointer ${
                  inspectorView === 'inspector'
                    ? 'border-cyan-400 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <ListChecks className="w-3.5 h-3.5" />
                <span>Test-by-Test Inspector &amp; Editor</span>
              </button>

              <button
                type="button"
                onClick={() => setInspectorView('coverage')}
                className={`flex items-center gap-1.5 px-3 py-2.5 font-medium border-b-2 transition-colors cursor-pointer ${
                  inspectorView === 'coverage'
                    ? 'border-cyan-400 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>V8 Coverage &amp; Uncovered Paths</span>
              </button>

              <button
                type="button"
                onClick={() => setInspectorView('console')}
                className={`flex items-center gap-1.5 px-3 py-2.5 font-medium border-b-2 transition-colors cursor-pointer ${
                  inspectorView === 'console'
                    ? 'border-cyan-400 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Live Output ({streamLogs.length})</span>
              </button>
            </div>

            {lastCommand && (
              <div className="hidden md:block text-[10px] font-mono text-slate-400 truncate max-w-[260px]">
                {lastCommand}
              </div>
            )}
          </div>

          {/* VIEW A: Test-by-Test Inspector & Live Adjustment */}
          {inspectorView === 'inspector' && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 space-y-3">
              {selectedTest ? (
                <>
                  {/* Selected Test Summary Card (Tier 2 Glass) */}
                  <div className="p-3.5 rounded-xl glass-surface-2 space-y-2 shrink-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs font-mono">
                          <span
                            className={`font-bold uppercase ${
                              selectedTest.status === 'passed'
                                ? 'text-emerald-400'
                                : selectedTest.status === 'failed'
                                ? 'text-rose-400'
                                : 'text-amber-400'
                            }`}
                          >
                            {selectedTest.status}
                          </span>
                          <span className="text-slate-600">·</span>
                          <span className="text-cyan-400">{selectedTest.suiteFile}</span>
                          <span className="text-slate-600">·</span>
                          <span className="text-slate-400 tabular-nums">
                            {selectedTest.durationMs.toFixed(2)} ms
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-white mt-1">
                          {selectedTest.fullName}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            runVitestStream(selectedTest.suiteFile, selectedTest.title, withCoverage)
                          }
                          disabled={isRunning}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-cyan-300 cursor-pointer whitespace-nowrap"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Run Only This Test</span>
                        </button>
                        {onAskAiForTest && (
                          <button
                            type="button"
                            onClick={() =>
                              onAskAiForTest(
                                `Analyze @${selectedTest.suiteFile} test "${selectedTest.title}"${
                                  activeTargetCoverage
                                    ? ` and improve ${selectedTest.targetModule} branch coverage (currently ${activeTargetCoverage.branches.pct.toFixed(
                                        1
                                      )}%, missed lines: ${activeTargetCoverage.uncoveredLines
                                        .slice(0, 8)
                                        .join(', ')})`
                                    : ''
                                }.`
                              )
                            }
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white cursor-pointer whitespace-nowrap"
                          >
                            <Sparkles className="w-3 h-3 text-cyan-400" />
                            <span>Optimize via Codex</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Failure details if failing */}
                    {selectedTest.failureMessages.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-800/70 text-[11px] font-mono text-rose-200 whitespace-pre-wrap overflow-x-auto max-h-36">
                        {selectedTest.failureMessages.join('\n\n')}
                      </div>
                    )}

                    {/* Target module coverage snapshot & progressive path shortcut */}
                    {activeTargetCoverage && (
                      <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-slate-400">
                            Module: <span className="text-slate-200">{activeTargetCoverage.file}</span>
                          </span>
                          <span className={getPctColor(activeTargetCoverage.lines.pct)}>
                            Lines {activeTargetCoverage.lines.pct.toFixed(1)}%
                          </span>
                          <span className={getPctColor(activeTargetCoverage.branches.pct)}>
                            Branches {activeTargetCoverage.branches.pct.toFixed(1)}%
                          </span>
                          {activeTargetCoverage.uncoveredLines.length > 0 && (
                            <span className="text-amber-300">
                              Missed lines: {activeTargetCoverage.uncoveredLines.slice(0, 6).join(', ')}
                              {activeTargetCoverage.uncoveredLines.length > 6 ? '…' : ''}
                            </span>
                          )}
                        </div>

                        {activeTargetCoverage.uncoveredLines.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              handleAppendProgressiveProbe(
                                activeTargetCoverage.file,
                                activeTargetCoverage.uncoveredLines
                              )
                            }
                            className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                          >
                            + Add Progressive Edge Case
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Test Source Live Editor & Save/Re-Run Controls (Tier 3 Active Focus Glass) */}
                  <div className="flex-1 flex flex-col min-h-0 rounded-xl glass-surface-3 overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <FileCode2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-white font-semibold">{loadedTestFile}</span>
                        {hasUnsavedChanges && (
                          <span className="text-[11px] text-amber-400">· Modified</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {hasUnsavedChanges && (
                          <button
                            type="button"
                            onClick={() => setTestSourceCode(savedOriginalSource)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 cursor-pointer"
                          >
                            Revert
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSaveAndRerun(false)}
                          disabled={isSavingTest || isRunning}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{isSavingTest ? 'Saving...' : 'Save & Re-Run Suite'}</span>
                        </button>
                      </div>
                    </div>

                    {saveNotice && (
                      <div className="px-3 py-1.5 bg-cyan-950/60 border-b border-cyan-800/70 text-[11px] font-mono text-cyan-200 shrink-0">
                        {saveNotice}
                      </div>
                    )}

                    <textarea
                      value={testSourceCode}
                      onChange={(e) => setTestSourceCode(e.target.value)}
                      spellCheck={false}
                      className="flex-1 w-full bg-slate-950 p-3 text-xs font-mono text-slate-200 focus:outline-none leading-relaxed resize-none"
                    />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                  Select a test on the left to inspect timing, assertions, and uncovered paths.
                </div>
              )}
            </div>
          )}

          {/* VIEW B: Per-File V8 Coverage & Uncovered Branches Table */}
          {inspectorView === 'coverage' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {coverageFiles.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-500">
                  Enable &ldquo;V8 Coverage&rdquo; and run Vitest to inspect per-file statement, branch, and line metrics.
                </div>
              ) : (
                coverageFiles.map((cov) => {
                  const pairedTestFile = cov.file.replace(/\.ts$/, '.test.ts');
                  return (
                    <div
                      key={cov.file}
                      className="p-4 rounded-xl glass-surface-2 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-mono font-semibold text-white">
                            {cov.file}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5 tabular-nums">
                            Lines {cov.lines.covered}/{cov.lines.total} · Stmts {cov.statements.covered}/
                            {cov.statements.total} · Branches {cov.branches.covered}/{cov.branches.total}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await loadTestSourceFile(pairedTestFile);
                              handleAppendProgressiveProbe(cov.file, cov.uncoveredLines);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-cyan-300 cursor-pointer"
                          >
                            + Target Missed Paths
                          </button>
                        </div>
                      </div>

                      {/* 4 Progress Bars */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                        {(
                          [
                            ['Lines', cov.lines],
                            ['Statements', cov.statements],
                            ['Functions', cov.functions],
                            ['Branches', cov.branches],
                          ] as const
                        ).map(([label, metric]) => (
                          <div key={label} className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">{label}</span>
                              <span className={`font-bold tabular-nums ${getPctColor(metric.pct)}`}>
                                {metric.pct.toFixed(1)}%
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden">
                              <div
                                className={`h-full ${getBarColor(metric.pct)} transition-all`}
                                style={{ width: `${Math.min(100, metric.pct)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Uncovered lines & branch paths */}
                      {(cov.uncoveredLines.length > 0 || cov.uncoveredBranches.length > 0) && (
                        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono space-y-1.5">
                          {cov.uncoveredLines.length > 0 && (
                            <div className="flex items-start gap-2 text-amber-300">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <div>
                                <span className="text-slate-400">Uncovered Lines: </span>
                                <span>{cov.uncoveredLines.slice(0, 20).join(', ')}</span>
                                {cov.uncoveredLines.length > 20 && (
                                  <span className="text-slate-500">
                                    {' '}
                                    (+{cov.uncoveredLines.length - 20} more)
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          {cov.uncoveredBranches.length > 0 && (
                            <div className="text-slate-400">
                              <span>Missed Branch Paths: </span>
                              <span className="text-slate-300">
                                {cov.uncoveredBranches
                                  .slice(0, 8)
                                  .map((b) => `L${b.line} (${b.type}, -${b.pathsMissed})`)
                                  .join(' · ')}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* VIEW C: Live Streaming Vitest Console */}
          {inspectorView === 'console' && (
            <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] bg-slate-950 space-y-1">
              {streamLogs.length === 0 ? (
                <div className="text-slate-500 italic">No live Vitest output recorded yet.</div>
              ) : (
                streamLogs.map((line, i) => (
                  <div
                    key={i}
                    className={`whitespace-pre-wrap break-all ${
                      line.includes('FAIL') || line.includes('Error') || line.startsWith('×')
                        ? 'text-rose-300'
                        : line.startsWith('✓') || line.includes('PASS')
                        ? 'text-emerald-300'
                        : line.startsWith('$')
                        ? 'text-cyan-400 font-bold'
                        : 'text-slate-300'
                    }`}
                  >
                    {line}
                  </div>
                ))
              )}
              <div ref={consoleEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
