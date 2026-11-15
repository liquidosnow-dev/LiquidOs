import { ProjectFile } from '../types';

export type OnDeviceFsMode = 'disconnected' | 'native' | 'opfs' | 'imported';

export interface FileSystemCapabilities {
  fileSystemAccess: boolean;
  opfs: boolean;
  indexedDb: boolean;
  directoryInput: boolean;
  isTopLevelWindow: boolean;
  iframeRestricted: boolean;
}

export interface StorageQuotaEstimate {
  usageBytes: number;
  quotaBytes: number;
  usagePct: number;
}

export interface DeviceSyncDiff {
  toCreate: ProjectFile[];
  toUpdate: ProjectFile[];
  unchanged: ProjectFile[];
  deviceOnly: ProjectFile[];
}

export interface OnDeviceMountStatus {
  mode: OnDeviceFsMode;
  mountName: string | null;
  permission: 'granted' | 'prompt' | 'denied' | 'sandboxed';
  autoSync: boolean;
  lastSyncedAt: number | null;
  syncedFileCount: number;
  quota: StorageQuotaEstimate | null;
  savedHandleName: string | null;
  lastNotice: string | null;
  lastError: string | null;
}

const IDB_DB_NAME = 'liquidos_ondevice_fs_v1';
const IDB_STORE_NAME = 'directory_handles';
const IDB_HANDLE_KEY = 'primary_workspace_dir';
const OPFS_WORKSPACE_FOLDER = 'liquidos-one-workspace';
const MAX_READABLE_FILE_BYTES = 1024 * 1024; // 1 MB safeguard for text editor sync

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.vitest',
  '.vitest-coverage',
  '.next',
  '.cache',
  '__pycache__',
]);

const TEXT_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'py',
  'json',
  'jsonc',
  'html',
  'htm',
  'css',
  'scss',
  'md',
  'mdx',
  'txt',
  'yaml',
  'yml',
  'toml',
  'sql',
  'sh',
  'env',
  'example',
  'gitignore',
  'svg',
  'xml',
]);

export function detectFileSystemCapabilities(
  win: any = typeof window !== 'undefined' ? window : undefined,
  nav: any = typeof navigator !== 'undefined' ? navigator : undefined
): FileSystemCapabilities {
  let isTopLevelWindow = true;
  if (win) {
    try {
      isTopLevelWindow = win.self === win.top;
    } catch {
      isTopLevelWindow = false;
    }
  }

  const hasPicker = Boolean(win && typeof win.showDirectoryPicker === 'function');
  const hasOpfs = Boolean(nav && nav.storage && typeof nav.storage.getDirectory === 'function');
  const hasIdb = Boolean(win && typeof win.indexedDB !== 'undefined');
  const hasDirInput =
    typeof document !== 'undefined'
      ? 'webkitdirectory' in document.createElement('input')
      : true;

  return {
    fileSystemAccess: hasPicker,
    opfs: hasOpfs,
    indexedDb: hasIdb,
    directoryInput: hasDirInput,
    isTopLevelWindow,
    iframeRestricted: hasPicker && !isTopLevelWindow,
  };
}

export function normalizeRelativePath(rawPath: string): string | null {
  if (typeof rawPath !== 'string') return null;
  const cleaned = rawPath
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim();
  if (!cleaned) return null;

  const segments = cleaned.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  for (const seg of segments) {
    if (seg === '.' || seg === '..' || seg.includes('\0')) {
      return null;
    }
  }
  return segments.join('/');
}

export function inferLanguageFromPath(filePath: string): ProjectFile['language'] {
  const lower = filePath.toLowerCase();
  const ext = lower.includes('.') ? lower.split('.').pop() || '' : '';
  if (ext === 'ts' || ext === 'tsx') return 'typescript';
  if (ext === 'js' || ext === 'jsx' || ext === 'mjs' || ext === 'cjs') return 'javascript';
  if (ext === 'py') return 'python';
  if (ext === 'css' || ext === 'scss') return 'css';
  if (ext === 'json' || ext === 'jsonc') return 'json';
  if (ext === 'md' || ext === 'mdx') return 'markdown';
  if (ext === 'html' || ext === 'htm') return 'html';
  return 'typescript';
}

