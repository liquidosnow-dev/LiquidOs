import React, { useState } from 'react';
import { Plus, Search, MessageSquare, Layers, Database, HardDrive, CheckCircle2, Cloud, Sparkles, ChevronDown, X } from 'lucide-react';
import { TEMPLATES, AppTemplate } from '../services/templates';

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
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const [isConnectorsOpen, setIsConnectorsOpen] = useState(false);
  const [isPillarsOpen, setIsPillarsOpen] = useState(true);

  // Filter threads by search query
  const filteredThreads = chatThreads.filter(t =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.preview.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs"
        />
      )}

      <aside
        className={`w-64 bg-slate-950 border-r border-slate-800 flex flex-col h-full text-slate-300 font-sans shrink-0 select-none transition-transform duration-200 z-50 ${
          isMobileOpen
            ? 'fixed inset-y-0 left-0 shadow-2xl translate-x-0'
            : 'hidden lg:flex'
        }`}
      >
        {/* Workspace Top Menu (Matching IMG 4: Mercy's Lovable) */}
        <div className="p-3 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex-1 flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-pink-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                M
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-white truncate">Mercy's Lovable</div>
                <div className="text-[10px] text-slate-400 font-mono">Workspace PRO</div>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </div>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-white lg:hidden cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

      {/* New Project / Chat Button */}
      <div className="p-3 pb-1">
        <button
          onClick={onNewThread}
          className="w-full py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Wish / App</span>
        </button>
      </div>

      {/* Thread Search Bar */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search threads..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
      </div>

      {/* Templates Selector Section */}
      <div className="px-3 py-2">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 px-1">
          App Architecture Blueprints
        </div>
        <div className="space-y-1">
          {TEMPLATES.map(tpl => {
            const isSelected = activeTemplateId === tpl.id;
            return (
              <button
                key={tpl.id}
                onClick={() => onSelectTemplate(tpl)}
                className={`w-full p-2 rounded-lg text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 border border-cyan-500 text-white'
                    : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="text-sm shrink-0">{tpl.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold truncate text-slate-200">{tpl.name}</div>
                  <div className="text-[10px] text-cyan-400 truncate font-mono">{tpl.badge}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Connectors / Integrations Accordion */}
      <div className="px-3 py-1">
        <button
          onClick={() => setIsConnectorsOpen(!isConnectorsOpen)}
          className="w-full py-1.5 px-1 flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Connected Services
          </span>
          <span className="text-[10px] text-emerald-400 font-mono">3 Active</span>
        </button>

        {isConnectorsOpen && (
          <div className="mt-1 space-y-1 pl-1 text-[11px] font-mono text-slate-400">
            <div className="flex items-center gap-2 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Puter Cloud Drive (KV)</span>
            </div>
            <div className="flex items-center gap-2 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Google Tasks & Keep Sync</span>
            </div>
            <div className="flex items-center gap-2 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Cloud SQL & Firebase Auth</span>
            </div>
          </div>
        )}
      </div>

      {/* Architectural Pillars & Control Surfaces */}
      <div className="px-3 py-1">
        <button
          onClick={() => setIsPillarsOpen(!isPillarsOpen)}
          className="w-full py-1.5 px-1 flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Architecture Pillars (6)
          </span>
          <span className="text-[10px] text-cyan-400 font-mono">SPEC v4.2</span>
        </button>

        {isPillarsOpen && (
          <div className="mt-1 space-y-1">
            {onOpenIngressShield && (
              <button
                onClick={onOpenIngressShield}
                className="w-full p-1.5 rounded-lg text-left text-xs text-rose-300 hover:bg-slate-900 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span className="text-sm">🛡️</span>
                <div className="min-w-0 flex-1 truncate">
                  <div className="font-semibold text-rose-300 truncate">Five-Ring Ingress Shield</div>
                  <div className="text-[9px] text-slate-500 truncate">39 iOS Entry Points · 4 Daemons</div>
                </div>
              </button>
            )}

            {onOpenManifest && (
              <button
                onClick={onOpenManifest}
                className="w-full p-1.5 rounded-lg text-left text-xs text-purple-300 hover:bg-slate-900 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span className="text-sm">📜</span>
                <div className="min-w-0 flex-1 truncate">
                  <div className="font-semibold text-purple-300 truncate">MANIFEST.json v1.1</div>
                  <div className="text-[9px] text-slate-500 truncate">5-Stage Handoff · Rollback</div>
                </div>
              </button>
            )}

            {onOpenEnterpriseMcp && (
              <button
                onClick={onOpenEnterpriseMcp}
                className="w-full p-1.5 rounded-lg text-left text-xs text-amber-300 hover:bg-slate-900 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span className="text-sm">🌐</span>
                <div className="min-w-0 flex-1 truncate">
                  <div className="font-semibold text-amber-300 truncate">Enterprise & MCP v1.2</div>
                  <div className="text-[9px] text-slate-500 truncate">Google + 3P Workspaces Bridge</div>
                </div>
              </button>
            )}

            {onOpenKineticMonolith && (
              <button
                onClick={onOpenKineticMonolith}
                className="w-full p-1.5 rounded-lg text-left text-xs text-cyan-300 hover:bg-slate-900 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span className="text-sm">⚛️</span>
                <div className="min-w-0 flex-1 truncate">
                  <div className="font-semibold text-cyan-300 truncate">Kinetic Monolith</div>
                  <div className="text-[9px] text-slate-500 truncate">Duality.SI · ~2.8GB iPad A16</div>
                </div>
              </button>
            )}

            {onOpenSourceInventory && (
              <button
                onClick={onOpenSourceInventory}
                className="w-full p-1.5 rounded-lg text-left text-xs text-emerald-300 hover:bg-slate-900 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span className="text-sm">📖</span>
                <div className="min-w-0 flex-1 truncate">
                  <div className="font-semibold text-emerald-300 truncate">17 Active Sources Matrix</div>
                  <div className="text-[9px] text-slate-500 truncate">Specs, Connectors, A2A 24-Tests</div>
                </div>
              </button>
            )}

            {onOpenModelAllowlist && (
              <button
                onClick={onOpenModelAllowlist}
                className="w-full p-1.5 rounded-lg text-left text-xs text-indigo-300 hover:bg-slate-900 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span className="text-sm">📱</span>
                <div className="min-w-0 flex-1 truncate">
                  <div className="font-semibold text-indigo-300 truncate">LiteRT-LM Edge Gallery</div>
                  <div className="text-[9px] text-slate-500 truncate">13 On-Device Models · Gemma 4 MTP</div>
                </div>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Recent Chats / Threads List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-1">
          Recent Conversations
        </div>

        {filteredThreads.length === 0 ? (
          <div className="text-[11px] text-slate-600 px-2 py-4 text-center">
            {searchQuery ? 'No matching threads found.' : 'No threads yet.'}
          </div>
        ) : (
          filteredThreads.map(thread => {
            const isActive = thread.id === activeThreadId;
            return (
              <button
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                className={`w-full p-2 rounded-lg text-left transition-all flex items-start gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white border border-slate-800'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
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

      {/* Account Profile Footer (Matching IMG 4: Mercy liquidosnow@gmail.com) */}
      <div className="p-3 border-t border-slate-800 bg-slate-950">
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
