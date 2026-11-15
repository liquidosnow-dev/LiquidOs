import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  detectFileSystemCapabilities,
  normalizeRelativePath,
  inferLanguageFromPath,
  shouldIgnoreEntry,
  formatBytes,
  computeSyncDiff,
  readDirectoryHandleTree,
  writeFilesToDirectoryHandle,
  deleteEntryFromDirectoryHandle,
  readWebkitDirectoryFileList,
} from './onDeviceFs';
import { ProjectFile } from '../types';

function createMockDirectoryHandle(name = 'root') {
  const dirs = new Map<string, any>();
  const files = new Map<string, { content: string; lastModified: number }>();

  const handle: any = {
    kind: 'directory',
    name,
    async getDirectoryHandle(childName: string, opts?: { create?: boolean }) {
      if (dirs.has(childName)) return dirs.get(childName);
      if (opts?.create) {
        const sub = createMockDirectoryHandle(childName);
        dirs.set(childName, sub);
        return sub;
      }
      throw new Error(`Directory not found: ${childName}`);
    },
    async getFileHandle(childName: string, opts?: { create?: boolean }) {
      if (!files.has(childName) && !opts?.create) {
        throw new Error(`File not found: ${childName}`);
      }
      if (!files.has(childName)) {
        files.set(childName, { content: '', lastModified: Date.now() });
      }
      return {
        kind: 'file',
        name: childName,
        async getFile() {
          const entry = files.get(childName)!;
          return {
            name: childName,
            size: Buffer.byteLength(entry.content, 'utf8'),
            lastModified: entry.lastModified,
            async text() {
              return entry.content;
            },
          };
        },
        async createWritable() {
          let buffer = '';
          return {
            async write(chunk: string) {
              buffer = chunk;
            },
            async close() {
              files.set(childName, { content: buffer, lastModified: Date.now() });
            },
          };
        },
      };
    },
    async removeEntry(entryName: string) {
      files.delete(entryName);
      dirs.delete(entryName);
    },
    async *values() {
      for (const sub of dirs.values()) {
        yield sub;
      }
      for (const [fname] of files.entries()) {
        yield await handle.getFileHandle(fname);
      }
    },
  };

  return handle;
}

test('detectFileSystemCapabilities identifies top-level vs cross-origin iframe restriction', () => {
  const topObj = {};
  const topCaps = detectFileSystemCapabilities(
    { self: topObj, top: topObj, showDirectoryPicker: async () => ({}), indexedDB: {} },
    { storage: { getDirectory: async () => ({}) } }
  );
  assert.equal(topCaps.fileSystemAccess, true);
  assert.equal(topCaps.opfs, true);
  assert.equal(topCaps.iframeRestricted, false);

  const iframeCaps = detectFileSystemCapabilities(
    { self: { id: 1 }, top: { id: 2 }, showDirectoryPicker: async () => ({}) },
    { storage: { getDirectory: async () => ({}) } }
  );
  assert.equal(iframeCaps.fileSystemAccess, true);
  assert.equal(iframeCaps.isTopLevelWindow, false);
  assert.equal(iframeCaps.iframeRestricted, true);
});

test('normalizeRelativePath blocks traversal and normalizes separators cleanly', () => {
  assert.equal(normalizeRelativePath('/src\\utils\\app.ts'), 'src/utils/app.ts');
  assert.equal(normalizeRelativePath('../etc/passwd'), null);
  assert.equal(normalizeRelativePath('src/../../secret.ts'), null);
  assert.equal(normalizeRelativePath('src/./file.ts'), null);
  assert.equal(normalizeRelativePath('   '), null);
  assert.equal(normalizeRelativePath('src/bad\0name.ts'), null);
});