export function shouldIgnoreEntry(
  name: string,
  kind: 'file' | 'directory',
  sizeBytes = 0
): boolean {
  if (!name || name.startsWith('.DS_Store')) return true;
  if (kind === 'directory') {
    return IGNORED_DIRS.has(name);
  }
  if (sizeBytes > MAX_READABLE_FILE_BYTES) return true;

  const lower = name.toLowerCase();
  if (lower === 'dockerfile' || lower === 'makefile' || lower === 'license' || lower === 'readme') {
    return false;
  }
  if (lower.startsWith('.env')) return false;
  if (!lower.includes('.')) return false;

  const ext = lower.split('.').pop() || '';
  return !TEXT_EXTENSIONS.has(ext);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function computeSyncDiff(
  workspaceFiles: ProjectFile[],
  deviceFiles: ProjectFile[]
): DeviceSyncDiff {
  const deviceMap = new Map<string, ProjectFile>();
  for (const df of deviceFiles) {
    const norm = normalizeRelativePath(df.path);
    if (norm) deviceMap.set(norm, df);
  }

  const workspaceSet = new Set<string>();
  const toCreate: ProjectFile[] = [];
  const toUpdate: ProjectFile[] = [];
  const unchanged: ProjectFile[] = [];

  for (const wf of workspaceFiles) {
    const norm = normalizeRelativePath(wf.path);
    if (!norm) continue;
    workspaceSet.add(norm);
    const existing = deviceMap.get(norm);
    if (!existing) {
      toCreate.push(wf);
    } else if (existing.content !== wf.content) {
      toUpdate.push(wf);
    } else {
      unchanged.push(wf);
    }
  }

  const deviceOnly: ProjectFile[] = [];
  for (const [norm, df] of deviceMap.entries()) {
    if (!workspaceSet.has(norm)) {
      deviceOnly.push(df);
    }
  }

  return { toCreate, toUpdate, unchanged, deviceOnly };
}

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandleDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    tx.objectStore(IDB_STORE_NAME).put(handle, IDB_HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to persist directory handle'));
  });
  db.close();
}

export async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDb();
    const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const req = tx.objectStore(IDB_STORE_NAME).get(IDB_HANDLE_KEY);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return handle;
  } catch {
    return null;
  }
}

export async function clearDirectoryHandle(): Promise<void> {
  try {
    const db = await openHandleDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      tx.objectStore(IDB_STORE_NAME).delete(IDB_HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore cleanup failures
  }
}

export async function queryHandlePermission(
  handle: any,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<'granted' | 'prompt' | 'denied'> {
  if (!handle || typeof handle.queryPermission !== 'function') return 'granted';
  try {
    return await handle.queryPermission({ mode });
  } catch {
    return 'prompt';
  }
}

export async function requestHandlePermission(
  handle: any,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<'granted' | 'prompt' | 'denied'> {
  if (!handle || typeof handle.requestPermission !== 'function') return 'granted';
  const current = await queryHandlePermission(handle, mode);
  if (current === 'granted') return 'granted';
  return await handle.requestPermission({ mode });
}

export async function pickNativeDirectoryHandle(): Promise<FileSystemDirectoryHandle> {
  const win = window as any;
  if (typeof win.showDirectoryPicker !== 'function') {
    throw new Error('File System Access API (showDirectoryPicker) is not supported in this browser.');
  }
  const handle = (await win.showDirectoryPicker({
    id: 'liquidos-one-workspace',
    mode: 'readwrite',
  })) as FileSystemDirectoryHandle;
  return handle;
}

export async function connectOpfsRoot(): Promise<FileSystemDirectoryHandle> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) {
    throw new Error('Origin Private File System (OPFS) is unavailable in this environment.');
  }
  const root = await navigator.storage.getDirectory();
  return await root.getDirectoryHandle(OPFS_WORKSPACE_FOLDER, { create: true });
}

export async function getStorageQuotaEstimate(): Promise<StorageQuotaEstimate | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const est = await navigator.storage.estimate();
    const usageBytes = Number(est.usage ?? 0);
    const quotaBytes = Number(est.quota ?? 0);
    const usagePct = quotaBytes > 0 ? Number(((usageBytes / quotaBytes) * 100).toFixed(2)) : 0;
    return { usageBytes, quotaBytes, usagePct };
  } catch {
    return null;
  }
}

