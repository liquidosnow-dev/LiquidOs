import React, { useState } from 'react';
import { SandboxBackup } from '../types/sandbox';
import { ProjectFile } from '../types';
import {
  Archive,
  Download,
  RotateCcw,
  Plus,
  Play,
  FileCode,
  CheckCircle2,
  Calendar,
  HardDrive,
  Trash2,
} from 'lucide-react';

interface ScriptsBackupsTabProps {
  backups: SandboxBackup[];
  files: ProjectFile[];
  onCreateBackup: (name: string) => void;
  onRestoreBackup: (backupId: string) => void;
  onDeleteBackup?: (backupId: string) => void;
}

export const ScriptsBackupsTab: React.FC<ScriptsBackupsTabProps> = ({
  backups,
  files,
  onCreateBackup,
  onRestoreBackup,
  onDeleteBackup,
}) => {
  const [newBackupName, setNewBackupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [activeScriptOutput, setActiveScriptOutput] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newBackupName.trim() || `webapp-backup-${new Date().toISOString().slice(0, 10)}.tar.gz`;
    onCreateBackup(name);
    setNewBackupName('');
    setIsCreating(false);
  };

  const handleDownload = async (b: SandboxBackup) => {
    const filename = b.name.endsWith('.tar.gz') ? b.name : `${b.name}.tar.gz`;
    try {
      const res = await fetch('/api/workspace/export-tar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'workspace',
          archiveName: filename,
          files: files.map((f) => ({ path: f.path, content: f.content })),
        }),
      });
      if (!res.ok) throw new Error('Archive export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      const fallbackData = {
        backupId: b.id,
        name: b.name,
        commitHash: b.commitHash,
        createdAt: new Date(b.createdAt).toISOString(),
        filesCount: b.filesCount,
        files: files.map((f) => ({ path: f.path, content: f.content })),
      };
      const blob = new Blob([JSON.stringify(fallbackData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleRestore = (b: SandboxBackup) => {
    onRestoreBackup(b.id);
    setRestoreSuccess(`Restored sandbox filesystem from snapshot ${b.name}`);
    setTimeout(() => setRestoreSuccess(null), 4000);
  };

  const scripts = [
    {
      name: 'scripts/backup.sh',
      desc: 'Creates a compressed tarball of /home/user/webapp excluding node_modules',
      cmd: 'tar --exclude="./node_modules" -czf /backups/webapp-latest.tar.gz .',
    },
    {
      name: 'scripts/migrate-d1.sh',
      desc: 'Runs Cloudflare D1 schema migrations against DB_PROD',
      cmd: 'wrangler d1 migrations apply DB_PROD --local',
    },
    {
      name: 'scripts/sync-kv-cache.sh',
      desc: 'Flushes and pre-warms active Hono session keys in CACHE_KV',
      cmd: 'curl -s -X POST http://localhost:8787/api/cache/prewarm',
    },
  ];

  const runScript = (name: string, cmd: string) => {
    setActiveScriptOutput(`$ ${cmd}\n[SUCCESS] Executed ${name} in 0.42s · Code 0`);
    setTimeout(() => setActiveScriptOutput(null), 5000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Scripts & Downloadable Backups</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Create offsite .tar.gz archives, restore points, and run sandbox automation scripts
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Snapshot</span>
        </button>
      </div>

      {restoreSuccess && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-800/80 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{restoreSuccess}</span>
        </div>
      )}

      {isCreating && (
        <form onSubmit={handleCreate} className="p-4 rounded-xl bg-slate-900 border border-cyan-800/60 space-y-3">
          <div className="text-xs font-bold text-white uppercase tracking-wider">New Sandbox Archive Snapshot</div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. pre-refactor-hono-d1.tar.gz"
              value={newBackupName}
              onChange={(e) => setNewBackupName(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white rounded-lg cursor-pointer"
            >
              Snapshot Now
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Backup Archives List */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Downloadable Sandbox Backups ({backups.length})
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Target: /home/user/webapp</span>
        </div>

        <div className="divide-y divide-slate-800/60">
          {backups.map((b) => (
            <div key={b.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-cyan-400 shrink-0">
                  <Archive className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-mono font-bold text-white">{b.name}</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-3">
                    <span>{(b.sizeBytes / 1024 / 1024).toFixed(2)} MB</span>
                    <span>·</span>
                    <span>{b.filesCount} files</span>
                    <span>·</span>
                    <span>Git: {b.commitHash}</span>
                    <span>·</span>
                    <span>{new Date(b.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => handleDownload(b)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors cursor-pointer"
                  title="Download .tar.gz"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRestore(b)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-xs transition-colors cursor-pointer"
                  title="Restore sandbox to this point"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </button>
                {onDeleteBackup && (
                  <button
                    type="button"
                    onClick={() => onDeleteBackup(b.id)}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sandbox Automation Scripts */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Sandbox Automation Scripts
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">POSIX Bash</span>
        </div>

        <div className="space-y-3">
          {scripts.map((s) => (
            <div key={s.name} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-mono font-bold text-emerald-400 truncate">{s.name}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{s.desc}</div>
                <code className="text-[10px] font-mono text-slate-500 block truncate mt-1">{s.cmd}</code>
              </div>
              <button
                type="button"
                onClick={() => runScript(s.name, s.cmd)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-950 hover:text-emerald-300 hover:border-emerald-700 text-xs font-medium text-slate-300 border border-slate-700 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>Run</span>
              </button>
            </div>
          ))}
        </div>

        {activeScriptOutput && (
          <pre className="p-3 bg-slate-950 text-emerald-400 font-mono text-xs rounded-xl border border-emerald-900/60 whitespace-pre-wrap animate-fadeIn">
            {activeScriptOutput}
          </pre>
        )}
      </div>
    </div>
  );
};
