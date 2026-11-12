import { Commit, Project, ProjectFile } from '../types';

/**
 * Creates a unique commit hash from message, author, files, and parent hash
 */
export function generateCommitHash(message: string, author: string, files: ProjectFile[], parentHash: string | null): string {
  const contentToHash = `${parentHash || 'genesis'}:${message}:${author}:${files.map(f => `${f.path}:${f.content.length}`).join(',')}:${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < contentToHash.length; i++) {
    const char = contentToHash.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Creates a new commit in the current branch
 */
export function createCommit(project: Project, message: string, author: string = 'Mercy (User)'): { project: Project; commit: Commit } {
  const currentBranch = project.branches[project.currentBranch];
  const lastCommitId = currentBranch ? currentBranch.currentCommitId : null;
  const lastCommit = project.commits.find(c => c.id === lastCommitId) || null;

  const newHash = generateCommitHash(message, author, project.files, lastCommit ? lastCommit.hash : null);
  const commitId = 'c_' + newHash;

  const commit: Commit = {
    id: commitId,
    message,
    author,
    timestamp: Date.now(),
    files: JSON.parse(JSON.stringify(project.files)),
    hash: newHash,
    parentHash: lastCommit ? lastCommit.hash : null,
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
    updatedAt: Date.now(),
  };

  return { project: updatedProject, commit };
}

/**
 * Rolls back the project files to a previous commit state
 */
export function rollbackToCommit(project: Project, commitId: string): Project {
  const targetCommit = project.commits.find(c => c.id === commitId);
  if (!targetCommit) {
    throw new Error(`Commit with ID "${commitId}" not found`);
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
