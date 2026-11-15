import { AuditLedgerEntry, Commit, Project, ProjectFile, VerificationClaimLevel } from '../types';
import { sha256Hex, appendAuditLedger } from './securityCrypto';
import { assertSafeIntegerLiterals, canonicalize } from './contractRegistry';
import {
  WritePhase,
  validateIngestPath,
  writeFilesToDirectoryHandle,
} from './onDeviceFs';
import { createCommit, verifyCommitIntegrity } from './versionControl';

export type GlobalMode = 'UNINITIALIZED' | 'ACTIVE' | 'RESTRICTED' | 'LOCKDOWN';

export type ProtectedOperationScope =
  | 'workspace_ingest'
  | 'workspace_commit'
  | 'device_sync';

export interface IngestionPermit {
  permitId: string;
  subject: string;
  issuer: string;
  epoch: number;
  fencingVersion: number;
  issuedAt: number;
  expiresAt: number;
  scopes: ProtectedOperationScope[];
  revoked: boolean;
  digest: string;
  serverSignature?: string;
}

export interface ControlPlaneState {
  contract: 'GLOBAL-MODE-001';
  mode: GlobalMode;
  epoch: number;
  minFencingVersion: number;
  activePermit: IngestionPermit | null;
  revokedPermitIds: string[];
  lastTransitionAt: number;
  lastTransitionReason: string;
  linearizationSeq?: number;
  activeKeyId?: string;
  publicKeyPem?: string;
  publicKeysById?: Record<string, string>;
}

export interface AuthorizationCheckResult {
  authorized: boolean;
  code:
    | 'ALLOW'
    | 'ERR_GLOBAL_MODE_UNINITIALIZED'
    | 'ERR_GLOBAL_MODE_LOCKDOWN'
    | 'ERR_GLOBAL_MODE_RESTRICTED'
    | 'ERR_IAM_NO_PERMIT'
    | 'ERR_IAM_PERMIT_REVOKED'
    | 'ERR_IAM_STALE_EPOCH'
    | 'ERR_IAM_STALE_FENCE'
    | 'ERR_IAM_EXPIRED'
    | 'ERR_IAM_DIGEST_MISMATCH'
    | 'ERR_MCP_SCOPE_DENIED';
  reason: string;
}

export interface FileValidationEntry {
  path: string;
  sha256: string;
  byteLength: number;
  valid: boolean;
  warnings: string[];
  claimStatus: 'untested';
}

export interface SnapshotValidationReport {
  valid: boolean;
  uploadedCount: number;
  totalWorkspaceFiles: number;
  treeDigest: string;
  uploadedDigest: string;
  fileResults: FileValidationEntry[];
  errors: string[];
  evidenceEnvelope: {
    contract: 'AN-EVC-001';
    claimStatus: 'untested';
    trustSource: 'external_user_drop';
    limitations: string[];
  };
}

export interface WatchFileVerificationEntry {
  path: string;
  sha256: string;
  verifier: 'esbuild_syntax' | 'json_jcs_safe_int' | 'markup_static' | 'text_utf8';
  passed: boolean;
  diagnostics: string[];
}

export interface WatchVerificationReport {
  commitHash: string;
  verifiedAt: number;
  allPassed: boolean;
  claimStatus: 'tested' | 'untested';
  claimLevel: VerificationClaimLevel;
  claimScope: string;
  testsExecuted: boolean;
  independentlyVerified: boolean;
  entries: WatchFileVerificationEntry[];
  serverReceipt?: {
    receiptId: string;
    keyId?: string;
    canonicalPayload: string;
    signature: string;
    publicKeyPem: string;
    algorithm: 'Ed25519';
  };
}

export interface DeviceSyncRecoveryReport {
  status: 'SYNCED' | 'PARTIAL_FAILURE' | 'ABORTED_LOCKDOWN' | 'DENIED';
  writtenPaths: string[];
  failedFiles: { path: string; reason: string }[];
  abortedPaths: string[];
  authorizationError?: string;
}

export interface RecoveryQueueEntry {
  path: string;
  reason: string;
  queuedAt: number;
}

