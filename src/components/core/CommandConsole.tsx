import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Terminal,
  Sparkles,
  Play,
  Loader2,
  AlertCircle,
  Columns2,
  Zap,
  Square,
  History,
  Database,
} from 'lucide-react';
import { ChatMessage, ProjectFile } from '../../types';
import { CloudSandboxSpecs, CloudflareBindings } from '../../types/sandbox';
import { executeTerminalCommand } from '../../utils/sandboxEngine';
import { safeEvaluateMath } from '../../utils/toolExecutor';
import { ToolCallCard } from '../ToolCallCard';

interface ConsoleDirectEntry {
  id: string;
  input: string;
  kind: 'shell' | 'math' | 'sql' | 'fetch' | 'error';
  output: string;
  timestamp: number;
}

interface CommandConsoleProps {
  messages: ChatMessage[];
  onSendMessage: (prompt: string, persona?: string) => Promise<void>;
  isLoading: boolean;
  selectedPersona: string;
  activeModelName: string;
  files: ProjectFile[];
  specs: CloudSandboxSpecs;
  bindings: CloudflareBindings;
  autonomousMode: boolean;
  onToggleAutonomousMode: () => void;
  autonomousStatus: string | null;
  onStopAutonomousLoop: () => void;
  onOpenPreviewSplit: () => void;
  onApplyAllFiles: (files: { path: string; content: string }[]) => void;
  externalPrompt?: string;
  onClearExternalPrompt?: () => void;
  focusNonce?: number;
}

const QUICK_COMMANDS = [
  { label: 'Analyze Contract', value: 'Audit canonical contract interop vectors and summarize health.' },
  { label: 'Build Component', value: 'Create a responsive telemetry status widget in dashboard.html' },
  { label: 'math: (256*4)+64', value: 'math: (256*4)+64' },
  { label: 'sql: SELECT * FROM os_tables', value: 'sql: os_state' },
];

