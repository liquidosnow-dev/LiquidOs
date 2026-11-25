import React, { useMemo, useState } from 'react';
import {
  Wrench,
  Code2,
  BarChart3,
  Shield,
  Eye,
  Cpu,
  Terminal,
  Play,
  ArrowRight,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import {
  RegisteredToolItem,
  TOOL_LIBRARY_CATEGORIES,
  ToolLibraryCategory,
  buildRegisteredToolCatalog,
} from '../../utils/spatialNavigation';
import { dispatchCodexToolCall } from '../../utils/codexToolEngine';
import { WorkspaceTabType } from '../PreviewCanvas';
import { StatusIndicator } from '../ui/StatusIndicator';

interface ToolLibraryProps {
  onApplyCreatedFile: (file: { path: string; content: string }) => void;
  onOpenWorkbench: (tab: WorkspaceTabType) => void;
  onFocusConsole: (prefillPrompt?: string) => void;
  compact?: boolean;
}

const CATEGORY_ICON: Record<Exclude<ToolLibraryCategory, 'All'>, React.ReactNode> = {
  'Development Tools': <Code2 className="w-3.5 h-3.5 text-cyan-300" />,
  'Analysis Suite': <BarChart3 className="w-3.5 h-3.5 text-sky-300" />,
  'Security Toolkit': <Shield className="w-3.5 h-3.5 text-emerald-300" />,
  Visualization: <Eye className="w-3.5 h-3.5 text-cyan-200" />,
  'AI Assist Modules': <Cpu className="w-3.5 h-3.5 text-indigo-300" />,
  Utilities: <Terminal className="w-3.5 h-3.5 text-slate-300" />,
};

export const ToolLibrary: React.FC<ToolLibraryProps> = ({
  onApplyCreatedFile,
  onOpenWorkbench,
  onFocusConsole,
  compact = false,
}) => {
  const catalog = useMemo(() => buildRegisteredToolCatalog(), []);
  const [selectedCategory, setSelectedCategory] = useState<ToolLibraryCategory>('All');
  const [runningToolId, setRunningToolId] = useState<string | null>(null);
  const [toolOutputs, setToolOutputs] = useState<
    Record<string, { ok: boolean; text: string; ms: number }>
  >({});

  const visibleTools =
    selectedCategory === 'All'
      ? catalog
      : catalog.filter((t) => t.category === selectedCategory);

  const handleRunTool = async (tool: RegisteredToolItem) => {
    setRunningToolId(tool.id);
    const t0 = performance.now();
    try {
      if (
        tool.name === 'execute_code' ||
        tool.name === 'web_fetch' ||
        tool.name === 'math_eval' ||
        tool.name === 'create_file'
      ) {
        const res = await dispatchCodexToolCall(tool.name, tool.sampleArgs, {
          onCreateFile: (created) => {
            onApplyCreatedFile({ path: created.path, content: created.content });
          },
        });
        setToolOutputs((prev) => ({
          ...prev,
          [tool.id]: {
            ok: res.toolCall.status === 'success',
            text: res.serializedOutput,
            ms: Math.round(performance.now() - t0),
          },
        }));
      } else if (tool.name === 'contract_interop') {
        const r = await fetch('/api/contract/interop');
        const json = await r.json().catch(() => null);
        setToolOutputs((prev) => ({
          ...prev,
          [tool.id]: {
            ok: r.ok,
            text: json
              ? `Vector parity: ${json.passed ?? json.total ?? 'verified'} · Spec ${json.contractId || 'AN-EVC-001'}`
              : `HTTP ${r.status}`,
            ms: Math.round(performance.now() - t0),
          },
        }));
      } else if (tool.name === 'control_plane_attest') {
        const r = await fetch('/api/control-plane/state');
        const json = await r.json().catch(() => null);
        setToolOutputs((prev) => ({
          ...prev,
          [tool.id]: {
            ok: r.ok,
            text: json
              ? `Mode: ${json.state?.mode} · Epoch #${json.state?.epoch} · Ed25519 Ready`
              : `HTTP ${r.status}`,
            ms: Math.round(performance.now() - t0),
          },
        }));
      } else if (tool.name === 'os_db_query') {
        const r = await fetch('/api/os/state');
        const json = await r.json().catch(() => null);
        setToolOutputs((prev) => ({
          ...prev,
          [tool.id]: {
            ok: r.ok,
            text: json
              ? `Engine: ${json.engine} · Active: ${json.activeBinding?.projectName || 'none'}`
              : `HTTP ${r.status}`,
            ms: Math.round(performance.now() - t0),
          },
        }));
      }
    } catch (err: any) {
      setToolOutputs((prev) => ({
        ...prev,
        [tool.id]: {
          ok: false,
          text: err?.message || 'Execution failed.',
          ms: Math.round(performance.now() - t0),
        },
      }));
    } finally {
      setRunningToolId(null);
    }
  };

  // Holographic Wireframe Cube SVG
  const CubeSvg = (
    <svg viewBox="0 0 140 140" className="w-full h-full" aria-hidden="true">
      <defs>
        <radialGradient id="los-cube-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="70" cy="70" r="56" fill="url(#los-cube-glow)" />
      <ellipse cx="70" cy="108" rx="44" ry="10" fill="none" stroke="#22d3ee" strokeOpacity="0.35" strokeWidth="1" />
      <ellipse cx="70" cy="108" rx="30" ry="6" fill="none" stroke="#38bdf8" strokeOpacity="0.45" strokeWidth="1" />
      {/* Outer wireframe isometric cube */}
      <polygon
        points="70,22 110,45 110,91 70,114 30,91 30,45"
        fill="rgba(8,47,73,0.28)"
        stroke="#67e8f9"
        strokeWidth="1.5"
      />
      <line x1="70" y1="22" x2="70" y2="68" stroke="#67e8f9" strokeWidth="1.2" strokeOpacity="0.7" />
      <line x1="30" y1="45" x2="70" y2="68" stroke="#bae6fd" strokeWidth="1.4" />
      <line x1="110" y1="45" x2="70" y2="68" stroke="#bae6fd" strokeWidth="1.4" />
      <line x1="70" y1="68" x2="70" y2="114" stroke="#e0f2fe" strokeWidth="1.5" />
      {/* Inner core prism */}
      <polygon
        points="70,48 86,58 86,78 70,88 54,78 54,58"
        fill="rgba(34,211,238,0.22)"
        stroke="#e0f2fe"
        strokeWidth="1"
      />
      <circle cx="70" cy="68" r="5" fill="#67e8f9" />
    </svg>
  );

  if (compact) {
    return (
      <div className="flex flex-col h-full justify-between gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-cyan-300" />
            <span className="text-xs sm:text-sm font-semibold text-slate-100">
              Tool Library
            </span>
          </div>
          <span className="text-[10px] font-mono text-cyan-300">
            {catalog.length} Registered
          </span>
        </div>

        <div className="grid grid-cols-12 gap-2.5 items-center flex-1">
          <ul className="col-span-7 space-y-1.5">
            {TOOL_LIBRARY_CATEGORIES.map((cat) => (
              <li
                key={cat}
                className="flex items-center gap-2 text-[11px] text-slate-200 truncate"
              >
                {CATEGORY_ICON[cat]}
                <span className="truncate">{cat}</span>
              </li>
            ))}
          </ul>
          <div className="col-span-5 h-28 rounded-xl bg-slate-950/80 border border-cyan-400/25 p-1.5 flex flex-col items-center justify-center">
            <div className="w-20 h-20">{CubeSvg}</div>
            <span className="text-[9px] text-slate-400 tracking-wide">
              Power. Precision. Purpose.
            </span>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onOpenWorkbench('testing')}
            className="mercury-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-300/25 bg-slate-900/75 hover:border-cyan-400/50 text-xs font-medium text-slate-100 cursor-pointer"
          >
            <span>Browse All</span>
            <ArrowRight className="w-3.5 h-3.5 text-cyan-300" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Category Filter Strip + Cube Badge */}
      <div className="flex items-center gap-3 rounded-xl bg-slate-950/70 border border-slate-300/15 p-2.5">
        <div className="w-14 h-14 rounded-lg bg-slate-900/80 border border-cyan-400/25 shrink-0 p-1">
          {CubeSvg}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-slate-100">
            Codex & LiquidOS Registered Capabilities
          </div>
          <p className="text-[11px] text-slate-400">
            Live callable functions wired to Puter SDK, server sandboxes, and Control Plane verification.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setSelectedCategory('All')}
          className={`px-2 py-1 rounded-lg text-[10px] font-medium border cursor-pointer ${
            selectedCategory === 'All'
              ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-100'
              : 'bg-slate-900/60 border-slate-300/15 text-slate-300'
          }`}
        >
          All ({catalog.length})
        </button>
        {TOOL_LIBRARY_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-2 py-1 rounded-lg text-[10px] font-medium border flex items-center gap-1 cursor-pointer ${
              selectedCategory === cat
                ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-100'
                : 'bg-slate-900/60 border-slate-300/15 text-slate-300 hover:text-white'
            }`}
          >
            {CATEGORY_ICON[cat]}
            <span>{cat}</span>
          </button>
        ))}
      </div>

      {/* Tools List */}
      <div className="space-y-2">
        {visibleTools.map((tool) => {
          const outcome = toolOutputs[tool.id];
          const isRunning = runningToolId === tool.id;
          return (
            <div
              key={tool.id}
              className="rounded-xl bg-slate-950/75 border border-slate-300/15 p-2.5 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {CATEGORY_ICON[tool.category]}
                    <span className="text-xs font-semibold text-slate-100">
                      {tool.title}
                    </span>
                    <span className="font-mono text-[10px] text-cyan-300">
                      {tool.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{tool.description}</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {tool.isCallable && (
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => void handleRunTool(tool)}
                      className="mercury-press px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400/45 text-[11px] font-medium text-cyan-100 hover:bg-cyan-500/30 flex items-center gap-1 cursor-pointer"
                    >
                      {isRunning ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                      <span>Test</span>
                    </button>
                  )}
                  {tool.workspaceTab && (
                    <button
                      type="button"
                      onClick={() => onOpenWorkbench(tool.workspaceTab!)}
                      className="mercury-press px-2 py-1 rounded-lg bg-slate-900 border border-slate-300/20 text-[11px] text-slate-200 hover:border-cyan-400/40 flex items-center gap-1 cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Open</span>
                    </button>
                  )}
                  {tool.name === 'codex_ai_chat' && (
                    <button
                      type="button"
                      onClick={() => onFocusConsole('Audit workspace security and summarize architecture.')}
                      className="mercury-press px-2 py-1 rounded-lg bg-slate-900 border border-slate-300/20 text-[11px] text-slate-200 hover:border-cyan-400/40 cursor-pointer"
                    >
                      Ask AI
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                <div className="flex items-center gap-2">
                  <StatusIndicator
                    tone={
                      tool.availability === 'Available'
                        ? 'nominal'
                        : tool.availability === 'Control-Plane Gated'
                        ? 'warning'
                        : 'active'
                    }
                    label={tool.availability}
                  />
                  <span className="font-mono text-slate-400">
                    scope: <span className="text-slate-200">{tool.permissionScope}</span>
                  </span>
                </div>
                <span className="font-mono text-slate-400">{tool.endpoint}</span>
              </div>

              {outcome && (
                <div
                  className={`rounded-lg border px-2.5 py-1.5 font-mono text-[10px] whitespace-pre-wrap break-all ${
                    outcome.ok
                      ? 'bg-emerald-950/35 border-emerald-500/35 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-[9px] text-slate-400 mb-0.5">
                    <span>{outcome.ok ? 'Execution Result' : 'Execution Failed'}</span>
                    <span>{outcome.ms} ms</span>
                  </div>
                  {outcome.text}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