export interface AtomicIngestionOutcome {
  ok: boolean;
  stage:
    | 'pre_auth'
    | 'snapshot_validation'
    | 'dispatch_auth'
    | 'commit_creation'
    | 'commit_publication'
    | 'device_sync'
    | 'recovery_persistence'
    | 'complete';
  project: Project;
  commit: Commit | null;
  snapshotReport: SnapshotValidationReport | null;
  syncReport: DeviceSyncRecoveryReport | null;
  pendingRecoveryPaths: string[];
  recoveryPersisted: boolean;
  auditLedger: AuditLedgerEntry[];
  error?: string;
}

const RECOVERY_QUEUE_STORAGE_KEY = 'liquidos_device_sync_recovery_queue_v1';

export function saveRecoveryQueueToStorage(paths: string[]): { ok: boolean; error?: string } {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        RECOVERY_QUEUE_STORAGE_KEY,
        JSON.stringify({ updatedAt: Date.now(), paths })
      );
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to persist recovery queue' };
  }
}

export function loadRecoveryQueueFromStorage(): string[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(RECOVERY_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.paths)
      ? parsed.paths.filter((p: unknown): p is string => typeof p === 'string')
      : [];
  } catch {
    return [];
  }
}

export function createUninitializedControlPlaneState(): ControlPlaneState {
  return {
    contract: 'GLOBAL-MODE-001',
    mode: 'UNINITIALIZED',
    epoch: 0,
    minFencingVersion: 0,
    activePermit: null,
    revokedPermitIds: [],
    lastTransitionAt: Date.now(),
    lastTransitionReason: 'Uninitialized fail-closed state',
    linearizationSeq: 0,
  };
}

export function createPermitDigest(payload: Omit<IngestionPermit, 'revoked' | 'digest' | 'serverSignature'>): string {
  return sha256Hex(
    canonicalize({
      permitId: payload.permitId,
      subject: payload.subject,
      issuer: payload.issuer,
      epoch: payload.epoch,
      fencingVersion: payload.fencingVersion,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      scopes: [...payload.scopes].sort(),
    })
  );
}

export function issueIngestionPermit(
  state: ControlPlaneState,
  options: {
    subject?: string;
    issuer?: string;
    scopes?: ProtectedOperationScope[];
    ttlMs?: number;
    now?: number;
  } = {}
): { state: ControlPlaneState; permit: IngestionPermit } {
  if (state.mode !== 'ACTIVE') {
    throw new Error(`GLOBAL-MODE-001: Cannot issue permit while mode is ${state.mode}`);
  }

  const now = options.now ?? Date.now();
  const nextFence = state.minFencingVersion + 1;
  const scopes: ProtectedOperationScope[] = options.scopes
    ? Array.from(new Set(options.scopes))
    : ['workspace_ingest', 'workspace_commit', 'device_sync'];

  const base = {
    permitId: `perm_${sha256Hex(`${state.epoch}:${nextFence}:${now}:${Math.random()}`).slice(0, 16)}`,
    subject: options.subject || 'human:mercy',
    issuer: options.issuer || 'system:liquidos_control_plane',
    epoch: state.epoch,
    fencingVersion: nextFence,
    issuedAt: now,
    expiresAt: now + (options.ttlMs ?? 15 * 60 * 1000),
    scopes,
  };

  const permit: IngestionPermit = {
    ...base,
    revoked: false,
    digest: createPermitDigest(base),
  };

  // Supersede previous active permit by adding it to revokedPermitIds
  const prevRevoked = state.activePermit
    ? Array.from(new Set([...state.revokedPermitIds, state.activePermit.permitId]))
    : state.revokedPermitIds;

  return {
    permit,
    state: {
      ...state,
      minFencingVersion: nextFence,
      activePermit: permit,
      revokedPermitIds: prevRevoked,
      linearizationSeq: (state.linearizationSeq ?? 0) + 1,
    },
  };
}

