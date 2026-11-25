import React, { useState, useEffect, useRef } from 'react';
import { ProjectFile } from '../types';
import { bundlePreviewHtml, detectPreviewRuntime } from '../utils/toolExecutor';
import {
  Monitor,
  Tablet,
  Smartphone,
  RotateCcw,
  ExternalLink,
  Terminal,
  Eye,
  Code,
  Columns2,
  Cpu,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  X,
  Search,
  Edit3,
  HardDrive,
  Activity,
  Globe,
  Archive,
  Sparkles,
  ShieldCheck,
  BookOpen,
  FlaskConical,
  Database,
  Send,
} from 'lucide-react';
import { runCapturePipeline } from '../workers/captureWorker';
import { hydrateVectorVault, getVectorVaultStats } from '../services/vectorStore';
import { MercuryEdgeRipple } from './MercuryEdgeRipple';
import { MercuryTooltip } from './MercuryTooltip';
import { MercuryFrameGlow } from './MercuryFrameGlow';
import { useMercuryFrameGlow } from '../hooks/useMercuryFrameGlow';

export type WorkspaceTabType =
  | 'preview'
  | 'split'
  | 'files'
  | 'contract'
  | 'code'
  | 'testing'
  | 'terminal'
  | 'metrics'
  | 'commits'
  | 'publish'
  | 'play_audit'
  | 'backups'
  | 'architecture'
  | 'settings'
  | 'tutorial';

interface ConsoleLog {
  id: string;
  level: 'log' | 'warn' | 'error';
  message: string;
  timestamp: number;
}

interface PreviewCanvasProps {
  files: ProjectFile[];
  activeFilePath?: string;
  activeTab: WorkspaceTabType;
  onChangeTab: (tab: WorkspaceTabType) => void;
  renderFileExplorer?: React.ReactNode;
  renderContract?: React.ReactNode;
  renderCodeEditor?: React.ReactNode;
  renderTesting?: React.ReactNode;
  renderTerminal?: React.ReactNode;
  renderMetrics?: React.ReactNode;
  renderCommits?: React.ReactNode;
  renderPublish?: React.ReactNode;
  renderPlayAudit?: React.ReactNode;
  renderBackups?: React.ReactNode;
  renderArchitecture?: React.ReactNode;
  renderSettings?: React.ReactNode;
  renderTutorial?: React.ReactNode;
  onSendInspectToChat?: (prompt: string) => void;
  watchMode?: boolean;
  watchTestStatus?: {
    isRunning: boolean;
    passed: number;
    failed: number;
    total: number;
  } | null;
  onDeviceMode?: 'disconnected' | 'native' | 'opfs' | 'imported';
}

