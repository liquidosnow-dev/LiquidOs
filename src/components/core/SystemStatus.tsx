import React, { useEffect, useRef, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  Cpu,
  Wrench,
  Sparkles,
  Check,
  Rocket,
  GitBranch,
} from 'lucide-react';
import { ModelOption } from '../../types';
import { ControlPlaneState } from '../../utils/ingestionControlPlane';
import { SpatialDirection } from '../../utils/spatialNavigation';

interface SystemStatusProps {
  selectedModel: ModelOption;
  availableModels: ModelOption[];
  onSelectModel: (model: ModelOption) => void;
  controlPlaneState: ControlPlaneState;
  activeDirection: SpatialDirection;
  onGoHome: () => void;
  onOpenSecurity: () => void;
  onOpenDeploy: () => void;
  onOpenVersionControl: () => void;
  onOpenModelAllowlist: () => void;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({
  selectedModel,
  availableModels,
  onSelectModel,
  controlPlaneState,
  activeDirection,
  onGoHome,
  onOpenSecurity,
  onOpenDeploy,
  onOpenVersionControl,
  onOpenModelAllowlist,
}) => {
  const [now, setNow] = useState<Date>(() => new Date());
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsModelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const timeFormatted = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const dateFormatted = now.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isModeActive = controlPlaneState.mode === 'ACTIVE';
  const isModeRestricted = controlPlaneState.mode === 'RESTRICTED';

  return (
    <header className="relative z-40 shrink-0 h-14 px-3 sm:px-6 flex items-center justify-between border-b border-slate-200/15 bg-[#04070f]/90 backdrop-blur-xl">
      {/* Left: Liquid OS Infinity Brand */}
      <button
        type="button"
        onClick={onGoHome}
        className="flex items-center gap-2.5 text-left group cursor-pointer"
        title={activeDirection === 'HOME' ? 'Liquid OS Core' : 'Return to Orbital Home'}
      >
        <div className="relative w-9 h-7 flex items-center justify-center">
          <svg viewBox="0 0 64 32" className="w-9 h-6" aria-hidden="true">
            <defs>
              <linearGradient id="los-header-inf" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="48%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
            <path
              d="M17.5 23.5c-4.7 0-8.5-3.4-8.5-7.5s3.8-7.5 8.5-7.5c6.5 0 11 15 17.5 15 4.7 0 8.5-3.4 8.5-7.5s-3.8-7.5-8.5-7.5c-6.5 0-11 15-17.5 15Z"
              transform="translate(5 0)"
              fill="none"
              stroke="url(#los-header-inf)"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="text-sm sm:text-base font-bold tracking-[0.18em] text-slate-100">
            LIQUID <span className="text-cyan-300 font-semibold">OS</span>
          </div>
          <div className="text-[9px] tracking-[0.26em] text-slate-400 uppercase hidden sm:block">
            BUILD · CONTROL · EVOLVE
          </div>
        </div>
      </button>

      {/* Center: Sovereign Plate */}
      <div className="hidden lg:flex items-center justify-center">
        <div className="px-7 py-1.5 rounded-b-xl border-x border-b border-slate-300/20 bg-gradient-to-b from-slate-900/75 to-slate-950/95 shadow-[inset_0_-1px_0_rgba(56,189,248,0.22)]">
          <span className="text-[11px] tracking-[0.28em] font-medium text-slate-200 uppercase">
            SOVEREIGN · INSPECTABLE · AIR SAFE
          </span>
        </div>
      </div>

      {/* Right: Model Selector + Security State + Clock + Quick Utility Icons */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Compact Multi-Model Selector Dropdown (Preserves Puter / Reasoning / Tool badges) */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsModelMenuOpen((prev) => !prev)}
            className="mercury-press flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300/20 bg-slate-900/70 hover:border-cyan-400/40 text-xs text-slate-100 cursor-pointer"
            title="Switch Active AI Model"
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
            <span className="font-medium truncate max-w-[92px] sm:max-w-[130px]">
              {selectedModel.name}
            </span>
            {selectedModel.supportsTools && (
              <span className="hidden xl:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/30 text-[9px] text-emerald-300 font-semibold">
                Tools
              </span>
            )}
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>

          {isModelMenuOpen && (
            <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-24px)] rounded-2xl los-glass-elevated p-2 z-50 animate-fade-in">
              <div className="px-2.5 py-1.5 border-b border-slate-200/10 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-200 uppercase tracking-wider">
                  Codex & Edge Models
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsModelMenuOpen(false);
                    onOpenModelAllowlist();
                  }}
                  className="text-[10px] text-cyan-300 hover:text-cyan-200 cursor-pointer"
                >
                  Allowlist →
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto py-1 space-y-1">
                {availableModels.map((model) => {
                  const active = model.id === selectedModel.id;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        onSelectModel(model);
                        setIsModelMenuOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-xl border transition-colors cursor-pointer flex items-start justify-between gap-2 ${
                        active
                          ? 'bg-cyan-500/15 border-cyan-400/40'
                          : 'bg-transparent border-transparent hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-slate-100">
                            {model.name}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {model.provider}
                          </span>
                          {model.supportsPuter && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-500/30">
                              Puter
                            </span>
                          )}
                          {model.supportsTools && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-500/30">
                              <Wrench className="w-2.5 h-2.5" />
                              Tools
                            </span>
                          )}
                          {model.supportsReasoning && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-indigo-950/70 text-indigo-300 border border-indigo-500/30">
                              <Sparkles className="w-2.5 h-2.5" />
                              Reasoning
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                          {model.description}
                        </p>
                      </div>
                      {active && <Check className="w-3.5 h-3.5 text-cyan-300 shrink-0 mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Security Status Pill */}
        <button
          type="button"
          onClick={onOpenSecurity}
          className={`mercury-press flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-left cursor-pointer ${
            isModeActive
              ? 'border-emerald-500/35 bg-emerald-950/35 hover:border-emerald-400/55'
              : isModeRestricted
              ? 'border-amber-500/40 bg-amber-950/35'
              : 'border-rose-500/50 bg-rose-950/45'
          }`}
          title="Open Security, Keys & Control Plane Diagnostics"
        >
          {isModeActive ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <ShieldAlert
              className={`w-4 h-4 shrink-0 ${
                isModeRestricted ? 'text-amber-400' : 'text-rose-400'
              }`}
            />
          )}
          <div className="hidden sm:block leading-tight">
            <div
              className={`text-[11px] font-semibold ${
                isModeActive
                  ? 'text-emerald-300'
                  : isModeRestricted
                  ? 'text-amber-300'
                  : 'text-rose-300'
              }`}
            >
              {isModeActive ? 'System Secure' : `Mode: ${controlPlaneState.mode}`}
            </div>
            <div className="text-[9px] text-slate-400 font-mono">
              Epoch #{controlPlaneState.epoch} · Ed25519
            </div>
          </div>
        </button>

        {/* Quick Deploy & Git Triggers */}
        <div className="hidden md:flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenVersionControl}
            title="Version Control & Commit History"
            className="mercury-press p-1.5 rounded-lg border border-slate-300/15 bg-slate-900/60 hover:border-cyan-400/40 text-slate-300 hover:text-cyan-200 cursor-pointer"
          >
            <GitBranch className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onOpenDeploy}
            title="Ed25519 Verified Deployment Pipeline"
            className="mercury-press p-1.5 rounded-lg border border-slate-300/15 bg-slate-900/60 hover:border-cyan-400/40 text-slate-300 hover:text-cyan-200 cursor-pointer"
          >
            <Rocket className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Live Tabular Clock & Date */}
        <div className="hidden sm:flex flex-col items-end leading-tight pl-2 border-l border-slate-200/15 tabular-nums">
          <span className="text-xs font-semibold text-slate-100 font-mono">{timeFormatted}</span>
          <span className="text-[10px] text-slate-400">{dateFormatted}</span>
        </div>
      </div>
    </header>
  );
};
