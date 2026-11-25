import React, { useEffect, useState } from 'react';
import { Activity, Cpu, HardDrive, Network, ShieldCheck, RefreshCw, Maximize2 } from 'lucide-react';
import { CloudSandboxSpecs } from '../../types/sandbox';
import { ControlPlaneState } from '../../utils/ingestionControlPlane';
import { StatusIndicator } from '../ui/StatusIndicator';

interface LiveMetricsSample {
  cpuPct: number;
  memPct: number;
  netGbps: number;
  historyCpu: number[];
  bars: number[];
  isSimulated: boolean;
}

interface SystemTelemetryProps {
  specs: CloudSandboxSpecs;
  controlPlaneState: ControlPlaneState;
  watchTestStatus: {
    isRunning: boolean;
    passed: number;
    failed: number;
    total: number;
  } | null;
  onOpenFullMetrics: () => void;
  compact?: boolean;
}

export const SystemTelemetry: React.FC<SystemTelemetryProps> = ({
  specs,
  controlPlaneState,
  watchTestStatus,
  onOpenFullMetrics,
  compact = false,
}) => {
  const [honoStatus, setHonoStatus] = useState<'checking' | 'healthy' | 'offline'>('checking');
  const [osEngineLabel, setOsEngineLabel] = useState<string>('Checking OS DB...');
  const [osFilesTracked, setOsFilesTracked] = useState<number>(0);
  const [sample, setSample] = useState<LiveMetricsSample>({
    cpuPct: 12,
    memPct: 28,
    netGbps: 2.4,
    historyCpu: [14, 18, 12, 22, 16, 15, 29, 21, 14, 12],
    bars: [28, 42, 35, 58, 46, 62, 74, 48, 39],
    isSimulated: true,
  });

  const refreshTelemetry = async () => {
    try {
      const [honoRes, osRes, metricsRes] = await Promise.all([
        fetch('/api/hono/health').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/os/state').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('/api/sandbox/metrics').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      setHonoStatus(honoRes?.status === 'ok' || honoRes?.ok ? 'healthy' : 'offline');
      if (osRes) {
        setOsEngineLabel(osRes.engine || 'WAL SQLite + DuckDB');
        setOsFilesTracked(osRes.activeBinding?.filesCount || 0);
      } else {
        setOsEngineLabel('Offline / Local Memory');
      }

      if (metricsRes && typeof metricsRes.cpuPercent === 'number') {
        const cpu = Math.max(4, Math.min(96, Math.round(metricsRes.cpuPercent)));
        const rawMemPct =
          typeof metricsRes.ramUsedMb === 'number' && typeof metricsRes.ramTotalMb === 'number' && metricsRes.ramTotalMb > 0
            ? (metricsRes.ramUsedMb / metricsRes.ramTotalMb) * 100
            : 28;
        const mem = Math.max(8, Math.min(96, Math.round(rawMemPct)));
        const kbTotal = (metricsRes.networkRxKb || 120) + (metricsRes.networkTxKb || 80);
        const net = Number(Math.max(0.1, kbTotal / 1024).toFixed(1));
        setSample((prev) => ({
          cpuPct: cpu,
          memPct: mem,
          netGbps: net,
          historyCpu: [...prev.historyCpu.slice(1), cpu],
          bars: [...prev.bars.slice(1), mem],
          isSimulated: true,
        }));
      }
    } catch {
      setHonoStatus('offline');
    }
  };

  useEffect(() => {
    void refreshTelemetry();
    const timer = window.setInterval(() => void refreshTelemetry(), 6000);
    return () => window.clearInterval(timer);
  }, []);

  const sparklinePoints = sample.historyCpu
    .map((v, idx) => {
      const x = (idx / Math.max(1, sample.historyCpu.length - 1)) * 180;
      const y = 36 - (v / 100) * 32;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-cyan-300" />
            <span className="text-xs font-semibold text-slate-100">System Telemetry</span>
          </div>
          <StatusIndicator
            tone={honoStatus === 'healthy' ? 'live' : 'warning'}
            label={honoStatus === 'healthy' ? 'Hono Live' : 'Checking'}
          />
        </div>

        <div className="grid grid-cols-12 items-center gap-2">
          {/* SVG Waveform */}
          <div className="col-span-5">
            <svg viewBox="0 0 180 40" className="w-full h-9 overflow-visible" aria-hidden="true">
              <defs>
                <linearGradient id="los-spark-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon
                points={`0,38 ${sparklinePoints} 180,38`}
                fill="url(#los-spark-fill)"
              />
              <polyline
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={sparklinePoints}
              />
            </svg>
          </div>

          {/* Numeric Stats */}
          <div className="col-span-4 space-y-0.5 text-[11px] font-mono tabular-nums">
            <div className="flex justify-between">
              <span className="text-slate-400">CPU</span>
              <span className="text-slate-100 font-semibold">{sample.cpuPct}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">MEM</span>
              <span className="text-slate-100 font-semibold">{sample.memPct}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">NET</span>
              <span className="text-cyan-300 font-semibold">{sample.netGbps} GB/s</span>
            </div>
          </div>

          {/* Bar Cluster */}
          <div className="col-span-3 flex items-end justify-end gap-1 h-9 px-1" aria-hidden="true">
            {sample.bars.slice(-6).map((b, i) => (
              <span
                key={i}
                style={{ height: `${Math.max(20, Math.min(100, b))}%` }}
                className="w-1.5 rounded-t bg-gradient-to-t from-cyan-600/80 to-cyan-300"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Honesty Distinction Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusIndicator
            tone={honoStatus === 'healthy' ? 'live' : 'warning'}
            label="Actual Host API"
            sublabel={honoStatus === 'healthy' ? 'Hono OK' : 'Offline'}
          />
          <StatusIndicator
            tone="simulated"
            label="Demo Stream"
            sublabel="metrics endpoint"
          />
          <StatusIndicator
            tone={controlPlaneState.mode === 'ACTIVE' ? 'nominal' : 'warning'}
            label={`Mode ${controlPlaneState.mode}`}
            sublabel={`Epoch #${controlPlaneState.epoch}`}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void refreshTelemetry()}
            className="mercury-press px-2 py-0.5 rounded-lg bg-slate-900/75 border border-slate-300/20 text-[11px] text-slate-200 hover:border-cyan-400/45 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3 text-cyan-300" />
            <span>Poll</span>
          </button>
          <button
            type="button"
            onClick={onOpenFullMetrics}
            className="mercury-press px-2.5 py-0.5 rounded-lg bg-cyan-500/15 border border-cyan-400/40 text-[11px] text-cyan-200 hover:bg-cyan-500/25 flex items-center gap-1 cursor-pointer"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Scaling Controls</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="rounded-xl bg-slate-950/75 border border-slate-300/15 px-2.5 py-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3 text-cyan-300" /> CPU Load (Demo)
            </span>
            <span className="font-mono text-amber-300/80">SIM</span>
          </div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-base font-bold font-mono tabular-nums text-slate-100">
              {sample.cpuPct}%
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {specs.cpus} vCPU · {specs.plan}
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-slate-950/75 border border-slate-300/15 px-2.5 py-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <HardDrive className="w-3 h-3 text-cyan-300" /> Memory (Demo)
            </span>
            <span className="font-mono text-amber-300/80">SIM</span>
          </div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-base font-bold font-mono tabular-nums text-slate-100">
              {sample.memPct}%
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Cap {specs.ramGb} GB
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-slate-950/75 border border-slate-300/15 px-2.5 py-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <Network className="w-3 h-3 text-emerald-300" /> OS DB Binding
            </span>
            <span className="font-mono text-emerald-300">LIVE</span>
          </div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-sm font-bold font-mono text-emerald-200 truncate">
              {osFilesTracked} files bound
            </span>
            <span className="text-[10px] text-slate-400 truncate max-w-[95px]">
              {osEngineLabel}
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-slate-950/75 border border-slate-300/15 px-2.5 py-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-300" /> Watch / Permits
            </span>
            <span className="font-mono text-emerald-300">LIVE</span>
          </div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-sm font-bold font-mono text-slate-100">
              {watchTestStatus
                ? `${watchTestStatus.passed}/${watchTestStatus.total} Pass`
                : 'Watch Ready'}
            </span>
            <span className="text-[10px] text-cyan-300 font-mono">
              Permit {controlPlaneState.activePermit ? 'Valid' : 'None'}
            </span>
          </div>
        </div>
      </div>

      {/* Visual Telemetry Graphs */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center rounded-xl bg-slate-950/70 border border-slate-300/15 px-3 py-1.5">
        <div className="sm:col-span-7">
          <div className="text-[10px] text-slate-400 mb-0.5 flex items-center justify-between">
            <span>Telemetry Oscillation Trace (CPU % · Demo Series)</span>
            <span className="font-mono text-cyan-300">{sample.netGbps} GB/s</span>
          </div>
          <svg viewBox="0 0 180 40" className="w-full h-8 overflow-visible" aria-hidden="true">
            <polyline
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={sparklinePoints}
            />
          </svg>
        </div>
        <div className="sm:col-span-5 flex items-end justify-end gap-1.5 h-10 px-2 border-t sm:border-t-0 sm:border-l border-slate-300/10 pt-2 sm:pt-0">
          {sample.bars.map((val, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full">
              <span
                style={{ height: `${Math.max(16, Math.min(100, val))}%` }}
                className="w-full max-w-[10px] rounded-t bg-gradient-to-t from-cyan-700/70 to-cyan-300/90"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
