import { Commit, CommitProvenance, Project, ProjectFile } from '../types';
import { sha256Hex } from './securityCrypto';
import { canonicalize } from './contractRegistry';

export function normalizeCommitProvenance(provenance?: CommitProvenance): {
  source: CommitProvenance['source'];
  claimStatus: CommitProvenance['claimStatus'];
  authorizationPermitId: string | null;
  epoch: number | null;
  fencingVersion: number | null;
} {
  return {
    source: provenance?.source ?? 'workspace_edit',
    claimStatus: provenance?.claimStatus ?? 'untested',
    authorizationPermitId: provenance?.authorizationPermitId ?? null,
    epoch: typeof provenance?.epoch === 'number' ? provenance.epoch : null,
    fencingVersion: typeof provenance?.fencingVersion === 'number' ? provenance.fencingVersion : null,
  };
}

export function computeCommitFileDigests(files: ProjectFile[]): {
  fileHashes: Record<string, string>;
  treeDigest: string;
} {
  const fileHashes: Record<string, string> = {};
  const sorted = files.slice().sort((a, b) => a.path.localeCompare(b.path));
  for (const f of sorted) {
    fileHashes[f.path] = sha256Hex(f.content);
  }
  const treeDigest = sha256Hex(canonicalize(fileHashes));
  return { fileHashes, treeDigest };
}

/**
 * Creates a cryptographic SHA-256 commit hash from message, author, JCS-canonicalized file digests,
 * parent hash, timestamp, and provenance metadata.
 */
export function generateCommitHash(
  message: string,
  author: string,
  files: ProjectFile[],
  parentHash: string | null,
  timestamp = Date.now(),
  provenance?: CommitProvenance
): string {
  const { fileHashes, treeDigest } = computeCommitFileDigests(files);
  const normalizedProvenance = normalizeCommitProvenance(provenance);
  const canonicalPayload = canonicalize({
    parentHash: parentHash || null,
    message,
    author,
    timestamp,
    treeDigest,
    fileHashes,
    provenance: normalizedProvenance,
  });
  return sha256Hex(canonicalPayload);
}

/**
 * Creates a new commit in the current branch with JCS-canonicalized SHA-256 file hashes and bound provenance.
 */
export function createCommit(
  project: Project,
  message: string,
  author: string = 'Mercy (User)',
  provenance?: CommitProvenance
): { project: Project; commit: Commit } {
  const currentBranch = project.branches[project.currentBranch];
  const lastCommitId = currentBranch ? currentBranch.currentCommitId : null;
  const lastCommit = project.commits.find(c => c.id === lastCommitId) || null;
  const timestamp = Date.now();
  const parentHash = lastCommit ? lastCommit.hash : null;

  const commitProvenance: CommitProvenance = provenance
    ? { ...provenance }
    : {
        source: 'workspace_edit',
        claimStatus: 'untested',
      };

  const { fileHashes, treeDigest } = computeCommitFileDigests(project.files);
  const newHash = generateCommitHash(
    message,
    author,
    project.files,
    parentHash,
    timestamp,
    commitProvenance
  );
  const commitId = 'c_' + newHash.slice(0, 16);

  const commit: Commit = {
    id: commitId,
    message,
    author,
    timestamp,
    files: JSON.parse(JSON.stringify(project.files)),
    hash: newHash,
    parentHash,
    fileHashes,
    treeDigest,
    provenance: commitProvenance,
  };

  const updatedProject: Project = {
    ...project,
    commits: [commit, ...project.commits],
    branches: {
      ...project.branches,
      [project.currentBranch]: {
        name: project.currentBranch,
        currentCommitId: commitId,
      },
    },
    updatedAt: timestamp,
  };

  return { project: updatedProject, commit };
}

