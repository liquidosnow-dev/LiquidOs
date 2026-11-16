import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import * as esbuild from 'esbuild';
import { AuditLedgerEntry, ProjectFile, VerificationClaimLevel } from '../types';
import { assertSafeIntegerLiterals, canonicalize } from './contractRegistry';
import { validateIngestPath } from './onDeviceFs';
import { verifyAuditLedgerIntegrity } from './securityCrypto';
import {
  AuthorizationCheckResult,
  ControlPlaneState,
  IngestionPermit,
  ProtectedOperationScope,
  WatchFileVerificationEntry,
  WatchVerificationReport,
  authorizeProtectedOperation,
  computeWorkspaceFileHashes,
  createUninitializedControlPlaneState,
  issueIngestionPermit,
  recordControlPlaneAudit,
  transitionGlobalMode,
} from './ingestionControlPlane';

export type ControlPlaneRole = 'viewer' | 'operator' | 'admin';

export interface SignedServerReceipt {
  receiptId: string;
  keyId: string;
  action: string;
  canonicalPayload: string;
  signature: string;
  publicKeyPem: string;
  algorithm: 'Ed25519';
  linearizationSeq: number;
}

export interface KeyRotationRecord {
  prevKeyId: string;
  nextKeyId: string;
  nextPublicKeyPem: string;
  rotatedAt: number;
  actor: string;
  canonicalPayload: string;
  signedByPreviousKey: string;
  signedByNewKey: string;
}

export interface AuditCheckpoint {
  checkpointSeq: number;
  ledgerLength: number;
  tipIndex: number;
  tipHash: string;
  timestamp: number;
  keyId: string;
  canonicalPayload: string;
  signature: string;
}

export interface PersistedTransactionRecord {
  transactionId: string;
  workspaceId: string;
  payloadDigest: string;
  status: 'authorized' | 'completed';
  commitHash: string | null;
  treeDigest: string;
  linearizationSeq: number;
  receipt: SignedServerReceipt;
  createdAt: number;
}

export interface DurableRecoveryEntry {
  transactionId: string;
  workspaceId: string;
  paths: string[];
  expectedFileHashes: Record<string, string>;
  status: 'pending' | 'recovered' | 'failed';
  retryCount: number;
  lastError?: string;
  updatedAt: number;
}

export interface EndpointAuthRule {
  method: 'GET' | 'POST';
  path: string;
  minRole: ControlPlaneRole | 'public';
  workspaceScoped: boolean;
  csrfAndOriginProtected: boolean;
  replayProtected: boolean;
  rejectionStatuses: number[];
  description: string;
}

export const CONTROL_PLANE_AUTH_MATRIX: EndpointAuthRule[] = [
  {
    method: 'GET',
    path: '/api/control-plane/state',
    minRole: 'public',
    workspaceScoped: false,
    csrfAndOriginProtected: false,
    replayProtected: false,
    rejectionStatuses: [],
    description: 'Read non-secret mode, epoch, fence, activeKeyId, and public keyring metadata.',
  },
  {
    method: 'GET',
    path: '/api/control-plane/keys',
    minRole: 'public',
    workspaceScoped: false,
    csrfAndOriginProtected: false,
    replayProtected: false,
    rejectionStatuses: [],
    description: 'Read public key keyring and signed key rotation history (never private keys).',
  },
  {
    method: 'POST',
    path: '/api/control-plane/session',
    minRole: 'public',
    workspaceScoped: true,
    csrfAndOriginProtected: true,
    replayProtected: false,
    rejectionStatuses: [403],
    description: 'Bootstrap same-origin scoped session token for first-party workbench requests.',
  },
  {
    method: 'POST',
    path: '/api/control-plane/mode',
    minRole: 'operator',
    workspaceScoped: true,
    csrfAndOriginProtected: true,
    replayProtected: true,
    rejectionStatuses: [400, 401, 403, 409],
    description: 'Transition GLOBAL-MODE-001 (LOCKDOWN/RESTRICTED for operator+; ACTIVE requires admin).',
  },
  {
    method: 'POST',
    path: '/api/control-plane/permit',
    minRole: 'admin',
    workspaceScoped: true,
    csrfAndOriginProtected: true,
    replayProtected: true,
    rejectionStatuses: [401, 403, 409],
    description: 'Mint signed IAM-001 capability permit when mode is ACTIVE.',
  },
  {
    method: 'POST',
    path: '/api/control-plane/keys/rotate',
    minRole: 'admin',
    workspaceScoped: true,
    csrfAndOriginProtected: true,
    replayProtected: true,
    rejectionStatuses: [401, 403, 409],
    description: 'Rotate persistent Ed25519 signing identity and emit dual-signed transition record.',
  },
  {
    method: 'POST',
    path: '/api/control-plane/authorize',
    minRole: 'operator',
    workspaceScoped: true,
    csrfAndOriginProtected: true,
    replayProtected: false,
    rejectionStatuses: [400, 401, 403],
    description: 'Validate IAM-001 permit, epoch, fence, and MCP-001 scope server-side.',
  },
  {
    method: 'POST',
    path: '/api/control-plane/ingest',
    minRole: 'operator',
    workspaceScoped: true,
    csrfAndOriginProtected: true,
    replayProtected: true,
    rejectionStatuses: [400, 401, 403, 409],
    description: 'Authorize external workspace ingestion with idempotency keys & Ed25519 receipt.',
  },
  {
    method: 'POST',
    path: '/api/control-plane/verify-upload',
    minRole: 'operator',
    workspaceScoped: true,
    csrfAndOriginProtected: true,
    replayProtected: false,
    rejectionStatuses: [400, 401, 403],
    description: 'Execute Watch Mode static/syntax checks returning explicit claimLevel taxonomy.',
  },
  {
    method: 'POST',
    path: '/api/control-plane/recovery-queue',
    minRole: 'operator',
    workspaceScoped: true,
    csrfAndOriginProtected: true,
    replayProtected: true,
    rejectionStatuses: [400, 401, 403, 409],
    description: 'Persist durable server-side recovery queue with stale-overwrite prevention.',
  },
  {
    method: 'GET',
    path: '/api/control-plane/audit',
    minRole: 'operator',
    workspaceScoped: true,
    csrfAndOriginProtected: true,
    replayProtected: false,
    rejectionStatuses: [401, 403],
    description: 'Read server hash-chained audit ledger, signed checkpoints, and tamper checks.',
  },
  {
    method: 'POST',
    path: '/api/control-plane/verify-receipt',
    minRole: 'public',
    workspaceScoped: false,
    csrfAndOriginProtected: false,
    replayProtected: false,
    rejectionStatuses: [400],
    description: 'Verify an Ed25519 server receipt against historical public keyring.',
  },
  {
    method: 'POST',
    path: '/api/control-plane/attest',
    minRole: 'operator',
    workspaceScoped: true,
    csrfAndOriginProtected: true,
    replayProtected: true,
    rejectionStatuses: [400, 401, 403, 409],
    description: 'Issue signed Ed25519 attestation receipt for evaluated autonomous recursive engine cycles.',
  },
];

