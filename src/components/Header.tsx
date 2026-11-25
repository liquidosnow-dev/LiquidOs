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
  Brain,
  Wrench,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { MercurySphere } from './MercurySphere';
import { MercuryEdgeRipple } from './MercuryEdgeRipple';
import { MercuryTooltip } from './MercuryTooltip';
import { MercuryFrameGlow } from './MercuryFrameGlow';
import { useMercuryFrameGlow } from '../hooks/useMercuryFrameGlow';

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
  const { frameRef: headerFrameRef, glowHandlers: headerGlowHandlers } = useMercuryFrameGlow<HTMLElement>();

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
    <header
      ref={headerFrameRef}
      {...headerGlowHandlers}
      data-mercury-panel="header"
      className="relative h-14 glass-surface-1 border-x-0 border-t-0 rounded-b-2xl px-3 sm:px-4 flex items-center justify-between text-slate-100 shrink-0 z-30 font-sans gap-3"
    >
      <MercuryFrameGlow />
      <MercuryEdgeRipple variant="dual" delaySeconds={0.4} durationSeconds={14} rx={16} />
      {/* Zone 1: Brand Identity & Multi-Model Selector */}
      <div className="relative z-10 flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 sm:flex-initial">
        {onToggleMobileSidebar && (
          <MercuryTooltip content="Open workspace navigation drawer" placement="bottom">
            <button
              type="button"
              onClick={onToggleMobileSidebar}
              className="mercury-press p-1.5 rounded-xl glass-surface-2 text-slate-300 hover:text-white lg:hidden cursor-pointer shrink-0"
              aria-label="Toggle Sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>
          </MercuryTooltip>
        )}

        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink-0">
          <MercurySphere size="sm" label="LiquidOS ONE Mercury Sphere" />
          <div className="leading-tight hidden sm:block min-w-0">
            <div className="flex items-center gap-2 font-bold text-sm tracking-tight text-white whitespace-nowrap">
              <span>LiquidOS ONE</span>
              <span className="text-[11px] font-mono text-cyan-300 font-normal">AN-EVC-001</span>
            </div>
            <div className="text-[11px] text-slate-400 font-normal truncate max-w-[180px]">
              {project.name}
            </div>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-700/70 hidden md:block shrink-0" />

        {/* Multi-Model Selector Dropdown with Codex Capability Badges */}
        <div className="relative min-w-0 sm:shrink-0">
          <MercuryTooltip content="Switch reasoning, tool-calling, and Puter AI models" placement="bottom" className="max-w-full min-w-0">
            <button
              type="button"
              data-testid="model-selector-trigger"
              onClick={() => {
                setIsModelDropdownOpen((v) => !v);
                setIsArchitectureMenuOpen(false);
              }}
              className="mercury-press flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl glass-surface-2 hover:border-slate-300/40 text-xs cursor-pointer whitespace-nowrap max-w-[152px] sm:max-w-none min-w-0"
              aria-expanded={isModelDropdownOpen}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <span className="font-semibold text-slate-100 truncate">{selectedModel.name}</span>
            <span className="hidden md:inline-flex items-center gap-1 pl-1 border-l border-white/10">
              {selectedModel.supportsTools && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/30 text-[10px] font-mono text-cyan-300"
                  title="Supports Codex Tool Calling"
                >
                  <Wrench className="w-2.5 h-2.5" />
                  <span>Tools</span>
                </span>
              )}
              {selectedModel.supportsReasoning && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-500/15 border border-violet-400/30 text-[10px] font-mono text-violet-300"
                  title="Supports Deep Reasoning"
                >
                  <Brain className="w-2.5 h-2.5" />
                  <span>Reason</span>
                </span>
              )}
            </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
          </MercuryTooltip>

          {isModelDropdownOpen && (
            <div
              data-testid="model-selector-menu"
              className="mercury-crest-panel absolute left-0 mt-1.5 w-96 max-w-[92vw] glass-surface-2 rounded-2xl p-2 z-50 space-y-1 max-h-[75vh] overflow-y-auto shadow-2xl"
            >
              <div className="px-2.5 py-1 flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <span>Codex Multi-Model Selector</span>
                <span className="font-mono text-[10px] text-cyan-400 normal-case">Puter &amp; Edge Ready</span>
              </div>
              {availableModels.map((model) => {
                const isSelected = model.id === selectedModel.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    data-testid={`model-option-${model.id}`}
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
                    <div className="space-y-1.5 min-w-0 pr-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-white truncate">{model.name}</span>
                        <span className="text-[11px] font-mono text-slate-400 shrink-0">
                          {model.provider}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{model.description}</p>
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono ${
                            model.supportsTools
                              ? 'bg-cyan-500/15 border-cyan-500/35 text-cyan-300'
                              : 'bg-slate-900/70 border-slate-700/70 text-slate-500'
                          }`}
                        >
                          <Wrench className="w-2.5 h-2.5" />
                          <span>{model.supportsTools ? 'Tool Calling' : 'No Tools'}</span>
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono ${
                            model.supportsReasoning
                              ? 'bg-violet-500/15 border-violet-500/35 text-violet-300'
                              : 'bg-slate-900/70 border-slate-700/70 text-slate-500'
                          }`}
                        >
                          <Brain className="w-2.5 h-2.5" />
                          <span>{model.supportsReasoning ? 'Reasoning' : 'Standard'}</span>
                        </span>
                        {model.supportsPuter && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-emerald-500/35 bg-emerald-500/10 text-[10px] font-mono text-emerald-300">
                            Puter
                          </span>
                        )}
                        {model.badges.slice(0, 2).map((badge) => (
                          <span
                            key={badge}
                            className="text-[10px] font-mono text-slate-400"
                          >
                            · {badge}
                          </span>
                        ))}
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
      <div className="relative z-10 flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Version Control */}
        <MercuryTooltip content="Git branches, commit history, and rollback controls" placement="bottom" className="hidden sm:inline-flex">
          <button
            type="button"
            onClick={onOpenVersionControl}
            className="mercury-press flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl glass-surface-1 text-xs text-slate-200 cursor-pointer whitespace-nowrap"
            aria-label="Git Version Control & Commits"
          >
            <GitBranch className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="font-mono text-[11px] hidden sm:inline">{project.currentBranch}</span>
            <span className="font-mono tabular-nums text-slate-400 text-[11px] hidden lg:inline">
              · {project.commits.length}
            </span>
          </button>
        </MercuryTooltip>

        {/* Consolidated 6-Pillar Architecture Menu */}
        <div className="relative hidden sm:block">
          <MercuryTooltip content="Inspect system architecture pillars and runtime blueprints" placement="bottom">
            <button
              type="button"
              onClick={() => {
                setIsArchitectureMenuOpen((v) => !v);
                setIsModelDropdownOpen(false);
              }}
              className="mercury-press flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl glass-surface-1 text-xs text-slate-200 cursor-pointer whitespace-nowrap"
              aria-label="Open System Architecture Modules & Blueprints"
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="hidden md:inline">System Pillars</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
          </MercuryTooltip>

          {isArchitectureMenuOpen && (
            <div className="mercury-crest-panel absolute right-0 mt-1.5 w-72 glass-surface-2 rounded-2xl p-1.5 z-50 space-y-1">
              <button
                type="button"
                onClick={() => {
                  onOpenArchitecture();
                  setIsArchitectureMenuOpen(false);
                }}
                className="mercury-press w-full px-2.5 py-2 rounded-xl text-left hover:bg-slate-800/80 transition-colors flex items-center justify-between cursor-pointer"
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
                    className="mercury-press w-full px-2.5 py-2 rounded-xl text-left hover:bg-slate-800/80 transition-colors flex items-center gap-2.5 cursor-pointer"
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
        <MercuryTooltip content="Security protocols, MFA matrix, and key custody" placement="bottom">
          <button
            type="button"
            onClick={onOpenSecurity}
            className="mercury-press hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl glass-surface-1 text-xs text-slate-200 cursor-pointer whitespace-nowrap"
            aria-label="Security Protocols & MFA Matrix"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="hidden lg:inline">AES-256 · MFA</span>
          </button>
        </MercuryTooltip>

        {/* Sandbox Specs & Metrics */}
        {onOpenMetrics && (
          <MercuryTooltip content="Live sandbox CPU, GPU, and RAM telemetry (4 CPU / 8 GB)" placement="bottom">
            <button
              type="button"
              onClick={onOpenMetrics}
              className="mercury-press hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl glass-surface-1 text-xs text-slate-200 cursor-pointer whitespace-nowrap font-mono tabular-nums"
              aria-label="Sandbox CPU/GPU & RAM Metrics"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{sandboxPlan} :8787</span>
            </button>
          </MercuryTooltip>
        )}

        {/* Tutorial Quick Trigger */}
        {onOpenTutorial && (
          <MercuryTooltip content="Open interactive handoff and system walkthrough" placement="bottom">
            <button
              type="button"
              onClick={onOpenTutorial}
              className="mercury-press hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl glass-surface-1 text-xs text-slate-200 hover:text-white cursor-pointer whitespace-nowrap"
              aria-label="Open Handoff Tutorial"
            >
              <BookOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Tutorial</span>
            </button>
          </MercuryTooltip>
        )}

        {/* Settings */}
        <MercuryTooltip content="Inference hyperparameters & LiteRT edge configuration" placement="bottom">
          <button
            type="button"
            onClick={onOpenSettings}
            className="mercury-press p-2 rounded-xl glass-surface-1 text-slate-300 hover:text-white cursor-pointer shrink-0"
            aria-label="Apollo Hyperparameters & Settings"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </MercuryTooltip>

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

        {/* PWA Install Prompt */}
        <PWAInstallButton />

        {/* Publish & Deploy CTA */}
        {onOpenPublish ? (
          <MercuryTooltip content="Publish to Genspark Hosting, Cloudflare Edge, or GitHub" placement="bottom">
            <button
              type="button"
              onClick={onOpenPublish}
              className="mercury-press flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600/90 to-slate-700/90 hover:from-cyan-500 hover:to-slate-600 border border-slate-200/25 text-white font-semibold text-xs cursor-pointer whitespace-nowrap shrink-0"
            >
              <Rocket className="w-3.5 h-3.5 shrink-0" />
              <span>Publish</span>
            </button>
          </MercuryTooltip>
        ) : (
          <MercuryTooltip content="Verify Ed25519 receipt and deploy to Cloudflare" placement="bottom">
            <button
              type="button"
              onClick={onOpenDeploy}
              className="mercury-press flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600/90 to-slate-700/90 hover:from-cyan-500 hover:to-slate-600 border border-slate-200/25 text-white font-semibold text-xs cursor-pointer whitespace-nowrap shrink-0"
            >
              <Rocket className="w-3.5 h-3.5 shrink-0" />
              <span>Deploy</span>
            </button>
          </MercuryTooltip>
        )}
      </div>
    </header>
  );
};
