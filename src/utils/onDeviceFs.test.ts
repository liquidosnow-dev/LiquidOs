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
  readDroppedFiles,
  readDroppedDataTransfer,
  validateIngestPath,
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

test('ING-01/ING-03/ING-04: readDroppedFiles rejects traversal, absolute/encoded paths, duplicates, binaries, NUL bytes, and oversize payloads', async () => {
  const mkDropFile = (name: string, content: string, size?: number, relPath?: string) =>
    ({
      name,
      webkitRelativePath: relPath ?? '',
      size: size ?? Buffer.byteLength(content, 'utf8'),
      lastModified: 9000,
      text: async () => content,
    }) as unknown as File;

  // validateIngestPath rejects absolute, drive, UNC, and encoded traversal while normalizing Windows relative separators
  assert.deepEqual(validateIngestPath('src\\nested\\app.ts'), { ok: true, path: 'src/nested/app.ts' });
  assert.equal(validateIngestPath('/etc/passwd').ok, false);
  assert.equal(validateIngestPath('\\\\server\\share\\file.ts').ok, false);
  assert.equal(validateIngestPath('C:\\Windows\\system32\\cmd.exe').ok, false);
  assert.equal(validateIngestPath('%2e%2e/secret.ts').ok, false);
  assert.equal(validateIngestPath('%252e%252e%252fetc').ok, false);

  const res = await readDroppedFiles(
    [
      mkDropFile('alpha.ts', 'export const alpha = 1;'),
      mkDropFile('alpha.ts', 'export const alpha = 2;'),
      mkDropFile('ALPHA.ts', 'export const collision = true;'),
      mkDropFile('logo.png', 'png-binary-data', 512),
      mkDropFile('disguised.ts', 'MZ\u0000\u0001binary', 16),
      mkDropFile('oversize.ts', 'x', 2 * 1024 * 1024),
      mkDropFile('secret.ts', 'nope', 16, '../../etc/passwd'),
      mkDropFile('abs.ts', 'nope', 16, '/etc/shadow'),
      mkDropFile('ignored.js', 'skip', 16, 'node_modules/pkg/ignored.js'),
    ],
    'uploads'
  );

  assert.deepEqual(
    res.files.map((f) => f.path),
    ['uploads/alpha.ts']
  );
  // Deterministic first-seen retention; duplicate & case-collision explicitly reported
  assert.equal(res.files[0].content, 'export const alpha = 1;');
  assert.equal(res.skipped.length, 8);
  assert.match(res.skipped[0].reason, /Duplicate relative path/i);
  assert.match(res.skipped[1].reason, /Case-insensitive.*path collision/i);
  assert.match(res.skipped[2].reason, /binary or non-text/i);
  assert.match(res.skipped[3].reason, /NUL byte/i);
  assert.match(res.skipped[4].reason, /limit/i);
  assert.match(res.skipped[5].reason, /traversal/i);
  assert.match(res.skipped[6].reason, /Absolute path/i);
  assert.match(res.skipped[7].reason, /Ignored/i);
});