export interface ControlPlaneSessionClaims {
  sessionId: string;
  actor: string;
  role: ControlPlaneRole;
  workspaceId: string;
  issuedAt: number;
  expiresAt: number;
}

const ROLE_WEIGHT: Record<ControlPlaneRole, number> = {
  viewer: 1,
  operator: 2,
  admin: 3,
};

export function hasMinimumRole(actual: ControlPlaneRole, required: ControlPlaneRole): boolean {
  return (ROLE_WEIGHT[actual] || 0) >= (ROLE_WEIGHT[required] || 99);
}

export function verifyEd25519Receipt(
  publicKeyPem: string,
  canonicalPayload: string,
  signatureBase64: string
): boolean {
  try {
    return crypto.verify(
      null,
      Buffer.from(canonicalPayload, 'utf8'),
      publicKeyPem,
      Buffer.from(signatureBase64, 'base64')
    );
  } catch {
    return false;
  }
}

export function verifyReceiptWithKeyring(
  receipt: {
    keyId?: string;
    canonicalPayload: string;
    signature: string;
    publicKeyPem?: string;
  },
  publicKeysById: Record<string, string>
): { valid: boolean; reason?: string } {
  if (!receipt || !receipt.canonicalPayload || !receipt.signature) {
    return { valid: false, reason: 'Malformed receipt payload or signature.' };
  }
  if (!receipt.keyId || !publicKeysById[receipt.keyId]) {
    return {
      valid: false,
      reason: `Unknown or untrusted keyId "${receipt.keyId || '(missing)'}" in keyring.`,
    };
  }
  const trustedPem = publicKeysById[receipt.keyId];
  if (receipt.publicKeyPem && receipt.publicKeyPem.trim() !== trustedPem.trim()) {
    return {
      valid: false,
      reason: `Receipt publicKeyPem does not match pinned keyId "${receipt.keyId}".`,
    };
  }
  const ok = verifyEd25519Receipt(trustedPem, receipt.canonicalPayload, receipt.signature);
  return ok
    ? { valid: true }
    : { valid: false, reason: 'Ed25519 signature verification failed against pinned keyring key.' };
}