export function transitionGlobalMode(
  state: ControlPlaneState,
  nextMode: 'ACTIVE' | 'RESTRICTED' | 'LOCKDOWN',
  reason: string,
  now = Date.now()
): ControlPlaneState {
  const nextSeq = (state.linearizationSeq ?? 0) + 1;
  if (nextMode === 'LOCKDOWN' || nextMode === 'RESTRICTED') {
    const revokedIds = state.activePermit
      ? Array.from(new Set([...state.revokedPermitIds, state.activePermit.permitId]))
      : state.revokedPermitIds;

    return {
      ...state,
      mode: nextMode,
      epoch: state.epoch + 1,
      minFencingVersion: state.minFencingVersion + 1,
      activePermit: null,
      revokedPermitIds: revokedIds,
      lastTransitionAt: now,
      lastTransitionReason: reason,
      linearizationSeq: nextSeq,
    };
  }

  // Returning to ACTIVE never revives previously revoked permits; a fresh permit must be issued.
  return {
    ...state,
    mode: 'ACTIVE',
    epoch: state.epoch + 1,
    minFencingVersion: state.minFencingVersion + 1,
    activePermit: null,
    lastTransitionAt: now,
    lastTransitionReason: reason,
    linearizationSeq: nextSeq,
  };
}

export function authorizeProtectedOperation(
  state: ControlPlaneState | null | undefined,
  permit: IngestionPermit | null | undefined,
  requiredScope: ProtectedOperationScope,
  now = Date.now()
): AuthorizationCheckResult {
  if (!state || state.mode === 'UNINITIALIZED') {
    return {
      authorized: false,
      code: 'ERR_GLOBAL_MODE_UNINITIALIZED',
      reason: 'GLOBAL-MODE-001 fail-closed: control plane state is missing or uninitialized.',
    };
  }
  if (state.mode === 'LOCKDOWN') {
    return {
      authorized: false,
      code: 'ERR_GLOBAL_MODE_LOCKDOWN',
      reason: `GLOBAL-MODE-001 LOCKDOWN active (${state.lastTransitionReason}); protected operation "${requiredScope}" denied.`,
    };
  }
  if (state.mode === 'RESTRICTED') {
    return {
      authorized: false,
      code: 'ERR_GLOBAL_MODE_RESTRICTED',
      reason: `GLOBAL-MODE-001 RESTRICTED mode denies "${requiredScope}".`,
    };
  }
  if (!permit) {
    return {
      authorized: false,
      code: 'ERR_IAM_NO_PERMIT',
      reason: `IAM-001 fail-closed: no active capability permit for "${requiredScope}".`,
    };
  }
  if (permit.revoked || state.revokedPermitIds.includes(permit.permitId)) {
    return {
      authorized: false,
      code: 'ERR_IAM_PERMIT_REVOKED',
      reason: `IAM-001: permit "${permit.permitId}" was revoked and cannot be reused.`,
    };
  }
  if (permit.epoch !== state.epoch) {
    return {
      authorized: false,
      code: 'ERR_IAM_STALE_EPOCH',
      reason: `Stale authorization epoch (${permit.epoch} != ${state.epoch}).`,
    };
  }
  if (permit.fencingVersion < state.minFencingVersion) {
    return {
      authorized: false,
      code: 'ERR_IAM_STALE_FENCE',
      reason: `Stale fencing version (${permit.fencingVersion} < ${state.minFencingVersion}).`,
    };
  }
  if (now > permit.expiresAt) {
    return {
      authorized: false,
      code: 'ERR_IAM_EXPIRED',
      reason: `Capability permit "${permit.permitId}" expired at ${new Date(permit.expiresAt).toISOString()}.`,
    };
  }

  const expectedDigest = createPermitDigest({
    permitId: permit.permitId,
    subject: permit.subject,
    issuer: permit.issuer,
    epoch: permit.epoch,
    fencingVersion: permit.fencingVersion,
    issuedAt: permit.issuedAt,
    expiresAt: permit.expiresAt,
    scopes: permit.scopes,
  });
  if (expectedDigest !== permit.digest) {
    return {
      authorized: false,
      code: 'ERR_IAM_DIGEST_MISMATCH',
      reason: 'Capability permit digest tampered or invalid.',
    };
  }

  if (!permit.scopes.includes(requiredScope)) {
    return {
      authorized: false,
      code: 'ERR_MCP_SCOPE_DENIED',
      reason: `MCP-001 boundary violation: permit lacks required scope "${requiredScope}".`,
    };
  }

  return {
    authorized: true,
    code: 'ALLOW',
    reason: `Authorized under GLOBAL-MODE-001 ACTIVE (epoch=${state.epoch}, fence=${permit.fencingVersion}).`,
  };
}

