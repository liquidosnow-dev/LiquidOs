import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommit, rollbackToCommit, computeLineDiff, generateCommitHash } from './versionControl';
import { Project } from '../types';

test('generateCommitHash produces consistent hexadecimal string', () => {
  const hash1 = generateCommitHash('initial commit', 'Mercy', [], null);
  assert.equal(typeof hash1, 'string');
  assert.equal(hash1.length >= 8, true);
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
});

test('rollbackToCommit restores exact file contents from prior commit', () => {
  const fileV1 = [{ name: 'app.js', path: 'app.js', language: 'javascript' as const, content: 'const v = 1;', lastModified: 100 }];
  const fileV2 = [{ name: 'app.js', path: 'app.js', language: 'javascript' as const, content: 'const v = 2;', lastModified: 200 }];

  const initialProject: Project = {
    id: 'proj_1',
    name: 'Rollback Test',
    description: '',
    currentBranch: 'main',
    branches: { main: { name: 'main', currentCommitId: 'c_1' } },
    commits: [
      { id: 'c_1', message: 'v1', author: 'Mercy', timestamp: 100, files: fileV1, hash: 'h1', parentHash: null },
    ],
    files: fileV2,
    createdAt: 100,
    updatedAt: 200,
  };

  const restoredProject = rollbackToCommit(initialProject, 'c_1');
  assert.equal(restoredProject.files[0].content, 'const v = 1;');
});

test('computeLineDiff identifies additions and removals', () => {
  const oldText = 'line1\nline2';
  const newText = 'line1\nline2-modified\nline3';

  const diff = computeLineDiff(oldText, newText);
  assert.equal(diff.some(d => d.type === 'unchanged' && d.content === 'line1'), true);
  assert.equal(diff.some(d => d.type === 'added'), true);
});
