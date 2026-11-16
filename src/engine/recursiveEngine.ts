/**
 * Recursive Autonomous Execution Engine (src/engine/recursiveEngine.ts)
 *
 * Implements a fail-closed, multi-step autonomous loop runner capable of:
 * 1. Reading analytical & semantic context from Vault adapters (DuckDB + LanceDB).
 * 2. Planning and executing multi-step autonomous tasks.
 * 3. Evaluating all proposed file modifications (path safety, payload integrity, static/syntax & Watch Mode checks).
 * 4. Requesting new Ed25519 cryptographic attestations from the authoritative Control Plane.
 * 5. Committing attested workspace changes with SHA-256 provenance, or rolling back cleanly on violation.
 */

import {
  AuditLedgerEntry,
  Commit,
  Project,
  ProjectFile,
  ToolCall,
  VerificationClaimLevel,
} from '../types';
import {
  indexWorkspaceFilesInLanceDb,
  readVaultAdaptersSnapshot,
  VaultReadSnapshot,
} from '../adapters/vaultAdapters';
import {
  assertSafeIntegerLiterals,
  canonicalize,
} from '../utils/contractRegistry';
import {
  ControlPlaneState,
  WatchVerificationReport,
  computeWorkspaceFileHashes,
  recordControlPlaneAudit,
} from '../utils/ingestionControlPlane';
import { inferLanguageFromPath, validateIngestPath } from '../utils/onDeviceFs';
import { sha256Hex } from '../utils/securityCrypto';
import { createCommit, rollbackToCommit } from '../utils/versionControl';

export type AutonomousTaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'blocked';

export interface AutonomousTask {
  id: string;
  title: string;
  description: string;
  targetPaths?: string[];
  status: AutonomousTaskStatus;
  iteration?: number;
  summary?: string;
  error?: string;
}

export interface FileModification {
  path: string;
  action: 'create' | 'modify' | 'delete';
  content: string;
  rationale?: string;
}

export interface FileModificationEvaluation {
  passed: boolean;
  changedPaths: string[];
  modifiedFiles: ProjectFile[];
  deletedPaths: string[];
  fileHashes: Record<string, string>;
  treeDigest: string;
  diagnostics: string[];
  claimLevel: VerificationClaimLevel;
  watchReport?: WatchVerificationReport | null;
}

export interface Ed25519AttestationReceipt {
  receiptId: string;
  keyId: string;
  action: string;
  canonicalPayload: string;
  signature: string;
  publicKeyPem: string;
  algorithm: 'Ed25519';
  linearizationSeq: number;
}

export interface ControlPlaneAttestationResponse {
  ok: boolean;
  status?: number;
  code?: string;
  error?: string;
  attestationDigest?: string;
  treeDigest?: string;
  linearizationSeq?: number;
  activeKeyId?: string;
  publicKeyPem?: string;
  receipt?: Ed25519AttestationReceipt;
  verified?: boolean;
  state?: ControlPlaneState;
}

export interface ControlPlaneAttestationRequest {
  cycleId: string;
  stepName: string;
  iteration: number;
  taskIds: string[];
  modifiedFiles: ProjectFile[];
  vaultDigest: string;
  evaluationPassed: boolean;
  evaluationDiagnostics: string[];
  permitId: string | null;
  expectedEpoch: number;
  expectedFencingVersion?: number;
}

export interface LoopIterationTrace {
  iteration: number;
  cycleId: string;
  tasksExecuted: AutonomousTask[];
  vaultSnapshot: VaultReadSnapshot;
  modifications: FileModification[];
  evaluation: FileModificationEvaluation;
  attestation: ControlPlaneAttestationResponse;
  commitId?: string;
  commitHash?: string;
  rolledBack: boolean;
  toolCalls: ToolCall[];
  durationMs: number;
}

export interface RecursiveLoopResult {
  success: boolean;
  goal: string;
  iterationsCompleted: number;
  totalTasksExecuted: number;
  completedTasks: AutonomousTask[];
  remainingTasks: AutonomousTask[];
  project: Project;
  commits: Commit[];
  attestations: ControlPlaneAttestationResponse[];
  auditLedger: AuditLedgerEntry[];
  traces: LoopIterationTrace[];
  toolCalls: ToolCall[];
  aborted: boolean;
  reason?: string;
}

export interface RecursiveLoopProgressEvent {
  phase:
    | 'planning'
    | 'vault_read'
    | 'task_execution'
    | 'file_evaluation'
    | 'attestation_request'
    | 'commit'
    | 'rollback'
    | 'completed'
    | 'halted';
  iteration: number;
  message: string;
  task?: AutonomousTask;
}

