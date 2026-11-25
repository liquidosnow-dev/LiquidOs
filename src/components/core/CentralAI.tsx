import React, { useState } from 'react';
import { Sparkles, Bot, Zap, ChevronDown, MessageSquare } from 'lucide-react';
import { ModelOption } from '../../types';
import { SpatialDirection } from '../../utils/spatialNavigation';
import { MercurySphere } from '../MercurySphere';

interface CentralAIProps {
  activeDirection: SpatialDirection;
  selectedModel: ModelOption;
  selectedPersona: string;
  onSelectPersona: (persona: string) => void;
  isProcessing: boolean;
  autonomousMode: boolean;
  onToggleAutonomousMode: () => void;
  autonomousStatus: string | null;
  pendingSyncCount: number;
  onFocusConsole: () => void;
  onGoHome: () => void;
}

const QUICK_PERSONAS = [
  'Full-Stack App Builder',
  'LiquidOS System Architect',
  'Python Data Analyst',
  'Bug Hunter & Refactorer',
  'React UI Designer',
];

export const CentralAI: React.FC<CentralAIProps> = ({
  activeDirection,
  selectedModel,
  selectedPersona,
  onSelectPersona,
  isProcessing,
  autonomousMode,
  onToggleAutonomousMode,
  autonomousStatus,
  pendingSyncCount,
  onFocusConsole,
  onGoHome,
}) => {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const statusLine = isProcessing
    ? autonomousStatus || 'Synthesizing Workspace...'
    : 'Always Present · Always Aware';

  return (
    <div
      data-testid="central-ai-anchor"
      className="pointer-events-none max-lg:relative lg:absolute lg:left-1/2 lg:top-[48%] lg:-translate-x-1/2 lg:-translate-y-1/2 z-20 flex flex-col items-center justify-center shrink-0 py-2 lg:py-0"
    >
      {/* Orbital Aura Rings (Background ambient only, fixed center) */}
      <div
        aria-hidden="true"
        className="pointer-events-none hidden lg:flex items-center justify-center absolute w-[260px] h-[260px] rounded-full los-orbital-ring opacity-65"
      >
        <div className="w-[214px] h-[214px] rounded-full border border-cyan-300/20 shadow-[inset_0_0_24px_rgba(34,211,238,0.16)]" />
      </div>

      {/* Mobile Compact Persistent Anchor Strip + Desktop Centered Holographic Core */}
      <div className="pointer-events-auto relative flex lg:flex-col items-center gap-3 lg:gap-1.5 px-3 py-1.5 lg:p-0 rounded-2xl lg:rounded-none bg-slate-950/80 lg:bg-transparent border border-cyan-400/25 lg:border-0 backdrop-blur-md lg:backdrop-blur-none">
        {/* Core Avatar & Liquid Mercury Crest */}
        <button
          type="button"
          onClick={() => setPopoverOpen((prev) => !prev)}
          aria-expanded={popoverOpen}
          aria-label="Liquid AI Central Presence"
          className="group relative flex items-center justify-center w-12 h-12 lg:w-28 lg:h-28 rounded-full focus-visible:outline-none cursor-pointer"
        >
          {/* Outer metallic cybernetic bezel */}
          <span
            aria-hidden="true"
            className={`absolute inset-0 rounded-full border transition-all duration-300 ${
              isProcessing
                ? 'border-cyan-300/75 shadow-[0_0_32px_rgba(34,211,238,0.65)] scale-105'
                : 'border-cyan-400/40 shadow-[0_0_26px_rgba(34,211,238,0.35)] group-hover:border-cyan-300/70'
            }`}
          />

          {/* Sculpted Liquid Mercury Sphere base */}
          <div className="hidden lg:flex items-center justify-center absolute inset-1.5 rounded-full overflow-hidden bg-gradient-to-b from-[#07192b] via-[#040d1a] to-[#02050c] border border-slate-200/20">
            {/* Custom Vector Sovereign AI Silhouette */}
            <svg
              viewBox="0 0 120 120"
              className="w-full h-full"
              aria-hidden="true"
            >
              <defs>
                <radialGradient id="los-ai-halo" cx="50%" cy="42%" r="54%">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.45" />
                  <stop offset="65%" stopColor="#0ea5e9" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="#020617" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="los-ai-armor" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#334155" />
                  <stop offset="50%" stopColor="#0f172a" />
                  <stop offset="100%" stopColor="#1e293b" />
                </linearGradient>
                <linearGradient id="los-ai-visor" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="50%" stopColor="#e2e8f0" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r="56" fill="url(#los-ai-halo)" />
              {/* Collar & cybernetic shoulders */}
              <path
                d="M22 108 C24 85 40 77 60 77 C80 77 96 85 98 108 Z"
                fill="url(#los-ai-armor)"
                stroke="#38bdf8"
                strokeOpacity="0.45"
                strokeWidth="1.2"
              />
              {/* Glowing chest conduits */}
              <path
                d="M36 96 L48 87 M84 96 L72 87"
                stroke="#22d3ee"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              {/* Neck */}
              <rect x="52" y="65" width="16" height="16" rx="4" fill="#1e293b" />
              {/* Sculpted silver/obsidian head contour */}
              <path
                d="M42 48 C42 33 50 25 60 25 C70 25 78 33 78 48 C78 60 70 69 60 69 C50 69 42 60 42 48 Z"
                fill="#0f172a"
                stroke="#cbd5e1"
                strokeOpacity="0.48"
                strokeWidth="1.2"
              />
              {/* Mercury liquid-glass crest highlight */}
              <path
                d="M46 36 C51 28 69 28 74 36"
                fill="none"
                stroke="url(#los-ai-visor)"
                strokeWidth="1.8"
                strokeLinecap="round"
                opacity="0.85"
              />
              {/* Luminous eyes */}
              <circle cx="53" cy="48" r="2.2" fill="#67e8f9" />
              <circle cx="67" cy="48" r="2.2" fill="#67e8f9" />
              <path
                d="M55 58 Q60 61 65 58"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="lg:hidden">
            <MercurySphere size="md" isActive={isProcessing} label="Liquid AI Presence" />
          </div>
        </button>

        {/* Identity & Live Status */}
        <div className="flex flex-col lg:items-center text-left lg:text-center">
          <div className="flex items-center gap-1.5">
            <span className="text-xs lg:text-sm font-bold tracking-[0.2em] text-cyan-300">
              LIQUID AI
            </span>
            {pendingSyncCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-400/40 text-[9px] font-mono text-amber-200">
                {pendingSyncCount} sync
              </span>
            )}
          </div>
          <p className="text-[10px] lg:text-[11px] text-slate-300 max-w-[200px] truncate">
            {statusLine}
          </p>

          {/* Infinity Emblem Badge + Active State Trigger */}
          <button
            type="button"
            onClick={() => setPopoverOpen((prev) => !prev)}
            className="mt-0.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-950/75 border border-cyan-400/30 hover:border-cyan-300/60 text-[10px] text-slate-200 cursor-pointer"
          >
            <svg viewBox="0 0 36 18" className="w-5 h-2.5" aria-hidden="true">
              <path
                d="M9.5 14c-3 0-5.5-2.2-5.5-5s2.5-5 5.5-5c4.2 0 7.2 10 11.5 10 3 0 5.5-2.2 5.5-5s-2.5-5-5.5-5c-4.2 0-7.2 10-11.5 10Z"
                transform="translate(2.5 0)"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
            <span className="font-mono text-[9px] text-cyan-200 uppercase">
              {activeDirection}
            </span>
            <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
          </button>
        </div>

        {/* Contextual Agent Communication Popover */}
        {popoverOpen && (
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-72 rounded-2xl los-glass-elevated p-3 z-50 text-left animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/15">
              <div className="flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-cyan-300" />
                <span className="text-xs font-semibold text-slate-100">
                  Sovereign AI Core
                </span>
              </div>
              <span className="text-[10px] font-mono text-cyan-300">
                {selectedModel.name}
              </span>
            </div>

            <div className="mt-2.5 space-y-2.5">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Active Agent Persona
                </label>
                <div className="flex flex-wrap gap-1">
                  {QUICK_PERSONAS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onSelectPersona(p)}
                      className={`px-2 py-1 rounded-md text-[10px] border transition-colors cursor-pointer ${
                        selectedPersona === p
                          ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                          : 'bg-slate-900/60 border-slate-700/60 text-slate-300 hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-950/60 border border-slate-300/15 px-2.5 py-2">
                <div>
                  <div className="text-[11px] font-medium text-slate-100 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-cyan-300" />
                    RecursiveEngine Auto-Loop
                  </div>
                  <div className="text-[9px] text-slate-400">
                    Multi-step Ed25519 attested synthesis
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onToggleAutonomousMode}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border cursor-pointer ${
                    autonomousMode
                      ? 'bg-emerald-950/70 border-emerald-500/45 text-emerald-300'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  {autonomousMode ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setPopoverOpen(false);
                    onFocusConsole();
                  }}
                  className="mercury-press flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/45 text-xs font-medium text-cyan-100 hover:bg-cyan-500/30 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Command Console
                </button>
                {activeDirection !== 'HOME' && (
                  <button
                    type="button"
                    onClick={() => {
                      setPopoverOpen(false);
                      onGoHome();
                    }}
                    className="mercury-press px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-300/20 text-xs text-slate-200 hover:border-slate-200/40 cursor-pointer"
                  >
                    Home
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
