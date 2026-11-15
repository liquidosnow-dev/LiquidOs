import React, { useState } from 'react';
import { ModelOption, Collaborator, Project } from '../types';
import {
  Cpu,
  Shield,
  GitBranch,
  Rocket,
  Sliders,
  ChevronDown,
  Check,
  Sparkles,
  Menu,
  ShieldAlert,
  Layers,
  Network,
  Box,
  BookOpen,
  Smartphone,
  Activity,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  selectedModel: ModelOption;
  availableModels: ModelOption[];
  onSelectModel: (model: ModelOption) => void;
  collaborators: Collaborator[];
  project: Project;
  onOpenVersionControl: () => void;
  onOpenSecurity: () => void;
  onOpenDeploy: () => void;
  onOpenSettings: () => void;
  onOpenArchitecture: () => void;
  onOpenIngressShield?: () => void;
  onOpenManifest?: () => void;
  onOpenEnterpriseMcp?: () => void;
  onOpenKineticMonolith?: () => void;
  onOpenSourceInventory?: () => void;
  onOpenModelAllowlist?: () => void;
  onOpenPublish?: () => void;
  onOpenMetrics?: () => void;
  onOpenTerminal?: () => void;
  onOpenTutorial?: () => void;
  sandboxPlan?: string;
  onToggleMobileSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedModel,
  availableModels,
  onSelectModel,
  collaborators,
  project,
  onOpenVersionControl,
  onOpenSecurity,
  onOpenDeploy,
  onOpenSettings,
  onOpenArchitecture,
  onOpenIngressShield,
  onOpenManifest,
  onOpenEnterpriseMcp,
  onOpenKineticMonolith,
  onOpenSourceInventory,
  onOpenModelAllowlist,
  onOpenPublish,
  onOpenMetrics,
  onOpenTutorial,
  sandboxPlan = 'Pro',
  onToggleMobileSidebar,
}) => {
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isArchitectureMenuOpen, setIsArchitectureMenuOpen] = useState(false);

  const architecturePillars = [
    {
      label: 'Five-Ring Ingress Shield',
      meta: '39 iOS Entry Points · 4 Daemons',
      icon: ShieldAlert,
      accent: 'text-rose-400',
      action: onOpenIngressShield,
    },
    {
      label: 'Wayopen MANIFEST v1.1',
      meta: '5-Stage Handoff & Rollback',
      icon: Layers,
      accent: 'text-purple-400',
      action: onOpenManifest,
    },
    {
      label: 'Enterprise & MCP v1.2',
      meta: 'Google + 3P Workspace Bridge',
      icon: Network,
      accent: 'text-amber-400',
      action: onOpenEnterpriseMcp,
    },
    {
      label: 'Kinetic Monolith & Duality.SI',
      meta: '~2.8 GB Peak RAM · iPad A16',
      icon: Box,
      accent: 'text-cyan-400',
      action: onOpenKineticMonolith,
    },
    {
      label: '17 Active Sources & A2A',
      meta: 'Repo Index · 24 Unit Tests',
      icon: BookOpen,
      accent: 'text-emerald-400',
      action: onOpenSourceInventory,
    },
    {
      label: 'LiteRT-LM Edge Allowlist',
      meta: '13 On-Device Models · Gemma 4',
      icon: Smartphone,
      accent: 'text-indigo-400',
      action: onOpenModelAllowlist,
    },
  ].filter((item) => Boolean(item.action));

  return (
    <header className="h-14 glass-surface-1 border-x-0 border-t-0 px-3 sm:px-4 flex items-center justify-between text-slate-100 shrink-0 z-30 font-sans gap-3">
      {/* Zone 1: Brand Identity & Multi-Model Selector */}
      <div className="flex items-center gap-2.5 min-w-0">
        {onToggleMobileSidebar && (
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white lg:hidden cursor-pointer shrink-0"
            title="Toggle Sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-white font-mono font-bold text-xs shadow-sm shrink-0">
            1
          </div>
          <div className="leading-tight hidden sm:block min-w-0">
            <div className="flex items-center gap-2 font-bold text-sm tracking-tight text-white whitespace-nowrap">
              <span>LiquidOS ONE</span>
              <span className="text-[11px] font-mono text-cyan-400 font-normal">AN-EVC-001</span>
            </div>
            <div className="text-[11px] text-slate-400 font-normal truncate max-w-[180px]">
              {project.name}
            </div>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-800 hidden md:block shrink-0" />

        {/* Model Selector Dropdown */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsModelDropdownOpen((v) => !v);
              setIsArchitectureMenuOpen(false);
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass-surface-2 hover:border-cyan-400/50 text-xs transition-all cursor-pointer whitespace-nowrap"
            aria-expanded={isModelDropdownOpen}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="font-semibold text-slate-100">{selectedModel.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {isModelDropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-80 glass-surface-2 rounded-xl p-2 z-50 space-y-1 max-h-[75vh] overflow-y-auto">
              <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Select Reasoning &amp; Tool Model
              </div>
              {availableModels.map((model) => {
                const isSelected = model.id === selectedModel.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      onSelectModel(model);
                      setIsModelDropdownOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-lg text-left transition-colors flex items-start justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-950/60 border border-cyan-500/50 text-white'
                        : 'hover:bg-slate-800/70 text-slate-300 border border-transparent'
                    }`}
                  >
                    <div className="space-y-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-white truncate">{model.name}</span>
                        <span className="text-[11px] font-mono text-slate-400 shrink-0">
                          {model.provider}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{model.description}</p>
                      <div className="text-[10px] font-mono text-cyan-400">
                        {model.badges.join(' · ')}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Zone 2 & 3: Consolidated Navigation & Primary CTA */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Version Control */}
        <button
          type="button"
          onClick={onOpenVersionControl}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-surface-1 hover:border-white/20 text-xs text-slate-200 transition-all cursor-pointer whitespace-nowrap"
          title="Git Version Control & Commits"
        >
          <GitBranch className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="font-mono text-[11px] hidden sm:inline">{project.currentBranch}</span>
          <span className="font-mono tabular-nums text-slate-400 text-[11px] hidden lg:inline">
            · {project.commits.length}
          </span>
        </button>

        {/* Consolidated 6-Pillar Architecture Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsArchitectureMenuOpen((v) => !v);
              setIsModelDropdownOpen(false);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-surface-1 hover:border-white/20 text-xs text-slate-200 transition-all cursor-pointer whitespace-nowrap"
            title="Open System Architecture Modules & Blueprints"
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="hidden md:inline">System Pillars</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {isArchitectureMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-72 glass-surface-2 rounded-xl p-1.5 z-50 space-y-1">
              <button
                type="button"
                onClick={() => {
                  onOpenArchitecture();
                  setIsArchitectureMenuOpen(false);
                }}
                className="w-full px-2.5 py-2 rounded-lg text-left hover:bg-slate-800 transition-colors flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="text-xs font-semibold text-white">Pi Pipeline &amp; Vault Blueprint</div>
                  <div className="text-[11px] text-slate-400">SQLite WAL · DuckDB · LanceDB workspace</div>
                </div>
                <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />
              </button>

              <div className="h-px bg-slate-800 my-1" />

              {architecturePillars.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <button
                    key={pillar.label}
                    type="button"
                    onClick={() => {
                      pillar.action?.();
                      setIsArchitectureMenuOpen(false);
                    }}
                    className="w-full px-2.5 py-2 rounded-lg text-left hover:bg-slate-800 transition-colors flex items-center gap-2.5 cursor-pointer"
                  >
                    <Icon className={`w-4 h-4 ${pillar.accent} shrink-0`} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-200 truncate">{pillar.label}</div>
                      <div className="text-[11px] text-slate-400 truncate">{pillar.meta}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Security / MFA */}
        <button
          type="button"
          onClick={onOpenSecurity}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-surface-1 hover:border-white/20 text-xs text-slate-200 transition-all cursor-pointer whitespace-nowrap"
          title="Security Protocols & MFA Matrix"
        >
          <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="hidden lg:inline">AES-256 · MFA</span>
        </button>

        {/* Sandbox Specs & Metrics */}
        {onOpenMetrics && (
          <button
            type="button"
            onClick={onOpenMetrics}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-surface-1 hover:border-white/20 text-xs text-slate-200 transition-all cursor-pointer whitespace-nowrap font-mono tabular-nums"
            title="Sandbox CPU/GPU & RAM Metrics (4 CPU / 8 GB)"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{sandboxPlan} :8787</span>
          </button>
        )}

        {/* Tutorial Quick Trigger */}
        {onOpenTutorial && (
          <button
            type="button"
            onClick={onOpenTutorial}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-surface-1 hover:border-white/20 text-xs text-slate-200 hover:text-white transition-all cursor-pointer whitespace-nowrap"
            title="Open Handoff Tutorial"
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Tutorial</span>
          </button>
        )}

        {/* Settings */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-2 rounded-lg glass-surface-1 hover:border-white/20 text-slate-300 hover:text-white transition-all cursor-pointer shrink-0"
          title="Apollo Hyperparameters & Settings"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>

        {/* Collaborator Avatars */}
        <div className="hidden xl:flex items-center -space-x-2 px-1 shrink-0" title="Active Collaborators">
          {collaborators.slice(0, 3).map((c) => (
            <div
              key={c.id}
              className={`w-7 h-7 rounded-full border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-white ${c.avatarColor}`}
              title={`${c.name} (${c.email}) - ${c.status}`}
            >
              {c.name[0]}
            </div>
          ))}
        </div>

        {/* PWA Install Prompt (renders when browser fires beforeinstallprompt or on iOS) */}
        <PWAInstallButton />

        {/* Publish & Deploy CTA */}
        {onOpenPublish ? (
          <button
            type="button"
            onClick={onOpenPublish}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Rocket className="w-3.5 h-3.5 shrink-0" />
            <span>Publish</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenDeploy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Rocket className="w-3.5 h-3.5 shrink-0" />
            <span>Deploy</span>
          </button>
        )}
      </div>
    </header>
  );
};