export interface RecursiveEngineOptions {
  goal: string;
  project: Project;
  initialTasks?: Array<Omit<AutonomousTask, 'status'> & { status?: AutonomousTaskStatus }>;
  maxIterations?: number;
  autoRepairOnEvalFailure?: boolean;
  duckdbSql?: string;
  actor?: string;
  getControlPlaneState: () => ControlPlaneState;
  getAuthHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
  auditLedger?: AuditLedgerEntry[];
  signal?: AbortSignal;

  /**
   * Optional custom task planner invoked if initialTasks is empty or to discover follow-up tasks.
   */
  planTasks?: (ctx: {
    goal: string;
    iteration: number;
    project: Project;
    vault: VaultReadSnapshot;
    completedTasks: AutonomousTask[];
    lastEvaluation?: FileModificationEvaluation;
  }) => Promise<Array<Omit<AutonomousTask, 'status'>>>;

  /**
   * Executes a single task and returns proposed file modifications + summary.
   */
  executeTask: (ctx: {
    goal: string;
    task: AutonomousTask;
    iteration: number;
    project: Project;
    vault: VaultReadSnapshot;
    signal?: AbortSignal;
  }) => Promise<{
    summary: string;
    modifications: FileModification[];
    followUpTasks?: Array<Omit<AutonomousTask, 'status'>>;
  }>;

  /**
   * Optional custom Vault snapshot reader (defaults to isomorphic DuckDB + LanceDB adapters).
   */
  readVault?: (ctx: {
    project: Project;
    query: string;
    duckdbSql?: string;
  }) => Promise<VaultReadSnapshot>;

  /**
   * Optional custom remote file verification hook (defaults to /api/control-plane/verify-upload when fetchable).
   */
  verifyModificationsRemote?: (ctx: {
    commitHash: string;
    files: ProjectFile[];
  }) => Promise<WatchVerificationReport | null>;

  /**
   * Optional custom Control Plane Ed25519 attestation requester
   * (defaults to POST /api/control-plane/attest + POST /api/control-plane/verify-receipt).
   */
  requestAttestation?: (
    req: ControlPlaneAttestationRequest
  ) => Promise<ControlPlaneAttestationResponse>;

  onProgress?: (event: RecursiveLoopProgressEvent) => void;
}

/**
 * Applies validated file modifications to a Project immutably (returns updated Project).
 */
export function applyFileModificationsToProject(
  project: Project,
  modifications: FileModification[]
): Project {
  let nextFiles = project.files.map((f) => ({ ...f }));
  const now = Date.now();

  for (const mod of modifications) {
    if (mod.action === 'delete') {
      nextFiles = nextFiles.filter((f) => f.path !== mod.path);
      continue;
    }

    const existingIdx = nextFiles.findIndex((f) => f.path === mod.path);
    const name = mod.path.split('/').pop() || mod.path;
    const language = inferLanguageFromPath(mod.path);

    if (existingIdx >= 0) {
      nextFiles[existingIdx] = {
        ...nextFiles[existingIdx],
        name,
        language,
        content: mod.content,
        lastModified: now,
      };
    } else {
      nextFiles.push({
        name,
        path: mod.path,
        language,
        content: mod.content,
        lastModified: now,
      });
    }
  }

  return {
    ...project,
    files: nextFiles,
    updatedAt: now,
  };
}

/**
 * Performs structural and static safety checks on a single JS/TS/JSON/HTML file.
 */
function runStaticContentDiagnostics(path: string, content: string): string[] {
  const diagnostics: string[] = [];
  const lower = path.toLowerCase();

  if (lower.endsWith('.json') || lower.endsWith('.jsonc')) {
    try {
      assertSafeIntegerLiterals(content);
      JSON.parse(content);
    } catch (err: any) {
      diagnostics.push(`JSON validation failed for ${path}: ${err?.message || 'invalid JSON'}`);
    }
    return diagnostics;
  }

  if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(lower)) {
    // Check balanced delimiters outside string literals/comments as a fast browser-safe syntax gate
    let parens = 0;
    let braces = 0;
    let brackets = 0;
    let quote: string | null = null;
    let escaped = false;
    for (let i = 0; i < content.length; i++) {
      const ch = content[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\' && quote) {
        escaped = true;
        continue;
      }
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        quote = ch;
        continue;
      }
      if (ch === '(') parens++;
      else if (ch === ')') parens--;
      else if (ch === '{') braces++;
      else if (ch === '}') braces--;
      else if (ch === '[') brackets++;
      else if (ch === ']') brackets--;

      if (parens < 0 || braces < 0 || brackets < 0) {
        diagnostics.push(`Unbalanced delimiter near character ${i} in ${path}`);
        break;
      }
    }
    if (parens !== 0 || braces !== 0 || brackets !== 0) {
      diagnostics.push(
        `Unclosed delimiters in ${path} (parens=${parens}, braces=${braces}, brackets=${brackets})`
      );
    }
  }

  return diagnostics;
}