export function verifyCommitIntegrity(commit: Commit): { valid: boolean; reason?: string } {
  if (!commit || typeof commit !== 'object' || !Array.isArray(commit.files)) {
    return { valid: false, reason: 'Malformed commit structure.' };
  }
  if (typeof commit.hash !== 'string' || !/^[a-f0-9]{64}$/.test(commit.hash)) {
    return { valid: false, reason: 'Commit hash must be a 64-character lowercase SHA-256 hex digest.' };
  }
  if (!commit.provenance || !commit.provenance.source || !commit.provenance.claimStatus) {
    return { valid: false, reason: 'Commit provenance metadata missing.' };
  }

  const seenPaths = new Set<string>();
  for (const file of commit.files) {
    if (!file || typeof file.path !== 'string') {
      return { valid: false, reason: 'Malformed file entry in commit.' };
    }
    if (seenPaths.has(file.path)) {
      return { valid: false, reason: `Duplicate path in commit files: ${file.path}.` };
    }
    seenPaths.add(file.path);
  }

  const { fileHashes, treeDigest } = computeCommitFileDigests(commit.files);
  if (!commit.treeDigest || commit.treeDigest !== treeDigest) {
    return { valid: false, reason: 'Commit treeDigest does not match snapshot file hashes.' };
  }

  if (!commit.fileHashes || typeof commit.fileHashes !== 'object') {
    return { valid: false, reason: 'Commit fileHashes map missing.' };
  }

  const computedKeys = Object.keys(fileHashes);
  const storedKeys = Object.keys(commit.fileHashes);
  if (computedKeys.length !== storedKeys.length) {
    return { valid: false, reason: 'Commit fileHashes key count mismatch.' };
  }
  for (const path of computedKeys) {
    if (commit.fileHashes[path] !== fileHashes[path]) {
      return { valid: false, reason: `File hash mismatch for ${path}.` };
    }
  }
  for (const storedPath of storedKeys) {
    if (!Object.prototype.hasOwnProperty.call(fileHashes, storedPath)) {
      return { valid: false, reason: `Unexpected extra file hash key: ${storedPath}.` };
    }
  }

  const expectedHash = generateCommitHash(
    commit.message,
    commit.author,
    commit.files,
    commit.parentHash,
    commit.timestamp,
    commit.provenance
  );
  if (commit.hash !== expectedHash) {
    return { valid: false, reason: 'Commit SHA-256 digest mismatch (provenance or header tampered).' };
  }
  return { valid: true };
}

/**
 * Rolls back the project files to a verified previous commit state.
 */
export function rollbackToCommit(project: Project, commitId: string): Project {
  const targetCommit = project.commits.find(c => c.id === commitId);
  if (!targetCommit) {
    throw new Error(`Commit with ID "${commitId}" not found`);
  }

  const integrity = verifyCommitIntegrity(targetCommit);
  if (!integrity.valid) {
    throw new Error(`Rollback blocked: target commit "${commitId}" failed integrity verification (${integrity.reason}).`);
  }

  return {
    ...project,
    files: JSON.parse(JSON.stringify(targetCommit.files)),
    branches: {
      ...project.branches,
      [project.currentBranch]: {
        name: project.currentBranch,
        currentCommitId: commitId,
      },
    },
    updatedAt: Date.now(),
  };
}

/**
 * Computes a simple line-by-line diff between two file strings
 */
export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumberOld?: number;
  lineNumberNew?: number;
}

export function computeLineDiff(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent ? oldContent.split('\n') : [];
  const newLines = newContent ? newContent.split('\n') : [];
  const result: DiffLine[] = [];

  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLine = oldLines[oldIdx];
    const newLine = newLines[newIdx];

    if (oldIdx < oldLines.length && newIdx < newLines.length && oldLine === newLine) {
      result.push({
        type: 'unchanged',
        content: oldLine,
        lineNumberOld: oldIdx + 1,
        lineNumberNew: newIdx + 1,
      });
      oldIdx++;
      newIdx++;
    } else if (newIdx < newLines.length && (oldIdx >= oldLines.length || !oldLines.includes(newLine))) {
      result.push({
        type: 'added',
        content: newLine,
        lineNumberNew: newIdx + 1,
      });
      newIdx++;
    } else if (oldIdx < oldLines.length) {
      result.push({
        type: 'removed',
        content: oldLine,
        lineNumberOld: oldIdx + 1,
      });
      oldIdx++;
    }
  }

  return result;
}
