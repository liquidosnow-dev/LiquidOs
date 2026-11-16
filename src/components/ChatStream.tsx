import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ToolCall, ProjectFile } from '../types';
import { ToolCallCard } from './ToolCallCard';
import { CodeBlock } from './CodeBlock';
import { extractFilesFromResponse } from '../utils/toolExecutor';
import {
  Send,
  Mic,
  Image as ImageIcon,
  Sparkles,
  Plus,
  Check,
  Play,
  Loader2,
  ArrowUp,
  Zap,
  AtSign,
  FileCode,
} from 'lucide-react';

interface ChatStreamProps {
  messages: ChatMessage[];
  onSendMessage: (prompt: string, persona?: string) => Promise<void>;
  isLoading: boolean;
  selectedPersona: string;
  onSelectPersona: (persona: string) => void;
  onRunInCanvas: (code: string) => void;
  onApplyToFile: (filepath: string, code: string) => void;
  onApplyAllFiles: (files: { path: string; content: string }[]) => void;
  activeModelName: string;
  files?: ProjectFile[];
  externalPrompt?: string;
  onClearExternalPrompt?: () => void;
  autonomousMode?: boolean;
  onToggleAutonomousMode?: () => void;
  autonomousStatus?: string | null;
  onStopAutonomousLoop?: () => void;
}

const PERSONA_PRESETS = [
  { id: 'fullstack', name: 'Full-Stack App Builder', icon: '⚡' },
  { id: 'architect', name: 'LiquidOS System Architect', icon: '💧' },
  { id: 'data_analyst', name: 'Python Data Analyst', icon: '📊' },
  { id: 'bug_hunter', name: 'Bug Hunter & Refactorer', icon: '🔍' },
  { id: 'ui_designer', name: 'React UI Designer', icon: '🎨' },
];