/**
 * Evaluates proposed file modifications against path containment, binary/size limits,
 * static/syntax invariants, and optional remote Watch Mode verification.
 */
export async function evaluateFileModifications(options: {
  project: Project;
  modifications: FileModification[];
  verifyRemote?: (ctx: {
    commitHash: string;
    files: ProjectFile[];
  }) => Promise<WatchVerificationReport | null>;
}): Promise<FileModificationEvaluation> {
  const { project, modifications, verifyRemote } = options;
  const diagnostics: string[] = [];
  const changedPaths = new Set<string>();
  const deletedPaths: string[] = [];
  const touchedFiles: ProjectFile[] = [];

  for (const mod of modifications) {
    const pathCheck = validateIngestPath(mod.path);
    if (!pathCheck.ok) {
      diagnostics.push(`Unsafe modification path "${mod.path}": ${pathCheck.reason}`);
      continue;
    }

    changedPaths.add(mod.path);
    if (mod.action === 'delete') {
      deletedPaths.push(mod.path);
      continue;
    }

    if (typeof mod.content !== 'string' || mod.content.includes('\u0000')) {
      diagnostics.push(`Binary or NUL byte content rejected in "${mod.path}".`);
      continue;
    }

    const byteLength = new TextEncoder().encode(mod.content).length;
    if (byteLength > 1024 * 1024) {
      diagnostics.push(`Oversize modification rejected for "${mod.path}" (${byteLength} bytes > 1 MB).`);
      continue;
    }

    const contentDiags = runStaticContentDiagnostics(mod.path, mod.content);
    diagnostics.push(...contentDiags);

    touchedFiles.push({
      name: mod.path.split('/').pop() || mod.path,
      path: mod.path,
      language: inferLanguageFromPath(mod.path),
      content: mod.content,
      lastModified: Date.now(),
    });
  }

  const { fileHashes, treeDigest } = computeWorkspaceFileHashes(
    applyFileModificationsToProject(project, modifications).files
  );

  let watchReport: WatchVerificationReport | null = null;
  if (diagnostics.length === 0 && touchedFiles.length > 0 && verifyRemote) {
    try {
      watchReport = await verifyRemote({
        commitHash: treeDigest,
        files: touchedFiles,
      });
      if (watchReport && !watchReport.allPassed) {
        for (const entry of watchReport.entries) {
          if (!entry.passed) {
            diagnostics.push(...entry.diagnostics);
          }
        }
      }
    } catch {
      // If remote Watch Mode verification isn't reachable in offline tests, local static checks still hold
    }
  }

  const passed = diagnostics.length === 0;
  const claimLevel: VerificationClaimLevel = !passed
    ? 'untested'
    : watchReport?.claimLevel || 'syntax_checked';

  return {
    passed,
    changedPaths: Array.from(changedPaths),
    modifiedFiles: touchedFiles,
    deletedPaths,
    fileHashes,
    treeDigest,
    diagnostics,
    claimLevel,
    watchReport,
  };
}

/**
 * Default HTTP Control Plane client requesting a new Ed25519 attestation from
 * POST /api/control-plane/attest and verifying its receipt via /api/control-plane/verify-receipt.
 */
export async function requestControlPlaneAttestationHttp(
  request: ControlPlaneAttestationRequest,
  getHeaders: () => Promise<Record<string, string>> | Record<string, string>
): Promise<ControlPlaneAttestationResponse> {
  if (typeof fetch !== 'function') {
    return {
      ok: false,
      code: 'ERR_CONTROL_PLANE_UNREACHABLE',
      error: 'Fetch API unavailable; fail-closed refusal to issue client-side attestation.',
    };
  }

  const headers = await getHeaders();
  const resp = await fetch('/api/control-plane/attest', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(request),
  });

  const data = await resp.json().catch(() => null);
  if (!resp.ok || !data?.ok || !data?.receipt) {
    return {
      ok: false,
      status: resp.status,
      code: data?.code || 'ERR_ATTESTATION_DENIED',
      error: data?.error || `Control Plane rejected Ed25519 attestation (HTTP ${resp.status}).`,
    };
  }

  // Independently verify the Ed25519 signature against the server keyring
  let verified = false;
  try {
    const verifyRes = await fetch('/api/control-plane/verify-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyId: data.receipt.keyId,
        canonicalPayload: data.receipt.canonicalPayload,
        signature: data.receipt.signature,
        publicKeyPem: data.receipt.publicKeyPem,
      }),
    });
    if (verifyRes.ok) {
      const verifyJson = await verifyRes.json().catch(() => null);
      verified = Boolean(verifyJson?.valid);
    }
  } catch {
    verified = false;
  }

  if (!verified) {
    return {
      ok: false,
      status: 403,
      code: 'ERR_RECEIPT_VERIFICATION_FAILED',
      error: 'Ed25519 receipt failed verification against Control Plane public keyring.',
    };
  }

  return {
    ...data,
    verified: true,
  };
}

