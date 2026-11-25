import React, { useState } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Cloud,
  ChevronDown,
  ChevronRight,
  X,
  Eye,
  ShieldCheck,
  HardDrive,
  Sliders,
  Globe,
  BookOpen,
  Terminal,
  Activity,
  Archive,
  FlaskConical,
  Smartphone,
} from 'lucide-react';
import { TEMPLATES, AppTemplate } from '../services/templates';
import { WorkspaceTabType } from './PreviewCanvas';
import { MercurySphere } from './MercurySphere';
import { MercuryEdgeRipple } from './MercuryEdgeRipple';
import { MercuryTooltip } from './MercuryTooltip';
import { MercuryFrameGlow } from './MercuryFrameGlow';
import { useMercuryFrameGlow } from '../hooks/useMercuryFrameGlow';

interface SidebarProps {
  onSelectTemplate: (template: AppTemplate) => void;
  activeTemplateId?: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  chatThreads: { id: string; title: string; timestamp: number; preview: string }[];
  activeThreadId: string;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  puterSyncing: boolean;
  onSyncPuter: () => void;
  onOpenIngressShield?: () => void;
  onOpenManifest?: () => void;
  onOpenEnterpriseMcp?: () => void;
  onOpenKineticMonolith?: () => void;
  onOpenSourceInventory?: () => void;
  onOpenModelAllowlist?: () => void;
  onSelectTab?: (tab: WorkspaceTabType) => void;
  activeWorkspaceTab?: WorkspaceTabType;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onSelectTemplate,
  activeTemplateId,
  searchQuery,
  onSearchChange,
  chatThreads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  puterSyncing,
  onSyncPuter,
  onOpenIngressShield,
  onOpenManifest,
  onOpenEnterpriseMcp,
  onOpenKineticMonolith,
  onOpenSourceInventory,
  onOpenModelAllowlist,
  onSelectTab,
  activeWorkspaceTab = 'preview',
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const [isPillarsOpen, setIsPillarsOpen] = useState(false);
  const { frameRef: sidebarFrameRef, glowHandlers: sidebarGlowHandlers } = useMercuryFrameGlow<HTMLElement>();

