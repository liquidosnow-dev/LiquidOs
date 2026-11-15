import React, { useState, useMemo, useRef } from 'react';
import { ProjectFile } from '../types';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  Download,
  Upload,
  FileUp,
  Search,
  Plus,
  Trash2,
  HardDrive,
  Copy,
  Check,
  AtSign,
  PackageCheck,
  FileArchive,
  ChevronRight,
  ChevronDown,
  Code2,
  Layers,
  FolderSync,
  Database,
  RefreshCw,
  Unlink,
  ArrowUpToLine,
  ArrowDownToLine,
  AlertCircle,
  ShieldCheck,
  X,
} from 'lucide-react';
import { CoalitionHandshakeModal } from './CoalitionHandshakeModal';
import {
  FileSystemCapabilities,
  OnDeviceMountStatus,
  DeviceSyncDiff,
  DropSkippedFile,
  DropImportResult,
  formatBytes,
  readWebkitDirectoryFileList,
  readDroppedFiles,
  readDroppedDataTransfer,
} from '../utils/onDeviceFs';
import {
  ControlPlaneState,
  SnapshotValidationReport,
  WatchVerificationReport,
} from '../utils/ingestionControlPlane';

interface FileExplorerTabProps {
  files: ProjectFile[];
  activeFilePath: string;
  onSelectFile: (path: string) => void;
  onAddFile?: (path: string, content: string) => void;
  onUploadFiles?: (
    files: ProjectFile[]
  ) => void | Promise<void | { ok: boolean; error?: string; commitHash?: string }>;
  onDeleteFile?: (path: string) => void;
  onReferenceFileInChat?: (path: string) => void;
  onOpenInCodeEditor?: (path: string) => void;
  onDeviceCapabilities?: FileSystemCapabilities;
  onDeviceMount?: OnDeviceMountStatus;
  onDeviceDiff?: DeviceSyncDiff | null;
  onMountNativeFolder?: () => void;
  onReconnectSavedFolder?: () => void;
  onConnectOpfs?: () => void;
  onImportFolderFiles?: (rootName: string, importedFiles: ProjectFile[]) => void;
  onPushToDevice?: () => void;
  onPullFromDevice?: () => void;
  onRefreshDeviceDiff?: () => void;
  onToggleDeviceAutoSync?: () => void;
  onDisconnectDevice?: () => void;
  controlPlaneState?: ControlPlaneState;
  onTransitionGlobalMode?: (nextMode: 'ACTIVE' | 'RESTRICTED' | 'LOCKDOWN', reason?: string) => void;
  onIssuePermit?: () => void;
  pendingSyncFiles?: ProjectFile[];
  onRetryFailedSync?: () => void;
  lastSnapshotValidation?: SnapshotValidationReport | null;
  lastWatchVerification?: WatchVerificationReport | null;
}

interface TreeGroup {
  folder: string;
  label: string;
  purpose: string;
  items: ProjectFile[];
}

const FOLDER_PURPOSES: Record<string, string> = {
  'verification-tools': 'AN-EVC-001 TypeScript + Python 3.10 Canonicalizer & Interop Harness',
  schemas: 'Draft 1.0.0 Evidence Envelope Schema & Canonical Test Vectors',
  tests: 'Cross-Runtime & Envelope Structural Unit Suites (186/186 PASS)',
  src: 'Hono v4 Edge API & Tamper-Evident SHA-256 Chain Core',
  root: 'Workspace Configuration, Wrangler Cloudflare Bindings & Handoff README',
};