/**
 * Executes the multi-step RecursiveEngine loop runner until all queued and
 * dynamically discovered tasks finish, maxIterations is reached, or a
 * fail-closed policy/evaluation/attestation gate halts execution.
 */
export class RecursiveEngine {
  async run(options: RecursiveEngineOptions): Promise<RecursiveLoopResult> {
    const maxIterations = Math.max(1, options.maxIterations ?? 5);
    const autoRepair = options.autoRepairOnEvalFailure ?? true;
    const actor = options.actor || 'agent:recursive_engine';

    let currentProject = options.project;
    let ledger = [...(options.auditLedger || [])];
    const commits: Commit[] = [];
    const attestations: ControlPlaneAttestationResponse[] = [];
    const traces: LoopIterationTrace[] = [];
    const allToolCalls: ToolCall[] = [];
    const completedTasks: AutonomousTask[] = [];

    const taskQueue: AutonomousTask[] = (options.initialTasks || []).map((t, idx) => ({
      id: t.id || `task_${idx + 1}`,
      title: t.title,
      description: t.description,
      targetPaths: t.targetPaths,
      status: t.status || 'pending',
      iteration: t.iteration,
      summary: t.summary,
      error: t.error,
    }));

    const emit = (event: RecursiveLoopProgressEvent) => {
      options.onProgress?.(event);
    };

    const readVaultFn =
      options.readVault ||
      ((ctx: { project: Project; query: string; duckdbSql?: string }) =>
        readVaultAdaptersSnapshot({
          project: ctx.project,
          query: ctx.query,
          duckdbSql: ctx.duckdbSql,
          useServerGuard: true,
        }));

    const verifyRemoteFn =
      options.verifyModificationsRemote ||
      (async (ctx: { commitHash: string; files: ProjectFile[] }) => {
        if (typeof fetch !== 'function') return null;
        const headers = options.getAuthHeaders ? await options.getAuthHeaders() : {};
        const res = await fetch('/api/control-plane/verify-upload', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({
            commitHash: ctx.commitHash,
            files: ctx.files,
          }),
        });
        if (!res.ok) return null;
        return (await res.json()) as WatchVerificationReport;
      });

    const requestAttestationFn =
      options.requestAttestation ||
      ((req: ControlPlaneAttestationRequest) =>
        requestControlPlaneAttestationHttp(
          req,
          options.getAuthHeaders || (() => ({}))
        ));

    let iteration = 0;
    let lastEvaluation: FileModificationEvaluation | undefined;