  const filteredThreads = chatThreads.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.preview.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const primarySurfaces: {
    id: WorkspaceTabType;
    label: string;
    meta: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'preview', label: 'Preview', meta: 'Live Sandbox', icon: Eye },
    { id: 'files', label: 'File Explorer', meta: 'Master Tree', icon: HardDrive },
    { id: 'contract', label: 'Contract Registry', meta: 'AN-EVC-001', icon: ShieldCheck },
    { id: 'testing', label: 'Testing', meta: 'Vitest + V8', icon: FlaskConical },
    { id: 'settings', label: 'Settings', meta: 'Inference & Edge', icon: Sliders },
    { id: 'publish', label: 'Publish', meta: 'Edge & GitHub', icon: Globe },
    { id: 'play_audit', label: 'Play Store Audit', meta: 'API 35 · TWA', icon: Smartphone },
    { id: 'tutorial', label: 'Tutorial', meta: 'Handoff Guide', icon: BookOpen },
  ];

  const runtimeTools: {
    id: WorkspaceTabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'terminal', label: 'Linux Terminal', icon: Terminal },
    { id: 'metrics', label: 'Sandbox Metrics', icon: Activity },
    { id: 'backups', label: 'Archives & Backups', icon: Archive },
  ];

  const activeTemplate = TEMPLATES.find((t) => t.id === activeTemplateId) || TEMPLATES[0];

  return (
    <>
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs"
        />
      )}

      <aside
        ref={sidebarFrameRef}
        {...sidebarGlowHandlers}
        data-mercury-panel="sidebar"
        className={`relative w-64 glass-surface-1 border-y-0 border-l-0 lg:rounded-r-2xl flex flex-col h-full text-slate-200 font-sans shrink-0 select-none transition-transform duration-200 z-50 ${
          isMobileOpen
            ? 'fixed inset-y-0 left-0 shadow-2xl translate-x-0 rounded-r-2xl'
            : 'hidden lg:flex'
        }`}
      >
        <MercuryFrameGlow />
        <MercuryEdgeRipple variant="green" delaySeconds={3.2} durationSeconds={15} rx={16} />

        {/* Active Unified Project Identity */}
        <div className="relative z-10 p-3 border-b border-white/10 flex items-center justify-between gap-2">
          <MercuryTooltip content="Reset or focus the unified LiquidOS ONE project" placement="bottom" className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => onSelectTemplate(TEMPLATES[0])}
              className="mercury-press mercury-crest-panel w-full flex items-center justify-between p-2 rounded-2xl glass-surface-2 hover:border-slate-300/40 cursor-pointer text-left min-w-0"
              aria-label="Reset / Focus Unified LiquidOS ONE Project"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <MercurySphere size="sm" label="LiquidOS ONE Emblem" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">LiquidOS ONE</div>
                  <div className="text-[10px] text-cyan-300 font-mono truncate">
                    {activeTemplate.files.length} files · AN-EVC-001
                  </div>
                </div>
              </div>
            </button>
          </MercuryTooltip>

          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close Sidebar"
              className="mercury-press p-2 rounded-xl glass-surface-2 text-slate-300 hover:text-white lg:hidden cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* New Action + Search */}
        <div className="relative z-10 p-3 pb-2 space-y-2 border-b border-white/10">
          <button
            type="button"
            onClick={onNewThread}
            className="mercury-press w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-600/90 to-slate-700/90 hover:from-cyan-500 hover:to-slate-600 border border-slate-200/25 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Synthesis Prompt</span>
          </button>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Filter threads..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-black/35 border border-slate-200/15 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-slate-200/45"
            />
          </div>
        </div>

        {/* Handoff & Core Surfaces */}
        {onSelectTab && (
          <div className="relative z-10 px-3 py-2.5 border-b border-white/10 space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-1">
              Workspace Surfaces
            </div>
            {primarySurfaces.map((s) => {
              const Icon = s.icon;
              const isActive = activeWorkspaceTab === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectTab(s.id)}
                  className={`mercury-press w-full px-2.5 py-1.5 rounded-xl text-left text-xs flex items-center justify-between gap-2 cursor-pointer ${
                    isActive
                      ? 'glass-surface-2 text-white font-semibold'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-cyan-300' : 'text-slate-400'}`} />
                    <span className="truncate">{s.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">{s.meta}</span>
                </button>
              );
            })}

            <div className="pt-1.5 space-y-0.5">
              {runtimeTools.map((rt) => {
                const Icon = rt.icon;
                const isActive = activeWorkspaceTab === rt.id;
                return (
                  <button
                    key={rt.id}
                    type="button"
                    onClick={() => onSelectTab(rt.id)}
                    className={`mercury-press w-full px-2.5 py-1 rounded-xl text-left text-xs flex items-center gap-2 cursor-pointer ${
                      isActive
                        ? 'glass-surface-2 text-cyan-200 font-medium'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white border border-transparent'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{rt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Collapsible Presets & System Pillars */}
        <div className="relative z-10 px-3 py-2 border-b border-white/10 space-y-2">
          <div>
            <button
              type="button"
              onClick={() => setIsPresetsOpen((v) => !v)}
              className="mercury-press w-full py-1 px-1.5 rounded-lg flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-200 cursor-pointer"
            >
              <span>Reference Views ({TEMPLATES.length})</span>
              {isPresetsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            {isPresetsOpen && (
              <div className="mt-1 space-y-1">
                {TEMPLATES.map((tpl) => {
                  const isSelected = activeTemplateId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => onSelectTemplate(tpl)}
                      className={`mercury-press w-full p-2 rounded-xl text-left flex items-center gap-2 cursor-pointer ${
                        isSelected
                          ? 'glass-surface-2 border-cyan-400/50 text-white'
                          : 'hover:bg-white/5 text-slate-300 hover:text-white border border-transparent'
                      }`}
                    >
                      <span className="text-xs font-mono shrink-0">{tpl.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate text-slate-100">{tpl.name}</div>
                        <div className="text-[10px] text-cyan-300 truncate font-mono">{tpl.badge}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setIsPillarsOpen((v) => !v)}
              className="mercury-press w-full py-1 px-1.5 rounded-lg flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-200 cursor-pointer"
            >
              <span>System Pillars (6)</span>
              {isPillarsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
            {isPillarsOpen && (
              <div className="mt-1 space-y-0.5 text-xs">
                {onOpenIngressShield && (
                  <button
                    type="button"
                    onClick={onOpenIngressShield}
                    className="mercury-press w-full px-2 py-1 rounded-lg text-left text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer truncate"
                  >
                    Five-Ring Ingress Shield
                  </button>
                )}
                {onOpenManifest && (
                  <button
                    type="button"
                    onClick={onOpenManifest}
                    className="mercury-press w-full px-2 py-1 rounded-lg text-left text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer truncate"
                  >
                    Wayopen MANIFEST v1.1
                  </button>
                )}
                {onOpenEnterpriseMcp && (
                  <button
                    type="button"
                    onClick={onOpenEnterpriseMcp}
                    className="mercury-press w-full px-2 py-1 rounded-lg text-left text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer truncate"
                  >
                    Enterprise &amp; MCP v1.2
                  </button>
                )}
                {onOpenKineticMonolith && (
                  <button
                    type="button"
                    onClick={onOpenKineticMonolith}
                    className="mercury-press w-full px-2 py-1 rounded-lg text-left text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer truncate"
                  >
                    Kinetic Monolith &amp; Duality.SI
                  </button>
                )}
                {onOpenSourceInventory && (
                  <button
                    type="button"
                    onClick={onOpenSourceInventory}
                    className="mercury-press w-full px-2 py-1 rounded-lg text-left text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer truncate"
                  >
                    17 Active Sources &amp; A2A
                  </button>
                )}
                {onOpenModelAllowlist && (
                  <button
                    type="button"
                    onClick={onOpenModelAllowlist}
                    className="mercury-press w-full px-2 py-1 rounded-lg text-left text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer truncate"
                  >
                    LiteRT-LM 13 Edge Models
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Recent Threads */}
        <div className="relative z-10 flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">
            Recent Threads
          </div>
          {filteredThreads.length === 0 ? (
            <div className="text-[11px] text-slate-500 px-2 py-4 text-center">
              {searchQuery ? 'No matching threads.' : 'No threads yet.'}
            </div>
          ) : (
            filteredThreads.map((thread) => {
              const isActive = thread.id === activeThreadId;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => onSelectThread(thread.id)}
                  className={`mercury-press w-full p-2 rounded-xl text-left flex items-start gap-2 cursor-pointer ${
                    isActive
                      ? 'glass-surface-2 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5 text-cyan-300" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate text-slate-100">{thread.title}</div>
                    <div className="text-[10px] text-slate-400 truncate">{thread.preview}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Account Footer */}
        <div className="relative z-10 p-3 border-t border-white/10 glass-surface-1 border-x-0 border-b-0 lg:rounded-br-2xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500/80 to-slate-800 border border-slate-200/35 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-inner">
                M
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">Mercy</div>
                <div className="text-[10px] text-slate-400 truncate">liquidosnow@gmail.com</div>
              </div>
            </div>

            <MercuryTooltip content="Sync workspace snapshot with Puter Cloud Drive" placement="top">
              <button
                type="button"
                onClick={onSyncPuter}
                disabled={puterSyncing}
                className="mercury-press p-1.5 rounded-xl glass-surface-2 text-slate-300 hover:text-cyan-300 cursor-pointer shrink-0"
                aria-label="Sync with Puter Cloud Drive"
              >
                <Cloud className={`w-3.5 h-3.5 ${puterSyncing ? 'animate-bounce text-cyan-300' : ''}`} />
              </button>
            </MercuryTooltip>
          </div>
        </div>
      </aside>
    </>
  );
};
