import React, { useState } from 'react';
import {
  Shield,
  Database,
  Cpu,
  Layers,
  HardDrive,
  CheckCircle2,
  AlertOctagon,
  Terminal,
  ShieldAlert,
  Network,
  Box,
  Key,
  Lock,
  ArrowRight,
  GitBranch,
  Sliders,
  Sparkles,
  ExternalLink
} from 'lucide-react';

interface ArchitectureViewProps {
  onOpenIngressShield?: () => void;
  onOpenManifest?: () => void;
  onOpenEnterpriseMcp?: () => void;
  onOpenKineticMonolith?: () => void;
}

export const ArchitectureView: React.FC<ArchitectureViewProps> = ({
  onOpenIngressShield,
  onOpenManifest,
  onOpenEnterpriseMcp,
  onOpenKineticMonolith,
}) => {
  const [selectedDiagram, setSelectedDiagram] = useState<
    'pipeline_infographic' | 'liquid_os_kmp' | 'apollo_settings' | 'agents_toolkit' | 'lovable_ide'
  >('pipeline_infographic');
  const [activeBarrier, setActiveBarrier] = useState<string | null>('security');

  const diagrams = [
    {
      id: 'pipeline_infographic',
      title: 'Pi Pipeline Hook Router & Sandbox Architecture',
      subtitle: 'Ingress, Hardware MTU Barriers, Direct Fallback Paths & State Transitions',
      assetPath: '/assets/aistudio/Pipeline_Hook_Router_Sandbox_Architecture_b8f41492.png',
      badge: 'INFOGRAPHIC · KEY ARCHITECTURE',
    },
    {
      id: 'liquid_os_kmp',
      title: 'Liquid OS Full System Diagram',
      subtitle: 'Pi Hook Router, Mercury Vault, Mobile KMP Core & Kernel Substrate',
      assetPath: '/assets/aistudio/IMG_0031_9de50447.jpeg',
      badge: 'KERNEL & STORAGE',
    },
    {
      id: 'agents_toolkit',
      title: "The Agent's Toolkit Patterns",
      subtitle: 'Tool-Calling, ReAct Loop, RAG, MCP Protocol, Multi-Agent & Computer Use',
      assetPath: '/assets/aistudio/IMG_0018_21016a14.png',
      badge: 'AGENT ENGINE',
    },
    {
      id: 'apollo_settings',
      title: 'Apollo Model Hyperparameters',
      subtitle: 'Temperature, Top P, Seed, Max Output, Min P & Repetition Penalty',
      assetPath: '/assets/aistudio/IMG_0010_22388209.png',
      badge: 'INFERENCE PARAMS',
    },
    {
      id: 'lovable_ide',
      title: 'Lovable LiquidOS Split-Screen IDE',
      subtitle: 'Builder preferences, Chat Stream & Live Responsive Preview',
      assetPath: '/assets/aistudio/IMG_0032_ecfc52d0.png',
      badge: 'WORKSPACE IDE',
    },
  ];

  const currentDiagram = diagrams.find(d => d.id === selectedDiagram) || diagrams[0];

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 overflow-y-auto p-4 md:p-6 space-y-6 font-sans">
      
      {/* Master 6-Pillar Overview Hero */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-cyan-800/60 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold">
                TOTAL ARCHITECTURAL UPGRADE · 16 SOURCES SYNTHESIZED
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                8 BOUNDARIES VERIFIED (100% UNIT TESTS)
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white mt-1.5">
              LiquidOS · Pi Pipeline Hook Router & Multi-Engine Storage Vault
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Consolidating Five-Ring Ingress Shields, Single-Width Ed25519 Gate, Multi-Engine Storage Vault (Encrypted SQLite, DuckDB, LanceDB, Audit Ledger), 5-Stage State Machine with MANIFEST.json v1.1, Enterprise Connectors & MCP v1.2, and On-Device Duality.SI Engine.
            </p>
          </div>

          {/* Quick Pillar Launch Action Stack */}
          <div className="flex flex-wrap items-center gap-2">
            {onOpenIngressShield && (
              <button
                onClick={onOpenIngressShield}
                className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Ingress 39 Shield
              </button>
            )}
            {onOpenManifest && (
              <button
                onClick={onOpenManifest}
                className="px-3 py-1.5 rounded-lg bg-purple-950/80 hover:bg-purple-900 border border-purple-700/60 text-purple-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <Layers className="w-3.5 h-3.5" />
                Manifest v1.1
              </button>
            )}
            {onOpenEnterpriseMcp && (
              <button
                onClick={onOpenEnterpriseMcp}
                className="px-3 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 border border-amber-700/60 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <Network className="w-3.5 h-3.5" />
                Enterprise & MCP
              </button>
            )}
            {onOpenKineticMonolith && (
              <button
                onClick={onOpenKineticMonolith}
                className="px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <Box className="w-3.5 h-3.5" />
                Kinetic Monolith
              </button>
            )}
          </div>
        </div>

        {/* 6 Core Pillars Architecture Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t border-slate-800/80 text-xs">
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="font-bold text-rose-400 flex items-center gap-1.5 mb-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              1. Five-Ring Ingress Barrier
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              39 iOS entry points intercepted by 4 standing daemons (D-Ingress, D-Peripheral, D-Extension, D-System). Single-Width Gate (width=1, Ed25519 signed).
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="font-bold text-cyan-400 flex items-center gap-1.5 mb-1">
              <Cpu className="w-3.5 h-3.5" />
              2. Pi Pipeline & Liquid Vault
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Kernel SO_PEERCRED checks, 3 barriers (Security, 1,232B MTU & 10k Scan Rows, Vector latency). 4 engines: Encrypted SQLite, DuckDB OLAP, LanceDB, Ledger.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="font-bold text-purple-400 flex items-center gap-1.5 mb-1">
              <Layers className="w-3.5 h-3.5" />
              3. 5-Stage Lifecycle & Rollback
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              PREPARED ➔ SIGNED ➔ PERSISTED ➔ READ ➔ CONFIRMED. MANIFEST.json v1.1 claim ledger (10 fields). ROLLBACK_TO_SOURCE discards staging files safely.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="font-bold text-amber-400 flex items-center gap-1.5 mb-1">
              <Network className="w-3.5 h-3.5" />
              4. Enterprise Connectors & MCP
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Google Enterprise (Drive, Gmail, BigQuery, AlloyDB, GCS, Spanner) + 3P (M365, Jira, GitHub, Slack). MCP v1.2: Doorway, Room, Key, Checkpoint.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              5. On-Device Duality.SI Engine
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              iPad A16 ~2.8GB RAM envelope (increased-memory-limit). Dual stream (Focused temp 0.1 vs Exploratory temp 0.85). 30-40 daemons Notepad Constraint.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="font-bold text-blue-400 flex items-center gap-1.5 mb-1">
              <Box className="w-3.5 h-3.5" />
              6. Control Surfaces & Hardware Truths
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Origin Console (mercurysi.lovable.app) & Kinetic Monolith (liquidos-mercurysi.base44.app). 4 physical hardware truths & unit test boundaries.
            </p>
          </div>
        </div>
      </div>

      {/* Blueprint Diagram Viewer Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-2xl">
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/80 font-mono">
                {currentDiagram.badge}
              </span>
              <h3 className="text-sm font-bold text-white">{currentDiagram.title}</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{currentDiagram.subtitle}</p>
          </div>

          {/* Diagram Switcher Tabs */}
          <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {diagrams.map(d => (
              <button
                key={d.id}
                onClick={() => setSelectedDiagram(d.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  selectedDiagram === d.id
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {d.title.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Image Rendering */}
        <div className="p-4 bg-slate-950/80 flex items-center justify-center min-h-[380px] overflow-auto">
          <img
            src={currentDiagram.assetPath}
            alt={currentDiagram.title}
            className="max-h-[520px] w-auto object-contain rounded-xl border border-slate-800/80 shadow-2xl transition-transform hover:scale-[1.01]"
          />
        </div>
      </div>

      {/* Interactive Execution Barriers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Subsystem 1: Hook Router */}
        <div
          onClick={() => setActiveBarrier('security')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activeBarrier === 'security'
              ? 'bg-cyan-950/40 border-cyan-500 shadow-lg shadow-cyan-950/50'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold text-cyan-400 flex items-center gap-1.5">
              <Shield className="w-4 h-4" /> [SECURITY BARRIER]
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-sm font-bold text-white">Pi Hook Router</div>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Extracts kernel-anchored socket credentials (`SO_PEERCRED`) and evaluates Query AST allow-lists with Ed25519 single-width signatures.
          </p>
        </div>

        {/* Subsystem 2: Memory MTU & 10k Scan Row Threshold */}
        <div
          onClick={() => setActiveBarrier('mtu')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activeBarrier === 'mtu'
              ? 'bg-amber-950/40 border-amber-500 shadow-lg shadow-amber-950/50'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <Cpu className="w-4 h-4" /> [MEMORY MTU BARRIER]
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950 text-amber-300">1,232 B · 10k Rows</span>
          </div>
          <div className="text-sm font-bold text-white">DuckDB OLAP Columnar</div>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Enforces 1,232-byte network MTU framing caps and a configurable 10,000 max scan row threshold to prevent unified memory overflow.
          </p>
        </div>

        {/* Subsystem 3: Vector Index Barrier */}
        <div
          onClick={() => setActiveBarrier('vector')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activeBarrier === 'vector'
              ? 'bg-purple-950/40 border-purple-500 shadow-lg shadow-purple-950/50'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold text-purple-400 flex items-center gap-1.5">
              <Database className="w-4 h-4" /> [VECTOR INDEX BARRIER]
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950 text-purple-300">1536-dim · 5ms</span>
          </div>
          <div className="text-sm font-bold text-white">LanceDB HNSW Store</div>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Vector latency bounds strictly capped at 5.0ms with cosine distance and 64-hop graph limits prior to dense retrieval.
          </p>
        </div>

        {/* Subsystem 4: Tamper-Evident Ledger */}
        <div
          onClick={() => setActiveBarrier('ledger')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activeBarrier === 'ledger'
              ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-950/50'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4" /> SHA-256 AUDIT LEDGER
            </span>
            <span className="text-[10px] font-mono text-emerald-400">STATE 5/5</span>
          </div>
          <div className="text-sm font-bold text-white">Cryptographic Chain</div>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            5-Stage state machine: PREPARED ➔ SIGNED ➔ PERSISTED ➔ READ ➔ CONFIRMED. Triggers automatic ROLLBACK_TO_SOURCE on fault.
          </p>
        </div>
      </div>
    </div>
  );
};