export const PreviewCanvas: React.FC<PreviewCanvasProps> = ({
  files,
  activeFilePath,
  activeTab,
  onChangeTab,
  renderFileExplorer,
  renderContract,
  renderCodeEditor,
  renderTesting,
  renderTerminal,
  renderMetrics,
  renderCommits,
  renderPublish,
  renderPlayAudit,
  renderBackups,
  renderArchitecture,
  renderSettings,
  renderTutorial,
  onSendInspectToChat,
  watchMode = false,
  watchTestStatus = null,
  onDeviceMode = 'disconnected',
}) => {
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [currentRoute, setCurrentRoute] = useState('/');
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'log' | 'warn' | 'error'>('all');
  const [consoleCommand, setConsoleCommand] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [isConsoleDrawerOpen, setIsConsoleDrawerOpen] = useState(false);

  // Inspect mode & Visual Edit mode
  const [isInspectMode, setIsInspectMode] = useState(false);
  const [isVisualEditMode, setIsVisualEditMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<{
    tag: string;
    classes: string;
    text: string;
    dimensions: string;
  } | null>(null);

  // Visual Edit state controls
  const [visualAccent, setVisualAccent] = useState<'cyan' | 'amber' | 'emerald' | 'purple'>('cyan');
  const [visualPadding, setVisualPadding] = useState<'compact' | 'normal' | 'spacious'>('normal');
  const [copiedInspect, setCopiedInspect] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { frameRef: canvasFrameRef, glowHandlers: canvasGlowHandlers } = useMercuryFrameGlow<HTMLDivElement>();
  const [vectorChunkCount, setVectorChunkCount] = useState<number>(0);
  const [isVectorizing, setIsVectorizing] = useState<boolean>(false);

  const runtimeInfo = detectPreviewRuntime(files, activeFilePath);
  const bundledHtml = bundlePreviewHtml(files, activeFilePath);
  const isLivePreviewVisible = activeTab === 'preview' || activeTab === 'split';

  const captureCurrentPreviewSnapshot = async () => {
    setIsVectorizing(true);
    try {
      await hydrateVectorVault();
      const targetUrl = `https://app.preview${currentRoute || '/'}`;
      await runCapturePipeline(targetUrl, bundledHtml);
      setVectorChunkCount(getVectorVaultStats().totalChunks);
    } finally {
      setIsVectorizing(false);
    }
  };

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      await hydrateVectorVault();
      const targetUrl = `https://app.preview${currentRoute || '/'}`;
      await runCapturePipeline(targetUrl, bundledHtml);
      if (active) {
        setVectorChunkCount(getVectorVaultStats().totalChunks);
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [bundledHtml, currentRoute, reloadKey]);

  // Listen for console logs sent from the isolated iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'SANDBOX_CONSOLE') {
        setLogs((prev) => [
          ...prev.slice(-99),
          {
            id: Math.random().toString(36).substring(2, 9),
            level: e.data.level,
            message: e.data.message,
            timestamp: e.data.timestamp || Date.now(),
          },
        ]);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleReload = () => {
    setReloadKey((prev) => prev + 1);
  };

  const handleOpenNewWindow = () => {
    const bundled = bundlePreviewHtml(files, activeFilePath);
    const blob = new Blob([bundled], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleRunConsoleEval = (e: React.FormEvent) => {
    e.preventDefault();
    const expr = consoleCommand.trim();
    if (!expr) return;
    setLogs((prev) => [
      ...prev.slice(-99),
      {
        id: Math.random().toString(36).substring(2, 9),
        level: 'log',
        message: `> ${expr}`,
        timestamp: Date.now(),
      },
    ]);
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'SANDBOX_EVAL',
        code: expr,
      },
      '*'
    );
    setConsoleCommand('');
  };

  const getViewportWidthClass = () => {
    switch (viewport) {
      case 'desktop':
        return 'w-full h-full';
      case 'tablet':
        return 'w-[768px] h-full shadow-2xl border-x border-slate-700/60 my-auto rounded-lg';
      case 'mobile':
        return 'w-[375px] h-full shadow-2xl border-x border-slate-700/60 my-auto rounded-2xl overflow-hidden';
    }
  };

  const handleInspectClick = (componentName: string, classes: string, text: string) => {
    setSelectedElement({
      tag: componentName,
      classes,
      text,
      dimensions: '100% × auto (flexbox)',
    });
  };

  return (
    <div
      ref={canvasFrameRef}
      {...canvasGlowHandlers}
      data-mercury-panel="preview-canvas"
      className="relative flex flex-col h-full bg-transparent border-l border-white/10 lg:rounded-tl-2xl text-slate-200 overflow-hidden"
    >
      <MercuryFrameGlow className="z-20" />
      <MercuryEdgeRipple variant="red" delaySeconds={4.8} durationSeconds={14} rx={18} className="z-20" />

      {/* Top Navigation & Workspace Tabs Bar */}
      <div className="relative z-10 flex items-center justify-between px-3 py-2 glass-surface-1 border-x-0 border-t-0 gap-2 shrink-0 overflow-x-auto scrollbar-none">
        {/* Main Tab Controls */}
        <div className="flex items-center gap-1 bg-black/35 p-1 rounded-xl border border-white/15 shrink-0 whitespace-nowrap">
          <button
            type="button"
            data-testid="tab-preview"
            onClick={() => onChangeTab('preview')}
            className={`mercury-press flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
              activeTab === 'preview'
                ? 'glass-surface-2 text-white shadow-sm font-semibold border-slate-200/35'
                : 'text-slate-300 hover:text-white border border-transparent'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview</span>
          </button>

          <MercuryTooltip content="Split-screen live code editor and isolated artifact sandbox" placement="bottom">
            <button
              type="button"
              data-testid="tab-split"
              onClick={() => onChangeTab('split')}
              className={`mercury-press flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
                activeTab === 'split'
                  ? 'glass-surface-2 text-white shadow-sm font-semibold border-slate-200/35'
                  : 'text-slate-300 hover:text-white border border-transparent'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>
          </MercuryTooltip>

          <button
            type="button"
            data-testid="tab-code"
            onClick={() => onChangeTab('code')}
            className={`mercury-press flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
              activeTab === 'code'
                ? 'glass-surface-2 text-white shadow-sm font-semibold border-slate-200/35'
                : 'text-slate-300 hover:text-white border border-transparent'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Code</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('files')}
            className={`mercury-press flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
              activeTab === 'files'
                ? 'glass-surface-2 text-white shadow-sm font-semibold border-slate-200/35'
                : 'text-slate-300 hover:text-white border border-transparent'
            }`}
            title="Master File Tree Showcase (/home/user/webapp) & On-Device FS"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">File Explorer</span>
            {(onDeviceMode === 'native' || onDeviceMode === 'opfs') && (
              <span
                className={`text-[10px] font-mono ${
                  activeTab === 'files' ? 'text-emerald-100' : 'text-emerald-400'
                }`}
              >
                · {onDeviceMode === 'native' ? 'Host' : 'OPFS'}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('contract')}
            className={`mercury-press flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
              activeTab === 'contract'
                ? 'glass-surface-2 text-white shadow-sm font-semibold border-slate-200/35'
                : 'text-slate-300 hover:text-white border border-transparent'
            }`}
            title="AN-EVC-001 Cross-Runtime Canonicalization & Authority Boundary"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Contract</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('testing')}
            className={`mercury-press flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
              activeTab === 'testing'
                ? 'glass-surface-2 text-white shadow-sm font-semibold border-slate-200/35'
                : 'text-slate-300 hover:text-white border border-transparent'
            }`}
            title="Live Vitest Unit Runner & V8 Coverage Analysis"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Testing</span>
            {watchTestStatus?.isRunning ? (
              <span className="text-[11px] font-mono tabular-nums text-cyan-200">
                · Running
              </span>
            ) : watchTestStatus && watchTestStatus.total > 0 && watchMode ? (
              <span
                className={`text-[11px] font-mono tabular-nums ${
                  watchTestStatus.failed > 0
                    ? 'text-rose-200'
                    : activeTab === 'testing'
                    ? 'text-emerald-100'
                    : 'text-emerald-400'
                }`}
              >
                · {watchTestStatus.passed}/{watchTestStatus.total}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('terminal')}
            className={`mercury-press flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
              activeTab === 'terminal'
                ? 'glass-surface-2 text-white shadow-sm font-semibold border-slate-200/35'
                : 'text-slate-300 hover:text-white border border-transparent'
            }`}
            title="Interactive Linux Shell"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Terminal</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('metrics')}
            className={`mercury-press flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
              activeTab === 'metrics'
                ? 'glass-surface-2 text-white shadow-sm font-semibold border-slate-200/35'
                : 'text-slate-300 hover:text-white border border-transparent'
            }`}
            title="Real-Time CPU/GPU & RAM Telemetry"
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Metrics</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('settings')}
            className={`mercury-press flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
              activeTab === 'settings'
                ? 'glass-surface-2 text-white shadow-sm font-semibold border-slate-200/35'
                : 'text-slate-300 hover:text-white border border-transparent'
            }`}
            title="Apollo Model Hyperparameters & LiteRT Edge"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Settings</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('publish')}
            className={`mercury-press flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
              activeTab === 'publish'
                ? 'glass-surface-2 text-white shadow-sm font-semibold border-slate-200/35'
                : 'text-slate-300 hover:text-white border border-transparent'
            }`}
            title="Genspark Hosting, Cloudflare, GitHub & Play Store"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Publish</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('play_audit')}
            className={`mercury-press flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
              activeTab === 'play_audit'
                ? 'glass-surface-2 text-white shadow-sm font-semibold border-slate-200/35'
                : 'text-slate-300 hover:text-white border border-transparent'
            }`}
            title="Google Play Store Readiness & Full-Scale Audit"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Play Audit</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('backups')}
            className={`mercury-press flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
              activeTab === 'backups'
                ? 'glass-surface-2 text-white shadow-sm font-semibold border-slate-200/35'
                : 'text-slate-300 hover:text-white border border-transparent'
            }`}
            title="Scripts & Downloadable Archives"
          >
            <Archive className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Backups</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('tutorial')}
            className={`mercury-press flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
              activeTab === 'tutorial'
                ? 'glass-surface-2 text-white shadow-sm font-semibold border-slate-200/35'
                : 'text-slate-300 hover:text-white border border-transparent'
            }`}
            title="Handoff Walkthrough Guide"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Tutorial</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('architecture')}
            className={`mercury-press flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
              activeTab === 'architecture'
                ? 'glass-surface-2 text-white shadow-sm font-semibold border-slate-200/35'
                : 'text-slate-300 hover:text-white border border-transparent'
            }`}
            title="LiquidOS Pi Pipeline & Vault Architecture"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Architecture</span>
          </button>
        </div>

        {/* Route / Address Bar (Shown in preview / split mode) */}
        {isLivePreviewVisible && (
          <div className="flex-1 max-w-xs hidden xl:flex items-center gap-1.5 bg-black/35 border border-white/15 rounded-xl px-2.5 py-1 text-xs font-mono text-slate-300">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 uppercase shrink-0">
              {runtimeInfo.kind}
            </span>
            <input
              type="text"
              value={currentRoute}
              onChange={(e) => setCurrentRoute(e.target.value)}
              className="bg-transparent text-cyan-300 focus:outline-none w-full"
              title={`Active entry: ${runtimeInfo.entryPath}`}
            />
          </div>
        )}

        {/* Viewport, Inspect & Window controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isLivePreviewVisible && (
            <>
              {/* Inspect Mode (🔍) Toggle */}
              <MercuryTooltip content="Inspect preview elements and send CSS/DOM notes to Codex" placement="bottom">
                <button
                  type="button"
                  onClick={() => {
                    setIsInspectMode(!isInspectMode);
                    if (isVisualEditMode) setIsVisualEditMode(false);
                  }}
                  className={`mercury-press flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-medium cursor-pointer border whitespace-nowrap ${
                    isInspectMode
                      ? 'glass-surface-2 border-cyan-400/50 text-cyan-200 font-bold shadow-sm'
                      : 'bg-black/35 border-white/15 text-slate-300 hover:text-white'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Inspect</span>
                </button>
              </MercuryTooltip>

              {/* Visual Edit Mode (✏️) Toggle */}
              <MercuryTooltip content="Open live visual accent and styling controls" placement="bottom">
                <button
                  type="button"
                  onClick={() => {
                    setIsVisualEditMode(!isVisualEditMode);
                    if (isInspectMode) setIsInspectMode(false);
                  }}
                  className={`mercury-press flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-medium cursor-pointer border whitespace-nowrap ${
                    isVisualEditMode
                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 font-bold shadow-sm'
                      : 'bg-black/35 border-white/15 text-slate-300 hover:text-white'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Visual Edit</span>
                </button>
              </MercuryTooltip>

              {/* Viewport switcher */}
              <div className="flex items-center gap-1 bg-black/35 p-1 rounded-xl border border-white/15">
                <MercuryTooltip content="Desktop viewport (full width)" placement="bottom">
                  <button
                    type="button"
                    onClick={() => setViewport('desktop')}
                    aria-label="Desktop 1440px viewport"
                    className={`mercury-press p-1.5 rounded-lg cursor-pointer ${
                      viewport === 'desktop' ? 'bg-white/15 text-cyan-300' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                </MercuryTooltip>
                <MercuryTooltip content="Tablet viewport (768px)" placement="bottom">
                  <button
                    type="button"
                    onClick={() => setViewport('tablet')}
                    aria-label="Tablet 768px viewport"
                    className={`mercury-press p-1.5 rounded-lg cursor-pointer ${
                      viewport === 'tablet' ? 'bg-white/15 text-cyan-300' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Tablet className="w-3.5 h-3.5" />
                  </button>
                </MercuryTooltip>
                <MercuryTooltip content="Mobile viewport (375px)" placement="bottom">
                  <button
                    type="button"
                    onClick={() => setViewport('mobile')}
                    aria-label="Mobile 375px viewport"
                    className={`mercury-press p-1.5 rounded-lg cursor-pointer ${
                      viewport === 'mobile' ? 'bg-white/15 text-cyan-300' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                </MercuryTooltip>
              </div>
            </>
          )}

          {isLivePreviewVisible && (
            <MercuryTooltip content="Capture & index live preview snapshot into local Vector Vault" placement="bottom">
              <button
                type="button"
                data-testid="vectorize-snapshot-btn"
                onClick={captureCurrentPreviewSnapshot}
                disabled={isVectorizing}
                className="mercury-press flex items-center gap-1 px-2 py-1 rounded-xl bg-black/35 hover:bg-white/10 text-cyan-300 border border-white/15 text-xs font-mono tabular-nums cursor-pointer whitespace-nowrap"
              >
                <Database className="w-3.5 h-3.5" />
                <span>{isVectorizing ? 'Indexing...' : `Vec · ${vectorChunkCount}`}</span>
              </button>
            </MercuryTooltip>
          )}

          <MercuryTooltip content="Reload live preview frame" placement="bottom">
            <button
              type="button"
              onClick={handleReload}
              aria-label="Reload preview frame"
              className="mercury-press p-1.5 rounded-xl bg-black/35 hover:bg-white/10 text-slate-300 hover:text-white border border-white/15 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </MercuryTooltip>

          <MercuryTooltip content="Open bundled preview in standalone tab" placement="bottom">
            <button
              type="button"
              onClick={handleOpenNewWindow}
              aria-label="Open preview in new window"
              className="mercury-press p-1.5 rounded-xl bg-black/35 hover:bg-white/10 text-slate-300 hover:text-white border border-white/15 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </MercuryTooltip>

          <MercuryTooltip content="Toggle sandbox console output and JS REPL" placement="bottom">
            <button
              type="button"
              onClick={() => setIsConsoleDrawerOpen(!isConsoleDrawerOpen)}
              className={`mercury-press flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-mono border cursor-pointer whitespace-nowrap ${
                logs.some((l) => l.level === 'error')
                  ? 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                  : isConsoleDrawerOpen
                  ? 'glass-surface-2 text-cyan-300'
                  : 'bg-black/35 border-white/15 text-slate-300 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Logs ({logs.length})</span>
            </button>
          </MercuryTooltip>
        </div>
      </div>

      {/* Inspect Mode Banner Overlay */}
      {isLivePreviewVisible && isInspectMode && (
        <div className="relative z-10 bg-cyan-950/90 border-b border-cyan-800/80 px-4 py-2 text-xs flex items-center justify-between gap-3 text-cyan-200 shrink-0 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>
              <strong>Inspect Mode Active:</strong> Click any section in the preview below to inspect styling, CSS classes, and request AI revisions.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleInspectClick('header.banner', 'flex items-center justify-between pb-6 border-b', 'Enterprise Cloud Sandbox Header')}
              className="mercury-press px-2 py-0.5 rounded-lg bg-cyan-900/80 hover:bg-cyan-800 text-white text-[11px] font-mono cursor-pointer"
            >
              Inspect Header
            </button>
            <button
              type="button"
              onClick={() => handleInspectClick('div.card-d1', 'p-4 rounded-xl bg-slate-900 border border-slate-800', 'Cloudflare D1 SQL card')}
              className="mercury-press px-2 py-0.5 rounded-lg bg-cyan-900/80 hover:bg-cyan-800 text-white text-[11px] font-mono cursor-pointer"
            >
              Inspect D1 Card
            </button>
            <button
              type="button"
              onClick={() => setIsInspectMode(false)}
              aria-label="Close Inspect Mode"
              className="mercury-press p-1 rounded text-cyan-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Visual Edit Mode Styling Bar */}
      {isLivePreviewVisible && isVisualEditMode && (
        <div className="relative z-10 bg-amber-950/90 border-b border-amber-800/80 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-3 text-amber-200 shrink-0 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <Edit3 className="w-4 h-4 text-amber-400" />
              <span>Visual Tweaker:</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-amber-300">Accent:</span>
              {(['cyan', 'amber', 'emerald', 'purple'] as const).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setVisualAccent(color)}
                  aria-label={`Select ${color} accent`}
                  className={`mercury-press w-5 h-5 rounded-full border cursor-pointer ${
                    visualAccent === color ? 'ring-2 ring-white scale-110' : 'opacity-70'
                  } ${
                    color === 'cyan' ? 'bg-cyan-500 border-cyan-300' :
                    color === 'amber' ? 'bg-amber-500 border-amber-300' :
                    color === 'emerald' ? 'bg-emerald-500 border-emerald-300' :
                    'bg-purple-500 border-purple-300'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (onSendInspectToChat) {
                  onSendInspectToChat(`Update the UI styling with ${visualAccent} accent and modern borders`);
                }
              }}
              className="mercury-press px-3 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
            >
              Apply Tweaks via Codex AI
            </button>
            <button
              type="button"
              onClick={() => setIsVisualEditMode(false)}
              aria-label="Close Visual Edit Mode"
              className="mercury-press p-1 rounded text-amber-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Selected Element Inspect Card Overlay */}
      {selectedElement && isLivePreviewVisible && isInspectMode && (
        <div className="relative z-10 mercury-crest-panel mx-3 mt-2 p-3 glass-surface-2 rounded-2xl flex items-center justify-between gap-3 text-xs animate-fadeIn shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 font-mono text-[11px] font-bold border border-cyan-500/30">
                &lt;{selectedElement.tag}&gt;
              </span>
              <span className="text-white font-medium truncate">{selectedElement.text}</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 truncate mt-1">
              Classes: <span className="text-cyan-300">{selectedElement.classes}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (onSendInspectToChat) {
                  onSendInspectToChat(`Refactor element <${selectedElement.tag}> (${selectedElement.classes}): `);
                }
              }}
              className="mercury-press px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask AI to Tweak</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedElement(null)}
              aria-label="Dismiss Inspect Card"
              className="mercury-press p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 overflow-hidden bg-transparent flex justify-center items-center">
        {activeTab === 'preview' && (
          <div className="relative flex items-center justify-center p-2.5 h-full w-full bg-transparent">
            <div className={`mercury-crest-panel glass-surface-2 p-1.5 rounded-2xl transition-all duration-200 flex justify-center ${getViewportWidthClass()}`}>
              <iframe
                key={reloadKey}
                ref={iframeRef}
                title="Codex Live App Preview"
                srcDoc={bundledHtml}
                sandbox="allow-scripts allow-forms allow-modals"
                className="w-full h-full border-none rounded-xl bg-slate-900 shadow-xl"
              />
            </div>
          </div>
        )}

        {activeTab === 'split' && (
          <div
            data-testid="split-screen-runner"
            className="w-full h-full grid grid-cols-1 lg:grid-cols-2 min-h-0 overflow-hidden"
          >
            <div className="h-full min-h-0 overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col">
              {renderCodeEditor}
            </div>
            <div className="h-full min-h-0 flex flex-col bg-slate-950/60 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-black/30 border-b border-white/10 text-[11px] font-mono text-slate-400 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Eye className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-slate-200 font-semibold truncate">{runtimeInfo.entryPath}</span>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 uppercase text-[10px]">
                  {runtimeInfo.kind} sandbox
                </span>
              </div>
              <div className="relative flex-1 flex items-center justify-center p-2.5 min-h-0">
                <div className={`mercury-crest-panel glass-surface-2 p-1.5 rounded-2xl transition-all duration-200 flex justify-center ${getViewportWidthClass()}`}>
                  <iframe
                    key={reloadKey}
                    ref={iframeRef}
                    title="Codex Split-Screen Live Preview"
                    srcDoc={bundledHtml}
                    sandbox="allow-scripts allow-forms allow-modals"
                    className="w-full h-full border-none rounded-xl bg-slate-900 shadow-xl"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'files' && renderFileExplorer}

        {activeTab === 'contract' && renderContract}

        {activeTab === 'code' && renderCodeEditor}

        <div
          className={
            activeTab === 'testing'
              ? 'flex-1 w-full h-full flex flex-col min-h-0 overflow-hidden'
              : 'hidden'
          }
        >
          {renderTesting}
        </div>

        {activeTab === 'terminal' && renderTerminal}

        {activeTab === 'metrics' && renderMetrics}

        {activeTab === 'commits' && renderCommits}

        {activeTab === 'publish' && renderPublish}

        {activeTab === 'play_audit' && renderPlayAudit}

        {activeTab === 'backups' && renderBackups}

        {activeTab === 'architecture' && renderArchitecture}

        {activeTab === 'settings' && renderSettings}

        {activeTab === 'tutorial' && renderTutorial}
      </div>

      {/* Bottom Interactive Console Logs Drawer */}
      {isConsoleDrawerOpen && (
        <div
          data-testid="sandbox-console-drawer"
          className="relative z-10 h-52 border-t border-white/10 glass-surface-1 flex flex-col font-mono text-xs shrink-0 shadow-2xl"
        >
          <div className="flex items-center justify-between px-3 py-1.5 bg-black/30 border-b border-white/10 text-slate-400 gap-2">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-semibold text-slate-300">Sandbox Console</span>
              <span className="text-[11px] text-slate-400">· {logs.length} events</span>
            </div>
            <div className="flex items-center gap-1">
              {(['all', 'log', 'warn', 'error'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLogFilter(lvl)}
                  className={`mercury-press px-1.5 py-0.5 rounded text-[10px] uppercase cursor-pointer ${
                    logFilter === lvl
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  {lvl}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setLogs([])}
                className="mercury-press ml-2 px-1.5 py-0.5 rounded hover:text-slate-200 cursor-pointer"
                title="Clear logs"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setIsConsoleDrawerOpen(false)}
                aria-label="Close Console Drawer"
                className="mercury-press p-1 rounded hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono">
            {logs.filter((l) => logFilter === 'all' || l.level === logFilter).length === 0 ? (
              <div className="text-slate-500 italic">No console logs recorded yet.</div>
            ) : (
              logs
                .filter((l) => logFilter === 'all' || l.level === logFilter)
                .map((log) => (
                  <div key={log.id} className="flex items-start gap-2 py-0.5">
                    <span className="text-slate-500 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span
                      className={`shrink-0 uppercase text-[10px] font-bold px-1 rounded ${
                        log.level === 'error'
                          ? 'bg-rose-950 text-rose-400'
                          : log.level === 'warn'
                          ? 'bg-amber-950 text-amber-400'
                          : 'bg-slate-800 text-cyan-400'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span
                      className={`whitespace-pre-wrap break-all ${
                        log.level === 'error'
                          ? 'text-rose-300'
                          : log.level === 'warn'
                          ? 'text-amber-300'
                          : 'text-slate-300'
                      }`}
                    >
                      {log.message}
                    </span>
                  </div>
                ))
            )}
          </div>

          <form
            onSubmit={handleRunConsoleEval}
            className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border-t border-white/10 shrink-0"
          >
            <span className="text-cyan-400 font-bold">&gt;</span>
            <input
              type="text"
              value={consoleCommand}
              onChange={(e) => setConsoleCommand(e.target.value)}
              placeholder={
                isLivePreviewVisible
                  ? 'Evaluate JS inside isolated preview iframe (e.g. document.title)...'
                  : 'Switch to Preview or Split mode to run sandbox JS commands'
              }
              disabled={!isLivePreviewVisible}
              className="flex-1 bg-transparent text-slate-200 placeholder:text-slate-500 focus:outline-none text-xs font-mono"
            />
            <button
              type="submit"
              disabled={!isLivePreviewVisible || !consoleCommand.trim()}
              className="mercury-press px-2 py-0.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <Send className="w-3 h-3" />
              <span>Run</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
