import type { ProjectFile } from '../types/index.ts';

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
export const MAX_READABLE_FILE_BYTES = 1024 * 1024; // 1 MB safeguard per file
export const MAX_BATCH_BYTES = 10 * 1024 * 1024; // 10 MB cumulative batch safeguard
export const MAX_DROP_DEPTH = 16;
export const MAX_TRAVERSAL_ENTRIES = 1000;
export const MAX_PATH_LENGTH = 1024;
export const MAX_SEGMENT_LENGTH = 255;

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

export function normalizeCollisionKey(filePath: string): string {
  return filePath.normalize('NFC').toLowerCase();
}

/**
 * Strict ingest path validator (ING-01):
 * Rejects absolute Unix/Windows/UNC paths, drive letters, URI schemes,
 * control/bidi characters, NUL bytes, arbitrary-depth percent-encoded traversal sequences,
 * and oversize path/segment lengths while normalizing NFC Unicode and safe Windows separators.
 */
export function validateIngestPath(
  rawPath: string
): { ok: true; path: string } | { ok: false; reason: string } {
  if (typeof rawPath !== 'string') {
    return { ok: false, reason: 'Path must be a string' };
  }
  const trimmed = rawPath.trim();
  if (!trimmed) {
    return { ok: false, reason: 'Empty relative path' };
  }
  if (trimmed.length > MAX_PATH_LENGTH * 2) {
    return { ok: false, reason: `Path exceeds maximum length (${MAX_PATH_LENGTH} chars)` };
  }
  if (
    trimmed.includes('\0') ||
    /[\u0000-\u001F\u007F\u200E\u200F\u202A-\u202E\u2066-\u2069]/.test(trimmed) ||
    /%(?:25)*00/i.test(trimmed)
  ) {
    return { ok: false, reason: 'Control, bidi, or null byte rejected in path' };
  }
  if (/%(?:25)*(?:2e|2f|5c)/i.test(trimmed)) {
    return { ok: false, reason: 'Encoded traversal or separator sequence rejected' };
  }

  // Iterative percent-decoding check up to 8 layers against nested encodings
  let candidate = trimmed;
  for (let pass = 0; pass < 8 && candidate.includes('%'); pass++) {
    try {
      const decoded = decodeURIComponent(candidate);
      if (decoded === candidate) break;
      candidate = decoded;
      if (
        candidate.includes('\0') ||
        /^(?:\/+|\\+|[A-Za-z]:|[a-z][a-z0-9+.-]*:\/\/)/i.test(candidate) ||
        candidate
          .replace(/\\/g, '/')
          .split('/')
          .some((seg) => seg === '.' || seg === '..')
      ) {
        return { ok: false, reason: 'Encoded traversal or separator sequence rejected' };
      }
    } catch {
      return { ok: false, reason: 'Malformed percent-encoding rejected in path' };
    }
  }

  const nfc = trimmed.normalize('NFC');
  if (/^(?:\/+|\\+|[A-Za-z]:|[a-z][a-z0-9+.-]*:\/\/)/i.test(nfc)) {
    return { ok: false, reason: 'Absolute path or drive prefix rejected' };
  }

  const slashNormalized = nfc.replace(/\\/g, '/');
  const segments = slashNormalized.split('/').filter((s) => s.length > 0);
  if (segments.length === 0) {
    return { ok: false, reason: 'Empty relative path' };
  }

  const encoder = new TextEncoder();
  for (const seg of segments) {
    if (seg === '.' || seg === '..') {
      return { ok: false, reason: 'Path traversal segment rejected' };
    }
    if (seg.length > MAX_SEGMENT_LENGTH || encoder.encode(seg).byteLength > MAX_SEGMENT_LENGTH) {
      return {
        ok: false,
        reason: `Filename segment exceeds ${MAX_SEGMENT_LENGTH} character/byte limit`,
      };
    }
  }

  const joined = segments.join('/');
  if (joined.length > MAX_PATH_LENGTH) {
    return { ok: false, reason: `Path exceeds ${MAX_PATH_LENGTH} character limit` };
  }

  return { ok: true, path: joined };
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

export type WritePhase = 'pre_open' | 'pre_writable' | 'pre_write' | 'pre_close';

export interface DirectoryWriteOptions {
  signal?: AbortSignal;
  beforeEachWrite?: (path: string) => void | Promise<void>;
  beforePhase?: (phase: WritePhase, path: string) => void | Promise<void>;
}

export async function writeSingleFileToDirectoryHandle(
  rootHandle: any,
  rawPath: string,
  content: string,
  options?: DirectoryWriteOptions
): Promise<void> {
  const pathCheck = validateIngestPath(rawPath);
  if (!pathCheck.ok) {
    throw new Error(`Unsafe or empty file path rejected: "${rawPath}" (${pathCheck.reason})`);
  }
  const norm = pathCheck.path;

  const assertGate = async (phase: WritePhase) => {
    if (options?.signal?.aborted) {
      throw new Error(`GLOBAL-MODE-001: Write operation aborted prior to ${phase}.`);
    }
    if (phase === 'pre_open' && options?.beforeEachWrite) {
      await options.beforeEachWrite(norm);
    }
    if (options?.beforePhase) {
      await options.beforePhase(phase, norm);
    }
    if (options?.signal?.aborted) {
      throw new Error(`GLOBAL-MODE-001: Write operation aborted at ${phase}.`);
    }
  };

  await assertGate('pre_open');

  const parts = norm.split('/');
  const fileName = parts.pop()!;
  let currentDir = rootHandle;

  for (const folder of parts) {
    currentDir = await currentDir.getDirectoryHandle(folder, { create: true });
  }

  const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
  await assertGate('pre_writable');

  const writable = await fileHandle.createWritable();
  let closed = false;
  try {
    await assertGate('pre_write');
    await writable.write(content);
    await assertGate('pre_close');
    await writable.close();
    closed = true;
  } catch (err) {
    if (!closed) {
      if (typeof writable.abort === 'function') {
        await writable.abort().catch(() => {});
      }
    }
    throw err;
  }
}

export interface DirectoryWriteResult {
  writtenCount: number;
  writtenPaths: string[];
  failedFiles: { path: string; reason: string }[];
  aborted: boolean;
  abortedPaths: string[];
  errors: string[];
}

export async function writeFilesToDirectoryHandle(
  rootHandle: any,
  files: ProjectFile[],
  options?: DirectoryWriteOptions
): Promise<DirectoryWriteResult> {
  let writtenCount = 0;
  const writtenPaths: string[] = [];
  const failedFiles: { path: string; reason: string }[] = [];
  const abortedPaths: string[] = [];
  const errors: string[] = [];
  let aborted = false;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (options?.signal?.aborted) {
      aborted = true;
      for (let j = i; j < files.length; j++) {
        abortedPaths.push(files[j].path);
      }
      errors.push('Write operation aborted by control plane.');
      break;
    }

    try {
      await writeSingleFileToDirectoryHandle(rootHandle, file.path, file.content, options);
      writtenCount += 1;
      writtenPaths.push(file.path);
    } catch (err: any) {
      const reason = err?.message || 'write failed';
      if (
        String(reason).includes('LOCKDOWN') ||
        String(reason).includes('GLOBAL-MODE-001') ||
        String(reason).includes('IAM-001') ||
        String(reason).includes('revoked') ||
        String(reason).includes('Stale') ||
        String(reason).includes('aborted')
      ) {
        aborted = true;
        abortedPaths.push(file.path);
        for (let j = i + 1; j < files.length; j++) {
          abortedPaths.push(files[j].path);
        }
        errors.push(`${file.path}: ${reason}`);
        break;
      }
      failedFiles.push({ path: file.path, reason });
      errors.push(`${file.path}: ${reason}`);
    }
  }

  return { writtenCount, writtenPaths, failedFiles, aborted, abortedPaths, errors };
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

export interface DropSkippedFile {
  name: string;
  reason: string;
}

export interface DropImportResult {
  files: ProjectFile[];
  skipped: DropSkippedFile[];
}

function resolveDropTargetPath(
  rawRelativePath: string,
  targetDir = ''
): { ok: true; path: string } | { ok: false; reason: string } {
  const fileCheck = validateIngestPath(rawRelativePath);
  if (!fileCheck.ok) return fileCheck;

  const trimmedDir = typeof targetDir === 'string' ? targetDir.trim() : '';
  if (!trimmedDir) return fileCheck;

  const dirCheck = validateIngestPath(trimmedDir);
  if (!dirCheck.ok) {
    return { ok: false, reason: `Invalid target directory: ${dirCheck.reason}` };
  }

  const combined = validateIngestPath(`${dirCheck.path}/${fileCheck.path}`);
  if (!combined.ok) return combined;
  if (combined.path !== dirCheck.path && !combined.path.startsWith(`${dirCheck.path}/`)) {
    return { ok: false, reason: 'Path escaped designated destination directory' };
  }
  return combined;
}

export interface DropImportOptions {
  existingWorkspacePaths?: string[];
  signal?: AbortSignal;
}

function hasDisallowedMimeType(mime: string | undefined): boolean {
  if (!mime || typeof mime !== 'string') return false;
  const lower = mime.trim().toLowerCase();
  if (!lower) return false;
  if (lower.startsWith('text/')) return false;
  if (lower === 'image/svg+xml') return false;
  if (
    lower === 'application/json' ||
    lower === 'application/javascript' ||
    lower === 'application/x-javascript' ||
    lower === 'application/typescript' ||
    lower === 'application/xml' ||
    lower === 'application/toml' ||
    lower === 'application/yaml' ||
    lower === 'application/x-yaml'
  ) {
    return false;
  }
  return (
    lower.startsWith('image/') ||
    lower.startsWith('audio/') ||
    lower.startsWith('video/') ||
    lower.startsWith('font/') ||
    lower === 'application/pdf' ||
    lower === 'application/zip' ||
    lower === 'application/gzip' ||
    lower === 'application/octet-stream' ||
    lower === 'application/wasm' ||
    lower === 'application/x-msdownload' ||
    lower === 'application/x-executable'
  );
}

function hasBinaryMagicHeader(bytes: Uint8Array): boolean {
  if (bytes.length >= 4) {
    // PNG: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
    // PDF: %PDF
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return true;
    // ZIP: PK\x03\x04
    if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return true;
    // ELF: \x7fELF
    if (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) return true;
    // WASM: \x00asm
    if (bytes[0] === 0x00 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d) return true;
    // GIF8
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true;
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return true; // JPEG
  }
  return false;
}

async function decodeAndValidateTextFile(
  file: File
): Promise<{ ok: true; content: string; byteLength: number } | { ok: false; reason: string }> {
  let content: string;
  let byteLength: number;

  if (typeof (file as any).arrayBuffer === 'function') {
    const buf = await (file as any).arrayBuffer();
    const bytes = new Uint8Array(buf);
    byteLength = bytes.byteLength;
    if (byteLength > MAX_READABLE_FILE_BYTES) {
      return { ok: false, reason: `Decoded payload exceeds ${formatBytes(MAX_READABLE_FILE_BYTES)} text limit` };
    }
    if (bytes.includes(0)) {
      return { ok: false, reason: 'Binary NUL byte payload rejected' };
    }
    if (hasBinaryMagicHeader(bytes)) {
      return { ok: false, reason: 'Binary magic header signature rejected' };
    }
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return { ok: false, reason: 'Invalid UTF-8 byte sequence rejected' };
    }
  } else {
    const raw = await file.text();
    if (typeof raw !== 'string') {
      return { ok: false, reason: 'Unable to decode file as text' };
    }
    content = raw;
    byteLength = new TextEncoder().encode(content).byteLength;
    if (byteLength > MAX_READABLE_FILE_BYTES) {
      return { ok: false, reason: `Decoded payload exceeds ${formatBytes(MAX_READABLE_FILE_BYTES)} text limit` };
    }
    if (content.includes('\u0000')) {
      return { ok: false, reason: 'Binary NUL byte payload rejected' };
    }
  }

  // Reject non-whitespace C0 control characters (binary content disguised in UTF-8 text)
  if (/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/.test(content)) {
    return { ok: false, reason: 'Binary control character payload rejected' };
  }

  return { ok: true, content, byteLength };
}