test('ING-02: readDroppedFiles enforces maxFiles and malformed size metadata; readDroppedDataTransfer enforces depth & entry caps', async () => {
  const mkSimple = (name: string, content: string, size?: number) =>
    ({
      name,
      size: size ?? Buffer.byteLength(content, 'utf8'),
      lastModified: 1000,
      text: async () => content,
    }) as unknown as File;

  const limitRes = await readDroppedFiles(
    [
      mkSimple('a.ts', 'a'),
      mkSimple('bad.ts', 'bad', Number.NaN),
      mkSimple('spoof.ts', 'a'.repeat(1024 * 1024 + 5), 10),
      mkSimple('b.ts', 'b'),
      mkSimple('c.ts', 'c'),
    ],
    '',
    2
  );

  assert.deepEqual(
    limitRes.files.map((f) => f.path),
    ['a.ts', 'b.ts']
  );
  assert.equal(limitRes.skipped.length, 3);
  assert.match(limitRes.skipped[0].reason, /Malformed or non-finite/i);
  assert.match(limitRes.skipped[1].reason, /Decoded payload exceeds/i);
  assert.match(limitRes.skipped[2].reason, /Batch limit/i);

  const makeFileEntry = (name: string, content: string) => ({
    isFile: true,
    isDirectory: false,
    name,
    file: (onSuccess: (f: File) => void) =>
      onSuccess({
        name,
        size: Buffer.byteLength(content, 'utf8'),
        lastModified: 1234,
        text: async () => content,
      } as unknown as File),
  });

  const makeDirEntry = (name: string, children: any[]) => ({
    isFile: false,
    isDirectory: true,
    name,
    createReader: () => {
      let called = false;
      return {
        readEntries: (onSuccess: (batch: any[]) => void) => {
          if (!called) {
            called = true;
            onSuccess(children);
          } else {
            onSuccess([]);
          }
        },
      };
    },
  });

  // Deep nesting beyond maxDepth=2
  const deepTree = makeDirEntry('d0', [
    makeDirEntry('d1', [
      makeDirEntry('d2', [makeFileEntry('too-deep.ts', 'nope')]),
    ]),
    makeFileEntry('ok.ts', 'export const ok = true;'),
  ]);

  const deepTransfer = {
    items: [{ webkitGetAsEntry: () => deepTree }],
    files: [],
  } as unknown as DataTransfer;

  const deepRes = await readDroppedDataTransfer(deepTransfer, '', 50, 2, 100);
  assert.deepEqual(
    deepRes.files.map((f) => f.path),
    ['d0/ok.ts']
  );
  assert.ok(deepRes.skipped.some((s) => /depth exceeds/i.test(s.reason)));

  // Standard directory traversal with node_modules & binary skipped
  const treeTransfer = {
    items: [
      {
        webkitGetAsEntry: () =>
          makeDirEntry('plugin', [
            makeFileEntry('index.ts', 'export const plugin = true;'),
            makeDirEntry('node_modules', [makeFileEntry('dep.js', 'ignored')]),
            makeFileEntry('banner.png', 'binary'),
          ]),
      },
    ],
    files: [],
  } as unknown as DataTransfer;

  const treeRes = await readDroppedDataTransfer(treeTransfer, 'src');
  assert.deepEqual(
    treeRes.files.map((f) => f.path),
    ['src/plugin/index.ts']
  );
  assert.ok(treeRes.skipped.some((s) => s.name === 'src/plugin/banner.png'));
  assert.ok(treeRes.skipped.some((s) => /Ignored/i.test(s.reason)));

  const fallbackTransfer = {
    items: [],
    files: [
      {
        name: 'README.md',
        size: 10,
        lastModified: 1234,
        text: async () => '# Readme\n',
      } as unknown as File,
    ],
  } as unknown as DataTransfer;

  const fallbackRes = await readDroppedDataTransfer(fallbackTransfer, '');
  assert.deepEqual(
    fallbackRes.files.map((f) => f.path),
    ['README.md']
  );
  assert.equal(fallbackRes.skipped.length, 0);
});

