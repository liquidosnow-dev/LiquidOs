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
  Users,
  Menu,
  ShieldAlert,
  Layers,
  Network,
  Box,
  BookOpen,
  Smartphone,
} from 'lucide-react';

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
  onToggleMobileSidebar,
}) => {
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-3 sm:px-4 flex items-center justify-between text-slate-100 shrink-0 z-30 font-sans">
      {/* Brand & Project info */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onToggleMobileSidebar && (
          <button
            onClick={onToggleMobileSidebar}
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white lg:hidden cursor-pointer"
            title="Toggle Sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-md shrink-0">
            💧
          </div>
          <div className="leading-tight hidden sm:block">
            <div className="flex items-center gap-1.5 font-bold text-sm tracking-tight text-white">
              <span>Codex & LiquidOS</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                PRO
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-normal truncate max-w-[140px]">
              {project.name}
            </div>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-800 hidden md:block" />

        {/* Multi-Model Selector with Codex Badges */}
        <div className="relative">
          <button
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-xs transition-colors cursor-pointer"
            aria-expanded={isModelDropdownOpen}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold text-slate-200">{selectedModel.name}</span>
            <div className="hidden lg:flex items-center gap-1">
              {selectedModel.badges.slice(0, 2).map((b, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.2 text-[10px] font-mono rounded bg-slate-900 border border-slate-800 text-cyan-300"
                >
                  {b}
                </span>
              ))}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
          </button>

          {/* Model Dropdown Menu */}
          {isModelDropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-fade-in space-y-1">
              <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Select Model & Reasoning Engine
              </div>
              {availableModels.map(model => {
                const isSelected = model.id === selectedModel.id;
                return (
                  <button
                    key={model.id}
                    onClick={() => {
                      onSelectModel(model);
                      setIsModelDropdownOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl text-left transition-all flex items-start justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-950/60 border border-cyan-500/50 text-white'
                        : 'hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{model.name}</span>
                        <span className="text-[10px] font-mono px-1 rounded bg-slate-800 text-slate-400">
                          {model.provider}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{model.description}</p>
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {model.badges.map((b, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-slate-950 border border-slate-800 text-cyan-400"
                          >
                            {b}
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

      {/* Right Action Stack */}
      <div className="flex items-center gap-2">
        {/* Real-time Collaborators Avatars */}
        <div className="hidden md:flex items-center -space-x-2 mr-2" title="Active Collaborators (Real-Time)">
          {collaborators.map(c => (
            <div
              key={c.id}
              className={`w-7 h-7 rounded-full border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-white shadow-sm relative ${c.avatarColor}`}
              title={`${c.name} (${c.email}) - ${c.status}`}
            >
              {c.name[0]}
              <span
                className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-slate-900 ${
                  c.status === 'online' ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
            </div>
          ))}
        </div>

        {/* Version Control Badge Button */}
        <button
          onClick={onOpenVersionControl}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition-colors"
          title="Git Version Control & Commits"
        >
          <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-mono text-[11px] hidden sm:inline">{project.currentBranch}</span>
          <span className="text-slate-500 text-[10px] hidden lg:inline">
            ({project.commits.length} commits)
          </span>
        </button>

        {/* Ingress Shield Button */}
        {onOpenIngressShield && (
          <button
            onClick={onOpenIngressShield}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
            title="Five-Ring Ingress Barrier (39 Entry Points & 4 Daemons)"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Ingress 39</span>
          </button>
        )}

        {/* Wayopen Manifest & 5-Stage Handoff */}
        {onOpenManifest && (
          <button
            onClick={onOpenManifest}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
            title="Handoff State Machine & MANIFEST.json v1.1"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Manifest v1.1</span>
          </button>
        )}

        {/* Enterprise Connectors & MCP */}
        {onOpenEnterpriseMcp && (
          <button
            onClick={onOpenEnterpriseMcp}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
            title="Enterprise Connectors & MCP v1.2"
          >
            <Network className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">MCP Bridge</span>
          </button>
        )}

        {/* Kinetic Monolith & Duality.SI */}
        {onOpenKineticMonolith && (
          <button
            onClick={onOpenKineticMonolith}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
            title="Kinetic Monolith & Duality.SI Engine (~2.8GB iPad A16)"
          >
            <Box className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Kinetic Monolith</span>
          </button>
        )}

        {/* 17 Sources Inventory & A2A Tests */}
        {onOpenSourceInventory && (
          <button
            onClick={onOpenSourceInventory}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
            title="17 Active Sources Matrix, Reconstructed Repo Tree & A2A 24-Test Suite"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">17 Sources</span>
            <span className="text-[10px] px-1 rounded bg-emerald-950 text-emerald-300 font-mono">17</span>
          </button>
        )}

        {/* LiteRT-LM 13 Models Allowlist */}
        {onOpenModelAllowlist && (
          <button
            onClick={onOpenModelAllowlist}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
            title="LiteRT-LM On-Device Model Allowlist (Gemma 4 MTP, 13 Models)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">LiteRT 13</span>
            <span className="text-[10px] px-1 rounded bg-indigo-950 text-indigo-300 font-mono">iOS</span>
          </button>
        )}

        {/* Architecture Blueprint Button */}
        <button
          onClick={onOpenArchitecture}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
          title="Inspect Pi Pipeline & Vault Diagrams"
        >
          <Cpu className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Architecture</span>
        </button>

        {/* Security / MFA Status Button */}
        <button
          onClick={onOpenSecurity}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-emerald-400 transition-colors cursor-pointer"
          title="Security Protocols & MFA Matrix"
        >
          <Shield className="w-3.5 h-3.5" />
          <span className="hidden lg:inline text-slate-300">AES-256 · MFA</span>
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          title="Apollo Hyperparameters & Settings"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>

        {/* One-Click Deploy Button */}
        <button
          onClick={onOpenDeploy}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-medium text-xs transition-all shadow-md hover:shadow-cyan-500/20 active:scale-95 cursor-pointer"
        >
          <Rocket className="w-3.5 h-3.5" />
          <span>Deploy</span>
        </button>
      </div>
    </header>
  );
};
