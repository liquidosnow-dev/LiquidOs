import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  FileArchive,
  Layers,
  Terminal,
  ShieldCheck,
  Cpu,
  LayoutTemplate,
  FileText,
  Download,
  RefreshCw,
} from 'lucide-react';

interface ModuleFileEntry {
  path: string;
  source: 'disk' | 'workspace';
  lines: number;
  bytes: number;
  sha256: string;
  content: string;
}

interface CoalitionModulePayload {
  moduleId: string;
  title: string;
  description: string;
  promptSnippet: string;
  files: ModuleFileEntry[];
}

interface CoalitionHandshakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExportTar: (scope: 'workspace' | 'fullstack') => Promise<void>;
  isExporting?: boolean;
}

const MODULE_TABS = [
  { id: 'skill', label: 'Skill/prompt.md', meta: 'Handshake', icon: FileText },
  { id: 'module-1', label: 'Module 1', meta: 'Core Runtime', icon: Terminal },
  { id: 'module-2', label: 'Module 2', meta: 'Contract & Crypto', icon: ShieldCheck },
  { id: 'module-3', label: 'Module 3', meta: 'Pi Pipeline', icon: Cpu },
  { id: 'module-4', label: 'Module 4', meta: 'Glass UI Tabs', icon: LayoutTemplate },
] as const;

type ModuleTabId = (typeof MODULE_TABS)[number]['id'];