export async function readDirectoryHandleTree(
  dirHandle: any,
  maxFiles = 200
): Promise<ProjectFile[]> {
  const results: ProjectFile[] = [];

  async function walk(currentHandle: any, prefix: string) {
    if (results.length >= maxFiles) return;
    const entriesFn = currentHandle?.values || currentHandle?.entries;
    if (typeof entriesFn !== 'function') return;

    const iterator = currentHandle.values ? currentHandle.values() : currentHandle.entries();
    for await (const rawEntry of iterator) {
      if (results.length >= maxFiles) break;
      const entry = Array.isArray(rawEntry) ? rawEntry[1] : rawEntry;
      if (!entry || !entry.name) continue;

      const relPath = normalizeRelativePath(prefix ? `${prefix}/${entry.name}` : entry.name);
      if (!relPath) continue;

      if (entry.kind === 'directory') {
        if (shouldIgnoreEntry(entry.name, 'directory')) continue;
        await walk(entry, relPath);
      } else if (entry.kind === 'file') {
        const fileObj: File = await entry.getFile();
        if (shouldIgnoreEntry(entry.name, 'file', fileObj.size)) continue;
        const content = await fileObj.text();
        results.push({
          name: entry.name,
          path: relPath,
          language: inferLanguageFromPath(relPath),
          content,
          lastModified: fileObj.lastModified || Date.now(),
        });
      }
    }
  }

  await walk(dirHandle, '');
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

export async function writeSingleFileToDirectoryHandle(
  rootHandle: any,
  rawPath: string,
  content: string
): Promise<void> {
  const norm = normalizeRelativePath(rawPath);
  if (!norm) {
    throw new Error(`Unsafe or empty file path rejected: "${rawPath}"`);
  }
  const parts = norm.split('/');
  const fileName = parts.pop()!;
  let currentDir = rootHandle;

  for (const folder of parts) {
    currentDir = await currentDir.getDirectoryHandle(folder, { create: true });
  }

  const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(content);
  } finally {
    await writable.close();
  }
}

export async function writeFilesToDirectoryHandle(
  rootHandle: any,
  files: ProjectFile[]
): Promise<{ writtenCount: number; errors: string[] }> {
  let writtenCount = 0;
  const errors: string[] = [];

  for (const file of files) {
    try {
      await writeSingleFileToDirectoryHandle(rootHandle, file.path, file.content);
      writtenCount += 1;
    } catch (err: any) {
      errors.push(`${file.path}: ${err?.message || 'write failed'}`);
    }
  }

  return { writtenCount, errors };
}

export async function deleteEntryFromDirectoryHandle(
  rootHandle: any,
  rawPath: string
): Promise<void> {
  const norm = normalizeRelativePath(rawPath);
  if (!norm) return;
  const parts = norm.split('/');
  const fileName = parts.pop()!;
  let currentDir = rootHandle;
  for (const folder of parts) {
    currentDir = await currentDir.getDirectoryHandle(folder, { create: false });
  }
  await currentDir.removeEntry(fileName);
}

export async function readWebkitDirectoryFileList(
  fileList: FileList | File[],
  maxFiles = 200
): Promise<{ rootFolderName: string; files: ProjectFile[] }> {
  const arr = Array.from(fileList as Iterable<File>);
  const files: ProjectFile[] = [];
  let rootFolderName = 'Local Folder';

  for (const f of arr) {
    if (files.length >= maxFiles) break;
    const rawRel = (f as any).webkitRelativePath || f.name;
    const parts = rawRel.replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts.length > 1) {
      rootFolderName = parts[0];
    }
    const stripped = parts.length > 1 ? parts.slice(1).join('/') : parts[0];
    const norm = normalizeRelativePath(stripped);
    if (!norm) continue;

    // Skip ignored directories inside nested paths
    const segments = norm.split('/');
    if (segments.slice(0, -1).some((dir) => shouldIgnoreEntry(dir, 'directory'))) {
      continue;
    }
    if (shouldIgnoreEntry(segments[segments.length - 1], 'file', f.size)) {
      continue;
    }

    const content = await f.text();
    files.push({
      name: segments[segments.length - 1],
      path: norm,
      language: inferLanguageFromPath(norm),
      content,
      lastModified: f.lastModified || Date.now(),
    });
  }

  return {
    rootFolderName,
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
  };
}
