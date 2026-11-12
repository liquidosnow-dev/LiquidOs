import React, { useState } from 'react';
import { ToolCall } from '../types';
import { ChevronDown, ChevronRight, Play, CheckCircle2, AlertCircle, Loader2, Terminal, Globe, Calculator, FileCode, Search, Image as ImageIcon } from 'lucide-react';

interface ToolCallCardProps {
  toolCall: ToolCall;
  onRunInCanvas?: (code: string) => void;
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCall, onRunInCanvas }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getToolIcon = () => {
    switch (toolCall.toolName) {
      case 'execute_code':
        return <Terminal className="w-4 h-4 text-cyan-400" />;
      case 'web_fetch':
        return <Globe className="w-4 h-4 text-emerald-400" />;
      case 'math_eval':
        return <Calculator className="w-4 h-4 text-amber-400" />;
      case 'create_file':
      case 'patch_file':
        return <FileCode className="w-4 h-4 text-purple-400" />;
      case 'search_grounding':
        return <Search className="w-4 h-4 text-blue-400" />;
      case 'generate_image':
        return <ImageIcon className="w-4 h-4 text-pink-400" />;
      default:
        return <Terminal className="w-4 h-4 text-cyan-400" />;
    }
  };

  const getStatusBadge = () => {
    switch (toolCall.status) {
      case 'executing':
        return (
          <span className="flex items-center gap-1.5 text-xs text-cyan-400 font-mono">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Executing
          </span>
        );
      case 'success':
        return (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Success {toolCall.executionTimeMs ? `(${toolCall.executionTimeMs}ms)` : ''}
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1.5 text-xs text-rose-400 font-mono">
            <AlertCircle className="w-3.5 h-3.5" />
            Failed
          </span>
        );
    }
  };

  return (
    <div className="my-2 rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-sm transition-all hover:border-slate-700">
      {/* Header Bar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-slate-800 transition-colors cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="p-1 rounded-md bg-slate-800 border border-slate-700">
            {getToolIcon()}
          </span>
          <span className="font-mono text-xs font-semibold text-slate-200 truncate">
            {toolCall.toolName}
          </span>
          <span className="text-slate-500 text-xs hidden sm:inline">·</span>
          <span className="text-[11px] text-slate-400 font-mono truncate max-w-[200px] hidden sm:inline">
            {JSON.stringify(toolCall.arguments).slice(0, 40)}...
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {getStatusBadge()}
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Accordion Body */}
      {isOpen && (
        <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-800 space-y-2.5 text-xs font-mono">
          {/* Runtime Arguments */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Runtime Arguments
            </div>
            <pre className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300 overflow-x-auto text-[11px]">
              {JSON.stringify(toolCall.arguments, null, 2)}
            </pre>
          </div>

          {/* Execution Output */}
          {toolCall.result !== undefined && (
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                <span>Output Data</span>
                {toolCall.toolName === 'execute_code' && onRunInCanvas && toolCall.arguments.code && (
                  <button
                    onClick={() => onRunInCanvas(toolCall.arguments.code)}
                    className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-sans cursor-pointer"
                  >
                    <Play className="w-3 h-3" /> Run in Canvas
                  </button>
                )}
              </div>
              <pre className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-emerald-300 overflow-x-auto text-[11px] max-h-48 overflow-y-auto">
                {typeof toolCall.result === 'object'
                  ? JSON.stringify(toolCall.result, null, 2)
                  : String(toolCall.result)}
              </pre>
            </div>
          )}

          {/* Error Message if any */}
          {toolCall.error && (
            <div>
              <div className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider mb-1">
                Execution Error
              </div>
              <div className="p-2.5 rounded-lg bg-rose-950 border border-rose-900 text-rose-300 text-[11px]">
                {toolCall.error}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
