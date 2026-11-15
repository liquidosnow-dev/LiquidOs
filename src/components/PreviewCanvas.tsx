import React, { useState, useEffect, useRef } from 'react';
import { ProjectFile } from '../types';
import { bundlePreviewHtml } from '../utils/toolExecutor';
import {
  Monitor,
  Tablet,
  Smartphone,
  RotateCcw,
  ExternalLink,
  Terminal,
  Eye,
  Code,
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
} from 'lucide-react';
import { runCapturePipeline } from '../workers/captureWorker';
import { hydrateVectorVault, getVectorVaultStats } from '../services/vectorStore';

export type WorkspaceTabType =
  | 'preview'
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
  const [reloadKey, setReloadKey] = useState(0);
  const [isConsoleDrawerOpen, setIsConsoleDrawerOpen] = useState(false);

  // Inspect mode (🔍) & Visual Edit mode (✏️)
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
  const [vectorChunkCount, setVectorChunkCount] = useState<number>(0);
  const [isVectorizing, setIsVectorizing] = useState<boolean>(false);

  const bundledHtml = bundlePreviewHtml(files);

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
    const bundled = bundlePreviewHtml(files);
    const blob = new Blob([bundled], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
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
    <div className="flex flex-col h-full bg-transparent border-l border-white/10 text-slate-200 overflow-hidden">
      {/* Top Navigation & Workspace Tabs Bar */}
      <div className="flex items-center justify-between px-3 py-2 glass-surface-1 border-x-0 border-t-0 gap-2 shrink-0 overflow-x-auto scrollbar-none">
        {/* Main Tab Controls */}
        <div className="flex items-center gap-1 bg-black/30 p-1 rounded-lg border border-white/10 shrink-0 whitespace-nowrap">
          <button
            type="button"
            onClick={() => onChangeTab('preview')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'preview'
                ? 'bg-gradient-to-r from-cyan-500/80 to-blue-600/80 text-white shadow-sm font-semibold border border-white/15'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('files')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'files'
                ? 'bg-gradient-to-r from-cyan-500/80 to-blue-600/80 text-white shadow-sm font-semibold border border-white/15'
                : 'text-slate-400 hover:text-slate-200'
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
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'contract'
                ? 'bg-gradient-to-r from-cyan-500/80 to-blue-600/80 text-white shadow-sm font-semibold border border-white/15'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="AN-EVC-001 Cross-Runtime Canonicalization & Authority Boundary"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Contract</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('code')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'code'
                ? 'bg-gradient-to-r from-cyan-500/80 to-blue-600/80 text-white shadow-sm font-semibold border border-white/15'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Code</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('testing')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'testing'
                ? 'bg-gradient-to-r from-cyan-500/80 to-blue-600/80 text-white shadow-sm font-semibold border border-white/15'
                : 'text-slate-400 hover:text-slate-200'
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
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'terminal'
                ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Interactive Linux Shell"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Terminal</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('metrics')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'metrics'
                ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Real-Time CPU/GPU & RAM Telemetry"
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Metrics</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('settings')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Apollo Model Hyperparameters & LiteRT Edge"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Settings</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('publish')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'publish'
                ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Genspark Hosting, Cloudflare, GitHub & Play Store"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Publish</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('play_audit')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'play_audit'
                ? 'bg-gradient-to-r from-cyan-500/80 to-blue-600/80 text-white shadow-sm font-semibold border border-white/15'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Google Play Store Readiness & Full-Scale Audit"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Play Audit</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('backups')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'backups'
                ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Scripts & Downloadable Archives"
          >
            <Archive className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Backups</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('tutorial')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'tutorial'
                ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Handoff Walkthrough Guide"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Tutorial</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeTab('architecture')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'architecture'
                ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="LiquidOS Pi Pipeline & Vault Architecture"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Architecture</span>
          </button>
        </div>

        {/* Route / Address Bar (Shown in preview mode) */}
        {activeTab === 'preview' && (
          <div className="flex-1 max-w-xs hidden xl:flex items-center gap-1.5 bg-black/30 border border-white/10 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-300">
            <span className="text-slate-500">https://app.preview</span>
            <input
              type="text"
              value={currentRoute}
              onChange={(e) => setCurrentRoute(e.target.value)}
              className="bg-transparent text-cyan-300 focus:outline-none w-full"
            />
          </div>
        )}

        {/* Viewport, Inspect & Window controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {activeTab === 'preview' && (
            <>
              {/* Inspect Mode (🔍) Toggle */}
              <button
                type="button"
                onClick={() => {
                  setIsInspectMode(!isInspectMode);
                  if (isVisualEditMode) setIsVisualEditMode(false);
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border whitespace-nowrap ${
                  isInspectMode
                    ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200 font-bold shadow-sm'
                    : 'bg-black/30 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
                title="Inspect elements mode (🔍) to point at elements"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Inspect</span>
              </button>

              {/* Visual Edit Mode (✏️) Toggle */}
              <button
                type="button"
                onClick={() => {
                  setIsVisualEditMode(!isVisualEditMode);
                  if (isInspectMode) setIsInspectMode(false);
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border whitespace-nowrap ${
                  isVisualEditMode
                    ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 font-bold shadow-sm'
                    : 'bg-black/30 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
                title="Visual edit mode (✏️) to tweak styling directly"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Visual Edit</span>
              </button>

              {/* Viewport switcher */}
              <div className="flex items-center gap-1 bg-black/30 p-1 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setViewport('desktop')}
                  className={`p-1.5 rounded transition-colors ${
                    viewport === 'desktop' ? 'bg-white/10 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Desktop 1440px"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewport('tablet')}
                  className={`p-1.5 rounded transition-colors ${
                    viewport === 'tablet' ? 'bg-white/10 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Tablet 768px"
                >
                  <Tablet className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewport('mobile')}
                  className={`p-1.5 rounded transition-colors ${
                    viewport === 'mobile' ? 'bg-white/10 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Mobile 375px"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}

          {activeTab === 'preview' && (
            <button
              type="button"
              data-testid="vectorize-snapshot-btn"
              onClick={captureCurrentPreviewSnapshot}
              disabled={isVectorizing}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/30 hover:bg-white/10 text-cyan-300 border border-white/10 text-xs font-mono tabular-nums transition-colors cursor-pointer whitespace-nowrap"
              title="Capture & index live preview snapshot into local Vector Vault"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{isVectorizing ? 'Indexing...' : `Vec · ${vectorChunkCount}`}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleReload}
            className="p-1.5 rounded-lg bg-black/30 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/10 transition-colors"
            title="Reload frame"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleOpenNewWindow}
            className="p-1.5 rounded-lg bg-black/30 hover:bg-white/10 text-slate-400 hover:text-slate-200 border border-white/10 transition-colors"
            title="Open in new window"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsConsoleDrawerOpen(!isConsoleDrawerOpen)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-colors whitespace-nowrap ${
              logs.some((l) => l.level === 'error')
                ? 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                : isConsoleDrawerOpen
                ? 'glass-surface-2 text-cyan-300'
                : 'bg-black/30 border-white/10 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Console Logs"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Logs ({logs.length})</span>
          </button>
        </div>
      </div>

      {/* Inspect Mode Banner Overlay */}
      {activeTab === 'preview' && isInspectMode && (
        <div className="bg-cyan-950/90 border-b border-cyan-800/80 px-4 py-2 text-xs flex items-center justify-between gap-3 text-cyan-200 shrink-0 animate-fadeIn">
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
              className="px-2 py-0.5 rounded bg-cyan-900/80 hover:bg-cyan-800 text-white text-[11px] font-mono cursor-pointer"
            >
              Inspect Header
            </button>
            <button
              type="button"
              onClick={() => handleInspectClick('div.card-d1', 'p-4 rounded-xl bg-slate-900 border border-slate-800', 'Cloudflare D1 SQL card')}
              className="px-2 py-0.5 rounded bg-cyan-900/80 hover:bg-cyan-800 text-white text-[11px] font-mono cursor-pointer"
            >
              Inspect D1 Card
            </button>
            <button
              type="button"
              onClick={() => setIsInspectMode(false)}
              className="text-cyan-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Visual Edit Mode Styling Bar */}
      {activeTab === 'preview' && isVisualEditMode && (
        <div className="bg-amber-950/90 border-b border-amber-800/80 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-3 text-amber-200 shrink-0 animate-fadeIn">
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
                  className={`w-5 h-5 rounded-full border transition-all ${
                    visualAccent === color ? 'ring-2 ring-white scale-110' : 'opacity-70'
                  } ${
                    color === 'cyan' ? 'bg-cyan-500 border-cyan-300' :
                    color === 'amber' ? 'bg-amber-500 border-amber-300' :
                    color === 'emerald' ? 'bg-emerald-500 border-emerald-300' :
                    'bg-purple-500 border-purple-300'
                  }`}
                  title={`${color} accent`}
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
              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              Apply Tweaks via Codex AI
            </button>
            <button
              type="button"
              onClick={() => setIsVisualEditMode(false)}
              className="text-amber-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Selected Element Inspect Card Overlay */}
      {selectedElement && activeTab === 'preview' && isInspectMode && (
        <div className="mx-3 mt-2 p-3 glass-surface-2 rounded-xl flex items-center justify-between gap-3 text-xs animate-fadeIn shrink-0">
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
              className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask AI to Tweak</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedElement(null)}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden bg-transparent flex justify-center items-center">
        {activeTab === 'preview' && (
          <div className="relative flex items-center justify-center p-2 h-full w-full bg-transparent">
            <div className={`transition-all duration-200 flex justify-center ${getViewportWidthClass()}`}>
              <iframe
                key={reloadKey}
                ref={iframeRef}
                title="Codex Live App Preview"
                srcDoc={bundledHtml}
                sandbox="allow-scripts allow-forms allow-modals"
                className="w-full h-full border-none rounded-lg bg-slate-900 shadow-xl"
              />
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

      {/* Bottom Console Logs Drawer */}
      {isConsoleDrawerOpen && (
        <div className="h-44 border-t border-white/10 glass-surface-1 flex flex-col font-mono text-xs shrink-0 shadow-2xl">
          <div className="flex items-center justify-between px-3 py-1.5 bg-black/30 border-b border-white/10 text-slate-400">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-semibold text-slate-300">Sandbox Console Logs</span>
              <span className="text-[11px] text-slate-500">· {logs.length} events</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLogs([])}
                className="hover:text-slate-200 transition-colors"
                title="Clear logs"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setIsConsoleDrawerOpen(false)}
                className="hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono">
            {logs.length === 0 ? (
              <div className="text-slate-600 italic">No console logs recorded yet.</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 py-0.5">
                  <span className="text-slate-600 shrink-0">
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
        </div>
      )}
    </div>
  );
};
