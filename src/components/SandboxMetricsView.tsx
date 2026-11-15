import React, { useState, useEffect } from 'react';
import { CloudSandboxSpecs, SandboxMetrics } from '../types/sandbox';
import {
  Activity,
  Cpu,
  HardDrive,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Zap,
  Gauge,
  Wifi,
  Server,
  Layers,
} from 'lucide-react';

interface SandboxMetricsViewProps {
  specs: CloudSandboxSpecs;
  onUpdateSpecs: (specs: CloudSandboxSpecs) => void;
}

export const SandboxMetricsView: React.FC<SandboxMetricsViewProps> = ({
  specs,
  onUpdateSpecs,
}) => {
  const [metrics, setMetrics] = useState<SandboxMetrics>({
    cpuPercent: 14.8,
    ramUsedMb: 1482,
    ramTotalMb: specs.ramGb * 1024,
    gpuPercent: 8.4,
    diskUsedGb: 4.2,
    diskTotalGb: specs.diskGb,
    networkRxKb: 34.2,
    networkTxKb: 89.6,
    timestamp: Date.now(),
  });

  const [metricsHistory, setMetricsHistory] = useState<number[]>([
    12, 14, 18, 15, 22, 19, 14, 16, 25, 21, 15, 14, 18, 20, 16, 14,
  ]);

  const [remainingMinutes, setRemainingMinutes] = useState(58);
  const [isWaking, setIsWaking] = useState(false);

  // Live simulation ticker for metrics
  useEffect(() => {
    if (specs.status !== 'RUNNING') return;

    const interval = setInterval(() => {
      setMetrics((prev) => {
        const nextCpu = Math.max(4, Math.min(65, prev.cpuPercent + (Math.random() * 8 - 4)));
        const nextGpu = Math.max(2, Math.min(45, prev.gpuPercent + (Math.random() * 6 - 3)));
        const nextRam = Math.max(1200, Math.min(specs.ramGb * 1024 * 0.7, prev.ramUsedMb + (Math.random() * 20 - 10)));
        const nextRx = Math.max(5, prev.networkRxKb + (Math.random() * 20 - 10));
        const nextTx = Math.max(10, prev.networkTxKb + (Math.random() * 30 - 15));

        setMetricsHistory((hist) => [...hist.slice(-19), Math.round(nextCpu)]);

        return {
          cpuPercent: parseFloat(nextCpu.toFixed(1)),
          ramUsedMb: Math.round(nextRam),
          ramTotalMb: specs.ramGb * 1024,
          gpuPercent: parseFloat(nextGpu.toFixed(1)),
          diskUsedGb: prev.diskUsedGb,
          diskTotalGb: specs.diskGb,
          networkRxKb: parseFloat(nextRx.toFixed(1)),
          networkTxKb: parseFloat(nextTx.toFixed(1)),
          timestamp: Date.now(),
        };
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [specs.status, specs.ramGb, specs.diskGb]);

  const handlePlanChange = (plan: 'Free' | 'Plus' | 'Pro') => {
    let cpus = 1;
    let ramGb = 2;
    let gpu = 'None';
    if (plan === 'Plus') {
      cpus = 2;
      ramGb = 4;
      gpu = 'Shared GPU T4';
    } else if (plan === 'Pro') {
      cpus = 4;
      ramGb = 8;
      gpu = 'NVIDIA T4 16GB Virtualized';
    }

    onUpdateSpecs({
      ...specs,
      plan,
      cpus,
      ramGb,
      gpu,
    });
  };

  const handleTogglePause = () => {
    if (specs.status === 'RUNNING') {
      onUpdateSpecs({ ...specs, status: 'PAUSED' });
    } else {
      setIsWaking(true);
      onUpdateSpecs({ ...specs, status: 'WAKING' });
      setTimeout(() => {
        setIsWaking(false);
        onUpdateSpecs({ ...specs, status: 'RUNNING', lastActive: Date.now() });
      }, 1500);
    }
  };

  const ramPercent = Math.round((metrics.ramUsedMb / metrics.ramTotalMb) * 100);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Sandbox Metrics & Telemetry</h2>
            <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
              specs.status === 'RUNNING'
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                : specs.status === 'WAKING'
                ? 'bg-amber-950 text-amber-400 border border-amber-800 animate-pulse'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
              {specs.status === 'RUNNING' ? '● RUNNING' : specs.status === 'WAKING' ? '⏳ WAKING UP...' : '⏸ PAUSED'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time CPU/GPU, memory envelope, and auto-pause resource manager
          </p>
        </div>

        <button
          onClick={handleTogglePause}
          disabled={isWaking}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            specs.status === 'RUNNING'
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
          }`}
        >
          {specs.status === 'RUNNING' ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              <span>Simulate Pause</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              <span>Wake Sandbox</span>
            </>
          )}
        </button>
      </div>

      {/* Auto-Pause Inactivity Card */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider">
              Auto-Pause Guardrail (Resource Saver)
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              After about an hour of inactivity the sandbox pauses to save resources, and wakes up automatically next time you open the project.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
          <span className="text-[11px] text-slate-400 font-mono">Auto-pause in:</span>
          <span className="text-xs font-bold font-mono text-cyan-400">~{remainingMinutes}m remaining</span>
        </div>
      </div>

      {/* Real-Time Hardware Telemetry Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU Usage */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 shadow-md">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>vCPU Load</span>
            </span>
            <span className="font-mono text-cyan-400 font-bold">{metrics.cpuPercent}%</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-cyan-500 to-teal-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${metrics.cpuPercent}%` }}
            />
          </div>

          {/* Sparkline visualization */}
          <div className="flex items-end gap-1 h-8 pt-1">
            {metricsHistory.map((val, idx) => (
              <div
                key={idx}
                className="flex-1 bg-cyan-900/60 hover:bg-cyan-500 rounded-xs transition-colors"
                style={{ height: `${Math.max(10, (val / 65) * 100)}%` }}
                title={`${val}%`}
              />
            ))}
          </div>

          <div className="text-[11px] text-slate-400 flex justify-between font-mono">
            <span>{specs.cpus} Cores Allocated</span>
            <span>Load: 0.18</span>
          </div>
        </div>

        {/* GPU Usage */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 shadow-md">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>GPU Compute</span>
            </span>
            <span className="font-mono text-amber-400 font-bold">{metrics.gpuPercent}%</span>
          </div>

          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-amber-500 to-orange-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${metrics.gpuPercent}%` }}
            />
          </div>

          <div className="text-xs font-mono text-slate-300 bg-slate-950 p-2 rounded border border-slate-800/80 truncate">
            {specs.gpu}
          </div>

          <div className="text-[11px] text-slate-400 flex justify-between font-mono">
            <span>CUDA 12.4</span>
            <span>VRAM: 1.2 / 16 GB</span>
          </div>
        </div>

        {/* RAM Usage */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 shadow-md">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Memory (RAM)</span>
            </span>
            <span className="font-mono text-emerald-400 font-bold">{ramPercent}%</span>
          </div>

          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${ramPercent}%` }}
            />
          </div>

          <div className="text-xs font-mono text-slate-300 bg-slate-950 p-2 rounded border border-slate-800/80">
            {(metrics.ramUsedMb / 1024).toFixed(2)} GB / {specs.ramGb} GB
          </div>

          <div className="text-[11px] text-slate-400 flex justify-between font-mono">
            <span>Buffer: 769 MB</span>
            <span>Swap: 0 MB</span>
          </div>
        </div>

        {/* Disk & Network I/O */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 shadow-md">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Wifi className="w-4 h-4 text-purple-400" />
              <span>Network & Disk</span>
            </span>
            <span className="font-mono text-purple-400 font-bold">I/O Live</span>
          </div>

          <div className="space-y-1.5 text-xs font-mono bg-slate-950 p-2 rounded border border-slate-800/80">
            <div className="flex justify-between">
              <span className="text-slate-400">Disk Used:</span>
              <span className="text-white">{metrics.diskUsedGb} GB / {metrics.diskTotalGb} GB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Net RX:</span>
              <span className="text-cyan-300">{metrics.networkRxKb} KB/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Net TX:</span>
              <span className="text-emerald-300">{metrics.networkTxKb} KB/s</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex justify-between font-mono">
            <span>NVMe SSD</span>
            <span>TCP Socket OK</span>
          </div>
        </div>
      </div>

      {/* Specs by Plan Scaler */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>Sandbox Machine Scaling (Plan-Based Specs)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              The sandbox's memory and CPU/GPU scale with your membership. Plus and Pro get larger machines (up to 4 CPU / 8 GB).
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
            Active: {specs.plan} Tier
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              plan: 'Free' as const,
              title: 'Standard',
              cpus: '1 vCPU',
              ram: '2 GB RAM',
              gpu: 'CPU Only',
              badge: 'Starter',
              desc: 'Basic sandbox for prototypes and lightweight scripts.',
            },
            {
              plan: 'Plus' as const,
              title: 'Plus Tier',
              cpus: '2 vCPUs',
              ram: '4 GB RAM',
              gpu: 'Shared GPU',
              badge: 'Popular',
              desc: 'Faster builds, Hono API backend, and responsive dev server.',
            },
            {
              plan: 'Pro' as const,
              title: 'Pro Enterprise',
              cpus: '4 vCPUs / GPU',
              ram: '8 GB RAM',
              gpu: 'NVIDIA T4 16GB',
              badge: 'High Perf',
              desc: 'High-performance 4 CPU/GPU & 8 GB RAM sandbox for production apps.',
            },
          ].map((tier) => {
            const isCurrent = specs.plan === tier.plan;
            return (
              <div
                key={tier.plan}
                onClick={() => handlePlanChange(tier.plan)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isCurrent
                    ? 'bg-cyan-950/40 border-cyan-500 shadow-lg shadow-cyan-950/40'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white">{tier.title}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                    isCurrent ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {tier.badge}
                  </span>
                </div>
                <div className="space-y-1 text-xs font-mono text-cyan-300">
                  <div>⚡ {tier.cpus}</div>
                  <div>🧠 {tier.ram}</div>
                  <div>🎮 {tier.gpu}</div>
                </div>
                <p className="text-xs text-slate-400 mt-2.5">{tier.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