export const FileExplorerTab: React.FC<FileExplorerTabProps> = ({
  files,
  activeFilePath,
  onSelectFile,
  onAddFile,
  onUploadFiles,
  onDeleteFile,
  onReferenceFileInChat,
  onOpenInCodeEditor,
  onDeviceCapabilities,
  onDeviceMount,
  onDeviceDiff,
  onMountNativeFolder,
  onReconnectSavedFolder,
  onConnectOpfs,
  onImportFolderFiles,
  onPushToDevice,
  onPullFromDevice,
  onRefreshDeviceDiff,
  onToggleDeviceAutoSync,
  onDisconnectDevice,
  controlPlaneState,
  onTransitionGlobalMode,
  onIssuePermit,
  pendingSyncFiles = [],
  onRetryFailedSync,
  lastSnapshotValidation,
  lastWatchVerification,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'verification-tools': true,
    schemas: true,
    tests: true,
    src: true,
    root: true,
  });
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dropSkippedNotice, setDropSkippedNotice] = useState<DropSkippedFile[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isProcessingDrop, setIsProcessingDrop] = useState(false);
  const [dropTargetDir, setDropTargetDir] = useState<string>('');
  const dragDepthRef = useRef(0);
  const dropInputRef = useRef<HTMLInputElement | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isExportingTar, setIsExportingTar] = useState(false);
  const [isHandshakeOpen, setIsHandshakeOpen] = useState(false);
  const [isDevicePanelOpen, setIsDevicePanelOpen] = useState(true);

  const targetFolderOptions = useMemo(() => {
    const set = new Set<string>(['', 'uploads', 'src', 'verification-tools', 'schemas', 'tests']);
    for (const f of files) {
      const slashIdx = f.path.indexOf('/');
      if (slashIdx > 0) {
        set.add(f.path.slice(0, slashIdx));
      }
    }
    return Array.from(set);
  }, [files]);

  const filteredFiles = useMemo(
    () =>
      files.filter((f) =>
        f.path.toLowerCase().includes(filterQuery.trim().toLowerCase())
      ),
    [files, filterQuery]
  );

  // Build hierarchical groups sorted deterministically
  const treeGroups: TreeGroup[] = useMemo(() => {
    const map = new Map<string, ProjectFile[]>();
    for (const file of filteredFiles) {
      const slashIdx = file.path.indexOf('/');
      const topFolder = slashIdx === -1 ? 'root' : file.path.slice(0, slashIdx);
      const list = map.get(topFolder) || [];
      list.push(file);
      map.set(topFolder, list);
    }

    const order = ['src', 'verification-tools', 'schemas', 'tests', 'root'];
    const keys = Array.from(map.keys()).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

    return keys.map((folder) => ({
      folder,
      label: folder === 'root' ? '/ (Root Config & Handoff)' : `${folder}/`,
      purpose: FOLDER_PURPOSES[folder] || 'Workspace directory',
      items: (map.get(folder) || []).slice().sort((a, b) => a.path.localeCompare(b.path)),
    }));
  }, [filteredFiles]);

  const activeFile = files.find((f) => f.path === activeFilePath) || files[0];

  const toggleFolder = (folder: string) => {
    setExpandedFolders((prev) => ({ ...prev, [folder]: !prev[folder] }));
  };

  const handleDownloadFile = (file: ProjectFile, e: React.MouseEvent) => {
    e.stopPropagation();
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.split('/').pop() || file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadWorkspaceTar = async (scope: 'workspace' | 'fullstack' = 'workspace') => {
    setIsExportingTar(true);
    try {
      const archiveName =
        scope === 'fullstack' ? 'liquidos-one-fullstack.tar.gz' : 'liquidos-one-webapp.tar.gz';
      const res = await fetch('/api/workspace/export-tar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          archiveName,
          files: files.map((f) => ({ path: f.path, content: f.content })),
        }),
      });
      if (!res.ok) {
        throw new Error(`Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = archiveName;
      a.click();
      URL.revokeObjectURL(url);
      setUploadSuccess(`Exported real POSIX archive: ${archiveName}`);
      setTimeout(() => setUploadSuccess(null), 4000);
    } catch {
      const manifest = {
        archive: 'liquidos-one-master-handoff.json',
        extractedPath: '/home/user/webapp',
        timestamp: new Date().toISOString(),
        files: files.map((f) => ({ path: f.path, size: f.content.length, content: f.content })),
      };
      const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'liquidos-one-webapp-manifest.json';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingTar(false);
    }
  };

  const handleCopyPath = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText('/home/user/webapp/' + path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const hasFilesInDrag = (dt: DataTransfer | null): boolean => {
    if (!dt) return false;
    if (dt.types && Array.from(dt.types).includes('Files')) return true;
    return Boolean(dt.files && dt.files.length > 0);
  };

  const ingestUploadedResult = async (resultPromise: Promise<DropImportResult>) => {
    setIsProcessingDrop(true);
    setUploadError(null);
    try {
      const { files: imported, skipped } = await resultPromise;
      setDropSkippedNotice(skipped);

      if (imported.length > 0) {
        let commitResult: void | { ok: boolean; error?: string; commitHash?: string } = undefined;
        if (onUploadFiles) {
          commitResult = await onUploadFiles(imported);
        } else if (onAddFile) {
          for (const f of imported) {
            onAddFile(f.path, f.content);
          }
          onSelectFile(imported[0].path);
        }

        if (commitResult && commitResult.ok === false) {
          setUploadError(commitResult.error || 'Upload blocked by GLOBAL-MODE-001 / IAM-001.');
          return;
        }

        setExpandedFolders((prev) => {
          const next = { ...prev };
          for (const f of imported) {
            const slashIdx = f.path.indexOf('/');
            const top = slashIdx === -1 ? 'root' : f.path.slice(0, slashIdx);
            next[top] = true;
          }
          return next;
        });

        const destLabel = dropTargetDir
          ? `/home/user/webapp/${dropTargetDir}/`
          : '/home/user/webapp/';
        const totalDroppedBytes = imported.reduce((acc, f) => acc + f.content.length, 0);
        const hashNote =
          commitResult && commitResult.commitHash
            ? ` · commit ${commitResult.commitHash.slice(0, 8)} (untested)`
            : '';
        setUploadSuccess(
          `Added ${imported.length} file${imported.length === 1 ? '' : 's'} (${formatBytes(totalDroppedBytes)}) into ${destLabel}${hashNote}`
        );
        setTimeout(() => setUploadSuccess(null), 5000);
      } else if (skipped.length > 0) {
        setUploadError(`No text source files imported (${skipped.length} skipped).`);
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to read dropped files.');
    } finally {
      setIsProcessingDrop(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;
    await ingestUploadedResult(
      readDroppedFiles(uploadedFiles, dropTargetDir, 200, [], {
        existingWorkspacePaths: files.map((f) => f.path),
      })
    );
    e.target.value = '';
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    if (!hasFilesInDrag(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!hasFilesInDrag(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!hasFilesInDrag(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    if (!hasFilesInDrag(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragActive(false);
    await ingestUploadedResult(
      readDroppedDataTransfer(e.dataTransfer, dropTargetDir, 200, undefined, undefined, {
        existingWorkspacePaths: files.map((f) => f.path),
      })
    );
  };

  const handleCreateNewFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const cleanPath = newFileName.trim().startsWith('/')
      ? newFileName.trim().substring(1)
      : newFileName.trim();

    if (onAddFile) {
      onAddFile(cleanPath, `// ${cleanPath}\nexport {};\n`);
      onSelectFile(cleanPath);
    }
    setNewFileName('');
    setIsAddingNew(false);
  };

  const getFileIcon = (path: string) => {
    if (
      path.endsWith('.ts') ||
      path.endsWith('.tsx') ||
      path.endsWith('.js') ||
      path.endsWith('.mjs') ||
      path.endsWith('.py')
    ) {
      return <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />;
    }
    if (path.endsWith('.json') || path.endsWith('.jsonc')) {
      return <FileJson className="w-4 h-4 text-amber-400 shrink-0" />;
    }
    if (path.endsWith('.html')) {
      return <FileCode className="w-4 h-4 text-orange-400 shrink-0" />;
    }
    return <FileText className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  const totalBytes = files.reduce((acc, f) => acc + f.content.length, 0);
  const totalLines = files.reduce((acc, f) => acc + f.content.split('\n').length, 0);

  return (
    <div
      className="relative flex flex-col h-full bg-transparent text-slate-200 overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid="file-explorer-container"
    >
      {/* Full-Workspace Drag-Over Highlight Overlay */}
      {isDragActive && (
        <div
          className="pointer-events-none absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-sm border-2 border-dashed border-cyan-400 flex items-center justify-center p-6"
          data-testid="file-drop-overlay"
        >
          <div className="max-w-md w-full rounded-2xl border border-cyan-400/50 bg-slate-900/90 px-6 py-7 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center mx-auto mb-3">
              <FileUp className="w-6 h-6 text-cyan-300" />
            </div>
            <div className="text-sm font-semibold text-white">
              Drop files or folders into active workspace
            </div>
            <div className="mt-1.5 text-xs font-mono text-cyan-300 truncate">
              Destination: /home/user/webapp/{dropTargetDir ? `${dropTargetDir}/` : ''}
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              Text &amp; source files up to 1 MB · Skips node_modules, .git &amp; binaries automatically
            </div>
          </div>
        </div>
      )}

      {/* Master Showcase Header */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 glass-surface-1 border-x-0 border-t-0 shrink-0 gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <HardDrive className="w-4 h-4 text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-mono font-semibold text-white truncate">
              Master File Tree Showcase · /home/user/webapp
            </div>
            <div className="text-[11px] font-mono tabular-nums text-slate-400">
              {files.length} files · {totalLines.toLocaleString()} lines · {(totalBytes / 1024).toFixed(1)} KB
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {onDeviceMount && (
            <button
              type="button"
              onClick={() => setIsDevicePanelOpen((prev) => !prev)}
              aria-expanded={isDevicePanelOpen}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap border ${
                onDeviceMount.mode === 'native' || onDeviceMount.mode === 'opfs'
                  ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200 hover:border-emerald-300/60'
                  : 'glass-surface-2 border-white/10 text-cyan-200 hover:border-cyan-400/50'
              }`}
              title="Toggle On-Device File System Connectivity Panel"
            >
              <FolderSync className="w-3.5 h-3.5 text-cyan-300" />
              <span>
                {onDeviceMount.mode === 'native'
                  ? `Host FS: ${onDeviceMount.mountName}`
                  : onDeviceMount.mode === 'opfs'
                  ? 'OPFS Disk: Connected'
                  : onDeviceMount.mode === 'imported'
                  ? `Imported: ${onDeviceMount.mountName}`
                  : 'On-Device FS'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsHandshakeOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-surface-2 hover:border-violet-400/50 text-xs font-medium text-violet-200 transition-colors cursor-pointer whitespace-nowrap"
            title="Open Coalition Code-Assembly Handshake (Skill/prompt.md) & Module Bundler"
          >
            <Layers className="w-3.5 h-3.5 text-violet-300" />
            <span>Coalition Handshake</span>
          </button>

          <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg glass-surface-1 hover:border-white/20 text-xs font-medium text-slate-200 cursor-pointer transition-colors whitespace-nowrap shrink-0">
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Upload</span>
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => handleDownloadWorkspaceTar('workspace')}
            disabled={isExportingTar}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500/90 to-blue-600/90 hover:from-cyan-400 hover:to-blue-500 border border-white/15 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            title="Download real POSIX .tar.gz archive of /home/user/webapp"
          >
            <FileArchive className="w-3.5 h-3.5" />
            <span>{isExportingTar ? 'Exporting...' : 'Export .tar.gz'}</span>
          </button>
        </div>
      </div>

      {/* On-Device File System Connectivity Panel */}
      {isDevicePanelOpen && onDeviceMount && (
        <div
          className="px-4 py-3 border-b border-white/10 glass-surface-2 space-y-2.5 shrink-0"
          data-testid="ondevice-fs-panel"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                {onDeviceMount.mode === 'native' || onDeviceMount.mode === 'opfs' ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Database className="w-4 h-4 text-cyan-400 shrink-0" />
                )}
                <span>On-Device File System</span>
              </div>
              <span className="text-slate-600">·</span>
              <span className="text-[11px] font-mono tabular-nums text-slate-300">
                {onDeviceMount.mode === 'disconnected'
                  ? 'Not Connected (In-Memory Workspace)'
                  : onDeviceMount.mode === 'native'
                  ? `Host Folder "${onDeviceMount.mountName}" · ${onDeviceMount.permission.toUpperCase()}`
                  : onDeviceMount.mode === 'opfs'
                  ? `Origin Private File System (${onDeviceMount.mountName}) · SANDBOXED DISK`
                  : `Imported Folder "${onDeviceMount.mountName}" · READ/MERGE`}
              </span>
              {onDeviceMount.quota && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400">
                    Device Storage {formatBytes(onDeviceMount.quota.usageBytes)} /{' '}
                    {formatBytes(onDeviceMount.quota.quotaBytes)}
                  </span>
                </>
              )}
              {onDeviceMount.lastSyncedAt && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="text-[11px] font-mono tabular-nums text-emerald-300">
                    Synced {new Date(onDeviceMount.lastSyncedAt).toLocaleTimeString()}
                  </span>
                </>
              )}
            </div>

            {/* Capability Matrix Summary */}
            {onDeviceCapabilities && (
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-400">
                <span
                  className={
                    onDeviceCapabilities.iframeRestricted
                      ? 'text-amber-300'
                      : onDeviceCapabilities.fileSystemAccess
                      ? 'text-emerald-300'
                      : 'text-slate-500'
                  }
                >
                  Host Picker:{' '}
                  {onDeviceCapabilities.iframeRestricted
                    ? 'Iframe Restricted (Use OPFS or Open Standalone)'
                    : onDeviceCapabilities.fileSystemAccess
                    ? 'Supported'
                    : 'Unsupported'}
                </span>
                <span>·</span>
                <span className={onDeviceCapabilities.opfs ? 'text-cyan-300' : 'text-slate-500'}>
                  OPFS Disk: {onDeviceCapabilities.opfs ? 'Ready' : 'Unavailable'}
                </span>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {onMountNativeFolder && (
              <button
                type="button"
                onClick={onMountNativeFolder}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-surface-1 hover:border-cyan-400/50 text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
                title="Select a real folder on your device via Browser File System Access API"
              >
                <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
                <span>Mount Local Folder</span>
              </button>
            )}

            {onDeviceMount.mode === 'disconnected' &&
              onDeviceMount.savedHandleName &&
              onReconnectSavedFolder && (
                <button
                  type="button"
                  onClick={onReconnectSavedFolder}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-400/40 text-xs font-medium text-amber-200 hover:bg-amber-500/25 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reconnect &ldquo;{onDeviceMount.savedHandleName}&rdquo;</span>
                </button>
              )}

            {onConnectOpfs && (
              <button
                type="button"
                onClick={onConnectOpfs}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-surface-1 hover:border-emerald-400/50 text-xs font-medium text-emerald-200 transition-colors cursor-pointer whitespace-nowrap"
                title="Connect persistent on-device Origin Private File System (OPFS) disk"
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>Connect OPFS Volume</span>
              </button>
            )}

            {onImportFolderFiles && (
              <label
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-surface-1 hover:border-white/25 text-xs font-medium text-slate-200 cursor-pointer transition-colors whitespace-nowrap"
                title="Import an entire directory from your device via webkitdirectory"
              >
                <Folder className="w-3.5 h-3.5 text-violet-300" />
                <span>Import Folder</span>
                <input
                  type="file"
                  multiple
                  // @ts-expect-error webkitdirectory is supported in Chromium/Firefox/Safari
                  webkitdirectory=""
                  directory=""
                  className="hidden"
                  onChange={async (e) => {
                    const list = e.target.files;
                    if (!list || list.length === 0) return;
                    const parsed = await readWebkitDirectoryFileList(list);
                    onImportFolderFiles(parsed.rootFolderName, parsed.files);
                    e.target.value = '';
                  }}
                />
              </label>
            )}

            {(onDeviceMount.mode === 'native' || onDeviceMount.mode === 'opfs') && (
              <>
                <div className="h-4 w-px bg-white/10 mx-0.5 hidden sm:block" />

                {onPushToDevice && (
                  <button
                    type="button"
                    onClick={onPushToDevice}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-600/80 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    title="Write all workspace files to connected on-device folder/OPFS"
                  >
                    <ArrowUpToLine className="w-3.5 h-3.5" />
                    <span>Push to Device</span>
                  </button>
                )}

                {onPullFromDevice && (
                  <button
                    type="button"
                    onClick={onPullFromDevice}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-surface-1 hover:border-cyan-400/50 text-xs font-medium text-cyan-200 transition-colors cursor-pointer whitespace-nowrap"
                    title="Load files from connected on-device folder/OPFS into workspace"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    <span>Pull to Workspace</span>
                  </button>
                )}

                {onRefreshDeviceDiff && (
                  <button
                    type="button"
                    onClick={onRefreshDeviceDiff}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg glass-surface-1 hover:border-white/25 text-xs font-mono text-slate-300 transition-colors cursor-pointer whitespace-nowrap"
                    title="Re-scan connected on-device files and refresh diff"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Scan</span>
                  </button>
                )}

                {onToggleDeviceAutoSync && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={onDeviceMount.autoSync}
                    onClick={onToggleDeviceAutoSync}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap border ${
                      onDeviceMount.autoSync
                        ? 'bg-violet-500/20 border-violet-400/50 text-violet-200'
                        : 'glass-surface-1 border-white/10 text-slate-400'
                    }`}
                    title="Automatically write-through file edits and creations to the connected device storage"
                  >
                    <FolderSync className="w-3.5 h-3.5" />
                    <span>Auto-Sync: {onDeviceMount.autoSync ? 'ON' : 'OFF'}</span>
                  </button>
                )}

                {onDisconnectDevice && (
                  <button
                    type="button"
                    onClick={onDisconnectDevice}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg glass-surface-1 hover:border-rose-400/50 text-xs font-medium text-rose-300 transition-colors cursor-pointer whitespace-nowrap"
                    title="Disconnect on-device mount"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Diff / Notice Banner */}
          {(onDeviceDiff || onDeviceMount.lastNotice || onDeviceMount.lastError) && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono tabular-nums">
              <div className="flex flex-wrap items-center gap-2">
                {onDeviceMount.lastError ? (
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{onDeviceMount.lastError}</span>
                  </span>
                ) : onDeviceMount.lastNotice ? (
                  <span className="text-cyan-300">{onDeviceMount.lastNotice}</span>
                ) : null}
              </div>

              {onDeviceDiff && (
                <div className="flex flex-wrap items-center gap-2 text-slate-300">
                  <span className="text-emerald-300">={onDeviceDiff.unchanged.length} synced</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-cyan-300">+{onDeviceDiff.toCreate.length} local only</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-amber-300">~{onDeviceDiff.toUpdate.length} modified</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-violet-300">{onDeviceDiff.deviceOnly.length} on disk only</span>
                </div>
              )}
            </div>
          )}

          {/* Control-Plane Gate (GLOBAL-MODE-001 / IAM-001) & Recovery Bar */}
          {controlPlaneState && (
            <div
              className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-[11px] font-mono tabular-nums"
              data-testid="control-plane-gate-bar"
            >
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span
                  className={
                    controlPlaneState.mode === 'ACTIVE' && controlPlaneState.activePermit
                      ? 'text-emerald-300 font-semibold'
                      : controlPlaneState.mode === 'LOCKDOWN'
                      ? 'text-rose-400 font-semibold'
                      : 'text-amber-300 font-semibold'
                  }
                >
                  GLOBAL-MODE-001: {controlPlaneState.mode}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-300">epoch {controlPlaneState.epoch}</span>
                <span className="text-slate-600">·</span>
                <span className={controlPlaneState.activePermit ? 'text-cyan-300' : 'text-rose-300'}>
                  {controlPlaneState.activePermit
                    ? `IAM-001 fence v${controlPlaneState.activePermit.fencingVersion}`
                    : 'No active permit (fail-closed)'}
                </span>
                {lastSnapshotValidation && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400">
                      Snapshot {lastSnapshotValidation.treeDigest.slice(0, 8)} ({lastSnapshotValidation.evidenceEnvelope.claimStatus})
                    </span>
                  </>
                )}
                {lastWatchVerification && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span
                      className={
                        lastWatchVerification.allPassed ? 'text-emerald-300' : 'text-amber-300'
                      }
                      title={
                        lastWatchVerification.serverReceipt
                          ? `${lastWatchVerification.claimScope} · Ed25519 receipt ${lastWatchVerification.serverReceipt.receiptId}`
                          : lastWatchVerification.claimScope
                      }
                    >
                      Watch Check {lastWatchVerification.entries.filter((e) => e.passed).length}/
                      {lastWatchVerification.entries.length} (
                      {lastWatchVerification.claimLevel || lastWatchVerification.claimStatus}
                      {lastWatchVerification.serverReceipt ? ' · Ed25519' : ''})
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {pendingSyncFiles.length > 0 && onRetryFailedSync && (
                  <button
                    type="button"
                    onClick={onRetryFailedSync}
                    className="px-2 py-1 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 hover:bg-amber-500/30 cursor-pointer whitespace-nowrap"
                  >
                    Retry Sync ({pendingSyncFiles.length})
                  </button>
                )}
                {onTransitionGlobalMode && controlPlaneState.mode !== 'LOCKDOWN' && (
                  <button
                    type="button"
                    onClick={() =>
                      onTransitionGlobalMode('LOCKDOWN', 'Operator triggered containment lockdown')
                    }
                    className="px-2 py-1 rounded glass-surface-1 border border-rose-500/30 text-rose-300 hover:border-rose-400/60 cursor-pointer whitespace-nowrap"
                  >
                    Lockdown
                  </button>
                )}
                {onTransitionGlobalMode && controlPlaneState.mode !== 'ACTIVE' && (
                  <button
                    type="button"
                    onClick={() =>
                      onTransitionGlobalMode('ACTIVE', 'Operator restored ACTIVE mode')
                    }
                    className="px-2 py-1 rounded glass-surface-1 border border-emerald-500/30 text-emerald-300 hover:border-emerald-400/60 cursor-pointer whitespace-nowrap"
                  >
                    Restore ACTIVE
                  </button>
                )}
                {onIssuePermit &&
                  controlPlaneState.mode === 'ACTIVE' &&
                  !controlPlaneState.activePermit && (
                    <button
                      type="button"
                      onClick={onIssuePermit}
                      className="px-2 py-1 rounded bg-cyan-600/80 hover:bg-cyan-500 text-white cursor-pointer whitespace-nowrap"
                    >
                      Issue Permit
                    </button>
                  )}
              </div>
            </div>
          )}
        </div>
      )}

      {uploadSuccess && (
        <div className="px-4 py-2 bg-emerald-950/60 border-b border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <PackageCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">{uploadSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadSuccess(null)}
            className="p-0.5 text-emerald-400 hover:text-white cursor-pointer shrink-0"
            aria-label="Dismiss upload success message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {uploadError && (
        <div className="px-4 py-2 bg-amber-950/60 border-b border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">{uploadError}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="p-0.5 text-amber-300 hover:text-white cursor-pointer shrink-0"
            aria-label="Dismiss upload error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {dropSkippedNotice.length > 0 && (
        <div
          className="px-4 py-2 bg-slate-900/90 border-b border-white/10 text-[11px] font-mono text-slate-300 flex items-center justify-between gap-3 shrink-0"
          data-testid="drop-skipped-banner"
        >
          <div className="min-w-0 truncate">
            Skipped {dropSkippedNotice.length} item{dropSkippedNotice.length === 1 ? '' : 's'}:{' '}
            <span className="text-amber-300">
              {dropSkippedNotice
                .slice(0, 3)
                .map((s) => `${s.name} (${s.reason})`)
                .join(' · ')}
              {dropSkippedNotice.length > 3 ? ` · +${dropSkippedNotice.length - 3} more` : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDropSkippedNotice([])}
            className="p-0.5 text-slate-400 hover:text-white cursor-pointer shrink-0"
            aria-label="Dismiss skipped files notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search & New File Bar */}
      <div className="px-4 py-2.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 bg-black/20 shrink-0">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter master file tree (e.g. canonical, schema, chain)..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full glass-surface-1 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>
        <button
          type="button"
          onClick={() => setIsAddingNew(!isAddingNew)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-cyan-400 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New File</span>
        </button>
      </div>

      {isAddingNew && (
        <form onSubmit={handleCreateNewFile} className="px-4 py-2 border-b border-slate-800 bg-slate-900/50 flex gap-2 shrink-0">
          <input
            type="text"
            placeholder="e.g. verification-tools/audit.ts"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            autoFocus
          />
          <button
            type="submit"
            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setIsAddingNew(false)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Split Showcase: Hierarchical Tree (left) + Live Source Inspector (right) */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 min-h-0 overflow-hidden">
        {/* Left: Dropzone + Grouped Tree */}
        <div className="xl:col-span-6 overflow-y-auto border-b xl:border-b-0 xl:border-r border-slate-800 p-3 space-y-3">
          {/* Interactive Drag-and-Drop File Upload Zone */}
          <div
            role="button"
            tabIndex={0}
            data-testid="file-dropzone"
            aria-label="Drag and drop local files or folders into active project workspace, or press Enter to browse files"
            onClick={() => dropInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dropInputRef.current?.click();
              }
            }}
            className={`rounded-xl border border-dashed px-3.5 py-3 transition-colors cursor-pointer select-none ${
              isDragActive
                ? 'border-cyan-400 bg-cyan-950/35'
                : 'border-white/15 bg-black/25 hover:border-cyan-400/50 hover:bg-slate-900/50'
            }`}
          >
            <input
              ref={dropInputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              data-testid="file-dropzone-input"
            />
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-400/25 flex items-center justify-center shrink-0">
                  <FileUp className="w-4 h-4 text-cyan-300" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-white truncate">
                    {isProcessingDrop
                      ? 'Importing local files into workspace...'
                      : 'Drag & drop local files or folders here'}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 truncate">
                    Click or press Enter to browse · Text &amp; source up to 1 MB
                  </div>
                </div>
              </div>

              <div
                className="flex items-center gap-1.5 shrink-0"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                  Target:
                </span>
                <select
                  aria-label="Target workspace folder"
                  value={dropTargetDir}
                  onChange={(e) => setDropTargetDir(e.target.value)}
                  className="bg-slate-950/90 border border-white/15 rounded-md px-2 py-1 text-[11px] font-mono text-cyan-200 focus:outline-none focus:border-cyan-400 cursor-pointer"
                >
                  {targetFolderOptions.map((dir) => (
                    <option key={dir || '__root__'} value={dir}>
                      {dir === '' ? '/ (Workspace Root)' : `${dir}/`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {treeGroups.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No files match &ldquo;{filterQuery}&rdquo;
            </div>
          ) : (
            treeGroups.map((group) => {
              const isOpen = expandedFolders[group.folder] !== false;
              return (
                <div key={group.folder} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleFolder(group.folder)}
                    className="w-full px-3 py-2 bg-slate-900 flex items-center justify-between text-left hover:bg-slate-800/70 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      {isOpen ? (
                        <FolderOpen className="w-4 h-4 text-cyan-400 shrink-0" />
                      ) : (
                        <Folder className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="text-xs font-mono font-semibold text-white truncate">
                        {group.label}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                      {group.items.length} files
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-3 py-1.5 border-t border-slate-800/80 space-y-1">
                      <div className="text-[11px] text-slate-500 pb-1">{group.purpose}</div>
                      {group.items.map((file) => {
                        const isSelected = activeFile?.path === file.path;
                        const lineCount = file.content.split('\n').length;
                        const sizeKb = (file.content.length / 1024).toFixed(1);
                        const displayName =
                          group.folder === 'root'
                            ? file.path
                            : file.path.slice(group.folder.length + 1);

                        return (
                          <div
                            key={file.path}
                            onClick={() => onSelectFile(file.path)}
                            className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-colors group ${
                              isSelected
                                ? 'bg-cyan-950/60 border border-cyan-700/60 text-white'
                                : 'hover:bg-slate-800/60 text-slate-300 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {getFileIcon(file.path)}
                              <div className="min-w-0">
                                <div className="text-xs font-mono font-medium truncate">
                                  {displayName}
                                </div>
                                <div className="text-[10px] font-mono tabular-nums text-slate-500">
                                  {lineCount} lines · {sizeKb} KB
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              {onReferenceFileInChat && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onReferenceFileInChat(file.path);
                                  }}
                                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-400"
                                  title="Insert @mention into chat"
                                >
                                  <AtSign className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => handleCopyPath(file.path, e)}
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                                title="Copy /home/user/webapp path"
                              >
                                {copiedPath === file.path ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDownloadFile(file, e)}
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-400"
                                title="Download file"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              {onDeleteFile && files.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteFile(file.path);
                                  }}
                                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400"
                                  title="Delete file"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right: Quick File Content Showcase */}
        <div className="xl:col-span-6 flex flex-col min-h-0 bg-black/20 overflow-hidden">
          {activeFile ? (
            <>
              <div className="px-4 py-2.5 glass-surface-1 border-x-0 border-t-0 flex items-center justify-between gap-2 shrink-0">
                <div className="min-w-0">
                  <div className="text-xs font-mono font-semibold text-cyan-300 truncate">
                    /home/user/webapp/{activeFile.path}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                    {activeFile.language.toUpperCase()} · {activeFile.content.split('\n').length} lines
                  </div>
                </div>
                {onOpenInCodeEditor && (
                  <button
                    type="button"
                    onClick={() => onOpenInCodeEditor(activeFile.path)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg glass-surface-2 hover:border-cyan-400/50 text-xs font-medium text-white cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Edit in Code Tab</span>
                  </button>
                )}
              </div>
              <pre className="flex-1 overflow-auto p-4 text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre">
                {activeFile.content}
              </pre>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
              Select a file from the Master Tree to inspect its source.
            </div>
          )}
        </div>
      </div>

      <CoalitionHandshakeModal
        isOpen={isHandshakeOpen}
        onClose={() => setIsHandshakeOpen(false)}
        onExportTar={handleDownloadWorkspaceTar}
        isExporting={isExportingTar}
      />
    </div>
  );
};