test('shouldIgnoreEntry and inferLanguageFromPath enforce safe filtering and language detection', () => {
  assert.equal(shouldIgnoreEntry('node_modules', 'directory'), true);
  assert.equal(shouldIgnoreEntry('.git', 'directory'), true);
  assert.equal(shouldIgnoreEntry('src', 'directory'), false);
  assert.equal(shouldIgnoreEntry('bundle.png', 'file', 1200), true);
  assert.equal(shouldIgnoreEntry('huge.ts', 'file', 2 * 1024 * 1024), true);
  assert.equal(shouldIgnoreEntry('.env.example', 'file', 120), false);
  assert.equal(shouldIgnoreEntry('Dockerfile', 'file', 300), false);

  assert.equal(inferLanguageFromPath('src/index.ts'), 'typescript');
  assert.equal(inferLanguageFromPath('verification-tools/canonical.py'), 'python');
  assert.equal(inferLanguageFromPath('schemas/envelope.jsonc'), 'json');
  assert.equal(inferLanguageFromPath('README.md'), 'markdown');
});

test('computeSyncDiff categorizes created, updated, unchanged, and device-only files', () => {
  const mk = (path: string, content: string): ProjectFile => ({
    name: path.split('/').pop()!,
    path,
    language: inferLanguageFromPath(path),
    content,
    lastModified: 1000,
  });

  const workspace = [
    mk('src/a.ts', 'const a = 1;'),
    mk('src/b.ts', 'const b = 2;'),
    mk('src/c.ts', 'const c = 3;'),
  ];
  const device = [
    mk('src/a.ts', 'const a = 1;'),
    mk('src/b.ts', 'const b = 999;'),
    mk('src/d.ts', 'const d = 4;'),
  ];

  const diff = computeSyncDiff(workspace, device);
  assert.deepEqual(
    diff.toCreate.map((f) => f.path),
    ['src/c.ts']
  );
  assert.deepEqual(
    diff.toUpdate.map((f) => f.path),
    ['src/b.ts']
  );
  assert.deepEqual(
    diff.unchanged.map((f) => f.path),
    ['src/a.ts']
  );
  assert.deepEqual(
    diff.deviceOnly.map((f) => f.path),
    ['src/d.ts']
  );
});

test('writeFilesToDirectoryHandle, readDirectoryHandleTree, and deleteEntryFromDirectoryHandle round-trip nested trees', async () => {
  const root = createMockDirectoryHandle('liquidos-local');
  // Seed ignored dir to verify skip
  const nm = await root.getDirectoryHandle('node_modules', { create: true });
  const fh = await nm.getFileHandle('skip.js', { create: true });
  const w = await fh.createWritable();
  await w.write('ignored');
  await w.close();

  const files: ProjectFile[] = [
    {
      name: 'index.ts',
      path: 'src/index.ts',
      language: 'typescript',
      content: 'export const ok = true;\n',
      lastModified: 100,
    },
    {
      name: 'README.md',
      path: 'README.md',
      language: 'markdown',
      content: '# LiquidOS ONE\n',
      lastModified: 100,
    },
  ];

  const writeRes = await writeFilesToDirectoryHandle(root, files);
  assert.equal(writeRes.writtenCount, 2);
  assert.equal(writeRes.errors.length, 0);

  const readBack = await readDirectoryHandleTree(root);
  assert.deepEqual(
    readBack.map((f) => f.path),
    ['README.md', 'src/index.ts']
  );
  assert.equal(readBack[1].content, 'export const ok = true;\n');

  await deleteEntryFromDirectoryHandle(root, 'src/index.ts');
  const afterDelete = await readDirectoryHandleTree(root);
  assert.deepEqual(
    afterDelete.map((f) => f.path),
    ['README.md']
  );
});

test('readWebkitDirectoryFileList parses relative folder paths and skips node_modules & formatBytes works', async () => {
  const mkFile = (rel: string, content: string, size?: number) =>
    ({
      name: rel.split('/').pop()!,
      webkitRelativePath: rel,
      size: size ?? Buffer.byteLength(content, 'utf8'),
      lastModified: 5000,
      text: async () => content,
    }) as unknown as File;

  const res = await readWebkitDirectoryFileList([
    mkFile('my-repo/src/app.ts', 'export const x = 1;'),
    mkFile('my-repo/node_modules/pkg/index.js', 'module.exports = {};'),
    mkFile('my-repo/logo.png', 'pngdata'),
    mkFile('my-repo/README.md', '# My Repo'),
  ]);

  assert.equal(res.rootFolderName, 'my-repo');
  assert.deepEqual(
    res.files.map((f) => f.path),
    ['README.md', 'src/app.ts']
  );
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(2048), '2.0 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
});