export function computeWorkspaceFileHashes(files: ProjectFile[]): {
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

export function validateUploadedSnapshot(
  uploadedFiles: ProjectFile[],
  mergedWorkspaceFiles: ProjectFile[]
): SnapshotValidationReport {
  const fileResults: FileValidationEntry[] = [];
  const errors: string[] = [];

  for (const file of uploadedFiles) {
    const warnings: string[] = [];
    const pathCheck = validateIngestPath(file.path);
    if (!pathCheck.ok) {
      errors.push(`${file.path}: ${pathCheck.reason}`);
    }

    const byteLength = new TextEncoder().encode(file.content).byteLength;
    if (byteLength > 1024 * 1024) {
      errors.push(`${file.path}: exceeds 1 MB workspace file ceiling.`);
    }
    if (file.content.includes('\u0000')) {
      errors.push(`${file.path}: contains NUL byte binary payload.`);
    }

    if (file.path.toLowerCase().endsWith('.json')) {
      try {
        assertSafeIntegerLiterals(file.content);
        JSON.parse(file.content);
      } catch (err: any) {
        warnings.push(`JSON structural check warning: ${err?.message || 'invalid JSON'}`);
      }
    }

    fileResults.push({
      path: file.path,
      sha256: sha256Hex(file.content),
      byteLength,
      valid: pathCheck.ok && byteLength <= 1024 * 1024 && !file.content.includes('\u0000'),
      warnings,
      claimStatus: 'untested',
    });
  }

  const uploadedTree = computeWorkspaceFileHashes(uploadedFiles);
  const fullTree = computeWorkspaceFileHashes(mergedWorkspaceFiles);

  return {
    valid: errors.length === 0,
    uploadedCount: uploadedFiles.length,
    totalWorkspaceFiles: mergedWorkspaceFiles.length,
    treeDigest: fullTree.treeDigest,
    uploadedDigest: uploadedTree.treeDigest,
    fileResults,
    errors,
    evidenceEnvelope: {
      contract: 'AN-EVC-001',
      claimStatus: 'untested',
      trustSource: 'external_user_drop',
      limitations: [
        'External user-dropped content is untrusted until independently verified.',
        'Structural upload/commit success does not assert runtime safety or cryptographic signature custody.',
      ],
    },
  };
}

export async function syncFilesToDeviceWithRecovery(
  rootHandle: any,
  files: ProjectFile[],
  options: {
    getControlState: () => ControlPlaneState;
    getPermit: () => IngestionPermit | null;
    signal?: AbortSignal;
    now?: () => number;
  }
): Promise<DeviceSyncRecoveryReport> {
  const preAuth = authorizeProtectedOperation(
    options.getControlState(),
    options.getPermit(),
    'device_sync',
    options.now ? options.now() : Date.now()
  );
  if (!preAuth.authorized) {
    return {
      status: 'DENIED',
      writtenPaths: [],
      failedFiles: files.map((f) => ({ path: f.path, reason: preAuth.reason })),
      abortedPaths: [],
      authorizationError: preAuth.reason,
    };
  }

  const checkLiveAuth = (_phase: WritePhase) => {
    const check = authorizeProtectedOperation(
      options.getControlState(),
      options.getPermit(),
      'device_sync',
      options.now ? options.now() : Date.now()
    );
    if (!check.authorized) {
      throw new Error(check.reason);
    }
  };

  const res = await writeFilesToDirectoryHandle(rootHandle, files, {
    signal: options.signal,
    beforePhase: (phase) => checkLiveAuth(phase),
  });

  if (res.aborted) {
    return {
      status: 'ABORTED_LOCKDOWN',
      writtenPaths: res.writtenPaths,
      failedFiles: res.failedFiles,
      abortedPaths: res.abortedPaths,
      authorizationError: 'In-flight device synchronization aborted by control plane.',
    };
  }

  if (res.failedFiles.length > 0) {
    return {
      status: 'PARTIAL_FAILURE',
      writtenPaths: res.writtenPaths,
      failedFiles: res.failedFiles,
      abortedPaths: [],
    };
  }

  return {
    status: 'SYNCED',
    writtenPaths: res.writtenPaths,
    failedFiles: [],
    abortedPaths: [],
  };
}

/**
 * Atomic ingestion transaction orchestrator (ING-05, ING-06, ING-07, ING-10, ING-11).
 * Guarantees that if commit creation, integrity verification, or publication fails,
 * the original project snapshot is preserved verbatim and never leaves torn state.
 */
export async function executeAtomicIngestionTransaction(params: {
  project: Project;
  uploadedFiles: ProjectFile[];
  author?: string;
  getControlState: () => ControlPlaneState;
  getPermit: () => IngestionPermit | null;
  auditLedger: AuditLedgerEntry[];
  deviceHandle?: any | null;
  autoSyncDevice?: boolean;
  signal?: AbortSignal;
  publishProject?: (nextProject: Project, commit: Commit) => void;
  persistRecoveryQueue?: (paths: string[]) => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>;
  beforeCommitStep?: () => void;
}): Promise<AtomicIngestionOutcome> {
  const {
    project,
    uploadedFiles,
    author = 'Mercy (User)',
    getControlState,
    getPermit,
    deviceHandle = null,
    autoSyncDevice = false,
    signal,
    publishProject,
    persistRecoveryQueue = saveRecoveryQueueToStorage,
    beforeCommitStep,
  } = params;

  let ledger = params.auditLedger;

  if (uploadedFiles.length === 0) {
    return {
      ok: false,
      stage: 'pre_auth',
      project,
      commit: null,
      snapshotReport: null,
      syncReport: null,
      pendingRecoveryPaths: [],
      recoveryPersisted: true,
      auditLedger: ledger,
      error: 'No readable files provided.',
    };
  }

  // 1. Pre-commit authorization check
  const preAuth = authorizeProtectedOperation(getControlState(), getPermit(), 'workspace_commit');
  if (!preAuth.authorized) {
    ledger = recordControlPlaneAudit(ledger, 'workspace_ingest_denied', 'dropzone', author, {
      code: preAuth.code,
      reason: preAuth.reason,
      fileCount: uploadedFiles.length,
    });
    return {
      ok: false,
      stage: 'pre_auth',
      project,
      commit: null,
      snapshotReport: null,
      syncReport: null,
      pendingRecoveryPaths: [],
      recoveryPersisted: true,
      auditLedger: ledger,
      error: preAuth.reason,
    };
  }

  // 2. Snapshot-wide structural validation & digest computation
  const mergedMap = new Map<string, ProjectFile>(project.files.map((f) => [f.path, f]));
  for (const uf of uploadedFiles) {
    mergedMap.set(uf.path, uf);
  }
  const mergedList = Array.from(mergedMap.values());
  const snapshotReport = validateUploadedSnapshot(uploadedFiles, mergedList);

  if (!snapshotReport.valid) {
    const errMsg = snapshotReport.errors[0] || 'Snapshot validation rejected upload.';
    ledger = recordControlPlaneAudit(ledger, 'workspace_ingest_rejected', 'dropzone', author, {
      errors: snapshotReport.errors,
    });
    return {
      ok: false,
      stage: 'snapshot_validation',
      project,
      commit: null,
      snapshotReport,
      syncReport: null,
      pendingRecoveryPaths: [],
      recoveryPersisted: true,
      auditLedger: ledger,
      error: errMsg,
    };
  }

  // 3. Re-check authorization immediately prior to commit dispatch (linearization check)
  const expectedSeq = getControlState().linearizationSeq ?? 0;
  const dispatchAuth = authorizeProtectedOperation(getControlState(), getPermit(), 'workspace_commit');
  if (!dispatchAuth.authorized || signal?.aborted) {
    const reason = signal?.aborted
      ? 'Workspace commit aborted prior to dispatch.'
      : dispatchAuth.reason;
    ledger = recordControlPlaneAudit(ledger, 'workspace_commit_denied', 'dropzone', author, {
      code: dispatchAuth.code,
      reason,
    });
    return {
      ok: false,
      stage: 'dispatch_auth',
      project,
      commit: null,
      snapshotReport,
      syncReport: null,
      pendingRecoveryPaths: [],
      recoveryPersisted: true,
      auditLedger: ledger,
      error: reason,
    };
  }

  const label =
    uploadedFiles.length === 1
      ? `Uploaded ${uploadedFiles[0].path}`
      : `Uploaded ${uploadedFiles.length} local files into workspace`;

  let committedProject: Project = project;
  let commitRecord: Commit | null = null;

  try {
    beforeCommitStep?.();
    const liveState = getControlState();
    const livePermit = getPermit();
    const recheck = authorizeProtectedOperation(liveState, livePermit, 'workspace_commit');
    if (!recheck.authorized || (liveState.linearizationSeq ?? 0) !== expectedSeq || signal?.aborted) {
      throw new Error(recheck.authorized ? 'GLOBAL-MODE-001: Linearization sequence changed during commit.' : recheck.reason);
    }

    const { project: nextProj, commit } = createCommit(
      { ...project, files: mergedList },
      label,
      author,
      {
        source: 'external_drop',
        claimStatus: 'untested',
        authorizationPermitId: livePermit!.permitId,
        epoch: livePermit!.epoch,
        fencingVersion: livePermit!.fencingVersion,
      }
    );

    const integrity = verifyCommitIntegrity(commit);
    if (!integrity.valid) {
      throw new Error(integrity.reason || 'Commit integrity check failed.');
    }

    if (publishProject) {
      publishProject(nextProj, commit);
    }

    committedProject = nextProj;
    commitRecord = commit;
    ledger = recordControlPlaneAudit(ledger, 'workspace_ingest_committed', commit.id, author, {
      commitHash: commit.hash,
      treeDigest: commit.treeDigest,
      uploadedCount: uploadedFiles.length,
      uploadedPaths: uploadedFiles.map((f) => f.path),
      claimStatus: 'untested',
    });
  } catch (err: any) {
    const reason = err?.message || 'Atomic workspace commit failed; original project state retained.';
    ledger = recordControlPlaneAudit(ledger, 'workspace_commit_failed', 'rollback', author, {
      reason,
      retainedCommitId: project.branches[project.currentBranch]?.currentCommitId || null,
    });
    return {
      ok: false,
      stage: 'commit_creation',
      project,
      commit: null,
      snapshotReport,
      syncReport: null,
      pendingRecoveryPaths: [],
      recoveryPersisted: true,
      auditLedger: ledger,
      error: reason,
    };
  }

  // 4. Optional device synchronization + durable recovery queue persistence
  let syncReport: DeviceSyncRecoveryReport | null = null;
  let pendingRecoveryPaths: string[] = [];
  let recoveryPersisted = true;

  if (deviceHandle && autoSyncDevice) {
    syncReport = await syncFilesToDeviceWithRecovery(deviceHandle, uploadedFiles, {
      getControlState,
      getPermit,
      signal,
    });

    pendingRecoveryPaths = Array.from(
      new Set([
        ...syncReport.failedFiles.map((f) => f.path),
        ...syncReport.abortedPaths,
      ])
    );

    if (pendingRecoveryPaths.length > 0) {
      const persistRes = await persistRecoveryQueue(pendingRecoveryPaths);
      recoveryPersisted = persistRes.ok;
      if (!persistRes.ok) {
        ledger = recordControlPlaneAudit(
          ledger,
          'recovery_queue_persistence_failed',
          deviceHandle.name || 'device',
          author,
          { pendingRecoveryPaths, error: persistRes.error }
        );
      }
    } else {
      const clearRes = await persistRecoveryQueue([]);
      recoveryPersisted = clearRes.ok;
    }

    ledger = recordControlPlaneAudit(
      ledger,
      'device_auto_sync_' + syncReport.status.toLowerCase(),
      deviceHandle.name || 'device',
      author,
      {
        writtenCount: syncReport.writtenPaths.length,
        failedFiles: syncReport.failedFiles,
        abortedPaths: syncReport.abortedPaths,
        pendingRecoveryPaths,
        recoveryPersisted,
        authorizationError: syncReport.authorizationError,
      }
    );
  }

  return {
    ok: true,
    stage: 'complete',
    project: committedProject,
    commit: commitRecord,
    snapshotReport,
    syncReport,
    pendingRecoveryPaths,
    recoveryPersisted,
    auditLedger: ledger,
  };
}

export function recordControlPlaneAudit(
  ledger: AuditLedgerEntry[],
  action: string,
  entityId: string,
  actor: string,
  data: unknown
): AuditLedgerEntry[] {
  return appendAuditLedger(ledger, action, entityId, actor, data).ledger;
}