export const CoalitionHandshakeModal: React.FC<CoalitionHandshakeModalProps> = ({
  isOpen,
  onClose,
  onExportTar,
  isExporting = false,
}) => {
  const [activeModule, setActiveModule] = useState<ModuleTabId>('skill');
  const [moduleData, setModuleData] = useState<CoalitionModulePayload | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoading(true);
    setErrorMsg(null);

    fetch(`/api/workspace/coalition-module/${activeModule}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data: CoalitionModulePayload) => {
        if (cancelled) return;
        setModuleData(data);
        setSelectedFilePath(data.files[0]?.path || '');
      })
      .catch((err: any) => {
        if (cancelled) return;
        setErrorMsg(err?.message || 'Failed to load coalition module payload');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeModule]);

  if (!isOpen) return null;

  const activeFile =
    moduleData?.files.find((f) => f.path === selectedFilePath) || moduleData?.files[0] || null;

  const totalLines = moduleData?.files.reduce((sum, f) => sum + f.lines, 0) ?? 0;
  const totalBytes = moduleData?.files.reduce((sum, f) => sum + f.bytes, 0) ?? 0;

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyFullModuleBundle = () => {
    if (!moduleData) return;
    const bundled = moduleData.files
      .map(
        (f) =>
          `// ============================================================================\n// FILE: ${f.path} (${f.lines} lines · sha256:${f.sha256.slice(0, 16)})\n// ============================================================================\n${f.content}`
      )
      .join('\n\n');
    handleCopy(`bundle:${moduleData.moduleId}`, bundled);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Coalition Code-Assembly Handshake"
    >
      <div className="w-full max-w-6xl h-[86vh] glass-surface-2 rounded-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Top Modal Header */}
        <div className="px-5 py-4 glass-surface-1 border-x-0 border-t-0 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/80 to-violet-600/80 border border-white/20 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white truncate">
                Coalition Code-Assembly Handshake &amp; Direct Archive Export
              </h2>
              <div className="text-[11px] font-mono text-slate-400 truncate">
                Sequential Modular Protocol · Skill/prompt.md · POSIX .tar.gz Export
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onExportTar('workspace')}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-surface-1 hover:border-cyan-400/50 text-xs font-medium text-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <FileArchive className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export Workspace .tar.gz</span>
            </button>

            <button
              type="button"
              onClick={() => onExportTar('fullstack')}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500/90 to-blue-600/90 hover:from-cyan-400 hover:to-blue-500 text-xs font-semibold text-white border border-white/15 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Bundling .tar.gz...' : 'Export Full-Stack .tar.gz'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sequential Module Switcher */}
        <div className="px-5 py-2.5 border-b border-white/10 bg-black/25 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
          {MODULE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeModule === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveModule(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'glass-surface-3 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-300' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                <span className="text-[10px] font-mono text-slate-400">· {tab.meta}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-xs font-mono text-slate-400">
            <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
            <span>Reading unabridged module source from workspace...</span>
          </div>
        ) : errorMsg ? (
          <div className="flex-1 flex items-center justify-center text-xs font-mono text-rose-300 p-6">
            Failed to load module: {errorMsg}
          </div>
        ) : moduleData ? (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
            {/* Left Pane: Module Manifest & Handshake Prompt */}
            <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-white/10 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4">
              <div>
                <div className="text-xs font-semibold text-white">{moduleData.title}</div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {moduleData.description}
                </p>
                <div className="text-[11px] font-mono tabular-nums text-cyan-300 mt-2">
                  {moduleData.files.length} files · {totalLines.toLocaleString()} lines ·{' '}
                  {(totalBytes / 1024).toFixed(1)} KB
                </div>
              </div>

              {/* Files in this Module */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-300">
                    Module Files
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyFullModuleBundle}
                    className="flex items-center gap-1 text-[11px] font-mono text-cyan-300 hover:text-cyan-200 cursor-pointer whitespace-nowrap"
                  >
                    {copiedKey === `bundle:${moduleData.moduleId}` ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Copied Bundle</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy All ({moduleData.files.length})</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="divide-y divide-white/10 border border-white/10 rounded-xl overflow-hidden bg-black/25">
                  {moduleData.files.map((file) => {
                    const isSelected = activeFile?.path === file.path;
                    return (
                      <button
                        key={file.path}
                        type="button"
                        onClick={() => setSelectedFilePath(file.path)}
                        className={`w-full px-3 py-2 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500/15 text-white'
                            : 'hover:bg-white/5 text-slate-300'
                        }`}
                      >
                        <div className="text-xs font-mono font-medium truncate">{file.path}</div>
                        <div className="text-[10px] font-mono tabular-nums text-slate-400 mt-0.5 flex items-center justify-between gap-2">
                          <span>
                            {file.lines.toLocaleString()} lines · {(file.bytes / 1024).toFixed(1)} KB
                          </span>
                          <span className="text-slate-500">{file.sha256.slice(0, 10)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Handshake Prompt Snippet for External Platform */}
              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-300">
                    Agent Dispatch Prompt
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(`prompt:${moduleData.moduleId}`, moduleData.promptSnippet)
                    }
                    className="flex items-center gap-1 px-2 py-1 rounded-md glass-surface-1 text-[11px] font-mono text-violet-200 hover:border-violet-400/50 cursor-pointer whitespace-nowrap"
                  >
                    {copiedKey === `prompt:${moduleData.moduleId}` ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Copied Prompt</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Prompt</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-black/40 border border-white/10 text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                  {moduleData.promptSnippet}
                </pre>
              </div>
            </div>

            {/* Right Pane: Unabridged Source Preview */}
            <div className="lg:col-span-8 flex flex-col min-h-0 overflow-hidden bg-black/20">
              {activeFile ? (
                <>
                  <div className="px-4 py-2.5 border-b border-white/10 bg-black/30 flex items-center justify-between gap-3 shrink-0">
                    <div className="min-w-0">
                      <div className="text-xs font-mono font-semibold text-cyan-300 truncate">
                        {activeFile.path}
                      </div>
                      <div className="text-[10px] font-mono tabular-nums text-slate-400">
                        {activeFile.lines.toLocaleString()} lines · {(activeFile.bytes / 1024).toFixed(1)} KB · sha256:{activeFile.sha256.slice(0, 16)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(`file:${activeFile.path}`, activeFile.content)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-surface-1 hover:border-cyan-400/50 text-xs font-medium text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {copiedKey === `file:${activeFile.path}` ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied Source</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Copy File Source</span>
                        </>
                      )}
                    </button>
                  </div>

                  <pre className="flex-1 overflow-auto p-4 text-[11px] font-mono text-slate-200 leading-relaxed whitespace-pre">
                    {activeFile.content}
                  </pre>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                  Select a file to inspect its unabridged source.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
