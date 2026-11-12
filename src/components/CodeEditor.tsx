import React, { useState } from 'react';
import { ProjectFile, Collaborator } from '../types';
import { FileCode, Plus, Search, Play, Download, Trash2, Check, RefreshCw } from 'lucide-react';

interface CodeEditorProps {
  files: ProjectFile[];
  activeFilePath: string;
  onSelectFile: (path: string) => void;
  onUpdateFile: (path: string, content: string) => void;
  onCreateFile: (name: string) => void;
  onDeleteFile: (path: string) => void;
  onRunInCanvas: () => void;
  collaborators?: Collaborator[];
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  files,
  activeFilePath,
  onSelectFile,
  onUpdateFile,
  onCreateFile,
  onDeleteFile,
  onRunInCanvas,
  collaborators = [],
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  const activeFile = files.find(f => f.path === activeFilePath) || files[0];

  const handleContentChange = (newContent: string) => {
    if (activeFile) {
      onUpdateFile(activeFile.path, newContent);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 800);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFileName.trim()) {
      onCreateFile(newFileName.trim());
      setNewFileName('');
      setIsCreating(false);
    }
  };

  const handleDownloadAll = () => {
    // Generate standalone bundle download
    const bundleHtml = files.find(f => f.path.endsWith('.html'))?.content || '<!-- No HTML -->';
    const blob = new Blob([bundleHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project-bundle.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Find if any collaborator is active on this file
  const activeCollaborator = collaborators.find(c => c.activeFile === activeFile?.path);

  const lines = (activeFile?.content || '').split('\n');

  return (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800 text-slate-100 font-mono text-xs">
      {/* File Tabs Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 overflow-x-auto px-2">
        <div className="flex items-center gap-1 py-1 overflow-x-auto scrollbar-none">
          {files.map(file => {
            const isActive = file.path === activeFile?.path;
            return (
              <div
                key={file.path}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-t-md text-xs font-medium cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-slate-950 text-cyan-400 border-t-2 border-cyan-500 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
                onClick={() => onSelectFile(file.path)}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span className="truncate max-w-[120px]">{file.name}</span>
                {files.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFile(file.path);
                    }}
                    className="hover:text-rose-400 opacity-60 hover:opacity-100 p-0.5 rounded transition-opacity"
                    title="Delete file"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}

          {/* New file button */}
          {isCreating ? (
            <form onSubmit={handleCreateSubmit} className="flex items-center gap-1 px-2 py-1">
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="filename.ext"
                className="bg-slate-950 border border-cyan-500/60 rounded px-2 py-0.5 text-xs text-white focus:outline-none w-28 font-mono"
                autoFocus
              />
              <button type="submit" className="text-cyan-400 hover:text-cyan-300 text-xs px-1">
                ✓
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-slate-500 hover:text-slate-300 text-xs px-1"
              >
                ✕
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1 px-2 py-1 text-slate-500 hover:text-slate-200 hover:bg-slate-800/40 rounded transition-colors"
              title="Add new file"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0 px-2 font-sans">
          {savedFlash && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono pr-2 animate-fade-in">
              <Check className="w-3 h-3" /> Auto-saved
            </span>
          )}

          <button
            onClick={onRunInCanvas}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors shadow-sm cursor-pointer"
            title="Execute current code in preview canvas"
          >
            <Play className="w-3 h-3" />
            <span className="hidden sm:inline">Run Canvas</span>
          </button>

          <button
            onClick={handleDownloadAll}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Export project bundle"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Editor Sub-header with Stats and Collaborator Presence */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-950/80 border-b border-slate-900 text-[11px] text-slate-500">
        <div className="flex items-center gap-3">
          <span>{lines.length} lines</span>
          <span>·</span>
          <span>{((activeFile?.content || '').length / 1024).toFixed(1)} KB</span>
          <span>·</span>
          <span className="uppercase">{activeFile?.language}</span>
        </div>

        {activeCollaborator && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400 font-sans">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>{activeCollaborator.name} is viewing this file</span>
          </div>
        )}
      </div>

      {/* Main Text Area with Line Numbers */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* Line Numbers Gutter */}
        <div className="select-none bg-slate-950 text-slate-600 text-right py-3 px-3 border-r border-slate-900 shrink-0 font-mono text-[12px] leading-6 overflow-hidden">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Text Area */}
        <textarea
          value={activeFile?.content || ''}
          onChange={(e) => handleContentChange(e.target.value)}
          spellCheck={false}
          className="flex-1 w-full h-full bg-slate-950 text-slate-200 font-mono text-[13px] leading-6 p-3 resize-none focus:outline-none border-none selection:bg-cyan-900/50"
          placeholder="Start writing code..."
        />
      </div>
    </div>
  );
};