export const CommandConsole: React.FC<CommandConsoleProps> = ({
  messages,
  onSendMessage,
  isLoading,
  selectedPersona,
  activeModelName,
  files,
  specs,
  bindings,
  autonomousMode,
  onToggleAutonomousMode,
  autonomousStatus,
  onStopAutonomousLoop,
  onOpenPreviewSplit,
  externalPrompt,
  onClearExternalPrompt,
  focusNonce,
}) => {
  const [mode, setMode] = useState<'codex' | 'sandbox'>('codex');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number>(-1);
  const [directLogs, setDirectLogs] = useState<ConsoleDirectEntry[]>([]);
  const [consoleError, setConsoleError] = useState<string | null>(null);
  const [directRunning, setDirectRunning] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const streamContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (externalPrompt) {
      setInput(externalPrompt);
      onClearExternalPrompt?.();
      inputRef.current?.focus();
    }
  }, [externalPrompt, onClearExternalPrompt]);

  useEffect(() => {
    if (focusNonce && focusNonce > 0) {
      window.setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [focusNonce]);

  useEffect(() => {
    const el = streamContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, directLogs.length]);

  const runDirectCommand = async (raw: string) => {
    setDirectRunning(true);
    setConsoleError(null);
    const trimmed = raw.trim();
    try {
      if (trimmed.startsWith('math:') || /^[\d+\-*/().^\s]+$/.test(trimmed)) {
        const expr = trimmed.replace(/^math:\s*/i, '');
        const evalRes = safeEvaluateMath(expr);
        setDirectLogs((prev) => [
          ...prev,
          {
            id: 'cmd_' + Date.now(),
            input: trimmed,
            kind: evalRes.success ? 'math' : 'error',
            output: evalRes.success
              ? `${expr} = ${evalRes.result}`
              : evalRes.error || 'Math evaluation failed.',
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      if (trimmed.startsWith('sql:') || trimmed === 'os_state') {
        const res = await fetch('/api/os/state');
        const json = await res.json().catch(() => null);
        setDirectLogs((prev) => [
          ...prev,
          {
            id: 'cmd_' + Date.now(),
            input: trimmed,
            kind: res.ok ? 'sql' : 'error',
            output: res.ok
              ? JSON.stringify(
                  {
                    engine: json?.engine,
                    totalBindings: json?.totalBindings,
                    activeBinding: json?.activeBinding?.projectName || null,
                    filesTracked: json?.activeBinding?.filesCount || 0,
                  },
                  null,
                  2
                )
              : `OS DB query failed (HTTP ${res.status})`,
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      if (trimmed.startsWith('fetch ')) {
        const url = trimmed.slice(6).trim();
        const res = await fetch('/api/tools/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const data = await res.json().catch(() => null);
        setDirectLogs((prev) => [
          ...prev,
          {
            id: 'cmd_' + Date.now(),
            input: trimmed,
            kind: res.ok && data?.ok ? 'fetch' : 'error',
            output: data?.ok
              ? `HTTP ${data.status} (${url}):\n${String(data.preview || data.body || '').slice(0, 320)}`
              : data?.error || `Fetch failed (HTTP ${res.status})`,
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      // Default sandbox shell command execution
      const termOut = executeTerminalCommand(trimmed, files, specs, bindings);
      setDirectLogs((prev) => [
        ...prev,
        {
          id: 'cmd_' + Date.now(),
          input: trimmed,
          kind: termOut.exitCode === 0 ? 'shell' : 'error',
          output: termOut.output,
          timestamp: Date.now(),
        },
      ]);
    } catch (err: any) {
      setConsoleError(err?.message || 'Command execution failed.');
    } finally {
      setDirectRunning(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const raw = input.trim();
    if (!raw || isLoading || directRunning) return;

    setConsoleError(null);
    setHistory((prev) => [raw, ...prev.filter((item) => item !== raw)].slice(0, 30));
    setHistoryCursor(-1);
    setInput('');

    const isExplicitDirect =
      mode === 'sandbox' ||
      raw.startsWith('math:') ||
      raw.startsWith('sql:') ||
      raw.startsWith('fetch ') ||
      /^(ls|pwd|uname|cat |whoami|wrangler|pnpm|npm|help)$/i.test(raw);

    if (isExplicitDirect) {
      await runDirectCommand(raw);
      return;
    }

    try {
      await onSendMessage(raw, selectedPersona);
    } catch (err: any) {
      setConsoleError(err?.message || 'Codex inference encountered an error.');
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      if (history.length === 0) return;
      e.preventDefault();
      const nextIdx = Math.min(historyCursor + 1, history.length - 1);
      setHistoryCursor(nextIdx);
      setInput(history[nextIdx]);
    } else if (e.key === 'ArrowDown') {
      if (historyCursor <= 0) {
        setHistoryCursor(-1);
        setInput('');
      } else {
        const nextIdx = historyCursor - 1;
        setHistoryCursor(nextIdx);
        setInput(history[nextIdx]);
      }
    }
  };

  const recentMessages = messages.slice(-6);

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col gap-2">
      {/* Mode & Capability Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMode('codex')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1 cursor-pointer ${
              mode === 'codex'
                ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-100'
                : 'bg-slate-900/60 border-slate-300/15 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>Codex AI ({activeModelName})</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('sandbox')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1 cursor-pointer ${
              mode === 'sandbox'
                ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-100'
                : 'bg-slate-900/60 border-slate-300/15 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3 h-3" />
            <span>Direct Shell / Math / SQL</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleAutonomousMode}
            className={`px-2 py-1 rounded-lg text-[10px] font-medium border flex items-center gap-1 cursor-pointer ${
              autonomousMode
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-900/70 border-slate-700 text-slate-400'
            }`}
            title="Toggle RecursiveEngine autonomous multi-step synthesis"
          >
            <Zap className="w-3 h-3" />
            <span>Recursive {autonomousMode ? 'ON' : 'OFF'}</span>
          </button>
          <button
            type="button"
            onClick={onOpenPreviewSplit}
            className="mercury-press px-2.5 py-1 rounded-lg text-[11px] font-medium border border-slate-300/20 bg-slate-900/75 text-slate-200 hover:border-cyan-400/45 flex items-center gap-1 cursor-pointer"
          >
            <Columns2 className="w-3 h-3 text-cyan-300" />
            <span>Split Preview</span>
          </button>
        </div>
      </div>

      {/* Live Output Stream */}
      <div
        ref={streamContainerRef}
        className="flex-1 min-h-0 overflow-y-auto rounded-xl bg-[#03060d]/80 border border-slate-300/15 p-2.5 space-y-2"
      >
        {consoleError && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-950/50 border border-rose-500/45 px-2.5 py-1.5 text-xs text-rose-200">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
            <span>{consoleError}</span>
          </div>
        )}

        {mode === 'sandbox' ? (
          directLogs.length === 0 ? (
            <div className="text-[11px] text-slate-400 font-mono py-2 px-1">
              Ready for direct sandbox commands (`ls`, `uname`, `wrangler`, `math: 2^10`, `sql: os_state`, `fetch https://example.com`).
            </div>
          ) : (
            directLogs.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg bg-slate-950/80 border border-slate-300/10 p-2 font-mono text-[11px]"
              >
                <div className="flex items-center justify-between text-cyan-300 mb-1">
                  <span>&gt; {entry.input}</span>
                  <span className="text-[9px] uppercase text-slate-400">{entry.kind}</span>
                </div>
                <pre
                  className={`whitespace-pre-wrap break-words text-[11px] ${
                    entry.kind === 'error' ? 'text-rose-300' : 'text-slate-200'
                  }`}
                >
                  {entry.output}
                </pre>
              </div>
            ))
          )
        ) : (
          recentMessages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-xl px-3 py-2 text-xs border ${
                msg.sender === 'user'
                  ? 'bg-cyan-950/30 border-cyan-500/25 text-cyan-50 ml-8'
                  : 'bg-slate-950/75 border-slate-300/15 text-slate-200 mr-4'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 mb-1">
                <span className="font-semibold text-slate-300">
                  {msg.sender === 'user' ? 'Operator' : msg.model || 'Liquid AI'}
                </span>
                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="whitespace-pre-wrap break-words leading-relaxed line-clamp-4">
                {msg.content}
              </div>
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-2 space-y-1">
                  {msg.toolCalls.slice(0, 2).map((tc) => (
                    <ToolCallCard key={tc.id} toolCall={tc} />
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        {(isLoading || directRunning) && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-cyan-950/35 border border-cyan-500/30 px-3 py-1.5 text-xs text-cyan-200">
            <span className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-300" />
              <span>{autonomousStatus || 'Executing command in Liquid AI runtime...'}</span>
            </span>
            {autonomousStatus && (
              <button
                type="button"
                onClick={onStopAutonomousLoop}
                className="px-2 py-0.5 rounded bg-rose-950/70 border border-rose-500/40 text-[10px] text-rose-200 flex items-center gap-1 cursor-pointer"
              >
                <Square className="w-2.5 h-2.5" /> Stop
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick Prompts & Execution Bar */}
      <form onSubmit={handleSubmit} className="shrink-0 space-y-1.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="text-[10px] text-slate-500 flex items-center gap-1 shrink-0">
            <History className="w-3 h-3" /> Quick:
          </span>
          {QUICK_COMMANDS.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => {
                setInput(q.value);
                inputRef.current?.focus();
              }}
              className="px-2 py-0.5 rounded-md bg-slate-900/75 border border-slate-300/15 hover:border-cyan-400/40 text-[10px] text-slate-300 hover:text-cyan-200 whitespace-nowrap cursor-pointer"
            >
              {q.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-[#040812]/90 border border-slate-300/25 focus-within:border-cyan-400/60 px-3 py-1.5 shadow-[inset_0_1px_0_rgba(248,250,252,0.12)]">
          <span className="text-cyan-400 font-mono text-sm font-bold shrink-0">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={
              mode === 'codex'
                ? 'Enter command or ask Liquid AI anything (ArrowUp for history)...'
                : 'Enter shell cmd, math: expr, sql: os_state, or fetch https://...'
            }
            aria-label="Command Console Input"
            className="flex-1 bg-transparent text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || directRunning}
            aria-label="Execute command"
            className="mercury-press w-8 h-8 rounded-full flex items-center justify-center bg-cyan-500/20 border border-cyan-300/45 text-cyan-200 hover:bg-cyan-500/35 disabled:opacity-40 cursor-pointer shrink-0"
          >
            {isLoading || directRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowRight className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
