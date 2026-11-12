import React, { useState, useEffect, useRef } from 'react';
import { ProjectFile } from '../types';
import { bundlePreviewHtml } from '../utils/toolExecutor';
import { Monitor, Tablet, Smartphone, RotateCcw, ExternalLink, Terminal, Eye, Code, Cpu, Sliders, CheckCircle2, AlertTriangle, X } from 'lucide-react';

interface ConsoleLog {
  id: string;
  level: 'log' | 'warn' | 'error';
  message: string;
  timestamp: number;
}

interface PreviewCanvasProps {
  files: ProjectFile[];
  activeTab: 'preview' | 'code' | 'console' | 'architecture' | 'settings';
  onChangeTab: (tab: 'preview' | 'code' | 'console' | 'architecture' | 'settings') => void;
  renderCodeEditor?: React.ReactNode;
  renderArchitecture?: React.ReactNode;
  renderSettings?: React.ReactNode;
}

export const PreviewCanvas: React.FC<PreviewCanvasProps> = ({
  files,
  activeTab,
  onChangeTab,
  renderCodeEditor,
  renderArchitecture,
  renderSettings,
}) => {
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [currentRoute, setCurrentRoute] = useState('/');
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [isConsoleDrawerOpen, setIsConsoleDrawerOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Listen for console logs sent from the isolated iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'SANDBOX_CONSOLE') {
        setLogs(prev => [
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
    setReloadKey(prev => prev + 1);
  };

  const handleOpenNewWindow = () => {
    const bundled = bundlePreviewHtml(files);
    const blob = new Blob([bundled], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const bundledHtml = bundlePreviewHtml(files);

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

  return (
    <div className="flex flex-col h-full bg-slate-950 border-l border-slate-800 text-slate-200 overflow-hidden">
      {/* Top Navigation & Toolbar Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 gap-2 shrink-0">
        {/* Main Tab Controls */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => onChangeTab('preview')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'preview'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview</span>
          </button>

          <button
            onClick={() => onChangeTab('code')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'code'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Code</span>
          </button>

          <button
            onClick={() => onChangeTab('architecture')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'architecture'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="LiquidOS Pi Pipeline & Vault Architecture"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Architecture</span>
          </button>

          <button
            onClick={() => onChangeTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Apollo Model Hyperparameters"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>

        {/* Route / Address Bar (Shown in preview mode) */}
        {activeTab === 'preview' && (
          <div className="flex-1 max-w-sm hidden md:flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-300">
            <span className="text-slate-500">https://app.preview</span>
            <input
              type="text"
              value={currentRoute}
              onChange={(e) => setCurrentRoute(e.target.value)}
              className="bg-transparent text-cyan-300 focus:outline-none w-full"
            />
          </div>
        )}

        {/* Viewport & Window controls */}
        <div className="flex items-center gap-1">
          {activeTab === 'preview' && (
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setViewport('desktop')}
                className={`p-1.5 rounded transition-colors ${
                  viewport === 'desktop' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Desktop 1440px"
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewport('tablet')}
                className={`p-1.5 rounded transition-colors ${
                  viewport === 'tablet' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Tablet 768px"
              >
                <Tablet className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewport('mobile')}
                className={`p-1.5 rounded transition-colors ${
                  viewport === 'mobile' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Mobile 375px"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={handleReload}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
            title="Reload frame"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleOpenNewWindow}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
            title="Open in new window"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsConsoleDrawerOpen(!isConsoleDrawerOpen)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
              logs.some(l => l.level === 'error')
                ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                : isConsoleDrawerOpen
                ? 'bg-slate-800 border-slate-700 text-cyan-400'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Console Logs"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Logs ({logs.length})</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden bg-slate-950 flex justify-center items-center">
        {activeTab === 'preview' && (
          <div className={`relative flex items-center justify-center p-2 h-full w-full bg-slate-950`}>
            <div className={`transition-all duration-200 flex justify-center ${getViewportWidthClass()}`}>
              <iframe
                key={reloadKey}
                ref={iframeRef}
                title="Codex Live App Preview"
                srcDoc={bundledHtml}
                sandbox="allow-scripts allow-forms allow-same-origin allow-modals"
                className="w-full h-full border-none rounded-lg bg-slate-900 shadow-xl"
              />
            </div>
          </div>
        )}

        {activeTab === 'code' && renderCodeEditor}

        {activeTab === 'architecture' && renderArchitecture}

        {activeTab === 'settings' && renderSettings}
      </div>

      {/* Bottom Console Logs Drawer */}
      {isConsoleDrawerOpen && (
        <div className="h-44 border-t border-slate-800 bg-slate-950 flex flex-col font-mono text-xs shrink-0 shadow-2xl">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-slate-400">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-semibold text-slate-300">Sandbox Console Logs</span>
              <span className="text-[11px] text-slate-500">· {logs.length} events</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLogs([])}
                className="hover:text-slate-200 text-[11px] px-2 py-0.5 rounded bg-slate-800"
              >
                Clear
              </button>
              <button
                onClick={() => setIsConsoleDrawerOpen(false)}
                className="hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {logs.length === 0 ? (
              <div className="text-slate-600 text-center py-6">No console output yet. Interacting with the application will capture logs here.</div>
            ) : (
              logs.map(log => (
                <div
                  key={log.id}
                  className={`flex items-start gap-2 py-0.5 px-2 rounded text-[11px] ${
                    log.level === 'error'
                      ? 'bg-rose-950/40 text-rose-300 font-semibold'
                      : log.level === 'warn'
                      ? 'bg-amber-950/40 text-amber-300'
                      : 'text-slate-300 hover:bg-slate-900/60'
                  }`}
                >
                  <span className="text-slate-600 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`uppercase font-bold shrink-0 text-[10px] px-1 rounded ${
                      log.level === 'error'
                        ? 'bg-rose-900 text-rose-200'
                        : log.level === 'warn'
                        ? 'bg-amber-900 text-amber-200'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {log.level}
                  </span>
                  <span className="break-all">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