test('ING-01..ING-04 Second-Stage hardening: triple percent-encoding, bidi/length caps, NFC Unicode/existing workspace collisions, strict UTF-8/magic binaries, and AbortSignal', async () => {
  // Triple & quadruple encoded traversal + bidi + oversize segment/path
  assert.equal(validateIngestPath('%25252e%25252e%25252fpasswd').ok, false);
  assert.equal(validateIngestPath('%2525252e%2525252e/secret.ts').ok, false);
  assert.equal(validateIngestPath('src/\u202Eevil.ts').ok, false);
  assert.equal(validateIngestPath('a'.repeat(260) + '.ts').ok, false);
  assert.equal(validateIngestPath(('d/'.repeat(600)) + 'a.ts').ok, false);

  const mkBufferFile = (name: string, bytes: Uint8Array, type = 'text/plain', relPath = '') =>
    ({
      name,
      webkitRelativePath: relPath,
      type,
      size: bytes.byteLength,
      lastModified: 1000,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      text: async () => new TextDecoder('utf-8', { fatal: false }).decode(bytes),
    }) as unknown as File;

  const pdfBytes = new TextEncoder().encode('%PDF-1.7\nbinary stream');
  const invalidUtf8 = new Uint8Array([0xff, 0xfe, 0xfd]);
  const validText = new TextEncoder().encode('export const ok = 1;\n');
  const nfdContent = new TextEncoder().encode('export const cafe = "nfd";');

  const res = await readDroppedFiles(
    [
      mkBufferFile('caf\u00e9.ts', validText, 'text/typescript'),
      mkBufferFile('cafe\u0301.ts', nfdContent, 'text/typescript'), // NFD colliding with NFC in same batch
      mkBufferFile('INDEX.TS', validText, 'text/typescript'), // Collides case-insensitively with existing workspace file src/index.ts
      mkBufferFile('fake.ts', pdfBytes, 'text/typescript'), // PDF magic signature disguised as .ts
      mkBufferFile('badutf8.ts', invalidUtf8, 'text/typescript'), // Invalid UTF-8
      mkBufferFile('doc.txt', validText, 'application/pdf'), // Disallowed binary MIME
      mkBufferFile('src/index.ts', validText, 'text/typescript', 'src/index.ts'), // Exact-case overwrite IS allowed
    ],
    '',
    200,
    [],
    { existingWorkspacePaths: ['src/index.ts'] }
  );

  // Check exact acceptance & collision handling when targetDir=''
  const indexed = await readDroppedFiles(
    [
      mkBufferFile('caf\u00e9.ts', validText, 'text/typescript'),
      mkBufferFile('cafe\u0301.ts', nfdContent, 'text/typescript'),
      mkBufferFile('CAFE\u0301.ts', nfdContent, 'text/typescript'),
      mkBufferFile('INDEX.TS', validText, 'text/typescript'),
      mkBufferFile('fake.ts', pdfBytes, 'text/typescript'),
      mkBufferFile('badutf8.ts', invalidUtf8, 'text/typescript'),
      mkBufferFile('doc.txt', validText, 'application/pdf'),
    ],
    'src',
    200,
    [],
    { existingWorkspacePaths: ['src/index.ts'] }
  );

  assert.deepEqual(
    indexed.files.map((f) => f.path),
    ['src/café.ts']
  );
  assert.equal(indexed.skipped.length, 6);
  assert.match(indexed.skipped[0].reason, /Duplicate relative path/i);
  assert.match(indexed.skipped[1].reason, /Unicode path collision in batch/i);
  assert.match(indexed.skipped[2].reason, /existing workspace file "src\/index\.ts"/i);
  assert.match(indexed.skipped[3].reason, /magic header/i);
  assert.match(indexed.skipped[4].reason, /Invalid UTF-8/i);
  assert.match(indexed.skipped[5].reason, /MIME type/i);
  assert.ok(res.files.some((f) => f.path === 'src/index.ts'));

  // AbortSignal halts readDroppedDataTransfer
  const controller = new AbortController();
  controller.abort('LOCKDOWN');
  const abortedDrop = await readDroppedDataTransfer(
    {
      items: [],
      files: [mkBufferFile('a.ts', validText)],
    } as unknown as DataTransfer,
    '',
    50,
    4,
    100,
    { signal: controller.signal }
  );
  assert.equal(abortedDrop.files.length, 0);
  assert.match(abortedDrop.skipped[0].reason, /aborted/i);
});

test('ING-11 Linearization Gate: async LOCKDOWN between pre_writable and pre_close aborts writable without committing', async () => {
  const events: string[] = [];
  let committed = false;
  let abortedStream = false;

  const mockRoot: any = {
    async getDirectoryHandle(name: string) {
      events.push(`dir:${name}`);
      return mockRoot;
    },
    async getFileHandle(name: string) {
      events.push(`file:${name}`);
      return {
        async createWritable() {
          events.push('createWritable');
          return {
            async write() {
              events.push('write');
            },
            async close() {
              committed = true;
              events.push('close');
            },
            async abort() {
              abortedStream = true;
              events.push('abort');
            },
          };
        },
      };
    },
  };

  let lockedDown = false;
  const result = await writeFilesToDirectoryHandle(
    mockRoot,
    [
      {
        name: 'target.ts',
        path: 'src/target.ts',
        language: 'typescript',
        content: 'export const x = 1;',
        lastModified: 1000,
      },
    ],
    {
      beforePhase: (phase) => {
        if (phase === 'pre_write') {
          // Simulate concurrent async LOCKDOWN occurring right after createWritable()!
          lockedDown = true;
        }
        if (lockedDown) {
          throw new Error('GLOBAL-MODE-001 LOCKDOWN active mid-write');
        }
      },
    }
  );

  assert.equal(result.aborted, true);
  assert.equal(result.writtenCount, 0);
  assert.deepEqual(result.abortedPaths, ['src/target.ts']);
  assert.equal(committed, false);
  assert.equal(abortedStream, true);
  assert.ok(events.includes('abort'));
  assert.equal(events.includes('close'), false);
});
