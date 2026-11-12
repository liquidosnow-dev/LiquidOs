import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, ToolCall } from '../types';
import { ToolCallCard } from './ToolCallCard';
import { CodeBlock } from './CodeBlock';
import { extractFilesFromResponse } from '../utils/toolExecutor';
import { Send, Mic, Image as ImageIcon, Sparkles, Plus, Check, Play, Loader2, ArrowUp, Zap } from 'lucide-react';

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
}) => {
  const [inputPrompt, setInputPrompt] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputPrompt.trim() || isLoading) return;

    const text = inputPrompt.trim();
    setInputPrompt('');
    await onSendMessage(text, selectedPersona);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Microphone Audio Speech-to-Text
  const handleToggleVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      // Fallback: simulate audio transcription
      setIsRecording(true);
      setTimeout(() => {
        setIsRecording(false);
        setInputPrompt('Generate a responsive analytics dashboard with dark mode and live charts.');
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
        setInputPrompt(prev => (prev ? prev + ' ' + transcript : transcript));
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
    const { files } = extractFilesFromResponse(msg.content);

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
            {msg.toolCalls.map(tc => (
              <ToolCallCard key={tc.id} toolCall={tc} onRunInCanvas={onRunInCanvas} />
            ))}
          </div>
        )}

        {/* Content parts */}
        {parts.length > 0 ? parts : <div className="text-sm text-slate-200">{msg.content}</div>}

        {/* Action Button: Apply All Files to Project Workspace */}
        {files.length > 0 && (
          <div className="pt-2 flex items-center justify-between border-t border-slate-800">
            <div className="text-xs text-slate-400">
              Generated {files.length} project file{files.length > 1 ? 's' : ''}
            </div>
            <button
              onClick={() => onApplyAllFiles(files)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 text-cyan-400" />
              <span>Apply All to Workspace</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 font-sans text-slate-100 overflow-hidden">
      {/* Persona Presets Bar */}
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-950 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
          Codex Persona:
        </span>
        {PERSONA_PRESETS.map(p => {
          const isSelected = selectedPersona === p.name;
          return (
            <button
              key={p.id}
              onClick={() => onSelectPersona(p.name)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-cyan-950 border border-cyan-600 text-cyan-300 font-semibold shadow-sm'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{p.icon}</span>
              <span>{p.name}</span>
            </button>
          );
        })}
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-md mt-0.5">
                  💧
                </div>
              )}

              <div
                className={`rounded-2xl p-4 shadow-md min-w-0 ${
                  isUser
                    ? 'bg-cyan-600 text-white rounded-br-sm max-w-[85%]'
                    : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-bl-sm w-full overflow-hidden'
                }`}
              >
                {!isUser && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pb-2 mb-2 border-b border-slate-800">
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

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-md">
              💧
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 text-sm flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              <div className="flex items-center gap-2">
                <span>Codex is synthesizing application structure & calling tools...</span>
                <span className="text-xs text-cyan-400 font-mono">[Reasoning Active]</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer Section (Matching IMG 4: Ask Lovable... / Build / Mic / Send) */}
      <div className="p-4 bg-slate-950 border-t border-slate-800">
        <form onSubmit={handleSubmit} className="relative rounded-2xl bg-slate-900 border border-slate-800 focus-within:border-cyan-500 transition-colors shadow-2xl p-2.5">
          <textarea
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Codex... (e.g. 'Build an interactive dashboard for the LiquidOS Mercury Vault' or 'Add SQL query console')"
            rows={2}
            className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 resize-none focus:outline-none p-1.5 font-sans leading-relaxed"
          />

          <div className="flex items-center justify-between pt-2 border-t border-slate-800 mt-1">
            <div className="flex items-center gap-1.5">
              {/* Quick Template Prompt suggestions */}
              <button
                type="button"
                onClick={() => setInputPrompt('Add an interactive SQLite WAL query console with sample table data.')}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
              >
                + Add SQL Console
              </button>
              <button
                type="button"
                onClick={() => setInputPrompt('Simulate a packet fault and verify the SHA-256 tamper-evident rollback.')}
                className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
              >
                + Test Rollback
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Audio Microphone STT button */}
              <button
                type="button"
                onClick={handleToggleVoice}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  isRecording
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
                title={isRecording ? 'Listening... click to stop' : 'Transcribe voice prompt'}
              >
                <Mic className="w-4 h-4" />
              </button>

              {/* Build button (Matching Lovable IMG 4) */}
              <button
                type="submit"
                disabled={!inputPrompt.trim() || isLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white text-xs font-semibold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <span>Build</span>
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