export async function readDroppedFiles(
  fileList: FileList | File[],
  targetDir = '',
  maxFiles = 200,
  preSkipped: DropSkippedFile[] = [],
  options?: DropImportOptions
): Promise<DropImportResult> {
  const items = Array.from(fileList as Iterable<File>);
  const acceptedFiles: ProjectFile[] = [];
  const seenExact = new Set<string>();
  const seenLower = new Set<string>();
  const skipped: DropSkippedFile[] = [...preSkipped];
  let totalAcceptedBytes = 0;

  const existingCollisionMap = new Map<string, string>();
  if (options?.existingWorkspacePaths) {
    for (const wp of options.existingWorkspacePaths) {
      existingCollisionMap.set(normalizeCollisionKey(wp), wp.normalize('NFC'));
    }
  }

  for (const file of items) {
    if (options?.signal?.aborted) {
      skipped.push({
        name: file?.name || '(aborted)',
        reason: 'File ingestion aborted by control plane.',
      });
      continue;
    }

    if (!file || typeof file !== 'object') {
      skipped.push({ name: '(invalid)', reason: 'Malformed file metadata entry' });
      continue;
    }

    if (acceptedFiles.length >= maxFiles) {
      skipped.push({
        name: file.name || '(unnamed)',
        reason: `Batch limit (${maxFiles} files) reached`,
      });
      continue;
    }

    const rawRel = (file as any).webkitRelativePath || file.name;
    const pathCheck = resolveDropTargetPath(rawRel, targetDir);
    if (!pathCheck.ok) {
      skipped.push({ name: String(rawRel || file.name || '(unnamed)'), reason: pathCheck.reason });
      continue;
    }
    const relPath = pathCheck.path;

    // Deterministic duplicate, Unicode NFC, and case-insensitive collision rejection (ING-03)
    if (seenExact.has(relPath)) {
      skipped.push({ name: relPath, reason: 'Duplicate relative path in batch (first entry kept)' });
      continue;
    }
    const lowerKey = normalizeCollisionKey(relPath);
    if (seenLower.has(lowerKey)) {
      skipped.push({ name: relPath, reason: 'Case-insensitive or Unicode path collision in batch' });
      continue;
    }
    const existingExact = existingCollisionMap.get(lowerKey);
    if (existingExact && existingExact !== relPath) {
      skipped.push({
        name: relPath,
        reason: `Case-insensitive or Unicode path collision with existing workspace file "${existingExact}"`,
      });
      continue;
    }

    const segments = relPath.split('/');
    const fileName = segments[segments.length - 1];
    if (segments.slice(0, -1).some((dir) => shouldIgnoreEntry(dir, 'directory'))) {
      skipped.push({ name: relPath, reason: 'Ignored build or vendor directory' });
      continue;
    }

    if (typeof file.size !== 'number' || !Number.isFinite(file.size) || file.size < 0) {
      skipped.push({ name: relPath, reason: 'Malformed or non-finite file size metadata' });
      continue;
    }

    if (file.size > MAX_READABLE_FILE_BYTES) {
      skipped.push({
        name: relPath,
        reason: `Exceeds ${formatBytes(MAX_READABLE_FILE_BYTES)} text limit`,
      });
      continue;
    }

    // Pre-read cumulative byte check before allocating text/buffer memory
    if (totalAcceptedBytes + file.size > MAX_BATCH_BYTES) {
      skipped.push({
        name: relPath,
        reason: `Cumulative batch limit (${formatBytes(MAX_BATCH_BYTES)}) reached prior to read`,
      });
      continue;
    }

    if (hasDisallowedMimeType((file as any).type)) {
      skipped.push({ name: relPath, reason: `Unsupported binary MIME type (${(file as any).type})` });
      continue;
    }

    if (shouldIgnoreEntry(fileName, 'file', file.size)) {
      skipped.push({ name: relPath, reason: 'Unsupported binary or non-text file extension' });
      continue;
    }

    try {
      const decoded = await decodeAndValidateTextFile(file);
      if (!decoded.ok) {
        skipped.push({ name: relPath, reason: decoded.reason });
        continue;
      }
      if (totalAcceptedBytes + decoded.byteLength > MAX_BATCH_BYTES) {
        skipped.push({
          name: relPath,
          reason: `Cumulative batch limit (${formatBytes(MAX_BATCH_BYTES)}) reached`,
        });
        continue;
      }

      seenExact.add(relPath);
      seenLower.add(lowerKey);
      totalAcceptedBytes += decoded.byteLength;
      acceptedFiles.push({
        name: fileName,
        path: relPath,
        language: inferLanguageFromPath(relPath),
        content: decoded.content,
        lastModified: Number.isFinite(file.lastModified) && file.lastModified > 0 ? file.lastModified : Date.now(),
      });
    } catch {
      skipped.push({ name: relPath, reason: 'Unable to read file as UTF-8 text' });
    }
  }

  return {
    files: acceptedFiles.sort((a, b) => a.path.localeCompare(b.path)),
    skipped,
  };
}

