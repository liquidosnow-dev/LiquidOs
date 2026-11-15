import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  createCommit,
  rollbackToCommit,
  computeLineDiff,
  generateCommitHash,
  verifyCommitIntegrity,
} from './versionControl';
import { Project } from '../types';

test('generateCommitHash produces consistent 64-char SHA-256 hexadecimal string', () => {
  const hash1 = generateCommitHash('initial commit', 'Mercy', [], null, 1000);
  const hash2 = generateCommitHash('initial commit', 'Mercy', [], null, 1000);
  assert.equal(hash1.length, 64);
  assert.equal(hash1, hash2);
});

test('createCommit creates a new commit and updates project state', () => {
  const initialProject: Project = {
    id: 'proj_1',
    name: 'LiquidOS Test',
    description: 'Testing version control',
    currentBranch: 'main',
    branches: {
      main: { name: 'main', currentCommitId: '' },
    },
    commits: [],
    files: [
      {
        name: 'index.html',
        path: 'index.html',
        language: 'html',
        content: '<h1>Hello World</h1>',
        lastModified: Date.now(),
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const { project, commit } = createCommit(initialProject, 'First feature commit', 'Mercy');
  assert.equal(project.commits.length, 1);
  assert.equal(project.branches.main.currentCommitId, commit.id);
  assert.equal(commit.message, 'First feature commit');
  assert.equal(commit.files[0].content, '<h1>Hello World</h1>');
  assert.equal(verifyCommitIntegrity(commit).valid, true);
});

test('verifyCommitIntegrity detects provenance mutation, claimStatus spoofing, and rogue fileHashes keys', () => {
  const baseProject: Project = {
    id: 'proj_sec',
    name: 'Provenance Test',
    description: '',
    currentBranch: 'main',
    branches: { main: { name: 'main', currentCommitId: '' } },
    commits: [],
    files: [
      { name: 'a.ts', path: 'src/a.ts', language: 'typescript', content: 'export const a = 1;', lastModified: 1000 },
    ],
    createdAt: 1000,
    updatedAt: 1000,
  };

  const { commit } = createCommit(baseProject, 'Ingest drop', 'Mercy (User)', {
    source: 'external_drop',
    claimStatus: 'untested',
    authorizationPermitId: 'perm_abc',
    epoch: 2,
    fencingVersion: 5,
  });

  assert.equal(verifyCommitIntegrity(commit).valid, true);

  // Spoof claimStatus from untested -> tested without updating hash
  const spoofedClaim = {
    ...commit,
    provenance: { ...commit.provenance!, claimStatus: 'tested' as const },
  };
  assert.equal(verifyCommitIntegrity(spoofedClaim).valid, false);

  // Spoof permit ID
  const spoofedPermit = {
    ...commit,
    provenance: { ...commit.provenance!, authorizationPermitId: 'perm_forged' },
  };
  assert.equal(verifyCommitIntegrity(spoofedPermit).valid, false);

  // Extra rogue fileHashes entry
  const extraHashKey = {
    ...commit,
    fileHashes: { ...commit.fileHashes!, 'evil.ts': '0'.repeat(64) },
  };
  assert.equal(verifyCommitIntegrity(extraHashKey).valid, false);
});

test('rollbackToCommit restores exact file contents from verified commit and blocks tampered commits', () => {
  const fileV1 = [{ name: 'app.js', path: 'app.js', language: 'javascript' as const, content: 'const v = 1;', lastModified: 100 }];
  const fileV2 = [{ name: 'app.js', path: 'app.js', language: 'javascript' as const, content: 'const v = 2;', lastModified: 200 }];

  const baseProject: Project = {
    id: 'proj_1',
    name: 'Rollback Test',
    description: '',
    currentBranch: 'main',
    branches: { main: { name: 'main', currentCommitId: '' } },
    commits: [],
    files: fileV1,
    createdAt: 100,
    updatedAt: 100,
  };

  const { project: withV1, commit: c1 } = createCommit(baseProject, 'v1', 'Mercy');
  const { project: withV2 } = createCommit({ ...withV1, files: fileV2 }, 'v2', 'Mercy');

  const restoredProject = rollbackToCommit(withV2, c1.id);
  assert.equal(restoredProject.files[0].content, 'const v = 1;');

  // Corrupt target commit -> rollback must fail closed
  const tamperedProj: Project = {
    ...withV2,
    commits: withV2.commits.map((c) =>
      c.id === c1.id ? { ...c, provenance: { ...c.provenance!, claimStatus: 'tested' as const } } : c
    ),
  };
  assert.throws(() => rollbackToCommit(tamperedProj, c1.id), /integrity verification/i);
});

test('computeLineDiff identifies additions and removals', () => {
  const oldText = 'line1\nline2';
  const newText = 'line1\nline2-modified\nline3';

  const diff = computeLineDiff(oldText, newText);
  assert.equal(diff.some(d => d.type === 'unchanged' && d.content === 'line1'), true);
  assert.equal(diff.some(d => d.type === 'added'), true);
});