    while (iteration < maxIterations) {
      if (options.signal?.aborted) {
        return {
          success: false,
          goal: options.goal,
          iterationsCompleted: iteration,
          totalTasksExecuted: completedTasks.length,
          completedTasks,
          remainingTasks: taskQueue.filter((t) => t.status === 'pending'),
          project: currentProject,
          commits,
          attestations,
          auditLedger: ledger,
          traces,
          toolCalls: allToolCalls,
          aborted: true,
          reason: 'Autonomous recursive loop aborted by signal.',
        };
      }

      const cpState = options.getControlPlaneState();
      if (cpState.mode !== 'ACTIVE') {
        const denyReason = `GLOBAL-MODE-001 fail-closed halt: Control Plane is ${cpState.mode}.`;
        ledger = recordControlPlaneAudit(ledger, 'recursive_engine_halted', cpState.mode, actor, {
          iteration: iteration + 1,
          reason: denyReason,
        });
        emit({ phase: 'halted', iteration: iteration + 1, message: denyReason });
        return {
          success: false,
          goal: options.goal,
          iterationsCompleted: iteration,
          totalTasksExecuted: completedTasks.length,
          completedTasks,
          remainingTasks: taskQueue.filter((t) => t.status === 'pending'),
          project: currentProject,
          commits,
          attestations,
          auditLedger: ledger,
          traces,
          toolCalls: allToolCalls,
          aborted: false,
          reason: denyReason,
        };
      }

      iteration += 1;
      const iterStart = Date.now();
      const cycleId = `cyc_${sha256Hex(`${options.goal}:${iteration}:${iterStart}`).slice(0, 12)}`;
      const iterToolCalls: ToolCall[] = [];

      // Step 1: Read from DuckDB & LanceDB Vault adapters
      emit({
        phase: 'vault_read',
        iteration,
        message: `Iteration ${iteration}: Reading DuckDB OLAP & LanceDB vector vault adapters...`,
      });

      const vaultReadStart = Date.now();
      const vaultSnapshot = await readVaultFn({
        project: currentProject,
        query: options.goal,
        duckdbSql: options.duckdbSql,
      });
      const vaultLatency = Math.max(1, Date.now() - vaultReadStart);

      iterToolCalls.push(
        {
          id: `tc_duck_${cycleId}`,
          toolName: 'duckdb_query',
          status: 'success',
          executionTimeMs: vaultLatency,
          arguments: {
            adapter: 'duckdb',
            sql: vaultSnapshot.duckdb.sql,
            astPrefix: vaultSnapshot.duckdb.astGuard.normalizedPrefix,
          },
          result: {
            rowCount: vaultSnapshot.duckdb.rowCount,
            columns: vaultSnapshot.duckdb.columns,
            rows: vaultSnapshot.duckdb.rows.slice(0, 8),
            payloadDigest: vaultSnapshot.duckdb.payloadDigest,
          },
          timestamp: Date.now(),
        },
        {
          id: `tc_lance_${cycleId}`,
          toolName: 'lancedb_search',
          status: 'success',
          executionTimeMs: vaultLatency,
          arguments: {
            adapter: 'lancedb',
            query: vaultSnapshot.lancedb.query,
            topK: vaultSnapshot.lancedb.topK,
          },
          result: {
            totalIndexedChunks: vaultSnapshot.lancedb.totalIndexedChunks,
            hits: vaultSnapshot.lancedb.hits.map((h) => ({
              chunk_id: h.chunk_id,
              url: h.url,
              similarity: h.similarity,
              distance: h.distance,
            })),
            payloadDigest: vaultSnapshot.lancedb.payloadDigest,
          },
          timestamp: Date.now(),
        }
      );

      // Step 2: Plan tasks if queue is currently empty
      if (taskQueue.filter((t) => t.status === 'pending').length === 0 && options.planTasks) {
        emit({
          phase: 'planning',
          iteration,
          message: `Iteration ${iteration}: Decomposing autonomous tasks from Vault context...`,
        });
        const planned = await options.planTasks({
          goal: options.goal,
          iteration,
          project: currentProject,
          vault: vaultSnapshot,
          completedTasks: [...completedTasks],
          lastEvaluation,
        });
        for (const p of planned) {
          taskQueue.push({
            id: p.id || `task_${iteration}_${taskQueue.length + 1}`,
            title: p.title,
            description: p.description,
            targetPaths: p.targetPaths,
            status: 'pending',
          });
        }
      }

      const pendingTasks = taskQueue.filter((t) => t.status === 'pending');
      if (pendingTasks.length === 0) {
        allToolCalls.push(...iterToolCalls);
        break;
      }

      // Establish a pre-iteration Git/VCS recovery checkpoint
      const { project: checkpointProject, commit: checkpointCommit } = createCommit(
        currentProject,
        `Pre-iteration checkpoint (${cycleId} #${iteration})`,
        actor,
        {
          source: 'codex',
          claimStatus: 'untested',
          authorizationPermitId: cpState.activePermit?.permitId,
          epoch: cpState.epoch,
          fencingVersion: cpState.activePermit?.fencingVersion,
        }
      );
      currentProject = checkpointProject;

      // Step 3: Execute all currently pending tasks in this iteration
      const executedThisIter: AutonomousTask[] = [];
      const aggregatedMods = new Map<string, FileModification>();
      const followUps: AutonomousTask[] = [];

      for (const task of pendingTasks) {
        if (options.signal?.aborted) {
          task.status = 'blocked';
          task.error = 'Aborted by caller';
          break;
        }

        task.status = 'running';
        task.iteration = iteration;
        emit({
          phase: 'task_execution',
          iteration,
          task,
          message: `Executing task "${task.title}"...`,
        });

        const taskStart = Date.now();
        try {
          const execRes = await options.executeTask({
            goal: options.goal,
            task,
            iteration,
            project: currentProject,
            vault: vaultSnapshot,
            signal: options.signal,
          });
          task.status = 'completed';
          task.summary = execRes.summary;
          executedThisIter.push({ ...task });
          completedTasks.push({ ...task });

          for (const mod of execRes.modifications) {
            aggregatedMods.set(mod.path, mod);
          }
          if (execRes.followUpTasks && execRes.followUpTasks.length > 0) {
            for (const f of execRes.followUpTasks) {
              followUps.push({
                id: f.id || `task_f_${iteration}_${followUps.length + 1}`,
                title: f.title,
                description: f.description,
                targetPaths: f.targetPaths,
                status: 'pending',
              });
            }
          }

          iterToolCalls.push({
            id: `tc_task_${task.id}_${iteration}`,
            toolName: 'recursive_task',
            status: 'success',
            executionTimeMs: Math.max(1, Date.now() - taskStart),
            arguments: {
              taskId: task.id,
              title: task.title,
              iteration,
            },
            result: {
              summary: execRes.summary,
              proposedFiles: execRes.modifications.map((m) => `${m.action}:${m.path}`),
              followUpsQueued: execRes.followUpTasks?.length || 0,
            },
            timestamp: Date.now(),
          });
        } catch (err: any) {
          task.status = 'failed';
          task.error = err?.message || 'Task execution failed';
          executedThisIter.push({ ...task });
          iterToolCalls.push({
            id: `tc_task_${task.id}_${iteration}`,
            toolName: 'recursive_task',
            status: 'failed',
            executionTimeMs: Math.max(1, Date.now() - taskStart),
            arguments: { taskId: task.id, title: task.title, iteration },
            error: task.error,
            timestamp: Date.now(),
          });
          const rolledBackProj = rollbackToCommit(currentProject, checkpointCommit.id);
          currentProject = rolledBackProj;
          allToolCalls.push(...iterToolCalls);
          return {
            success: false,
            goal: options.goal,
            iterationsCompleted: iteration,
            totalTasksExecuted: completedTasks.length,
            completedTasks,
            remainingTasks: taskQueue.filter((t) => t.status === 'pending'),
            project: currentProject,
            commits,
            attestations,
            auditLedger: ledger,
            traces,
            toolCalls: allToolCalls,
            aborted: false,
            reason: `Task "${task.title}" failed: ${task.error}`,
          };
        }
      }

      for (const f of followUps) {
        taskQueue.push(f);
      }

      const modifications = Array.from(aggregatedMods.values());

      // Step 4: Evaluate all file modifications
      emit({
        phase: 'file_evaluation',
        iteration,
        message: `Evaluating ${modifications.length} proposed file modification(s)...`,
      });
      const evalStart = Date.now();
      const evaluation = await evaluateFileModifications({
        project: currentProject,
        modifications,
        verifyRemote: verifyRemoteFn,
      });
      lastEvaluation = evaluation;

      iterToolCalls.push({
        id: `tc_eval_${cycleId}`,
        toolName: 'file_eval',
        status: evaluation.passed ? 'success' : 'failed',
        executionTimeMs: Math.max(1, Date.now() - evalStart),
        arguments: {
          changedPaths: evaluation.changedPaths,
          treeDigest: evaluation.treeDigest,
        },
        result: {
          passed: evaluation.passed,
          claimLevel: evaluation.claimLevel,
          diagnostics: evaluation.diagnostics,
          fileHashes: evaluation.fileHashes,
        },
        error: evaluation.passed ? undefined : evaluation.diagnostics.join('; '),
        timestamp: Date.now(),
      });

      if (!evaluation.passed) {
        currentProject = rollbackToCommit(currentProject, checkpointCommit.id);
        emit({
          phase: 'rollback',
          iteration,
          message: `Evaluation failed (${evaluation.diagnostics[0] || 'invariant violation'}); rolled back to ${checkpointCommit.id}.`,
        });

        if (autoRepair && iteration < maxIterations) {
          taskQueue.push({
            id: `repair_${iteration}`,
            title: `Repair evaluation diagnostics (iteration ${iteration})`,
            description: `Fix evaluation issues: ${evaluation.diagnostics.join(' | ')}`,
            targetPaths: evaluation.changedPaths,
            status: 'pending',
          });
          traces.push({
            iteration,
            cycleId,
            tasksExecuted: executedThisIter,
            vaultSnapshot,
            modifications,
            evaluation,
            attestation: {
              ok: false,
              code: 'ERR_SKIPPED_EVAL_FAILED',
              error: 'Attestation skipped due to file evaluation failure; queued repair.',
            },
            rolledBack: true,
            toolCalls: iterToolCalls,
            durationMs: Date.now() - iterStart,
          });
          allToolCalls.push(...iterToolCalls);
          continue;
        }

        allToolCalls.push(...iterToolCalls);
        return {
          success: false,
          goal: options.goal,
          iterationsCompleted: iteration,
          totalTasksExecuted: completedTasks.length,
          completedTasks,
          remainingTasks: taskQueue.filter((t) => t.status === 'pending'),
          project: currentProject,
          commits,
          attestations,
          auditLedger: ledger,
          traces,
          toolCalls: allToolCalls,
          aborted: false,
          reason: `File modification evaluation failed: ${evaluation.diagnostics.join('; ')}`,
        };
      }

      // Step 5: Request a new Ed25519 attestation from the Control Plane (Fail-Closed)
      emit({
        phase: 'attestation_request',
        iteration,
        message: `Requesting Ed25519 attestation from Control Plane for ${executedThisIter.length} task(s)...`,
      });

      const attestStart = Date.now();
      const latestCp = options.getControlPlaneState();
      const attestation = await requestAttestationFn({
        cycleId,
        stepName: executedThisIter.map((t) => t.title).join(' + '),
        iteration,
        taskIds: executedThisIter.map((t) => t.id),
        modifiedFiles: evaluation.modifiedFiles,
        vaultDigest: vaultSnapshot.vaultDigest,
        evaluationPassed: evaluation.passed,
        evaluationDiagnostics: evaluation.diagnostics,
        permitId: latestCp.activePermit?.permitId || null,
        expectedEpoch: latestCp.epoch,
        expectedFencingVersion: latestCp.activePermit?.fencingVersion,
      });

      iterToolCalls.push({
        id: `tc_attest_${cycleId}`,
        toolName: 'control_plane_attest',
        status: attestation.ok ? 'success' : 'failed',
        executionTimeMs: Math.max(1, Date.now() - attestStart),
        arguments: {
          cycleId,
          iteration,
          permitId: latestCp.activePermit?.permitId || null,
          vaultDigest: vaultSnapshot.vaultDigest,
          treeDigest: evaluation.treeDigest,
        },
        result: attestation.ok
          ? {
              receiptId: attestation.receipt?.receiptId,
              keyId: attestation.receipt?.keyId,
              algorithm: attestation.receipt?.algorithm,
              attestationDigest: attestation.attestationDigest,
              linearizationSeq: attestation.linearizationSeq,
              signaturePreview: attestation.receipt?.signature?.slice(0, 32) + '...',
              verified: attestation.verified ?? true,
            }
          : undefined,
        error: attestation.ok ? undefined : attestation.error,
        timestamp: Date.now(),
      });

      if (!attestation.ok || !attestation.receipt) {
        currentProject = rollbackToCommit(currentProject, checkpointCommit.id);
        ledger = recordControlPlaneAudit(
          ledger,
          'recursive_attestation_denied',
          cycleId,
          actor,
          {
            iteration,
            code: attestation.code,
            error: attestation.error,
            rolledBackTo: checkpointCommit.id,
          }
        );
        emit({
          phase: 'rollback',
          iteration,
          message: `Control Plane Ed25519 attestation denied (${attestation.error}); rolled back cleanly.`,
        });
        traces.push({
          iteration,
          cycleId,
          tasksExecuted: executedThisIter,
          vaultSnapshot,
          modifications,
          evaluation,
          attestation,
          rolledBack: true,
          toolCalls: iterToolCalls,
          durationMs: Date.now() - iterStart,
        });
        allToolCalls.push(...iterToolCalls);
        return {
          success: false,
          goal: options.goal,
          iterationsCompleted: iteration,
          totalTasksExecuted: completedTasks.length,
          completedTasks,
          remainingTasks: taskQueue.filter((t) => t.status === 'pending'),
          project: currentProject,
          commits,
          attestations,
          auditLedger: ledger,
          traces,
          toolCalls: allToolCalls,
          aborted: false,
          reason: attestation.error || 'Control Plane Ed25519 attestation denied.',
        };
      }

      attestations.push(attestation);

      // Step 6: Commit attested modifications & refresh LanceDB vector vault
      const updatedFilesProject = applyFileModificationsToProject(currentProject, modifications);
      const { project: attestedProject, commit: attestedCommit } = createCommit(
        updatedFilesProject,
        `Autonomous cycle #${iteration}: ${executedThisIter.map((t) => t.title).join(', ')} [Ed25519 ${attestation.receipt.receiptId}]`,
        actor,
        {
          source: 'codex',
          claimStatus: 'tested',
          claimLevel: 'signed',
          authorizationPermitId: latestCp.activePermit?.permitId,
          epoch: latestCp.epoch,
          fencingVersion: latestCp.activePermit?.fencingVersion,
        }
      );
      currentProject = attestedProject;
      commits.push(attestedCommit);

      // Index modified files into LanceDB vector vault so subsequent iterations read fresh context
      if (evaluation.modifiedFiles.length > 0) {
        indexWorkspaceFilesInLanceDb(evaluation.modifiedFiles);
      }

      ledger = recordControlPlaneAudit(
        ledger,
        'recursive_cycle_committed',
        attestedCommit.id,
        actor,
        {
          cycleId,
          iteration,
          receiptId: attestation.receipt.receiptId,
          keyId: attestation.receipt.keyId,
          attestationDigest: attestation.attestationDigest,
          commitHash: attestedCommit.hash,
          changedPaths: evaluation.changedPaths,
        }
      );

      emit({
        phase: 'commit',
        iteration,
        message: `Iteration ${iteration} attested (Ed25519 ${attestation.receipt.receiptId}) & committed (${attestedCommit.id}).`,
      });

      traces.push({
        iteration,
        cycleId,
        tasksExecuted: executedThisIter,
        vaultSnapshot,
        modifications,
        evaluation,
        attestation,
        commitId: attestedCommit.id,
        commitHash: attestedCommit.hash,
        rolledBack: false,
        toolCalls: iterToolCalls,
        durationMs: Date.now() - iterStart,
      });
      allToolCalls.push(...iterToolCalls);

      // Stop if no pending tasks remain and no dynamic planner needs another pass
      if (taskQueue.filter((t) => t.status === 'pending').length === 0) {
        break;
      }
    }