export const ChatStream: React.FC<ChatStreamProps> = ({
  messages,
  onSendMessage,
  isLoading,
  selectedPersona,
  onSelectPersona,
  onRunInCanvas,
  onApplyToFile,
  onApplyAllFiles,
  activeModelName,
  files = [],
  externalPrompt,
  onClearExternalPrompt,
  autonomousMode = true,
  onToggleAutonomousMode,
  autonomousStatus,
  onStopAutonomousLoop,
}) => {
  const [inputPrompt, setInputPrompt] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [atFilter, setAtFilter] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync external prompt when passed (e.g. from Inspect mode or File Explorer)
  useEffect(() => {
    if (externalPrompt) {
      setInputPrompt((prev) => (prev ? prev + ' ' + externalPrompt : externalPrompt));
      if (onClearExternalPrompt) onClearExternalPrompt();
      textareaRef.current?.focus();
    }
  }, [externalPrompt, onClearExternalPrompt]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputPrompt.trim() || isLoading) return;

    const text = inputPrompt.trim();
    setInputPrompt('');
    setShowFilePicker(false);
    await onSendMessage(text, selectedPersona);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputPrompt(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1 && (atIndex === 0 || /\s/.test(textBeforeCursor[atIndex - 1]))) {
      const query = textBeforeCursor.slice(atIndex + 1);
      if (!/\s/.test(query)) {
        setShowFilePicker(true);
        setAtFilter(query.toLowerCase());
        return;
      }
    }
    setShowFilePicker(false);
  };

  const handleSelectMentionFile = (filePath: string) => {
    const cursorPos = textareaRef.current?.selectionStart || inputPrompt.length;
    const textBeforeCursor = inputPrompt.slice(0, cursorPos);
    const textAfterCursor = inputPrompt.slice(cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1) {
      const newText = textBeforeCursor.slice(0, atIndex) + '@' + filePath + ' ' + textAfterCursor;
      setInputPrompt(newText);
    } else {
      setInputPrompt(inputPrompt + ' @' + filePath + ' ');
    }
    setShowFilePicker(false);
    textareaRef.current?.focus();
  };

  // Microphone Audio Speech-to-Text
  const handleToggleVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsRecording(true);
      setTimeout(() => {
        setIsRecording(false);
        setInputPrompt('Generate a responsive analytics dashboard with Hono D1 and live charts.');
      }, 1500);
      return;
    }

    try {
      if (isRecording) {
        setIsRecording(false);
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsRecording(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputPrompt((prev) => (prev ? prev + ' ' + transcript : transcript));
        setIsRecording(false);
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);

      recognition.start();
    } catch {
      setIsRecording(false);
    }
  };

  // Helper to render message content with embedded ToolCall cards and Code blocks
  const renderMessageContent = (msg: ChatMessage) => {
    if (msg.sender === 'user') {
      return <div className="text-sm text-slate-100 whitespace-pre-wrap">{msg.content}</div>;
    }

    // Assistant message: extract files
    const { files: parsedFiles } = extractFilesFromResponse(msg.content);

    // Split markdown by code blocks to interleave text and CodeBlock components
    const codeBlockRegex = /```([a-zA-Z0-9_-]+)?(?:\s+(?:<!--|\/\/|\/\*)\s*filepath:\s*([^\s*>-]+)\s*(?:-->|\*\/)?)?\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(msg.content)) !== null) {
      const textBefore = msg.content.substring(lastIndex, match.index).trim();
      if (textBefore) {
        parts.push(
          <div key={`text-${lastIndex}`} className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap my-2">
            {textBefore}
          </div>
        );
      }

      const lang = match[1] || 'html';
      const filepath = match[2];
      const code = match[3];

      parts.push(
        <CodeBlock
          key={`code-${match.index}`}
          code={code}
          language={lang}
          filepath={filepath}
          onRunInCanvas={onRunInCanvas}
          onApplyToFile={onApplyToFile}
        />
      );

      lastIndex = match.index + match[0].length;
    }

    const trailingText = msg.content.substring(lastIndex).trim();
    if (trailingText) {
      parts.push(
        <div key={`text-end`} className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap my-2">
          {trailingText}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {/* Render Model Tool Calls if any (Radix-style collapsible timeline cards) */}
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="space-y-1 mb-3">
            <div className="text-[11px] font-mono text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>Model Tool Executions ({msg.toolCalls.length})</span>
            </div>
            {msg.toolCalls.map((tc) => (
              <ToolCallCard key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}

        {parts.length > 0 ? parts : <div className="text-sm text-slate-200">{msg.content}</div>}

        {/* Quick Batch Apply Bar if files were generated */}
        {parsedFiles.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-mono">
              Generated {parsedFiles.length} project {parsedFiles.length === 1 ? 'file' : 'files'}
            </span>
            <button
              type="button"
              onClick={() => onApplyAllFiles(parsedFiles)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply All to Workspace</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  const matchingFiles = files.filter((f) => f.path.toLowerCase().includes(atFilter));

  return (
    <div className="flex flex-col h-full bg-transparent text-slate-100 overflow-hidden">
      {/* Persona Presets Bar (Tier 1 Glass) */}
      <div className="flex items-center gap-1.5 p-2 glass-surface-1 border-x-0 border-t-0 overflow-x-auto scrollbar-none shrink-0">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pl-1.5 mr-1 shrink-0">
          Codex Persona:
        </span>
        {PERSONA_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelectPersona(p.name)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
              selectedPersona === p.name
                ? 'glass-surface-2 text-white font-semibold'
                : 'bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300'
            }`}
          >
            <span>{p.icon}</span>
            <span>{p.name}</span>
          </button>
        ))}
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-lg bg-cyan-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-md mt-0.5">
                  💧
                </div>
              )}

              <div
                className={`max-w-2xl rounded-2xl p-4 transition-all ${
                  isUser
                    ? 'glass-bubble-user text-slate-100'
                    : 'glass-surface-2 text-slate-100'
                }`}
              >
                {!isUser && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pb-2 mb-2 border-b border-white/10">
                    <div className="flex items-center gap-1.5 font-mono text-cyan-400 font-semibold">
                      <span>{msg.model || activeModelName}</span>
                      {msg.persona && (
                        <>
                          <span className="text-slate-600">·</span>
                          <span className="text-slate-400 font-sans">{msg.persona}</span>
                        </>
                      )}
                    </div>
                    <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>
                )}

                {renderMessageContent(msg)}
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-md mt-0.5">
                  M
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator (Tier 2 Glass) */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-md">
              💧
            </div>
            <div className="p-4 rounded-2xl glass-surface-2 text-slate-100 text-sm flex items-center justify-between gap-4 flex-1 max-w-2xl">
              <div className="flex items-center gap-3 min-w-0">
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="truncate">
                    {autonomousStatus || 'Codex is synthesizing edge application & running sandbox...'}
                  </span>
                  <span className="text-[11px] text-cyan-300 font-mono">
                    {autonomousMode
                      ? '[RecursiveEngine: Vault Read → Execute → Evaluate → Ed25519 Attest]'
                      : '[Reasoning Active]'}
                  </span>
                </div>
              </div>
              {autonomousMode && onStopAutonomousLoop && (
                <button
                  type="button"
                  onClick={onStopAutonomousLoop}
                  className="px-2.5 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-mono shrink-0 cursor-pointer"
                >
                  Stop
                </button>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Tier 3 Wish Composer Pinned at Bottom */}
      <div className="p-3.5 pt-2 bg-gradient-to-t from-[#060810]/90 via-[#060810]/40 to-transparent relative shrink-0">
        {showFilePicker && matchingFiles.length > 0 && (
          <div className="absolute bottom-full left-4 right-4 mb-2 glass-surface-2 rounded-xl p-2 z-30 max-h-48 overflow-y-auto animate-fadeIn">
            <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider px-2 py-1 flex items-center gap-1">
              <AtSign className="w-3 h-3 text-cyan-400" />
              <span>Reference Sandbox File (/home/user/webapp):</span>
            </div>
            <div className="space-y-0.5 mt-1">
              {matchingFiles.map((f) => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => handleSelectMentionFile(f.path)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-mono text-slate-200 hover:bg-cyan-500/15 hover:text-cyan-200 transition-colors cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">{f.path}</span>
                  <span className="text-[10px] text-slate-400 ml-auto shrink-0 font-sans">
                    {(f.content.length / 1024).toFixed(1)} KB
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="relative rounded-2xl glass-surface-3 focus-within:ring-2 focus-within:ring-violet-400/50 transition-all p-2.5"
        >
          <textarea
            ref={textareaRef}
            value={inputPrompt}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask Codex... (e.g. 'Build an interactive dashboard with Hono and Cloudflare D1' or type @ to reference file)"
            rows={2}
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-400 resize-none focus:outline-none p-1.5 font-sans leading-relaxed"
          />

          <div className="flex items-center justify-between pt-2 border-t border-white/10 mt-1">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              {/* Quick Template Prompt suggestions */}
              <button
                type="button"
                onClick={() => setInputPrompt('Add a Hono API endpoint /api/users with D1 database query and KV caching.')}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                + Hono D1 API
              </button>
              <button
                type="button"
                onClick={() => setInputPrompt('Configure Cloudflare R2 object storage upload endpoint in /home/user/webapp/src/index.ts')}
                className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                + R2 Upload
              </button>
              <button
                type="button"
                onClick={() => setInputPrompt('Deploy application to Genspark Hosting with automatic SSL and D1 provisioning')}
                className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                + Genspark Edge
              </button>
            </div>

            <div className="flex items-center gap-2">
              {onToggleAutonomousMode && (
                <button
                  type="button"
                  onClick={onToggleAutonomousMode}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono transition-colors cursor-pointer border ${
                    autonomousMode
                      ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200 hover:bg-cyan-500/30'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Route complex or multi-step requests through RecursiveEngine autonomous loop (simple queries use single-turn completion)"
                >
                  <Zap className={`w-3.5 h-3.5 ${autonomousMode ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{autonomousMode ? 'Auto-Loop ON' : 'Single-Shot'}</span>
                </button>
              )}

              {/* Audio Microphone STT button */}
              <button
                type="button"
                onClick={handleToggleVoice}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  isRecording
                    ? 'bg-rose-600 text-white'
                    : 'bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10'
                }`}
                title={isRecording ? 'Listening... click to stop' : 'Transcribe voice prompt'}
              >
                <Mic className="w-4 h-4" />
              </button>

              {/* Build button */}
              <button
                type="submit"
                disabled={!inputPrompt.trim() || isLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 disabled:opacity-40 text-white text-xs font-semibold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <span>{autonomousMode ? 'Run Loop' : 'Build'}</span>
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
