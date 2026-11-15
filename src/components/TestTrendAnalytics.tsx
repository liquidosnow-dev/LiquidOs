import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Cell,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ChevronDown,
  ChevronUp,
  TrendingUp,
  X,
  AlertOctagon,
  AlertTriangle,
  ShieldCheck,
  Radar as RadarIcon,
  Play,
  ArrowUpDown,
} from 'lucide-react';
import {
  getTestHistory,
  TestRunSnapshot,
  ModuleCoverageBreakdown,
  HotspotSeverity,
  getSortedHotspotModules,
  buildCoverageRadarData,
} from '../utils/testMetricsStore';

interface TestTrendAnalyticsProps {
  history?: TestRunSnapshot[];
  liveModuleBreakdown?: ModuleCoverageBreakdown[];
  availableSuitePaths?: string[];
  onRunSuite?: (suiteFile: string) => void;
}

type SortMode = 'hotspots' | 'alphabetical';

export const TestTrendAnalytics: React.FC<TestTrendAnalyticsProps> = ({
  history,
  liveModuleBreakdown = [],
  availableSuitePaths = [],
  onRunSuite,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasViewportSize, setHasViewportSize] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | HotspotSeverity>('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('hotspots');
  const [showFunctionsOverlay, setShowFunctionsOverlay] = useState(true);
  const [showStatementsOverlay, setShowStatementsOverlay] = useState(false);
  const [hasRadarSize, setHasRadarSize] = useState(false);

  const chartHostRef = useRef<HTMLDivElement | null>(null);
  const radarHostRef = useRef<HTMLDivElement | null>(null);

  const runs = history && history.length > 0 ? history : getTestHistory();

  useEffect(() => {
    const el = chartHostRef.current;
    if (!el || isCollapsed) {
      setHasViewportSize(false);
      return;
    }

    const measure = () => {
      if (el.offsetWidth > 0 && el.offsetHeight > 0) {
        setHasViewportSize(true);
      } else {
        setHasViewportSize(false);
      }
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isCollapsed]);

  useEffect(() => {
    const el = radarHostRef.current;
    if (!el || !isDrawerOpen) {
      setHasRadarSize(false);
      return;
    }

    const measure = () => {
      if (el.offsetWidth > 0 && el.offsetHeight > 0) {
        setHasRadarSize(true);
      } else {
        setHasRadarSize(false);
      }
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isDrawerOpen, selectedRunId]);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen]);

  const data = useMemo(
    () =>
      runs.map((run) => ({
        runId: run.runId,
        name: format(new Date(run.timestamp), 'HH:mm:ss'),
        Passed: run.passed,
        Failed: run.failed,
        Total: run.total,
        Coverage: Number(run.coverageLines.toFixed(1)),
        durationMs: run.durationMs,
        trigger: run.trigger || 'manual',
        fullTime: format(new Date(run.timestamp), 'MMM d, HH:mm:ss'),
      })),
    [runs]
  );

  const selectedRun = useMemo(() => {
    if (!selectedRunId) return runs[runs.length - 1] || null;
    return runs.find((r) => r.runId === selectedRunId) || runs[runs.length - 1] || null;
  }, [runs, selectedRunId]);

  const activeBreakdownSource: 'snapshot' | 'live' =
    selectedRun?.moduleBreakdown && selectedRun.moduleBreakdown.length > 0 ? 'snapshot' : 'live';

  const activeModules: ModuleCoverageBreakdown[] = useMemo(() => {
    if (selectedRun?.moduleBreakdown && selectedRun.moduleBreakdown.length > 0) {
      return selectedRun.moduleBreakdown;
    }
    return liveModuleBreakdown;
  }, [selectedRun, liveModuleBreakdown]);

  const hotspotCounts = useMemo(() => {
    let critical = 0;
    let watch = 0;
    let healthy = 0;
    for (const mod of activeModules) {
      if (mod.hotspotSeverity === 'CRITICAL') critical += 1;
      else if (mod.hotspotSeverity === 'WATCH') watch += 1;
      else healthy += 1;
    }
    return { critical, watch, healthy };
  }, [activeModules]);

  const radarData = useMemo(() => buildCoverageRadarData(activeModules, 8), [activeModules]);

  const displayedModules = useMemo(() => {
    const base =
      sortMode === 'hotspots'
        ? getSortedHotspotModules(activeModules)
        : [...activeModules].sort((a, b) => a.file.localeCompare(b.file));

    if (severityFilter === 'ALL') return base;
    return base.filter((m) => m.hotspotSeverity === severityFilter);
  }, [activeModules, severityFilter, sortMode]);

  const openRunDrawer = (runId: string) => {
    setSelectedRunId(runId);
    setSeverityFilter('ALL');
    setIsDrawerOpen(true);
  };

  const handleBarClick = (barEntry: any, index?: number) => {
    const clickedRunId =
      barEntry?.payload?.runId ||
      barEntry?.runId ||
      (typeof index === 'number' ? data[index]?.runId : undefined);
    if (clickedRunId) {
      openRunDrawer(clickedRunId);
    }
  };

  const latest = runs[runs.length - 1];
  const maxTotal = Math.max(40, ...runs.map((r) => r.passed + r.failed + 4));
  const passRate =
    latest && latest.total > 0 ? ((latest.passed / latest.total) * 100).toFixed(1) : '—';

  const getSeverityPresentation = (severity: HotspotSeverity) => {
    if (severity === 'CRITICAL') {
      return {
        label: 'CRITICAL',
        textClass: 'text-rose-300',
        badgeClass: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
        barClass: 'bg-rose-500',
        Icon: AlertOctagon,
      };
    }
    if (severity === 'WATCH') {
      return {
        label: 'WATCH',
        textClass: 'text-amber-300',
        badgeClass: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
        barClass: 'bg-amber-500',
        Icon: AlertTriangle,
      };
    }
    return {
      label: 'HEALTHY',
      textClass: 'text-emerald-300',
      badgeClass: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
      barClass: 'bg-emerald-500',
      Icon: ShieldCheck,
    };
  };

  return (
    <>
      <div className="mx-4 mt-3 mb-1 rounded-2xl glass-surface-2 overflow-hidden shrink-0">
        {/* Header Bar */}
        <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <TrendingUp className="w-4 h-4 text-violet-300 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs font-semibold text-white whitespace-nowrap">
                  Historical Test Trends (Last {runs.length} Runs)
                </h3>
                {latest && (
                  <span className="text-[11px] font-mono tabular-nums text-slate-400 whitespace-nowrap">
                    · Pass rate {passRate}% · Last {latest.durationMs}ms ·{' '}
                    {formatDistanceToNow(new Date(latest.timestamp), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Chart Series Legend */}
            <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono tabular-nums">
              <span className="flex items-center gap-1.5 text-emerald-300 whitespace-nowrap">
                <span className="w-2.5 h-2 rounded-xs bg-emerald-400 inline-block" aria-hidden="true" />
                Passed
              </span>
              <span className="flex items-center gap-1.5 text-rose-300 whitespace-nowrap">
                <span className="w-2.5 h-2 rounded-xs bg-rose-400 inline-block" aria-hidden="true" />
                Failed
              </span>
              <span className="flex items-center gap-1.5 text-violet-300 whitespace-nowrap">
                <span className="w-3 h-0.5 bg-violet-400 inline-block" aria-hidden="true" />
                Coverage %
              </span>
            </div>

            {latest && (
              <button
                type="button"
                onClick={() => openRunDrawer(selectedRun?.runId || latest.runId)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg glass-surface-1 hover:border-cyan-400/50 text-[11px] font-medium text-cyan-300 hover:text-cyan-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                <RadarIcon className="w-3.5 h-3.5" />
                <span>Hotspot Radar</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg glass-surface-1 text-[11px] font-medium text-slate-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
              aria-expanded={!isCollapsed}
            >
              <span>{isCollapsed ? 'Expand Chart' : 'Collapse'}</span>
              {isCollapsed ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Dual-Axis Recharts ComposedChart */}
        {!isCollapsed && (
          <div className="px-4 py-3">
            {data.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs font-mono text-slate-400">
                No execution snapshots recorded yet. Run Vitest to populate trend telemetry.
              </div>
            ) : (
              <>
                <div ref={chartHostRef} className="h-40 w-full min-w-0">
                  {hasViewportSize && (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis
                          dataKey="name"
                          stroke="#94a3b8"
                          fontSize={11}
                          tickLine={false}
                          axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                        />
                        <YAxis
                          yAxisId="left"
                          stroke="#94a3b8"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          domain={[0, maxTotal]}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#a78bfa"
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          domain={[50, 100]}
                          unit="%"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0d0f17',
                            borderColor: 'rgba(255,255,255,0.12)',
                            borderRadius: '12px',
                            color: '#f8fafc',
                            fontSize: '12px',
                            fontFamily: 'JetBrains Mono, monospace',
                          }}
                          labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="Passed"
                          fill="#34d399"
                          radius={[4, 4, 0, 0]}
                          barSize={16}
                          cursor="pointer"
                          onClick={handleBarClick}
                        >
                          {data.map((entry) => {
                            const isSelected = isDrawerOpen && selectedRun?.runId === entry.runId;
                            return (
                              <Cell
                                key={`passed-${entry.runId}`}
                                fill={isSelected ? '#22d3ee' : '#34d399'}
                                fillOpacity={isDrawerOpen && !isSelected ? 0.5 : 1}
                              />
                            );
                          })}
                        </Bar>
                        <Bar
                          yAxisId="left"
                          dataKey="Failed"
                          fill="#f87171"
                          radius={[4, 4, 0, 0]}
                          barSize={16}
                          cursor="pointer"
                          onClick={handleBarClick}
                        >
                          {data.map((entry) => {
                            const isSelected = isDrawerOpen && selectedRun?.runId === entry.runId;
                            return (
                              <Cell
                                key={`failed-${entry.runId}`}
                                fill="#f87171"
                                fillOpacity={isDrawerOpen && !isSelected ? 0.45 : 1}
                              />
                            );
                          })}
                        </Bar>
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="Coverage"
                          stroke="#a78bfa"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#a78bfa', strokeWidth: 0 }}
                          activeDot={{ r: 5, fill: '#c4b5fd' }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Keyboard-accessible Run Inspection Strip + Bar Click Hint */}
                <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-slate-400">
                    Click any bar to open module coverage hotspot radar
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Select test run for coverage breakdown">
                    {data.map((entry) => {
                      const isActive = isDrawerOpen && selectedRun?.runId === entry.runId;
                      return (
                        <button
                          key={entry.runId}
                          type="button"
                          data-testid={`trend-run-btn-${entry.runId}`}
                          aria-pressed={isActive}
                          onClick={() => openRunDrawer(entry.runId)}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-mono tabular-nums transition-colors cursor-pointer whitespace-nowrap border ${
                            isActive
                              ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                              : 'glass-surface-1 border-white/10 text-slate-300 hover:text-white hover:border-white/25'
                          }`}
                          title={`Inspect coverage breakdown for ${entry.fullTime}`}
                        >
                          {entry.name} · {entry.Passed}/{entry.Total} · {entry.Coverage}%
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Secondary Drawer: Module/File Coverage Breakdown + Hotspot Radar */}
      {isDrawerOpen &&
        selectedRun &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex justify-end bg-black/65 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Coverage breakdown drawer"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsDrawerOpen(false);
            }}
          >
          <div className="w-full max-w-2xl h-full bg-[#0b0f1c]/95 backdrop-blur-xl border-l border-white/15 shadow-2xl flex flex-col overflow-hidden text-slate-100">
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-white/10 flex items-start justify-between gap-4 shrink-0 glass-surface-1 border-x-0 border-t-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 uppercase tracking-wide">
                  <RadarIcon className="w-4 h-4 shrink-0" />
                  <span>Module Coverage &amp; Hotspot Breakdown</span>
                </div>
                <h2 className="text-base font-bold text-white mt-1 truncate">
                  Run {format(new Date(selectedRun.timestamp), 'MMM d, HH:mm:ss')}
                </h2>
                <div className="text-xs font-mono tabular-nums text-slate-300 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className={selectedRun.failed === 0 ? 'text-emerald-300' : 'text-rose-300'}>
                    {selectedRun.passed}/{selectedRun.total} passed
                  </span>
                  <span className="text-slate-600">·</span>
                  <span>Lines {selectedRun.coverageLines.toFixed(1)}%</span>
                  <span className="text-slate-600">·</span>
                  <span>{selectedRun.durationMs}ms</span>
                  <span className="text-slate-600">·</span>
                  <span className="capitalize">{selectedRun.trigger || 'manual'} trigger</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-400">
                    {activeBreakdownSource === 'snapshot' ? 'Recorded snapshot' : 'Live suite coverage'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Close coverage breakdown drawer"
                className="p-2 rounded-lg glass-surface-1 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Run Switcher inside Drawer */}
              {runs.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {runs.map((r) => {
                    const current = r.runId === selectedRun.runId;
                    return (
                      <button
                        key={`drawer-run-${r.runId}`}
                        type="button"
                        onClick={() => setSelectedRunId(r.runId)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono tabular-nums transition-colors cursor-pointer whitespace-nowrap border ${
                          current
                            ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200 font-semibold'
                            : 'glass-surface-1 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {format(new Date(r.timestamp), 'HH:mm:ss')} · {r.coverageLines.toFixed(1)}%
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Hotspot Summary Strip */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl glass-surface-2 border border-rose-500/25">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-rose-300">
                    <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                    <span>CRITICAL Hotspots</span>
                  </div>
                  <div className="text-xl font-bold font-mono tabular-nums text-white mt-1">
                    {hotspotCounts.critical}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    &lt; 55% lines or branches
                  </div>
                </div>

                <div className="p-3 rounded-xl glass-surface-2 border border-amber-500/25">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>WATCH Modules</span>
                  </div>
                  <div className="text-xl font-bold font-mono tabular-nums text-white mt-1">
                    {hotspotCounts.watch}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    55% – 81.9% coverage
                  </div>
                </div>

                <div className="p-3 rounded-xl glass-surface-2 border border-emerald-500/25">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-300">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>HEALTHY Modules</span>
                  </div>
                  <div className="text-xl font-bold font-mono tabular-nums text-white mt-1">
                    {hotspotCounts.healthy}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    &ge; 82% full coverage
                  </div>
                </div>
              </div>

              {/* RadarChart Hotspot Visualization */}
              <div className="rounded-2xl glass-surface-2 border border-white/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-xs font-semibold text-white">
                      Codebase Coverage Hotspot Radar
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Inward dips indicate uncovered edge branches &amp; execution hotspots across modules
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => setShowFunctionsOverlay((v) => !v)}
                      aria-pressed={showFunctionsOverlay}
                      className={`px-2 py-1 rounded-md border transition-colors cursor-pointer whitespace-nowrap ${
                        showFunctionsOverlay
                          ? 'bg-violet-500/20 border-violet-400/50 text-violet-200'
                          : 'glass-surface-1 border-white/10 text-slate-400'
                      }`}
                    >
                      Functions %
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowStatementsOverlay((v) => !v)}
                      aria-pressed={showStatementsOverlay}
                      className={`px-2 py-1 rounded-md border transition-colors cursor-pointer whitespace-nowrap ${
                        showStatementsOverlay
                          ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                          : 'glass-surface-1 border-white/10 text-slate-400'
                      }`}
                    >
                      Statements %
                    </button>
                  </div>
                </div>

                {radarData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-xs font-mono text-slate-400 text-center px-6">
                    Run Vitest with V8 coverage enabled to capture per-module breakdown telemetry.
                  </div>
                ) : (
                  <div ref={radarHostRef} className="h-72 w-full min-w-0" data-testid="coverage-radar-chart">
                    {hasRadarSize && (
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="72%" data={radarData}>
                          <PolarGrid stroke="rgba(255,255,255,0.12)" />
                          <PolarAngleAxis
                            dataKey="module"
                            tick={{ fill: '#cbd5e1', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                          />
                          <PolarRadiusAxis
                            angle={30}
                            domain={[0, 100]}
                            tick={{ fill: '#94a3b8', fontSize: 10 }}
                            axisLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0d0f17',
                              borderColor: 'rgba(255,255,255,0.14)',
                              borderRadius: '12px',
                              color: '#f8fafc',
                              fontSize: '12px',
                              fontFamily: 'JetBrains Mono, monospace',
                            }}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}
                          />
                          <Radar
                            name="Lines %"
                            dataKey="Lines"
                            stroke="#22d3ee"
                            fill="#22d3ee"
                            fillOpacity={0.22}
                            strokeWidth={2}
                          />
                          <Radar
                            name="Branches %"
                            dataKey="Branches"
                            stroke="#f59e0b"
                            fill="#f59e0b"
                            fillOpacity={0.22}
                            strokeWidth={2}
                          />
                          {showFunctionsOverlay && (
                            <Radar
                              name="Functions %"
                              dataKey="Functions"
                              stroke="#a78bfa"
                              fill="#a78bfa"
                              fillOpacity={0.14}
                              strokeWidth={1.5}
                            />
                          )}
                          {showStatementsOverlay && (
                            <Radar
                              name="Statements %"
                              dataKey="Statements"
                              stroke="#34d399"
                              fill="#34d399"
                              fillOpacity={0.14}
                              strokeWidth={1.5}
                            />
                          )}
                        </RadarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}
              </div>

              {/* File/Module Breakdown List */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {(['ALL', 'CRITICAL', 'WATCH', 'HEALTHY'] as const).map((sev) => (
                      <button
                        key={sev}
                        type="button"
                        onClick={() => setSeverityFilter(sev)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors cursor-pointer whitespace-nowrap border ${
                          severityFilter === sev
                            ? 'bg-cyan-600/80 border-cyan-400 text-white font-semibold'
                            : 'glass-surface-1 border-white/10 text-slate-300 hover:text-white'
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSortMode((prev) => (prev === 'hotspots' ? 'alphabetical' : 'hotspots'))
                    }
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg glass-surface-1 text-[11px] font-mono text-slate-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <ArrowUpDown className="w-3 h-3 text-cyan-300" />
                    <span>{sortMode === 'hotspots' ? 'Sort: Hotspots First' : 'Sort: A-Z'}</span>
                  </button>
                </div>

                {displayedModules.length === 0 ? (
                  <div className="p-6 rounded-xl glass-surface-1 text-center text-xs font-mono text-slate-400">
                    No modules match the active severity filter.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {displayedModules.map((mod) => {
                      const pres = getSeverityPresentation(mod.hotspotSeverity);
                      const SeverityIcon = pres.Icon;
                      const candidateSuitePath = mod.file.replace(/\.ts$/, '.test.ts');
                      const canRunSuite =
                        Boolean(onRunSuite) && availableSuitePaths.includes(candidateSuitePath);

                      return (
                        <div
                          key={mod.file}
                          className="p-3.5 rounded-xl glass-surface-1 border border-white/10 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0 flex items-center gap-2">
                              <SeverityIcon className={`w-4 h-4 shrink-0 ${pres.textClass}`} />
                              <span className="text-xs font-mono font-semibold text-white truncate">
                                {mod.file}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`px-2 py-0.5 rounded-md border text-[10px] font-mono font-semibold ${pres.badgeClass}`}
                              >
                                {pres.label}
                              </span>
                              {canRunSuite && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onRunSuite?.(candidateSuitePath);
                                    setIsDrawerOpen(false);
                                  }}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-600/80 hover:bg-cyan-500 text-white text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <Play className="w-3 h-3" />
                                  <span>Run Suite</span>
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono tabular-nums">
                            {[
                              { label: 'Lines', val: mod.linesPct },
                              { label: 'Branches', val: mod.branchesPct },
                              { label: 'Functions', val: mod.functionsPct },
                              { label: 'Statements', val: mod.statementsPct },
                            ].map((m) => (
                              <div key={m.label} className="p-2 rounded-lg bg-black/30 border border-white/5">
                                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                                  <span>{m.label}</span>
                                  <span
                                    className={
                                      m.val >= 82
                                        ? 'text-emerald-300 font-semibold'
                                        : m.val >= 55
                                          ? 'text-amber-300 font-semibold'
                                          : 'text-rose-300 font-semibold'
                                    }
                                  >
                                    {m.val.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      m.val >= 82
                                        ? 'bg-emerald-400'
                                        : m.val >= 55
                                          ? 'bg-amber-400'
                                          : 'bg-rose-400'
                                    }`}
                                    style={{ width: `${Math.min(100, Math.max(0, m.val))}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          {(mod.uncoveredLines.length > 0 || mod.uncoveredBranchesCount > 0) && (
                            <div className="text-[11px] font-mono text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                              {mod.uncoveredBranchesCount > 0 && (
                                <span className="text-amber-300/90 tabular-nums">
                                  {mod.uncoveredBranchesCount} missed branch{mod.uncoveredBranchesCount === 1 ? '' : 'es'}
                                </span>
                              )}
                              {mod.uncoveredLines.length > 0 && (
                                <span className="truncate tabular-nums">
                                  Uncovered lines: {mod.uncoveredLines.slice(0, 8).join(', ')}
                                  {mod.uncoveredLines.length > 8 ? '…' : ''}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>,
          document.body
        )}
    </>
  );
};
