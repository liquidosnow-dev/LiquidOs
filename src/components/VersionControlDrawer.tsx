import React, { useState } from 'react';
import { GitCommit, GitBranch, RotateCcw, Clock, Plus, Check, ChevronDown, ChevronRight, X } from 'lucide-react';
import { Project, Commit } from '../types';
import { computeLineDiff } from '../utils/versionControl';

interface VersionControlDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onCreateCommit: (message: string) => void;
  onRollback: (commitId: string) => void;
}

export const VersionControlDrawer: React.FC<VersionControlDrawerProps> = ({
  isOpen,
  onClose,
  project,
  onCreateCommit,
  onRollback,
}) => {
  const [newCommitMsg, setNewCommitMsg] = useState('');
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null);
  const [selectedDiffFile, setSelectedDiffFile] = useState<string>('');

  if (!isOpen) return null;

  const handleCommitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCommitMsg.trim()) {
      onCreateCommit(newCommitMsg.trim());
      setNewCommitMsg('');
    }
  };

  // Get active diff if a commit is selected
  const activeCommitFile = selectedCommit?.files.find(f => f.path === selectedDiffFile) || selectedCommit?.files[0];
  const currentProjectFile = project.files.find(f => f.path === (activeCommitFile?.path || ''));

  const diffLines = activeCommitFile && currentProjectFile
    ? computeLineDiff(activeCommitFile.content, currentProjectFile.content)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-slate-900 border-l border-slate-800 w-full max-w-xl h-full shadow-2xl flex flex-col text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <GitBranch className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-base font-bold text-white">Version Control & Commits</h2>
              <p className="text-xs text-slate-400">Branch: <span className="text-cyan-300 font-mono">{project.currentBranch}</span> · {project.commits.length} commits</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create new commit section */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 shrink-0">
          <form onSubmit={handleCommitSubmit} className="space-y-2">
            <div className="text-xs font-semibold text-slate-300">Commit Active Workspace Changes:</div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Commit message (e.g. Add DuckDB OLAP aggregator)..."
                value={newCommitMsg}
                onChange={(e) => setNewCommitMsg(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={!newCommitMsg.trim()}
                className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Commit</span>
              </button>
            </div>
          </form>
        </div>

        {/* Commits List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Commit History Timeline</div>

          {project.commits.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No commits yet on branch {project.currentBranch}. Make edits and commit them above.
            </div>
          ) : (
            project.commits.map((commit, index) => {
              const isSelected = selectedCommit?.id === commit.id;
              return (
                <div
                  key={commit.id}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-950/30 border-cyan-500 shadow-lg'
                      : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
                  }`}
                  onClick={() => {
                    setSelectedCommit(isSelected ? null : commit);
                    if (commit.files[0]) setSelectedDiffFile(commit.files[0].path);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 p-1 rounded-md bg-slate-800 text-cyan-400 shrink-0">
                        <GitCommit className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white leading-snug">{commit.message}</div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                          <span className="font-mono text-cyan-400">{commit.hash.slice(0, 7)}</span>
                          <span>·</span>
                          <span>{commit.author}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(commit.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRollback(commit.id);
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium transition-colors flex items-center gap-1 shrink-0"
                      title="Restore project files to this commit"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Rollback</span>
                    </button>
                  </div>

                  {/* Expanded Diff Viewer */}
                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Comparing with current workspace:</span>
                        <div className="flex gap-1">
                          {commit.files.map(f => (
                            <button
                              key={f.path}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDiffFile(f.path);
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                                selectedDiffFile === f.path
                                  ? 'bg-cyan-600 text-white'
                                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              {f.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Diff lines container */}
                      <div className="max-h-48 overflow-y-auto rounded-lg bg-slate-950 border border-slate-800/80 p-2 font-mono text-[11px]">
                        {diffLines.length === 0 ? (
                          <div className="text-slate-500 text-center py-2">No differences in this file.</div>
                        ) : (
                          diffLines.slice(0, 30).map((dl, i) => (
                            <div
                              key={i}
                              className={`py-0.5 px-1 rounded flex items-center gap-2 ${
                                dl.type === 'added'
                                  ? 'bg-emerald-950/50 text-emerald-300'
                                  : dl.type === 'removed'
                                  ? 'bg-rose-950/50 text-rose-300'
                                  : 'text-slate-400'
                              }`}
                            >
                              <span className="w-4 select-none text-slate-600">
                                {dl.type === 'added' ? '+' : dl.type === 'removed' ? '-' : ' '}
                              </span>
                              <span className="truncate">{dl.content}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
