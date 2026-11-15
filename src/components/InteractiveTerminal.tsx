import React, { useState, useRef, useEffect } from 'react';
import { ProjectFile } from '../types';
import { CloudSandboxSpecs, CloudflareBindings } from '../types/sandbox';
import { executeTerminalCommand } from '../utils/sandboxEngine';
import { Terminal as TermIcon, Play, Trash2, Copy, Check, CornerDownLeft } from 'lucide-react';

interface TerminalEntry {
  id: string;
  command: string;
  output: string;
  exitCode: number;
  timestamp: number;
}

interface InteractiveTerminalProps {
  files: ProjectFile[];
  specs: CloudSandboxSpecs;
  bindings: CloudflareBindings;
}

export const InteractiveTerminal: React.FC<InteractiveTerminalProps> = ({
  files,
  specs,
  bindings,
}) => {
  const [history, setHistory] = useState<TerminalEntry[]>([
    {
      id: 'init_1',
      command: 'uname -a',
      output: 'Linux sandbox-ent-hono 6.6.13-cloud-x86_64 #1 SMP PREEMPT_DYNAMIC GNU/Linux',
      exitCode: 0,
      timestamp: Date.now() - 60000,
    },
    {
      id: 'init_2',
      command: 'pnpm run dev',
      output: `> liquidos-hono-app@1.0.0 dev /home/user/webapp\n> vite\n\n  VITE v6.0.0  ready in 142 ms\n\n  ➜  Local:   http://localhost:3000/\n  ➜  Hono API: http://localhost:8787/api\n  ➜  press h + enter to show help`,
      exitCode: 0,
      timestamp: Date.now() - 50000,
    },
  ]);
  const [inputCommand, setInputCommand] = useState('');
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleRunCommand = (cmdToRun?: string) => {
    const cmd = (cmdToRun !== undefined ? cmdToRun : inputCommand).trim();
    if (!cmd) return;

    if (cmd === 'clear') {
      setHistory([]);
      setInputCommand('');
      setHistoryIndex(-1);
      return;
    }

    const { output, exitCode } = executeTerminalCommand(cmd, files, specs, bindings);

    setHistory(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        command: cmd,
        output,
        exitCode,
        timestamp: Date.now(),
      },
    ]);

    setInputCommand('');
    setHistoryIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRunCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const nextIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIndex);
        setInputCommand(history[nextIndex].command);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const nextIndex = historyIndex + 1;
        if (nextIndex >= history.length) {
          setHistoryIndex(-1);
          setInputCommand('');
        } else {
          setHistoryIndex(nextIndex);
          setInputCommand(history[nextIndex].command);
        }
      }
    }
  };

  const handleCopyOutput = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const quickPills = [
    { label: 'AN-EVC-001 Interop (36/36)', cmd: 'node verification-tools/interop.mjs' },
    { label: 'Master Suite (186/186)', cmd: 'node tests/run-all.mjs' },
    { label: 'Hono Dev Server', cmd: 'pnpm run dev' },
    { label: 'Wrangler D1 Query', cmd: 'wrangler d1 execute DB_PROD' },
    { label: 'Files List', cmd: 'ls -la' },
    { label: 'Clear Screen', cmd: 'clear' },
  ];

  return (
    <div
      className="flex flex-col h-full bg-slate-950 font-mono text-xs text-slate-200 overflow-hidden"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
          </div>
          <span className="text-xs font-semibold text-slate-300 font-sans ml-1">
            Sandbox Linux Terminal
          </span>
          <span className="text-[10px] text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800">
            {specs.containerId}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-sans">
            Plan: <span className="text-white font-bold">{specs.plan}</span> ({specs.cpus} vCPU / {specs.ramGb}GB)
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setHistory([]);
            }}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
            title="Clear terminal history"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick command buttons */}
      <div className="flex items-center gap-1.5 p-2 bg-slate-900/60 border-b border-slate-800/80 overflow-x-auto shrink-0 scrollbar-none">
        <span className="text-[10px] text-slate-500 font-sans uppercase font-bold shrink-0">Quick:</span>
        {quickPills.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRunCommand(p.cmd);
            }}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 text-[11px] whitespace-nowrap transition-colors border border-slate-700/60 cursor-pointer"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Terminal Output stream */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3 font-mono">
        <div className="text-slate-400 text-[11px]">
          Dedicated persistent Enterprise Linux sandbox running Hono v4 + Cloudflare Workers edge environment.
          Type commands or choose from quick shortcuts above.
        </div>

        {history.map((item) => (
          <div key={item.id} className="space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-emerald-400 font-bold">user@sandbox</span>
                <span className="text-slate-500">:</span>
                <span className="text-cyan-400">~/webapp</span>
                <span className="text-slate-500">$</span>
                <span className="text-white font-semibold">{item.command}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {item.exitCode !== 0 && (
                  <span className="text-[10px] text-red-400 bg-red-950 px-1 rounded">
                    exit {item.exitCode}
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyOutput(item.id, item.output);
                  }}
                  className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300"
                  title="Copy output"
                >
                  {copiedId === item.id ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
            {item.output && (
              <pre className="text-slate-300 whitespace-pre-wrap text-[11px] bg-slate-900/40 p-2 rounded border border-slate-800/40 overflow-x-auto">
                {item.output}
              </pre>
            )}
          </div>
        ))}

        {/* Active command prompt */}
        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-emerald-400 font-bold shrink-0">user@sandbox</span>
          <span className="text-slate-500">:</span>
          <span className="text-cyan-400 shrink-0">~/webapp</span>
          <span className="text-slate-500">$</span>
          <input
            ref={inputRef}
            type="text"
            value={inputCommand}
            onChange={(e) => setInputCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-white font-mono text-xs focus:outline-none min-w-0"
            placeholder="Type bash command (e.g. pnpm run dev, wrangler d1 execute)..."
            autoFocus
          />
          <button
            type="button"
            onClick={() => handleRunCommand()}
            className="p-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white shrink-0 cursor-pointer"
            title="Execute (Enter)"
          >
            <CornerDownLeft className="w-3 h-3" />
          </button>
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
