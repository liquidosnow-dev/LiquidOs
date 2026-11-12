import React, { useState } from 'react';
import {
  Network,
  Cloud,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  DoorOpen,
  Key,
  FolderLock,
  GitBranch,
  X,
  Server
} from 'lucide-react';
import { ENTERPRISE_CONNECTORS_CATALOG, createMcpHandoff } from '../utils/liquidArchitectureEngine';
import { EnterpriseConnector, McpHandoffSession } from '../types/architecture';

interface EnterpriseMcpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EnterpriseMcpModal: React.FC<EnterpriseMcpModalProps> = ({ isOpen, onClose }) => {
  const [connectors, setConnectors] = useState<EnterpriseConnector[]>(ENTERPRISE_CONNECTORS_CATALOG);
  const [activeTab, setActiveTab] = useState<'all' | 'google' | 'third_party'>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [mcpSession, setMcpSession] = useState<McpHandoffSession>(() =>
    createMcpHandoff('mcp.liquid.internal/room/vault-alpha', 'chk_mcp_9942')
  );

  if (!isOpen) return null;

  const filteredConnectors = activeTab === 'all'
    ? connectors
    : connectors.filter(c => c.category === activeTab);

  const handleSyncAll = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setConnectors(prev =>
        prev.map(c => ({
          ...c,
          lastSyncTime: Date.now(),
          itemCount: c.itemCount + Math.floor(Math.random() * 5),
        }))
      );
      setMcpSession(createMcpHandoff('mcp.liquid.internal/room/vault-alpha', 'chk_mcp_' + Math.random().toString(36).slice(2, 6)));
      setIsSyncing(false);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-5xl bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500 flex items-center justify-center text-cyan-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Enterprise Connectors & Model Context Protocol (MCP)</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                  MCP v1.2 · HTTP/2 + TLS 1.3
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Bridge Local Pi Pipeline to Cloud Workloads & Cross-Platform Checkpoint Handoffs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* MCP Architectural Metaphor Card */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-cyan-800/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white tracking-wide">
                  Model Context Protocol (MCP) Architectural Metaphor
                </span>
              </div>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                SOVEREIGN TRINITY: MOVE THE CHECKPOINT, NOT THE CREDENTIALS
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[10px] font-mono text-cyan-400 mb-1 flex items-center gap-1.5">
                  <DoorOpen className="w-3.5 h-3.5" />
                  1. THE DOORWAY
                </div>
                <div className="font-bold text-white">Model Context Protocol</div>
                <p className="text-[11px] text-slate-400 mt-0.5">Standardized interface connecting AI runtime to tools & workloads.</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[10px] font-mono text-amber-400 mb-1 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5" />
                  2. THE ROOM
                </div>
                <div className="font-bold text-white">Server Substrate</div>
                <p className="text-[11px] text-slate-400 mt-0.5 font-mono truncate">{mcpSession.roomServer}</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[10px] font-mono text-purple-400 mb-1 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" />
                  3. THE KEY
                </div>
                <div className="font-bold text-white">Cryptographic Permissions</div>
                <p className="text-[11px] text-slate-400 mt-0.5">vault:read, pipeline:route, audit:commit</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[10px] font-mono text-emerald-400 mb-1 flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5" />
                  4. THE CHECKPOINT
                </div>
                <div className="font-bold text-white">Progress State</div>
                <p className="text-[11px] text-slate-400 mt-0.5 font-mono truncate">{mcpSession.checkpointId}</p>
              </div>
            </div>
          </div>

          {/* Connectors Toolbar */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'all'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                All Connectors ({connectors.length})
              </button>
              <button
                onClick={() => setActiveTab('google')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'google'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                Google Enterprise ({connectors.filter(c => c.category === 'google').length})
              </button>
              <button
                onClick={() => setActiveTab('third_party')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'third_party'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                Third-Party Workspaces ({connectors.filter(c => c.category === 'third_party').length})
              </button>
            </div>

            <button
              onClick={handleSyncAll}
              disabled={isSyncing}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-cyan-400' : ''}`} />
              {isSyncing ? 'Syncing Connectors...' : 'Sync All Connectors'}
            </button>
          </div>

          {/* Connectors Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredConnectors.map((c) => (
              <div
                key={c.id}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-white">{c.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      {c.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>{c.authType}</span>
                    <span className="font-mono text-cyan-400">{c.itemCount.toLocaleString()} items</span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>Synced {Math.round((Date.now() - c.lastSyncTime) / 1000)}s ago</span>
                  <span className="text-slate-400">TLS 1.3 Active</span>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-500">
          <span>Enterprise Connectors Gateway · OAuth 2.0 PKCE & Service Account Delegations</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
          >
            Close Connectors
          </button>
        </div>

      </div>
    </div>
  );
};