function readEntryAsFile(entry: any): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

function readAllDirectoryEntries(reader: any, maxEntries: number): Promise<{ entries: any[]; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    const all: any[] = [];
    function nextBatch() {
      reader.readEntries(
        (batch: any[]) => {
          if (!batch || batch.length === 0) {
            resolve({ entries: all, truncated: false });
          } else {
            all.push(...batch);
            if (all.length >= maxEntries) {
              resolve({ entries: all.slice(0, maxEntries), truncated: true });
            } else {
              nextBatch();
            }
          }
        },
        reject
      );
    }
    nextBatch();
  });
}

export async function readDroppedDataTransfer(
  dataTransfer: DataTransfer,
  targetDir = '',
  maxFiles = 200,
  maxDepth = MAX_DROP_DEPTH,
  maxVisitedEntries = Math.min(Math.max(maxFiles * 5, 200), MAX_TRAVERSAL_ENTRIES),
  options?: DropImportOptions
): Promise<DropImportResult> {
  if (!dataTransfer) {
    return { files: [], skipped: [{ name: '(drop)', reason: 'Missing DataTransfer payload' }] };
  }
  if (options?.signal?.aborted) {
    return {
      files: [],
      skipped: [{ name: '(drop)', reason: 'Drop traversal aborted by control plane' }],
    };
  }

  const dtItems = dataTransfer.items ? Array.from(dataTransfer.items) : [];
  const entries = dtItems
    .map((item) => (item && typeof (item as any).webkitGetAsEntry === 'function' ? (item as any).webkitGetAsEntry() : null))
    .filter(Boolean);

  if (entries.length === 0) {
    return readDroppedFiles(dataTransfer.files || [], targetDir, maxFiles, [], options);
  }

  const collectedFiles: File[] = [];
  const traversalSkipped: DropSkippedFile[] = [];
  let visitedEntries = 0;

  async function traverseEntry(entry: any, prefix: string, depth: number): Promise<void> {
    if (options?.signal?.aborted) {
      return;
    }
    if (!entry || typeof entry.name !== 'string' || !entry.name.trim()) {
      traversalSkipped.push({ name: '(malformed)', reason: 'Malformed filesystem entry' });
      return;
    }

    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    visitedEntries += 1;
    if (visitedEntries > maxVisitedEntries) {
      traversalSkipped.push({
        name: rel,
        reason: `Directory traversal cap (${maxVisitedEntries} entries) exceeded`,
      });
      return;
    }

    if (depth > maxDepth) {
      traversalSkipped.push({
        name: rel,
        reason: `Directory nesting depth exceeds ${maxDepth} levels`,
      });
      return;
    }

    if (collectedFiles.length >= maxFiles) {
      traversalSkipped.push({ name: rel, reason: `Batch limit (${maxFiles} files) reached` });
      return;
    }

    if (entry.isFile) {
      try {
        const file = await readEntryAsFile(entry);
        if (options?.signal?.aborted) return;
        Object.defineProperty(file, 'webkitRelativePath', {
          value: rel,
          configurable: true,
        });
        collectedFiles.push(file);
      } catch {
        traversalSkipped.push({ name: rel, reason: 'Failed to read dropped file entry' });
      }
    } else if (entry.isDirectory) {
      if (shouldIgnoreEntry(entry.name, 'directory')) {
        traversalSkipped.push({ name: rel, reason: 'Ignored build or vendor directory' });
        return;
      }
      try {
        const reader = entry.createReader();
        const { entries: children, truncated } = await readAllDirectoryEntries(
          reader,
          Math.max(1, maxVisitedEntries - visitedEntries + 1)
        );
        if (truncated) {
          traversalSkipped.push({
            name: rel,
            reason: `Directory entry count exceeds traversal limit (${maxVisitedEntries})`,
          });
        }
        for (const child of children) {
          if (options?.signal?.aborted) {
            traversalSkipped.push({ name: rel, reason: 'Drop traversal aborted by control plane' });
            break;
          }
          if (visitedEntries >= maxVisitedEntries || collectedFiles.length >= maxFiles) {
            traversalSkipped.push({
              name: child?.name ? `${rel}/${child.name}` : rel,
              reason:
                collectedFiles.length >= maxFiles
                  ? `Batch limit (${maxFiles} files) reached`
                  : `Directory traversal cap (${maxVisitedEntries} entries) exceeded`,
            });
            break;
          }
          await traverseEntry(child, rel, depth + 1);
        }
      } catch {
        traversalSkipped.push({ name: rel, reason: 'Failed to enumerate dropped directory' });
      }
    }
  }

  for (const entry of entries) {
    if (options?.signal?.aborted) break;
    if (visitedEntries >= maxVisitedEntries || collectedFiles.length >= maxFiles) break;
    await traverseEntry(entry, '', 0);
  }

  if (options?.signal?.aborted) {
    return {
      files: [],
      skipped: [...traversalSkipped, { name: '(drop)', reason: 'Drop ingestion aborted by control plane' }],
    };
  }

  if (collectedFiles.length === 0 && traversalSkipped.length === 0 && dataTransfer.files?.length > 0) {
    return readDroppedFiles(dataTransfer.files, targetDir, maxFiles, [], options);
  }

  return readDroppedFiles(collectedFiles, targetDir, maxFiles, traversalSkipped, options);
}