export function verifyAuditWithCheckpoint(
  ledger: AuditLedgerEntry[],
  checkpoint: AuditCheckpoint | null | undefined,
  publicKeysById: Record<string, string>
): {
  valid: boolean;
  monotonicValid: boolean;
  truncationDetected: boolean;
  rollbackDetected: boolean;
  checkpointSignatureValid: boolean;
  reason?: string;
} {
  const baseIntegrity = verifyAuditLedgerIntegrity(ledger);
  if (!baseIntegrity.valid) {
    return {
      valid: false,
      monotonicValid: false,
      truncationDetected: false,
      rollbackDetected: false,
      checkpointSignatureValid: false,
      reason:
        typeof baseIntegrity.corruptedIndex === 'number'
          ? `Audit hash chain verification failed at index ${baseIntegrity.corruptedIndex}.`
          : 'Audit hash chain verification failed.',
    };
  }

  for (let i = 0; i < ledger.length; i++) {
    if (ledger[i].index !== i) {
      return {
        valid: false,
        monotonicValid: false,
        truncationDetected: false,
        rollbackDetected: false,
        checkpointSignatureValid: false,
        reason: `Non-monotonic audit index at position ${i} (got ${ledger[i].index}).`,
      };
    }
  }

  if (!checkpoint) {
    return {
      valid: true,
      monotonicValid: true,
      truncationDetected: false,
      rollbackDetected: false,
      checkpointSignatureValid: false,
    };
  }

  const keyVer = verifyReceiptWithKeyring(
    {
      keyId: checkpoint.keyId,
      canonicalPayload: checkpoint.canonicalPayload,
      signature: checkpoint.signature,
    },
    publicKeysById
  );
  if (!keyVer.valid) {
    return {
      valid: false,
      monotonicValid: true,
      truncationDetected: false,
      rollbackDetected: false,
      checkpointSignatureValid: false,
      reason: `Signed checkpoint verification failed: ${keyVer.reason}`,
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(checkpoint.canonicalPayload);
  } catch {
    return {
      valid: false,
      monotonicValid: true,
      truncationDetected: false,
      rollbackDetected: false,
      checkpointSignatureValid: false,
      reason: 'Signed checkpoint payload is not valid JSON.',
    };
  }

  if (ledger.length < checkpoint.ledgerLength) {
    return {
      valid: false,
      monotonicValid: true,
      truncationDetected: true,
      rollbackDetected: true,
      checkpointSignatureValid: true,
      reason: `Audit truncation detected: ledger length ${ledger.length} < signed checkpoint length ${checkpoint.ledgerLength}.`,
    };
  }

  const entryAtCheckpoint = ledger[checkpoint.ledgerLength - 1];
  if (
    !entryAtCheckpoint ||
    entryAtCheckpoint.hash !== checkpoint.tipHash ||
    parsed.tipHash !== checkpoint.tipHash ||
    entryAtCheckpoint.index !== checkpoint.tipIndex
  ) {
    return {
      valid: false,
      monotonicValid: true,
      truncationDetected: false,
      rollbackDetected: true,
      checkpointSignatureValid: true,
      reason: 'Audit rollback or history fork detected against signed checkpoint tipHash.',
    };
  }

  return {
    valid: true,
    monotonicValid: true,
    truncationDetected: false,
    rollbackDetected: false,
    checkpointSignatureValid: true,
  };
}

function writeFileAtomicSecure(filePath: string, content: string, mode = 0o600): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2, 8)}`;
  fs.writeFileSync(tmpPath, content, { encoding: 'utf8', mode });
  try {
    fs.chmodSync(tmpPath, mode);
  } catch {
    // Ignore on platforms not supporting chmod
  }
  fs.renameSync(tmpPath, filePath);
}

interface StoredKeyCustodyFile {
  version: 1;
  activeKeyId: string;
  activePublicKeyPem: string;
  activePrivateKeyPem: string;
  publicKeysById: Record<string, string>;
  keyTransitions: KeyRotationRecord[];
  sessionHmacSecret: string;
}

interface StoredControlPlaneStateFile {
  version: 1;
  workspaceId: string;
  state: ControlPlaneState;
  ledger: AuditLedgerEntry[];
  checkpoints: AuditCheckpoint[];
  recoveryQueuePaths: string[];
  recoveryRecords: DurableRecoveryEntry[];
  transactionsById: Record<string, PersistedTransactionRecord>;
}

export function createAuthoritativeControlPlaneEngine(options?: {
  initialActive?: boolean;
  stateDir?: string;
  workspaceId?: string;
}) {
  const workspaceId = options?.workspaceId || 'ws_unified_one';
  const stateDir = options?.stateDir ? path.resolve(options.stateDir) : null;
  const keyFilePath = stateDir ? path.join(stateDir, 'signing-key.json') : null;
  const stateFilePath = stateDir ? path.join(stateDir, 'control-plane-state.json') : null;

  // 1. Initialize or reload protected Ed25519 signing key custody & session secret
  let activeKeyId = '';
  let publicKeyPem = '';
  let privateKeyObj: crypto.KeyObject;
  let publicKeysById: Record<string, string> = {};
  let keyTransitions: KeyRotationRecord[] = [];
  let sessionHmacSecret = '';

  const generateNewKeypairRecord = () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const kid = `key_${crypto.createHash('sha256').update(pubPem, 'utf8').digest('hex').slice(0, 12)}`;
    return { keyId: kid, pubPem, privPem, privateKey };
  };

  const persistKeyCustody = (activePrivPem: string) => {
    if (!keyFilePath) return;
    const payload: StoredKeyCustodyFile = {
      version: 1,
      activeKeyId,
      activePublicKeyPem: publicKeyPem,
      activePrivateKeyPem: activePrivPem,
      publicKeysById,
      keyTransitions,
      sessionHmacSecret,
    };
    writeFileAtomicSecure(keyFilePath, JSON.stringify(payload, null, 2), 0o600);
  };

  let activePrivateKeyPem = '';
  if (keyFilePath && fs.existsSync(keyFilePath)) {
    const raw = JSON.parse(fs.readFileSync(keyFilePath, 'utf8')) as StoredKeyCustodyFile;
    activeKeyId = raw.activeKeyId;
    publicKeyPem = raw.activePublicKeyPem;
    activePrivateKeyPem = raw.activePrivateKeyPem;
    privateKeyObj = crypto.createPrivateKey(activePrivateKeyPem);
    publicKeysById = { ...(raw.publicKeysById || {}), [activeKeyId]: publicKeyPem };
    keyTransitions = Array.isArray(raw.keyTransitions) ? raw.keyTransitions : [];
    sessionHmacSecret = raw.sessionHmacSecret || crypto.randomBytes(32).toString('hex');
  } else {
    const gen = generateNewKeypairRecord();
    activeKeyId = gen.keyId;
    publicKeyPem = gen.pubPem;
    activePrivateKeyPem = gen.privPem;
    privateKeyObj = gen.privateKey;
    publicKeysById = { [activeKeyId]: publicKeyPem };
    keyTransitions = [];
    sessionHmacSecret = crypto.randomBytes(32).toString('hex');
    persistKeyCustody(activePrivateKeyPem);
  }

  let state: ControlPlaneState = createUninitializedControlPlaneState();
  let ledger: AuditLedgerEntry[] = [];
  let checkpoints: AuditCheckpoint[] = [];
  let recoveryQueuePaths: string[] = [];
  let recoveryRecords: DurableRecoveryEntry[] = [];
  let transactionsById: Record<string, PersistedTransactionRecord> = {};
  const seenNonces = new Set<string>();

  function signPayload(action: string, payload: unknown): SignedServerReceipt {
    const canonicalPayload = canonicalize(payload);
    const sig = crypto.sign(null, Buffer.from(canonicalPayload, 'utf8'), privateKeyObj);
    return {
      receiptId: `rcpt_${crypto.createHash('sha256').update(canonicalPayload).digest('hex').slice(0, 16)}`,
      keyId: activeKeyId,
      action,
      canonicalPayload,
      signature: sig.toString('base64'),
      publicKeyPem,
      algorithm: 'Ed25519',
      linearizationSeq: state.linearizationSeq ?? 0,
    };
  }

  function emitCheckpoint() {
    if (ledger.length === 0) return;
    const tip = ledger[ledger.length - 1];
    const checkpointSeq = checkpoints.length + 1;
    const timestamp = Date.now();
    const canonicalPayload = canonicalize({
      contract: 'AN-EVC-001',
      checkpointSeq,
      ledgerLength: ledger.length,
      tipIndex: tip.index,
      tipHash: tip.hash,
      timestamp,
      keyId: activeKeyId,
    });
    const sig = crypto.sign(null, Buffer.from(canonicalPayload, 'utf8'), privateKeyObj).toString('base64');
    checkpoints.push({
      checkpointSeq,
      ledgerLength: ledger.length,
      tipIndex: tip.index,
      tipHash: tip.hash,
      timestamp,
      keyId: activeKeyId,
      canonicalPayload,
      signature: sig,
    });
  }

  function persistStateSnapshot() {
    if (!stateFilePath) return;
    const snapshot: StoredControlPlaneStateFile = {
      version: 1,
      workspaceId,
      state,
      ledger,
      checkpoints,
      recoveryQueuePaths,
      recoveryRecords,
      transactionsById,
    };
    writeFileAtomicSecure(stateFilePath, JSON.stringify(snapshot, null, 2), 0o600);
  }

  function signPermit(permit: IngestionPermit): IngestionPermit {
    const permitCore = {
      permitId: permit.permitId,
      subject: permit.subject,
      issuer: permit.issuer,
      keyId: activeKeyId,
      workspaceId,
      epoch: permit.epoch,
      fencingVersion: permit.fencingVersion,
      issuedAt: permit.issuedAt,
      expiresAt: permit.expiresAt,
      scopes: [...permit.scopes].sort(),
      digest: permit.digest,
    };
    const sig = crypto.sign(null, Buffer.from(canonicalize(permitCore), 'utf8'), privateKeyObj);
    return {
      ...permit,
      serverSignature: sig.toString('base64'),
    };
  }

  // 2. Restore persisted state if present (so permits, revocations, recovery & ledger survive restart)
  if (stateFilePath && fs.existsSync(stateFilePath)) {
    const saved = JSON.parse(fs.readFileSync(stateFilePath, 'utf8')) as StoredControlPlaneStateFile;
    state = {
      ...saved.state,
      activeKeyId,
      publicKeyPem,
      publicKeysById: { ...publicKeysById },
    };
    ledger = Array.isArray(saved.ledger) ? saved.ledger : [];
    checkpoints = Array.isArray(saved.checkpoints) ? saved.checkpoints : [];
    recoveryQueuePaths = Array.isArray(saved.recoveryQueuePaths) ? saved.recoveryQueuePaths : [];
    recoveryRecords = Array.isArray(saved.recoveryRecords) ? saved.recoveryRecords : [];
    transactionsById = saved.transactionsById && typeof saved.transactionsById === 'object' ? saved.transactionsById : {};
    ledger = recordControlPlaneAudit(ledger, 'control_plane_restarted', activeKeyId, 'system', {
      workspaceId,
      mode: state.mode,
      epoch: state.epoch,
      recoveredEntries: ledger.length,
      recoveryQueueCount: recoveryQueuePaths.length,
    });
    emitCheckpoint();
    persistStateSnapshot();
  } else if (options?.initialActive !== false) {
    state = transitionGlobalMode(
      state,
      'ACTIVE',
      'Server control-plane initialized ACTIVE session'
    );
    const issued = issueIngestionPermit(state, {
      subject: 'human:mercy',
      issuer: `server:${activeKeyId}`,
      scopes: ['workspace_ingest', 'workspace_commit', 'device_sync'],
    });
    const signedPermit = signPermit(issued.permit);
    state = {
      ...issued.state,
      activePermit: signedPermit,
      activeKeyId,
      publicKeyPem,
      publicKeysById: { ...publicKeysById },
    };
    ledger = recordControlPlaneAudit(ledger, 'control_plane_boot', activeKeyId, 'system', {
      workspaceId,
      mode: state.mode,
      epoch: state.epoch,
      fencingVersion: signedPermit.fencingVersion,
      permitId: signedPermit.permitId,
    });
    emitCheckpoint();
    persistStateSnapshot();
  } else {
    state = {
      ...state,
      activeKeyId,
      publicKeyPem,
      publicKeysById: { ...publicKeysById },
    };
    ledger = recordControlPlaneAudit(ledger, 'control_plane_boot_uninitialized', activeKeyId, 'system', {
      workspaceId,
      mode: state.mode,
    });
    emitCheckpoint();
    persistStateSnapshot();
  }

  function issueSessionToken(params: {
    actor?: string;
    role?: ControlPlaneRole;
    workspaceId?: string;
    ttlMs?: number;
  } = {}): { token: string; claims: ControlPlaneSessionClaims } {
    const now = Date.now();
    const claims: ControlPlaneSessionClaims = {
      sessionId: `sess_${crypto.randomBytes(12).toString('hex')}`,
      actor: params.actor || 'human:mercy',
      role: params.role || 'admin',
      workspaceId: params.workspaceId || workspaceId,
      issuedAt: now,
      expiresAt: now + (params.ttlMs ?? 12 * 60 * 60 * 1000),
    };
    const encoded = Buffer.from(canonicalize(claims), 'utf8').toString('base64url');
    const mac = crypto
      .createHmac('sha256', sessionHmacSecret)
      .update(encoded, 'utf8')
      .digest('base64url');
    return { token: `${encoded}.${mac}`, claims };
  }

  function verifySessionToken(
    token: string | null | undefined,
    now = Date.now()
  ): { ok: true; claims: ControlPlaneSessionClaims } | { ok: false; code: string; reason: string } {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
      return { ok: false, code: 'ERR_UNAUTHENTICATED', reason: 'Missing or malformed session bearer token.' };
    }
    const [encoded, providedMac] = token.split('.', 2);
    const expectedMac = crypto
      .createHmac('sha256', sessionHmacSecret)
      .update(encoded, 'utf8')
      .digest('base64url');
    const a = Buffer.from(providedMac || '', 'utf8');
    const b = Buffer.from(expectedMac, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, code: 'ERR_UNAUTHENTICATED', reason: 'Invalid operator session token signature.' };
    }
    try {
      const claims = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ControlPlaneSessionClaims;
      if (!claims || typeof claims.expiresAt !== 'number' || now > claims.expiresAt) {
        return { ok: false, code: 'ERR_SESSION_EXPIRED', reason: 'Operator session token expired.' };
      }
      return { ok: true, claims };
    } catch {
      return { ok: false, code: 'ERR_UNAUTHENTICATED', reason: 'Corrupt session token claims.' };
    }
  }

  function authorizeHttpRequest(params: {
    method: 'GET' | 'POST';
    path: string;
    bearerToken?: string | null;
    origin?: string | null;
    host?: string | null;
    requestedWorkspaceId?: string | null;
    requestedMode?: string | null;
    nonce?: string | null;
    now?: number;
  }): {
    allowed: boolean;
    status: number;
    code: string;
    reason?: string;
    claims?: ControlPlaneSessionClaims;
  } {
    const rule = CONTROL_PLANE_AUTH_MATRIX.find(
      (r) => r.method === params.method && r.path === params.path
    );
    if (!rule) {
      return { allowed: false, status: 404, code: 'ERR_UNKNOWN_ROUTE', reason: 'Unknown control plane endpoint.' };
    }

    // 1. CSRF / Cross-Origin enforcement for browser-initiated mutating/sensitive endpoints
    if (rule.csrfAndOriginProtected && params.origin) {
      try {
        const parsedOrigin = new URL(params.origin);
        const normalizedHost = (params.host || '').toLowerCase();
        const originHost = parsedOrigin.host.toLowerCase();
        const isLocalhostMatch =
          (parsedOrigin.hostname === '127.0.0.1' || parsedOrigin.hostname === 'localhost') &&
          (normalizedHost.startsWith('127.0.0.1') || normalizedHost.startsWith('localhost'));
        if (normalizedHost && originHost !== normalizedHost && !isLocalhostMatch) {
          return {
            allowed: false,
            status: 403,
            code: 'ERR_ORIGIN_MISMATCH',
            reason: `Cross-origin request rejected (Origin ${originHost} != Host ${normalizedHost}).`,
          };
        }
      } catch {
        return {
          allowed: false,
          status: 403,
          code: 'ERR_ORIGIN_MISMATCH',
          reason: 'Malformed Origin header rejected.',
        };
      }
    }

    if (rule.minRole === 'public') {
      return { allowed: true, status: 200, code: 'ALLOW' };
    }

    // 2. Session bearer authentication
    const tokenRes = verifySessionToken(params.bearerToken, params.now);
    if (!tokenRes.ok) {
      return {
        allowed: false,
        status: 401,
        code: tokenRes.code,
        reason: tokenRes.reason,
      };
    }

    // 3. Role-Based Access Control (plus restoring ACTIVE requires admin)
    const requiredRole: ControlPlaneRole =
      params.path === '/api/control-plane/mode' && params.requestedMode === 'ACTIVE'
        ? 'admin'
        : rule.minRole;
    if (!hasMinimumRole(tokenRes.claims.role, requiredRole)) {
      return {
        allowed: false,
        status: 403,
        code: 'ERR_FORBIDDEN_ROLE',
        reason: `Role "${tokenRes.claims.role}" lacks required privilege "${requiredRole}" for ${params.method} ${params.path}.`,
      };
    }

    // 4. Workspace scope binding
    if (
      rule.workspaceScoped &&
      params.requestedWorkspaceId &&
      params.requestedWorkspaceId !== tokenRes.claims.workspaceId
    ) {
      return {
        allowed: false,
        status: 403,
        code: 'ERR_WORKSPACE_SCOPE_MISMATCH',
        reason: `Token workspace scope "${tokenRes.claims.workspaceId}" cannot access "${params.requestedWorkspaceId}".`,
      };
    }

    // 5. Anti-replay nonce check if supplied
    if (rule.replayProtected && params.nonce) {
      if (seenNonces.has(params.nonce)) {
        return {
          allowed: false,
          status: 409,
          code: 'ERR_REPLAY_NONCE',
          reason: `Replay nonce "${params.nonce}" was already consumed.`,
        };
      }
      seenNonces.add(params.nonce);
      if (seenNonces.size > 2000) {
        const first = seenNonces.values().next().value;
        if (first) seenNonces.delete(first);
      }
    }

    return {
      allowed: true,
      status: 200,
      code: 'ALLOW',
      claims: tokenRes.claims,
    };
  }

  function rotateSigningKey(actor = 'human:mercy') {
    const prevKeyId = activeKeyId;
    const prevPrivateKey = privateKeyObj;
    const gen = generateNewKeypairRecord();
    const rotatedAt = Date.now();
    const payloadObj = {
      contract: 'AN-EVC-001',
      action: 'signing_key_rotation',
      prevKeyId,
      nextKeyId: gen.keyId,
      nextPublicKeyPem: gen.pubPem,
      rotatedAt,
      actor,
    };
    const canonicalPayload = canonicalize(payloadObj);
    const signedByPreviousKey = crypto
      .sign(null, Buffer.from(canonicalPayload, 'utf8'), prevPrivateKey)
      .toString('base64');
    const signedByNewKey = crypto
      .sign(null, Buffer.from(canonicalPayload, 'utf8'), gen.privateKey)
      .toString('base64');

    const record: KeyRotationRecord = {
      prevKeyId,
      nextKeyId: gen.keyId,
      nextPublicKeyPem: gen.pubPem,
      rotatedAt,
      actor,
      canonicalPayload,
      signedByPreviousKey,
      signedByNewKey,
    };

    activeKeyId = gen.keyId;
    publicKeyPem = gen.pubPem;
    activePrivateKeyPem = gen.privPem;
    privateKeyObj = gen.privateKey;
    publicKeysById = { ...publicKeysById, [activeKeyId]: publicKeyPem };
    keyTransitions = [...keyTransitions, record];
    persistKeyCustody(activePrivateKeyPem);

    state = {
      ...state,
      activeKeyId,
      publicKeyPem,
      publicKeysById: { ...publicKeysById },
    };

    ledger = recordControlPlaneAudit(ledger, 'signing_key_rotated', activeKeyId, actor, {
      prevKeyId,
      nextKeyId: activeKeyId,
      rotatedAt,
    });
    emitCheckpoint();
    persistStateSnapshot();

    return {
      ok: true as const,
      prevKeyId,
      activeKeyId,
      publicKeyPem,
      publicKeysById: { ...publicKeysById },
      transitionRecord: record,
    };
  }

  function getPublicKeysSnapshot() {
    return {
      activeKeyId,
      publicKeyPem,
      publicKeysById: { ...publicKeysById },
      keyTransitions: [...keyTransitions],
    };
  }

  function getPublicState() {
    const latestCheckpoint = checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null;
    return {
      workspaceId,
      state: {
        ...state,
        activeKeyId,
        publicKeyPem,
        publicKeysById: { ...publicKeysById },
      },
      linearizationSeq: state.linearizationSeq ?? 0,
      recoveryQueuePaths: [...recoveryQueuePaths],
      recoveryRecords: [...recoveryRecords],
      activeKeyId,
      publicKeyPem,
      publicKeysById: { ...publicKeysById },
      ledgerLength: ledger.length,
      latestCheckpoint,
      ledgerIntegrity: verifyAuditWithCheckpoint(ledger, latestCheckpoint, publicKeysById),
      authMatrix: CONTROL_PLANE_AUTH_MATRIX,
    };
  }

  function transitionMode(
    nextMode: 'ACTIVE' | 'RESTRICTED' | 'LOCKDOWN',
    reason = `Operator transitioned GLOBAL-MODE-001 to ${nextMode}`,
    actor = 'human:mercy'
  ) {
    const nextState = transitionGlobalMode(state, nextMode, reason);
    state = {
      ...nextState,
      activeKeyId,
      publicKeyPem,
      publicKeysById: { ...publicKeysById },
    };
    ledger = recordControlPlaneAudit(ledger, 'global_mode_transition', nextMode, actor, {
      mode: state.mode,
      epoch: state.epoch,
      minFencingVersion: state.minFencingVersion,
      linearizationSeq: state.linearizationSeq,
      revokedCount: state.revokedPermitIds.length,
      reason: state.lastTransitionReason,
    });
    emitCheckpoint();
    persistStateSnapshot();

    const receipt = signPayload('global_mode_transition', {
      mode: state.mode,
      epoch: state.epoch,
      minFencingVersion: state.minFencingVersion,
      linearizationSeq: state.linearizationSeq,
      reason: state.lastTransitionReason,
      timestamp: state.lastTransitionAt,
    });
    return { state: { ...state }, receipt, linearizationSeq: state.linearizationSeq ?? 0, publicKeyPem, activeKeyId };
  }

  function issuePermit(opts?: {
    subject?: string;
    scopes?: ProtectedOperationScope[];
    ttlMs?: number;
  }) {
    if (state.mode !== 'ACTIVE') {
      return {
        ok: false as const,
        status: 403,
        code: state.mode === 'LOCKDOWN' ? 'ERR_GLOBAL_MODE_LOCKDOWN' : 'ERR_GLOBAL_MODE_RESTRICTED',
        error: `GLOBAL-MODE-001: Cannot issue capability permit while mode is ${state.mode}.`,
        state: { ...state },
      };
    }

    const issued = issueIngestionPermit(state, {
      subject: opts?.subject || 'human:mercy',
      issuer: `server:${activeKeyId}`,
      scopes: opts?.scopes || ['workspace_ingest', 'workspace_commit', 'device_sync'],
      ttlMs: opts?.ttlMs,
    });
    const signedPermit = signPermit(issued.permit);
    state = {
      ...issued.state,
      activePermit: signedPermit,
      activeKeyId,
      publicKeyPem,
      publicKeysById: { ...publicKeysById },
    };
    ledger = recordControlPlaneAudit(ledger, 'iam_permit_issued', signedPermit.permitId, `server:${activeKeyId}`, {
      epoch: signedPermit.epoch,
      fencingVersion: signedPermit.fencingVersion,
      scopes: signedPermit.scopes,
      expiresAt: signedPermit.expiresAt,
      linearizationSeq: state.linearizationSeq,
    });
    emitCheckpoint();
    persistStateSnapshot();

    const receipt = signPayload('iam_permit_issued', {
      permitId: signedPermit.permitId,
      epoch: signedPermit.epoch,
      fencingVersion: signedPermit.fencingVersion,
      digest: signedPermit.digest,
      linearizationSeq: state.linearizationSeq,
    });
    return {
      ok: true as const,
      status: 200,
      permit: signedPermit,
      state: { ...state },
      receipt,
      publicKeyPem,
      activeKeyId,
    };
  }

  function authorizeOperation(params: {
    permitId?: string | null;
    scope: ProtectedOperationScope;
    clientEpoch?: number;
    clientFencingVersion?: number;
    now?: number;
  }): {
    authorized: boolean;
    status: number;
    check: AuthorizationCheckResult;
    linearizationSeq: number;
    receipt: SignedServerReceipt | null;
    state: ControlPlaneState;
  } {
    const seq = state.linearizationSeq ?? 0;

    let candidatePermit: IngestionPermit | null = null;
    if (params.permitId && state.activePermit && params.permitId === state.activePermit.permitId) {
      candidatePermit = state.activePermit;
    } else if (params.permitId && state.revokedPermitIds.includes(params.permitId)) {
      const revokedResult: AuthorizationCheckResult = {
        authorized: false,
        code: 'ERR_IAM_PERMIT_REVOKED',
        reason: `IAM-001 server enforcement: permit "${params.permitId}" is permanently revoked.`,
      };
      ledger = recordControlPlaneAudit(ledger, 'server_auth_denied', params.permitId, `server:${activeKeyId}`, {
        scope: params.scope,
        code: revokedResult.code,
        linearizationSeq: seq,
      });
      emitCheckpoint();
      persistStateSnapshot();
      return {
        authorized: false,
        status: 403,
        check: revokedResult,
        linearizationSeq: seq,
        receipt: null,
        state: { ...state },
      };
    }

    if (
      typeof params.clientEpoch === 'number' &&
      params.clientEpoch !== state.epoch &&
      state.mode === 'ACTIVE'
    ) {
      const staleCheck: AuthorizationCheckResult = {
        authorized: false,
        code: 'ERR_IAM_STALE_EPOCH',
        reason: `Server rejected stale client epoch (${params.clientEpoch} != ${state.epoch}).`,
      };
      ledger = recordControlPlaneAudit(ledger, 'server_auth_denied', params.permitId || 'none', `server:${activeKeyId}`, {
        scope: params.scope,
        code: staleCheck.code,
        reason: staleCheck.reason,
        linearizationSeq: seq,
      });
      emitCheckpoint();
      persistStateSnapshot();
      return {
        authorized: false,
        status: 403,
        check: staleCheck,
        linearizationSeq: seq,
        receipt: null,
        state: { ...state },
      };
    }

    if (
      typeof params.clientFencingVersion === 'number' &&
      params.clientFencingVersion < state.minFencingVersion &&
      state.mode === 'ACTIVE'
    ) {
      const staleFence: AuthorizationCheckResult = {
        authorized: false,
        code: 'ERR_IAM_STALE_FENCE',
        reason: `Server rejected stale client fencing version (${params.clientFencingVersion} < ${state.minFencingVersion}).`,
      };
      ledger = recordControlPlaneAudit(ledger, 'server_auth_denied', params.permitId || 'none', `server:${activeKeyId}`, {
        scope: params.scope,
        code: staleFence.code,
        reason: staleFence.reason,
        linearizationSeq: seq,
      });
      emitCheckpoint();
      persistStateSnapshot();
      return {
        authorized: false,
        status: 403,
        check: staleFence,
        linearizationSeq: seq,
        receipt: null,
        state: { ...state },
      };
    }

    const check = authorizeProtectedOperation(state, candidatePermit, params.scope, params.now);
    if (!check.authorized) {
      ledger = recordControlPlaneAudit(ledger, 'server_auth_denied', params.permitId || 'none', `server:${activeKeyId}`, {
        scope: params.scope,
        code: check.code,
        reason: check.reason,
        linearizationSeq: seq,
      });
      emitCheckpoint();
      persistStateSnapshot();
      return {
        authorized: false,
        status: 403,
        check,
        linearizationSeq: seq,
        receipt: null,
        state: { ...state },
      };
    }

    const receipt = signPayload('authorization_grant', {
      permitId: candidatePermit!.permitId,
      scope: params.scope,
      epoch: state.epoch,
      fencingVersion: candidatePermit!.fencingVersion,
      linearizationSeq: seq,
      timestamp: params.now ?? Date.now(),
    });
    return {
      authorized: true,
      status: 200,
      check,
      linearizationSeq: seq,
      receipt,
      state: { ...state },
    };
  }

  function authorizeIngestionCommit(params: {
    permitId?: string | null;
    uploadedFiles: ProjectFile[];
    commitHash?: string;
    expectedEpoch?: number;
    expectedFencingVersion?: number;
    transactionId?: string;
    workspaceId?: string;
    actor?: string;
  }) {
    if (!Array.isArray(params.uploadedFiles) || params.uploadedFiles.length === 0) {
      return {
        ok: false as const,
        status: 400,
        code: 'ERR_INVALID_PAYLOAD',
        error: 'uploadedFiles must be a non-empty array.',
        linearizationSeq: state.linearizationSeq ?? 0,
      };
    }

    for (const file of params.uploadedFiles) {
      const pathCheck = validateIngestPath(file?.path);
      if (!pathCheck.ok) {
        return {
          ok: false as const,
          status: 400,
          code: 'ERR_UNSAFE_PATH',
          error: `Server rejected unsafe path "${file?.path}": ${pathCheck.reason}`,
          linearizationSeq: state.linearizationSeq ?? 0,
        };
      }
      if (typeof file.content !== 'string' || file.content.includes('\u0000')) {
        return {
          ok: false as const,
          status: 400,
          code: 'ERR_BINARY_PAYLOAD',
          error: `Server rejected binary/NUL payload in "${file.path}".`,
          linearizationSeq: state.linearizationSeq ?? 0,
        };
      }
      if (Buffer.byteLength(file.content, 'utf8') > 1024 * 1024) {
        return {
          ok: false as const,
          status: 400,
          code: 'ERR_OVERSIZE_PAYLOAD',
          error: `Server rejected oversize payload "${file.path}" (> 1 MB).`,
          linearizationSeq: state.linearizationSeq ?? 0,
        };
      }
    }

    const { fileHashes, treeDigest } = computeWorkspaceFileHashes(params.uploadedFiles);
    const reqWorkspaceId = params.workspaceId || workspaceId;
    const txId =
      typeof params.transactionId === 'string' && params.transactionId.trim()
        ? params.transactionId.trim()
        : `tx_${crypto.randomBytes(10).toString('hex')}`;
    const payloadDigest = crypto
      .createHash('sha256')
      .update(
        canonicalize({
          workspaceId: reqWorkspaceId,
          permitId: params.permitId || null,
          treeDigest,
          fileHashes,
        }),
        'utf8'
      )
      .digest('hex');

    // Idempotent transaction lookup BEFORE re-mutating state
    const existingTx = transactionsById[txId];
    if (existingTx) {
      if (existingTx.payloadDigest !== payloadDigest) {
        ledger = recordControlPlaneAudit(
          ledger,
          'transaction_idempotency_conflict',
          txId,
          params.actor || 'human:mercy',
          { existingDigest: existingTx.payloadDigest, incomingDigest: payloadDigest }
        );
        emitCheckpoint();
        persistStateSnapshot();
        return {
          ok: false as const,
          status: 409,
          code: 'ERR_IDEMPOTENCY_CONFLICT',
          error: `Transaction "${txId}" already exists with a different payload digest.`,
          linearizationSeq: state.linearizationSeq ?? 0,
        };
      }
      return {
        ok: true as const,
        status: 200,
        idempotentReplay: true,
        transactionId: txId,
        treeDigest: existingTx.treeDigest,
        fileHashes,
        receipt: existingTx.receipt,
        linearizationSeq: existingTx.linearizationSeq,
        activeKeyId,
        publicKeyPem,
      };
    }

    const authRes = authorizeOperation({
      permitId: params.permitId,
      scope: 'workspace_commit',
      clientEpoch: params.expectedEpoch,
      clientFencingVersion: params.expectedFencingVersion,
    });
    if (!authRes.authorized) {
      return {
        ok: false as const,
        status: 403,
        code: authRes.check.code,
        error: authRes.check.reason,
        linearizationSeq: authRes.linearizationSeq,
      };
    }

    const receipt = signPayload('server_ingest_receipt', {
      contract: 'AN-EVC-001',
      transactionId: txId,
      workspaceId: reqWorkspaceId,
      trustSource: 'external_user_drop',
      claimStatus: 'untested',
      claimLevel: 'untested',
      permitId: params.permitId,
      epoch: state.epoch,
      fencingVersion: state.activePermit?.fencingVersion ?? state.minFencingVersion,
      linearizationSeq: authRes.linearizationSeq,
      uploadedTreeDigest: treeDigest,
      commitHash: params.commitHash || null,
      fileCount: params.uploadedFiles.length,
    });

    transactionsById[txId] = {
      transactionId: txId,
      workspaceId: reqWorkspaceId,
      payloadDigest,
      status: 'authorized',
      commitHash: params.commitHash || null,
      treeDigest,
      linearizationSeq: authRes.linearizationSeq,
      receipt,
      createdAt: Date.now(),
    };

    ledger = recordControlPlaneAudit(
      ledger,
      'server_workspace_ingest_authorized',
      txId,
      params.actor || 'human:mercy',
      {
        transactionId: txId,
        receiptId: receipt.receiptId,
        keyId: activeKeyId,
        permitId: params.permitId,
        epoch: state.epoch,
        treeDigest,
        fileHashes,
        claimStatus: 'untested',
        claimLevel: 'untested',
      }
    );
    emitCheckpoint();
    persistStateSnapshot();

    return {
      ok: true as const,
      status: 200,
      idempotentReplay: false,
      transactionId: txId,
      treeDigest,
      fileHashes,
      receipt,
      linearizationSeq: authRes.linearizationSeq,
      activeKeyId,
      publicKeyPem,
    };
  }

  function verifyUploadedFilesWatchMode(params: {
    commitHash: string;
    files: ProjectFile[];
  }): WatchVerificationReport {
    const entries: WatchFileVerificationEntry[] = [];
    let allPassed = true;
    let hasAdvisoryWarning = false;

    for (const file of params.files) {
      const lower = file.path.toLowerCase();
      const sha256 = crypto.createHash('sha256').update(file.content, 'utf8').digest('hex');
      const diagnostics: string[] = [];
      let verifier: WatchFileVerificationEntry['verifier'] = 'text_utf8';
      let passed = true;

      if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(lower)) {
        verifier = 'esbuild_syntax';
        const loader = lower.endsWith('.tsx')
          ? 'tsx'
          : lower.endsWith('.ts')
          ? 'ts'
          : lower.endsWith('.jsx')
          ? 'jsx'
          : 'js';
        try {
          esbuild.transformSync(file.content, { loader, format: 'esm' });
        } catch (err: any) {
          passed = false;
          diagnostics.push(err?.message || `Syntax/parse error in ${file.path}`);
        }
      } else if (/\.jsonc?$/.test(lower)) {
        verifier = 'json_jcs_safe_int';
        try {
          assertSafeIntegerLiterals(file.content);
          JSON.parse(file.content);
        } catch (err: any) {
          passed = false;
          diagnostics.push(err?.message || `JSON/safe-int error in ${file.path}`);
        }
      } else if (/\.(html|htm|svg|xml)$/.test(lower)) {
        verifier = 'markup_static';
        if (/<script\b/i.test(file.content) || /\son[a-z]+\s*=/i.test(file.content)) {
          hasAdvisoryWarning = true;
          diagnostics.push('Advisory: inline <script> or on* event attribute detected in uploaded markup.');
        }
      }

      if (!passed) {
        allPassed = false;
      }

      entries.push({
        path: file.path,
        sha256,
        verifier,
        passed,
        diagnostics,
      });
    }

    const claimStatus: 'tested' | 'untested' =
      params.files.length > 0 && allPassed ? 'tested' : 'untested';
    const claimLevel: VerificationClaimLevel =
      params.files.length === 0 || !allPassed
        ? 'untested'
        : hasAdvisoryWarning
        ? 'syntax_checked'
        : 'policy_checked';
    const claimScope = 'syntax_and_static_policy_only (no arbitrary app test execution)';
    const verifiedAt = Date.now();
    const signed = signPayload('watch_file_verification', {
      commitHash: params.commitHash,
      verifiedAt,
      allPassed,
      claimStatus,
      claimLevel,
      claimScope,
      testsExecuted: false,
      independentlyVerified: false,
      entries: entries.map((e) => ({
        path: e.path,
        sha256: e.sha256,
        verifier: e.verifier,
        passed: e.passed,
      })),
    });

    ledger = recordControlPlaneAudit(
      ledger,
      'watch_verification_completed',
      params.commitHash || 'watch',
      `server:${activeKeyId}`,
      {
        allPassed,
        claimStatus,
        claimLevel,
        claimScope,
        testsExecuted: false,
        fileCount: entries.length,
        receiptId: signed.receiptId,
        keyId: activeKeyId,
      }
    );
    emitCheckpoint();
    persistStateSnapshot();

    return {
      commitHash: params.commitHash,
      verifiedAt,
      allPassed,
      claimStatus,
      claimLevel,
      claimScope,
      testsExecuted: false,
      independentlyVerified: false,
      entries,
      serverReceipt: {
        receiptId: signed.receiptId,
        keyId: activeKeyId,
        canonicalPayload: signed.canonicalPayload,
        signature: signed.signature,
        publicKeyPem,
        algorithm: 'Ed25519',
      },
    };
  }

  function updateRecoveryQueue(
    paths: string[],
    opts?: {
      transactionId?: string;
      expectedFileHashes?: Record<string, string>;
      currentFileHashes?: Record<string, string>;
      action?: 'queue' | 'retry_succeeded' | 'retry_failed' | 'clear';
      actor?: string;
      error?: string;
    }
  ): {
    ok: boolean;
    status: number;
    code?: string;
    error?: string;
    recoveryQueuePaths: string[];
    recoveryRecords: DurableRecoveryEntry[];
  } {
    const cleanPaths = Array.from(
      new Set(paths.filter((p): p is string => typeof p === 'string' && p.length > 0))
    );
    const txId = opts?.transactionId || 'tx_default_recovery';
    const action = opts?.action || (cleanPaths.length === 0 ? 'clear' : 'queue');

    // Prevent stale recovery retry from overwriting newer workspace file versions
    if (action === 'retry_succeeded' && opts?.expectedFileHashes && opts?.currentFileHashes) {
      for (const p of cleanPaths) {
        const expectedHash = opts.expectedFileHashes[p];
        const currentHash = opts.currentFileHashes[p];
        if (expectedHash && currentHash && expectedHash !== currentHash) {
          ledger = recordControlPlaneAudit(
            ledger,
            'recovery_stale_overwrite_blocked',
            txId,
            opts?.actor || 'server',
            { path: p, expectedHash, currentHash }
          );
          emitCheckpoint();
          persistStateSnapshot();
          return {
            ok: false,
            status: 409,
            code: 'ERR_STALE_RECOVERY_OVERWRITE',
            error: `Blocked stale recovery write for "${p}": workspace content hash changed since failure.`,
            recoveryQueuePaths: [...recoveryQueuePaths],
            recoveryRecords: [...recoveryRecords],
          };
        }
      }
    }

    recoveryQueuePaths = cleanPaths;
    const existingIdx = recoveryRecords.findIndex((r) => r.transactionId === txId);
    const nextEntry: DurableRecoveryEntry = {
      transactionId: txId,
      workspaceId,
      paths: cleanPaths,
      expectedFileHashes: opts?.expectedFileHashes || (existingIdx >= 0 ? recoveryRecords[existingIdx].expectedFileHashes : {}),
      status:
        cleanPaths.length === 0 || action === 'retry_succeeded' || action === 'clear'
          ? 'recovered'
          : action === 'retry_failed'
          ? 'failed'
          : 'pending',
      retryCount:
        existingIdx >= 0
          ? recoveryRecords[existingIdx].retryCount + (action.startsWith('retry_') ? 1 : 0)
          : action.startsWith('retry_')
          ? 1
          : 0,
      lastError: opts?.error,
      updatedAt: Date.now(),
    };

    if (existingIdx >= 0) {
      recoveryRecords = [
        ...recoveryRecords.slice(0, existingIdx),
        nextEntry,
        ...recoveryRecords.slice(existingIdx + 1),
      ];
    } else {
      recoveryRecords = [...recoveryRecords, nextEntry];
    }

    ledger = recordControlPlaneAudit(
      ledger,
      `recovery_queue_${action}`,
      txId,
      opts?.actor || `server:${activeKeyId}`,
      {
        count: recoveryQueuePaths.length,
        paths: recoveryQueuePaths,
        status: nextEntry.status,
        retryCount: nextEntry.retryCount,
        error: opts?.error,
      }
    );
    emitCheckpoint();
    persistStateSnapshot();

    return {
      ok: true,
      status: 200,
      recoveryQueuePaths: [...recoveryQueuePaths],
      recoveryRecords: [...recoveryRecords],
    };
  }

  function issueExecutionAttestation(params: {
    permitId?: string | null;
    cycleId: string;
    stepName: string;
    iteration: number;
    taskIds?: string[];
    modifiedFiles?: ProjectFile[];
    vaultDigest?: string;
    evaluationPassed?: boolean;
    evaluationDiagnostics?: string[];
    expectedEpoch?: number;
    expectedFencingVersion?: number;
    workspaceId?: string;
    actor?: string;
  }) {
    if (!params.cycleId || !params.stepName) {
      return {
        ok: false as const,
        status: 400,
        code: 'ERR_INVALID_PAYLOAD',
        error: 'cycleId and stepName are required for Control Plane Ed25519 attestation.',
        linearizationSeq: state.linearizationSeq ?? 0,
      };
    }

    if (params.evaluationPassed === false) {
      return {
        ok: false as const,
        status: 400,
        code: 'ERR_EVALUATION_FAILED',
        error: 'Refusing Ed25519 attestation for failed file modification evaluation.',
        linearizationSeq: state.linearizationSeq ?? 0,
      };
    }

    const files = Array.isArray(params.modifiedFiles) ? params.modifiedFiles : [];
    for (const file of files) {
      const pathCheck = validateIngestPath(file?.path);
      if (!pathCheck.ok) {
        return {
          ok: false as const,
          status: 400,
          code: 'ERR_UNSAFE_PATH',
          error: `Attestation rejected unsafe path "${file?.path}": ${pathCheck.reason}`,
          linearizationSeq: state.linearizationSeq ?? 0,
        };
      }
      if (typeof file.content !== 'string' || file.content.includes('\u0000')) {
        return {
          ok: false as const,
          status: 400,
          code: 'ERR_BINARY_PAYLOAD',
          error: `Attestation rejected binary/NUL payload in "${file.path}".`,
          linearizationSeq: state.linearizationSeq ?? 0,
        };
      }
    }

    const authRes = authorizeOperation({
      permitId: params.permitId,
      scope: 'workspace_commit',
      clientEpoch: params.expectedEpoch,
      clientFencingVersion: params.expectedFencingVersion,
    });
    if (!authRes.authorized) {
      return {
        ok: false as const,
        status: 403,
        code: authRes.check.code,
        error: authRes.check.reason,
        linearizationSeq: authRes.linearizationSeq,
      };
    }

    const { fileHashes, treeDigest } = computeWorkspaceFileHashes(files);
    const reqWorkspaceId = params.workspaceId || workspaceId;
    const attestationPayload = {
      contract: 'AN-EVC-001',
      cycleId: params.cycleId,
      stepName: params.stepName,
      iteration: params.iteration,
      workspaceId: reqWorkspaceId,
      permitId: params.permitId || null,
      epoch: state.epoch,
      fencingVersion: state.activePermit?.fencingVersion ?? state.minFencingVersion,
      linearizationSeq: authRes.linearizationSeq,
      taskIds: Array.isArray(params.taskIds) ? params.taskIds : [],
      vaultDigest: params.vaultDigest || 'none',
      evaluationPassed: true,
      evaluationDiagnostics: Array.isArray(params.evaluationDiagnostics)
        ? params.evaluationDiagnostics
        : [],
      treeDigest,
      fileHashes,
    };

    const attestationDigest = crypto
      .createHash('sha256')
      .update(canonicalize(attestationPayload), 'utf8')
      .digest('hex');

    const receipt = signPayload('autonomous_cycle_attestation', {
      ...attestationPayload,
      attestationDigest,
    });

    ledger = recordControlPlaneAudit(
      ledger,
      'autonomous_cycle_attested',
      params.cycleId,
      params.actor || 'agent:recursive_engine',
      {
        stepName: params.stepName,
        iteration: params.iteration,
        receiptId: receipt.receiptId,
        keyId: activeKeyId,
        attestationDigest,
        treeDigest,
        vaultDigest: attestationPayload.vaultDigest,
        fileCount: files.length,
        linearizationSeq: authRes.linearizationSeq,
      }
    );
    emitCheckpoint();
    persistStateSnapshot();

    return {
      ok: true as const,
      status: 200,
      receipt,
      attestationDigest,
      treeDigest,
      fileHashes,
      linearizationSeq: authRes.linearizationSeq,
      activeKeyId,
      publicKeyPem,
      state: { ...state },
    };
  }

  function getAuditSnapshot() {
    const latestCheckpoint = checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null;
    const checkpointVerification = verifyAuditWithCheckpoint(ledger, latestCheckpoint, publicKeysById);
    return {
      entries: ledger.slice().reverse(),
      totalEntries: ledger.length,
      checkpoints: [...checkpoints],
      latestCheckpoint,
      integrity: {
        ...verifyAuditLedgerIntegrity(ledger),
        checkpointVerification,
      },
      activeKeyId,
      publicKeyPem,
      publicKeysById: { ...publicKeysById },
    };
  }

  return {
    issueSessionToken,
    verifySessionToken,
    authorizeHttpRequest,
    rotateSigningKey,
    getPublicKeysSnapshot,
    getPublicState,
    transitionMode,
    issuePermit,
    authorizeOperation,
    authorizeIngestionCommit,
    verifyUploadedFilesWatchMode,
    updateRecoveryQueue,
    issueExecutionAttestation,
    getAuditSnapshot,
  };
}