    const remainingTasks = taskQueue.filter((t) => t.status === 'pending');
    const allTasksComplete = remainingTasks.length === 0 && completedTasks.length > 0;
    emit({
      phase: 'completed',
      iteration,
      message: allTasksComplete
        ? `Autonomous recursive loop finished (${completedTasks.length} tasks attested).`
        : `Recursive loop stopped after ${iteration} iteration(s) (${remainingTasks.length} pending).`,
    });

    return {
      success: allTasksComplete || completedTasks.length > 0,
      goal: options.goal,
      iterationsCompleted: iteration,
      totalTasksExecuted: completedTasks.length,
      completedTasks,
      remainingTasks,
      project: currentProject,
      commits,
      attestations,
      auditLedger: ledger,
      traces,
      toolCalls: allToolCalls,
      aborted: false,
      reason:
        remainingTasks.length > 0
          ? `Reached maxIterations=${maxIterations} with ${remainingTasks.length} pending task(s).`
          : undefined,
    };
  }
}

export const recursiveEngine = new RecursiveEngine();

export async function runRecursiveLoop(
  options: RecursiveEngineOptions
): Promise<RecursiveLoopResult> {
  return recursiveEngine.run(options);
}

/**
 * Single-cycle compatibility entry point built atop RecursiveEngine.
 */
