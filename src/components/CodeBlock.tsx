import React, { useState, useEffect } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markup'; // HTML
import { Check, Copy, Play, Download } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  filepath?: string;
  onRunInCanvas?: (code: string) => void;
  onApplyToFile?: (filepath: string, code: string) => void;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'html',
  filepath,
  onRunInCanvas,
  onApplyToFile,
}) => {
  const lines = (code || '').trim().split('\n');
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(lines.length <= 40);

  useEffect(() => {
    try {
      Prism.highlightAll();
    } catch {}
  }, [code, language, isExpanded]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleDownload = () => {
    const filename = filepath || `code.${language === 'javascript' ? 'js' : language}`;
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const displayedLines = isExpanded ? lines : lines.slice(0, 30);

  return (
    <div className="my-3 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-lg font-mono text-xs w-full max-w-full">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900 border-b border-slate-800 text-slate-300">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
          {filepath ? (
            <span className="font-semibold text-slate-200 ml-1 text-xs truncate">{filepath}</span>
          ) : (
            <span className="text-slate-400 uppercase text-[11px] tracking-wider ml-1">{language}</span>
          )}
          <span className="text-slate-500 text-[11px] hidden sm:inline shrink-0">· {lines.length} lines</span>
        </div>

        <div className="flex items-center gap-1.5 font-sans shrink-0">
          {onRunInCanvas && (
            <button
              onClick={() => onRunInCanvas(code)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-xs font-medium transition-colors cursor-pointer"
              title="Run in Live Preview Canvas"
            >
              <Play className="w-3 h-3 text-cyan-400" />
              <span>Run in Canvas</span>
            </button>
          )}

          {onApplyToFile && filepath && (
            <button
              onClick={() => onApplyToFile(filepath, code)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-800 text-xs font-medium transition-colors cursor-pointer"
              title="Apply changes to project workspace"
            >
              <span>Apply</span>
            </button>
          )}

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            title="Copy to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-slate-400" />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Download file"
          >
            <Download className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Code with Line Numbers in unified scroll area */}
      <div className="relative flex overflow-x-auto max-h-72 overflow-y-auto p-3 text-xs leading-5 bg-slate-950 min-w-0">
        {/* Line numbers gutter */}
        <div className="select-none text-slate-600 text-right pr-3 border-r border-slate-800 shrink-0 font-mono text-[11px]">
          {displayedLines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Code Content */}
        <pre className="pl-3 text-slate-200 font-mono text-[12px] flex-1 bg-transparent overflow-visible min-w-0">
          <code className={`language-${language} bg-transparent`}>
            {isExpanded ? code : displayedLines.join('\n') + '\n// ... ' + (lines.length - 30) + ' more lines'}
          </code>
        </pre>
      </div>

      {/* Expand / Collapse toggle for large code blocks */}
      {lines.length > 30 && (
        <div className="px-3 py-1.5 bg-slate-900 border-t border-slate-800 text-center">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors font-sans cursor-pointer"
          >
            {isExpanded ? 'Collapse Code' : `Expand Full Code (${lines.length} lines)`}
          </button>
        </div>
      )}
    </div>
  );
};
