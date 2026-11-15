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
        className={`w-64 glass-surface-1 border-y-0 border-l-0 flex flex-col h-full text-slate-200 font-sans shrink-0 select-none transition-transform duration-200 z-50 ${
          isMobileOpen
            ? 'fixed inset-y-0 left-0 shadow-2xl translate-x-0'
            : 'hidden lg:flex'
        }`}
      >
        {/* Active Unified Project Identity */}
        <div className="p-3 border-b border-white/10 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onSelectTemplate(TEMPLATES[0])}
            className="flex-1 flex items-center justify-between p-2 rounded-xl glass-surface-2 hover:border-cyan-400/50 transition-all cursor-pointer text-left min-w-0"
            title="Reset / Focus Unified LiquidOS ONE Project"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-xs font-mono font-bold text-white shrink-0">
                1
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">LiquidOS ONE</div>
                <div className="text-[10px] text-cyan-400 font-mono truncate">
                  {activeTemplate.files.length} files · AN-EVC-001
                </div>
              </div>
            </div>
          </button>

          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-white lg:hidden cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* New Action + Search */}
        <div className="p-3 pb-2 space-y-2 border-b border-slate-800/70">
          <button
            type="button"
            onClick={onNewThread}
            className="w-full py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Synthesis Prompt</span>
          </button>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Filter threads..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Handoff & Core Surfaces */}
        {onSelectTab && (
          <div className="px-3 py-2.5 border-b border-slate-800/70 space-y-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 mb-1">
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
                  className={`w-full px-2 py-1.5 rounded-lg text-left text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                    isActive
                      ? 'glass-surface-2 text-white font-semibold'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                    <span className="truncate">{s.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">{s.meta}</span>
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
                    className={`w-full px-2 py-1 rounded-lg text-left text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                      isActive ? 'bg-slate-900 text-cyan-300' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
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
        <div className="px-3 py-2 border-b border-slate-800/70 space-y-2">
          <div>
            <button
              type="button"
              onClick={() => setIsPresetsOpen((v) => !v)}
              className="w-full py-1 px-1 flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-300 cursor-pointer"
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
                      className={`w-full p-2 rounded-lg text-left transition-colors flex items-center gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 border border-cyan-500/70 text-white'
                          : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      <span className="text-xs font-mono shrink-0">{tpl.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate text-slate-200">{tpl.name}</div>
                        <div className="text-[10px] text-cyan-400 truncate font-mono">{tpl.badge}</div>
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
              className="w-full py-1 px-1 flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-300 cursor-pointer"
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
                    className="w-full px-2 py-1 rounded-lg text-left text-slate-300 hover:bg-slate-900 hover:text-white cursor-pointer truncate"
                  >
                    Five-Ring Ingress Shield
                  </button>
                )}
                {onOpenManifest && (
                  <button
                    type="button"
                    onClick={onOpenManifest}
                    className="w-full px-2 py-1 rounded-lg text-left text-slate-300 hover:bg-slate-900 hover:text-white cursor-pointer truncate"
                  >
                    Wayopen MANIFEST v1.1
                  </button>
                )}
                {onOpenEnterpriseMcp && (
                  <button
                    type="button"
                    onClick={onOpenEnterpriseMcp}
                    className="w-full px-2 py-1 rounded-lg text-left text-slate-300 hover:bg-slate-900 hover:text-white cursor-pointer truncate"
                  >
                    Enterprise &amp; MCP v1.2
                  </button>
                )}
                {onOpenKineticMonolith && (
                  <button
                    type="button"
                    onClick={onOpenKineticMonolith}
                    className="w-full px-2 py-1 rounded-lg text-left text-slate-300 hover:bg-slate-900 hover:text-white cursor-pointer truncate"
                  >
                    Kinetic Monolith &amp; Duality.SI
                  </button>
                )}
                {onOpenSourceInventory && (
                  <button
                    type="button"
                    onClick={onOpenSourceInventory}
                    className="w-full px-2 py-1 rounded-lg text-left text-slate-300 hover:bg-slate-900 hover:text-white cursor-pointer truncate"
                  >
                    17 Active Sources &amp; A2A
                  </button>
                )}
                {onOpenModelAllowlist && (
                  <button
                    type="button"
                    onClick={onOpenModelAllowlist}
                    className="w-full px-2 py-1 rounded-lg text-left text-slate-300 hover:bg-slate-900 hover:text-white cursor-pointer truncate"
                  >
                    LiteRT-LM 13 Edge Models
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Recent Threads */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-1">
            Recent Threads
          </div>
          {filteredThreads.length === 0 ? (
            <div className="text-[11px] text-slate-600 px-2 py-4 text-center">
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
                  className={`w-full p-2 rounded-lg text-left transition-colors flex items-start gap-2 cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white border border-slate-800'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5 text-cyan-400" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate text-slate-200">{thread.title}</div>
                    <div className="text-[10px] text-slate-500 truncate">{thread.preview}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Account Footer */}
        <div className="p-3 border-t border-white/10 glass-surface-1 border-x-0 border-b-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                M
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">Mercy</div>
                <div className="text-[10px] text-slate-400 truncate">liquidosnow@gmail.com</div>
              </div>
            </div>

            <button
              type="button"
              onClick={onSyncPuter}
              disabled={puterSyncing}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-800 transition-colors cursor-pointer"
              title="Sync with Puter Cloud Drive"
            >
              <Cloud className={`w-3.5 h-3.5 ${puterSyncing ? 'animate-bounce text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