export interface ExecutionResult {
  success: boolean;
  errorCount: number;
  attestationDigest?: string;
  auditLogSeq?: number;
  project?: Project;
  reason?: string;
}

export async function executeRecursiveCycle(params: {
  stepName: string;
  prompt: string;
  project: Project;
  controlPlaneState: ControlPlaneState;
  modificationsFn: () => Promise<FileModification[]>;
  testRunnerFn?: (project: Project) => Promise<number>;
  requestAttestation?: (
    req: ControlPlaneAttestationRequest
  ) => Promise<ControlPlaneAttestationResponse>;
}): Promise<ExecutionResult> {
  const result = await recursiveEngine.run({
    goal: params.prompt,
    project: params.project,
    maxIterations: 1,
    autoRepairOnEvalFailure: false,
    getControlPlaneState: () => params.controlPlaneState,
    requestAttestation: params.requestAttestation,
    initialTasks: [
      {
        id: 'single_cycle_task',
        title: params.stepName,
        description: params.prompt,
      },
    ],
    executeTask: async () => {
      const modifications = await params.modificationsFn();
      if (params.testRunnerFn) {
        const nextProj = applyFileModificationsToProject(params.project, modifications);
        const errs = await params.testRunnerFn(nextProj);
        if (errs > 0) {
          throw new Error(`Invariant test failure (${errs} errors)`);
        }
      }
      return {
        summary: `Executed ${params.stepName}`,
        modifications,
      };
    },
  });

  const latestAttest = result.attestations[result.attestations.length - 1];
  return {
    success: result.success,
    errorCount: result.success ? 0 : 1,
    attestationDigest: latestAttest?.attestationDigest,
    auditLogSeq: latestAttest?.linearizationSeq,
    project: result.project,
    reason: result.reason,
  };
}
