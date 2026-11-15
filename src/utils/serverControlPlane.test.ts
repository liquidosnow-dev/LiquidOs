import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CONTROL_PLANE_AUTH_MATRIX,
  createAuthoritativeControlPlaneEngine,
  verifyAuditWithCheckpoint,
  verifyEd25519Receipt,
  verifyReceiptWithKeyring,
} from './serverControlPlane';
import { ProjectFile } from '../types';

function makeFiles(): ProjectFile[] {
  return [
    {
      name: 'app.ts',
      path: 'src/app.ts',
      language: 'typescript',
      content: 'export const appReady: boolean = true;\n',
      lastModified: 1000,
    },
    {
      name: 'config.json',
      path: 'config.json',
      language: 'json',
      content: '{"version": 1}\n',
      lastModified: 1000,
    },
  ];
}

test('FIV-001: Persistent Ed25519 key custody (0600), key rotation dual-signatures, and historical receipt verification across server restarts', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-fiv001-'));
  try {
    const engine1 = createAuthoritativeControlPlaneEngine({
      initialActive: true,
      stateDir: tmpDir,
      workspaceId: 'ws_persist_test',
    });

    const keyFile = path.join(tmpDir, 'signing-key.json');
    assert.equal(fs.existsSync(keyFile), true);
    const stat = fs.statSync(keyFile);
    assert.equal(stat.mode & 0o077, 0);

    const state1 = engine1.getPublicState();
    const key1 = state1.activeKeyId;
    const permit1 = state1.state.activePermit!;
    const ingest1 = engine1.authorizeIngestionCommit({
      transactionId: 'tx_persist_1',
      permitId: permit1.permitId,
      uploadedFiles: makeFiles(),
    });
    assert.equal(ingest1.ok, true);
    if (!ingest1.ok) return;

    // Rotate signing key -> dual-signed transition record & historical key kept in keyring
    const rot = engine1.rotateSigningKey('human:mercy');
    assert.notEqual(rot.activeKeyId, key1);
    assert.ok(rot.publicKeysById[key1]);
    assert.ok(rot.publicKeysById[rot.activeKeyId]);
    assert.equal(
      verifyEd25519Receipt(
        rot.publicKeysById[key1],
        rot.transitionRecord.canonicalPayload,
        rot.transitionRecord.signedByPreviousKey
      ),
      true
    );
    assert.equal(
      verifyEd25519Receipt(
        rot.publicKeysById[rot.activeKeyId],
        rot.transitionRecord.canonicalPayload,
        rot.transitionRecord.signedByNewKey
      ),
      true
    );

    // Issue post-rotation receipt
    const ingest2 = engine1.authorizeIngestionCommit({
      transactionId: 'tx_persist_2',
      permitId: permit1.permitId,
      uploadedFiles: [makeFiles()[0]],
    });
    assert.equal(ingest2.ok, true);
    if (!ingest2.ok) return;
    assert.equal(ingest2.receipt.keyId, rot.activeKeyId);

    // Simulate full Express server process restart pointing at the same stateDir
    const engine2 = createAuthoritativeControlPlaneEngine({
      initialActive: true,
      stateDir: tmpDir,
      workspaceId: 'ws_persist_test',
    });
    const keysAfterRestart = engine2.getPublicKeysSnapshot();
    assert.equal(keysAfterRestart.activeKeyId, rot.activeKeyId);
    assert.equal(
      verifyReceiptWithKeyring(ingest1.receipt, keysAfterRestart.publicKeysById).valid,
      true
    );
    assert.equal(
      verifyReceiptWithKeyring(ingest2.receipt, keysAfterRestart.publicKeysById).valid,
      true
    );

    // Rogue public key swap or unknown keyId fails keyring verification
    assert.equal(
      verifyReceiptWithKeyring(
        { ...ingest1.receipt, keyId: 'key_rogue' },
        keysAfterRestart.publicKeysById
      ).valid,
      false
    );

    // Persisted ledger survives restart & includes rotation + checkpoint
    const audit2 = engine2.getAuditSnapshot();
    assert.equal(audit2.integrity.valid, true);
    assert.equal(audit2.integrity.checkpointVerification.valid, true);
    assert.ok(audit2.entries.some((e) => e.action === 'control_plane_restarted'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('FIV-002: Complete HTTP endpoint authorization matrix, RBAC roles, workspace scope, CORS/Origin, and replay nonces', () => {
  const engine = createAuthoritativeControlPlaneEngine({
    initialActive: true,
    workspaceId: 'ws_alpha',
  });

  // Matrix covers every route
  assert.ok(CONTROL_PLANE_AUTH_MATRIX.some((r) => r.path === '/api/control-plane/mode'));
  assert.ok(CONTROL_PLANE_AUTH_MATRIX.some((r) => r.path === '/api/control-plane/permit'));
  assert.ok(CONTROL_PLANE_AUTH_MATRIX.some((r) => r.path === '/api/control-plane/keys/rotate'));

  // 1. Unauthenticated requests rejected 401
  for (const pathItem of [
    '/api/control-plane/mode',
    '/api/control-plane/permit',
    '/api/control-plane/keys/rotate',
    '/api/control-plane/ingest',
    '/api/control-plane/recovery-queue',
  ]) {
    const unauth = engine.authorizeHttpRequest({
      method: 'POST',
      path: pathItem,
      bearerToken: null,
    });
    assert.equal(unauth.allowed, false);
    assert.equal(unauth.status, 401);
    assert.equal(unauth.code, 'ERR_UNAUTHENTICATED');
  }
  assert.equal(
    engine.authorizeHttpRequest({ method: 'GET', path: '/api/control-plane/audit', bearerToken: null }).status,
    401
  );

  // 2. Role hierarchy: viewer < operator < admin
  const viewerTok = engine.issueSessionToken({ role: 'viewer', workspaceId: 'ws_alpha' }).token;
  const opTok = engine.issueSessionToken({ role: 'operator', workspaceId: 'ws_alpha' }).token;
  const adminTok = engine.issueSessionToken({ role: 'admin', workspaceId: 'ws_alpha' }).token;
  const wrongWsTok = engine.issueSessionToken({ role: 'admin', workspaceId: 'ws_beta' }).token;

  assert.equal(
    engine.authorizeHttpRequest({
      method: 'POST',
      path: '/api/control-plane/mode',
      bearerToken: viewerTok,
      requestedMode: 'LOCKDOWN',
    }).status,
    403
  );
  assert.equal(
    engine.authorizeHttpRequest({
      method: 'POST',
      path: '/api/control-plane/mode',
      bearerToken: opTok,
      requestedMode: 'LOCKDOWN',
    }).allowed,
    true
  );
  // Restoring ACTIVE or minting permit or rotating key requires admin
  assert.equal(
    engine.authorizeHttpRequest({
      method: 'POST',
      path: '/api/control-plane/mode',
      bearerToken: opTok,
      requestedMode: 'ACTIVE',
    }).code,
    'ERR_FORBIDDEN_ROLE'
  );
  assert.equal(
    engine.authorizeHttpRequest({
      method: 'POST',
      path: '/api/control-plane/permit',
      bearerToken: opTok,
    }).code,
    'ERR_FORBIDDEN_ROLE'
  );
  assert.equal(
    engine.authorizeHttpRequest({
      method: 'POST',
      path: '/api/control-plane/keys/rotate',
      bearerToken: opTok,
    }).code,
    'ERR_FORBIDDEN_ROLE'
  );
  assert.equal(
    engine.authorizeHttpRequest({
      method: 'POST',
      path: '/api/control-plane/permit',
      bearerToken: adminTok,
    }).allowed,
    true
  );

  // 3. Cross-workspace scope denied 403
  const scopeDeny = engine.authorizeHttpRequest({
    method: 'GET',
    path: '/api/control-plane/audit',
    bearerToken: wrongWsTok,
    requestedWorkspaceId: 'ws_alpha',
  });
  assert.equal(scopeDeny.status, 403);
  assert.equal(scopeDeny.code, 'ERR_WORKSPACE_SCOPE_MISMATCH');

  // 4. Cross-origin CSRF rejected 403
  const csrfDeny = engine.authorizeHttpRequest({
    method: 'POST',
    path: '/api/control-plane/mode',
    bearerToken: adminTok,
    origin: 'https://attacker.example',
    host: '127.0.0.1:3000',
  });
  assert.equal(csrfDeny.status, 403);
  assert.equal(csrfDeny.code, 'ERR_ORIGIN_MISMATCH');

  // 5. Anti-replay nonce rejects duplicate nonce 409
  const firstNonce = engine.authorizeHttpRequest({
    method: 'POST',
    path: '/api/control-plane/ingest',
    bearerToken: adminTok,
    nonce: 'nonce_unique_1',
  });
  assert.equal(firstNonce.allowed, true);
  const replayNonce = engine.authorizeHttpRequest({
    method: 'POST',
    path: '/api/control-plane/ingest',
    bearerToken: adminTok,
    nonce: 'nonce_unique_1',
  });
  assert.equal(replayNonce.status, 409);
  assert.equal(replayNonce.code, 'ERR_REPLAY_NONCE');

  // 6. Expired session token rejected 401
  const expiredTok = engine.issueSessionToken({ role: 'admin', ttlMs: 100 }).token;
  const expiredRes = engine.authorizeHttpRequest({
    method: 'POST',
    path: '/api/control-plane/permit',
    bearerToken: expiredTok,
    now: Date.now() + 60_000,
  });
  assert.equal(expiredRes.status, 401);
  assert.equal(expiredRes.code, 'ERR_SESSION_EXPIRED');
});

test('FIV-003 & §4 Branches: Idempotent transactions, 409 payload conflict, durable recovery stale-overwrite guard, epoch/fence/expiration rejections', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-fiv003-'));
  try {
    const engine = createAuthoritativeControlPlaneEngine({
      initialActive: true,
      stateDir: tmpDir,
    });
    const st = engine.getPublicState();
    const permit = st.state.activePermit!;
    const files = makeFiles();

    // Idempotent transaction replay returns same receipt without error
    const tx1 = engine.authorizeIngestionCommit({
      transactionId: 'tx_idem_1',
      permitId: permit.permitId,
      uploadedFiles: files,
    });
    assert.equal(tx1.ok, true);
    const tx1Replay = engine.authorizeIngestionCommit({
      transactionId: 'tx_idem_1',
      permitId: permit.permitId,
      uploadedFiles: files,
    });
    assert.equal(tx1Replay.ok, true);
    if (tx1.ok && tx1Replay.ok) {
      assert.equal(tx1Replay.idempotentReplay, true);
      assert.equal(tx1Replay.receipt.receiptId, tx1.receipt.receiptId);
    }

    // Same transactionId with mutated content returns 409 ERR_IDEMPOTENCY_CONFLICT
    const conflict = engine.authorizeIngestionCommit({
      transactionId: 'tx_idem_1',
      permitId: permit.permitId,
      uploadedFiles: [{ ...files[0], content: 'export const tampered = true;' }],
    });
    assert.equal(conflict.ok, false);
    assert.equal(conflict.status, 409);
    assert.equal(conflict.code, 'ERR_IDEMPOTENCY_CONFLICT');

    // Stale epoch & stale fencing rejections
    const staleEpoch = engine.authorizeOperation({
      permitId: permit.permitId,
      scope: 'workspace_commit',
      clientEpoch: permit.epoch + 99,
    });
    assert.equal(staleEpoch.authorized, false);
    assert.equal(staleEpoch.check.code, 'ERR_IAM_STALE_EPOCH');

    const staleFence = engine.authorizeOperation({
      permitId: permit.permitId,
      scope: 'workspace_commit',
      clientFencingVersion: 0,
    });
    assert.equal(staleFence.authorized, false);
    assert.equal(staleFence.check.code, 'ERR_IAM_STALE_FENCE');

    // Permit expiration rejection
    const expiredCheck = engine.authorizeOperation({
      permitId: permit.permitId,
      scope: 'workspace_commit',
      now: permit.expiresAt + 5000,
    });
    assert.equal(expiredCheck.authorized, false);
    assert.equal(expiredCheck.check.code, 'ERR_IAM_EXPIRED');

    // Durable recovery queue survives restart & blocks stale hash overwrite (409)
    const q1 = engine.updateRecoveryQueue(['src/app.ts'], {
      transactionId: 'tx_rec_1',
      expectedFileHashes: { 'src/app.ts': 'hash_old_v1' },
      action: 'queue',
      error: 'EIO disk busy',
    });
    assert.equal(q1.ok, true);

    const engineRestarted = createAuthoritativeControlPlaneEngine({
      initialActive: true,
      stateDir: tmpDir,
    });
    assert.deepEqual(engineRestarted.getPublicState().recoveryQueuePaths, ['src/app.ts']);

    const staleRetry = engineRestarted.updateRecoveryQueue(['src/app.ts'], {
      transactionId: 'tx_rec_1',
      expectedFileHashes: { 'src/app.ts': 'hash_old_v1' },
      currentFileHashes: { 'src/app.ts': 'hash_newer_v2' },
      action: 'retry_succeeded',
    });
    assert.equal(staleRetry.ok, false);
    assert.equal(staleRetry.status, 409);
    assert.equal(staleRetry.code, 'ERR_STALE_RECOVERY_OVERWRITE');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('FIV-005 & FIV-006: Explicit verification claim taxonomy and signed audit checkpoint truncation/rollback detection', () => {
  const engine = createAuthoritativeControlPlaneEngine({ initialActive: true });
  const files = makeFiles();

  // Clean TS + JSON -> claimLevel = policy_checked, testsExecuted = false, signed receipt
  const cleanReport = engine.verifyUploadedFilesWatchMode({
    commitHash: 'a'.repeat(64),
    files,
  });
  assert.equal(cleanReport.claimLevel, 'policy_checked');
  assert.equal(cleanReport.testsExecuted, false);
  assert.equal(cleanReport.independentlyVerified, false);

  // Advisory inline <script> -> syntax_checked (not policy_checked)
  const htmlAdvisory = engine.verifyUploadedFilesWatchMode({
    commitHash: 'b'.repeat(64),
    files: [
      {
        name: 'index.html',
        path: 'index.html',
        language: 'html',
        content: '<html><body><script>alert(1)</script></body></html>',
        lastModified: 1000,
      },
    ],
  });
  assert.equal(htmlAdvisory.allPassed, true);
  assert.equal(htmlAdvisory.claimLevel, 'syntax_checked');

  // Failed syntax -> claimLevel = untested
  const broken = engine.verifyUploadedFilesWatchMode({
    commitHash: 'c'.repeat(64),
    files: [{ ...files[0], content: 'export const x = (' }],
  });
  assert.equal(broken.allPassed, false);
  assert.equal(broken.claimLevel, 'untested');

  // Checkpoint truncation & rollback detection
  const snap = engine.getAuditSnapshot();
  const chronological = snap.entries.slice().reverse();
  const latestCp = snap.latestCheckpoint!;
  assert.equal(verifyAuditWithCheckpoint(chronological, latestCp, snap.publicKeysById).valid, true);

  // Attacker truncates last entry (valid shorter chain, violates signed checkpoint length)
  const truncated = chronological.slice(0, chronological.length - 1);
  const truncCheck = verifyAuditWithCheckpoint(truncated, latestCp, snap.publicKeysById);
  assert.equal(truncCheck.valid, false);
  assert.equal(truncCheck.truncationDetected, true);
  assert.equal(truncCheck.rollbackDetected, true);

  // Attacker tampers tip hash at checkpoint position
  const forked = chronological.map((e, idx) =>
    idx === chronological.length - 1 ? { ...e, hash: '0'.repeat(64) } : e
  );
  const forkCheck = verifyAuditWithCheckpoint(forked, latestCp, snap.publicKeysById);
  assert.equal(forkCheck.valid, false);
});
