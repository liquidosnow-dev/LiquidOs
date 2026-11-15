import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  authorizeProtectedOperation,
  createUninitializedControlPlaneState,
  issueIngestionPermit,
  syncFilesToDeviceWithRecovery,
  transitionGlobalMode,
  validateUploadedSnapshot,
} from './ingestionControlPlane';
import { createCommit, verifyCommitIntegrity } from './versionControl';
import { Project, ProjectFile } from '../types';

function makeFiles(): ProjectFile[] {
  return [
    {
      name: 'a.ts',
      path: 'src/a.ts',
      language: 'typescript',
      content: 'export const a = 1;\n',
      lastModified: 1000,
    },
    {
      name: 'b.json',
      path: 'schemas/b.json',
      language: 'json',
      content: '{"ok":true}\n',
      lastModified: 1000,
    },
    {
      name: 'c.ts',
      path: 'src/c.ts',
      language: 'typescript',
      content: 'export const c = 3;\n',
      lastModified: 1000,
    },
  ];
}

test('ING-08 & ING-09: GLOBAL-MODE-001 fails closed on uninitialized state, revokes permits on LOCKDOWN, never revives on ACTIVE, and rejects stale epochs/fencing/scopes', () => {
  const uninit = createUninitializedControlPlaneState();
  const uninitAuth = authorizeProtectedOperation(uninit, null, 'workspace_commit');
  assert.equal(uninitAuth.authorized, false);
  assert.equal(uninitAuth.code, 'ERR_GLOBAL_MODE_UNINITIALIZED');

  const active = transitionGlobalMode(uninit, 'ACTIVE', 'Boot active session', 1000);
  // Active without a permit still fails closed under IAM-001
  assert.equal(authorizeProtectedOperation(active, null, 'workspace_commit', 1001).code, 'ERR_IAM_NO_PERMIT');

  const { state: withPermit, permit } = issueIngestionPermit(active, {
    subject: 'human:mercy',
    scopes: ['workspace_ingest', 'workspace_commit'],
    ttlMs: 60_000,
    now: 2000,
  });

  // Authorized for granted scope, denied for ungranted device_sync scope (MCP-001 / no self-elevation)
  assert.equal(authorizeProtectedOperation(withPermit, permit, 'workspace_commit', 2100).authorized, true);
  assert.equal(authorizeProtectedOperation(withPermit, permit, 'device_sync', 2100).code, 'ERR_MCP_SCOPE_DENIED');

  // Expired permit rejected
  assert.equal(authorizeProtectedOperation(withPermit, permit, 'workspace_commit', 70_000).code, 'ERR_IAM_EXPIRED');

  // LOCKDOWN revokes permit immediately
  const lockdown = transitionGlobalMode(withPermit, 'LOCKDOWN', 'Incident containment', 3000);
  assert.equal(lockdown.activePermit, null);
  assert.equal(authorizeProtectedOperation(lockdown, permit, 'workspace_commit', 3100).code, 'ERR_GLOBAL_MODE_LOCKDOWN');

  // Returning to ACTIVE must NEVER revive previously revoked permit!
  const resumed = transitionGlobalMode(lockdown, 'ACTIVE', 'Containment cleared', 4000);
  assert.equal(resumed.activePermit, null);
  const replayResumed = authorizeProtectedOperation(resumed, permit, 'workspace_commit', 4100);
  assert.equal(replayResumed.authorized, false);
  assert.equal(replayResumed.code, 'ERR_IAM_PERMIT_REVOKED');

  // Fresh permit after resuming ACTIVE succeeds with bumped epoch & fence
  const { state: reissued, permit: freshPermit } = issueIngestionPermit(resumed, { now: 4200 });
  assert.ok(freshPermit.epoch > permit.epoch);
  assert.ok(freshPermit.fencingVersion > permit.fencingVersion);
  assert.equal(authorizeProtectedOperation(reissued, freshPermit, 'device_sync', 4250).authorized, true);

  // Tampered digest rejected
  const tampered = { ...freshPermit, scopes: [...freshPermit.scopes] };
  tampered.digest = '0'.repeat(64);
  assert.equal(authorizeProtectedOperation(reissued, tampered, 'device_sync', 4250).code, 'ERR_IAM_DIGEST_MISMATCH');
});

test('ING-07 & ING-10: validateUploadedSnapshot validates every uploaded file with untrusted provenance and commit SHA-256 hashes detect tampering', () => {
  const uploaded = makeFiles();
  const report = validateUploadedSnapshot(uploaded, uploaded);

  assert.equal(report.valid, true);
  assert.equal(report.uploadedCount, 3);
  assert.equal(report.fileResults.length, 3);
  assert.ok(report.fileResults.every((r) => /^[a-f0-9]{64}$/.test(r.sha256) && r.claimStatus === 'untested'));
  assert.equal(report.evidenceEnvelope.claimStatus, 'untested');
  assert.equal(report.evidenceEnvelope.trustSource, 'external_user_drop');

  // Unsafe path in snapshot fails all-file validation
  const badUpload: ProjectFile[] = [
    ...uploaded,
    { name: 'evil.ts', path: '../evil.ts', language: 'typescript', content: 'bad', lastModified: 1000 },
  ];
  const badReport = validateUploadedSnapshot(badUpload, badUpload);
  assert.equal(badReport.valid, false);
  assert.match(badReport.errors[0], /traversal/i);

  // Commit SHA-256 verification & tamper detection (ING-10)
  const proj: Project = {
    id: 'p1',
    name: 'Test',
    description: '',
    currentBranch: 'main',
    branches: { main: { name: 'main', currentCommitId: '' } },
    commits: [],
    files: uploaded,
    createdAt: 1000,
    updatedAt: 1000,
  };
  const { commit } = createCommit(proj, 'Ingest 3 files', 'Mercy (User)', {
    source: 'external_drop',
    claimStatus: 'untested',
    authorizationPermitId: 'perm_test',
    epoch: 1,
    fencingVersion: 2,
  });

  assert.equal(commit.hash.length, 64);
  assert.equal(verifyCommitIntegrity(commit).valid, true);
  assert.equal(commit.provenance?.claimStatus, 'untested');

  // Tamper file content in commit without updating hash -> detected
  const tamperedCommit = {
    ...commit,
    files: commit.files.map((f, idx) => (idx === 0 ? { ...f, content: 'tampered!' } : f)),
  };
  assert.equal(verifyCommitIntegrity(tamperedCommit).valid, false);
});

test('ING-06 & ING-11: syncFilesToDeviceWithRecovery records partial write failures and halts mid-flight on LOCKDOWN cancellation', async () => {
  const active = transitionGlobalMode(createUninitializedControlPlaneState(), 'ACTIVE', 'init', 1000);
  const { state: readyState, permit } = issueIngestionPermit(active, { now: 1000 });
  const files = makeFiles();

  // Case 1: Partial failure when 2nd file throws permission/I/O fault
  const partialHandle: any = {
    name: 'mock-host-dir',
    async getDirectoryHandle(name: string) {
      return {
        async getFileHandle(fname: string) {
          if (fname === 'b.json') {
            throw new Error('EACCES: read-only destination');
          }
          return {
            async createWritable() {
              return { async write() {}, async close() {} };
            },
          };
        },
        async getDirectoryHandle(sub: string) {
          return partialHandle.getDirectoryHandle(sub);
        },
      };
    },
  };

  const partialReport = await syncFilesToDeviceWithRecovery(partialHandle, files, {
    getControlState: () => readyState,
    getPermit: () => permit,
    now: () => 1100,
  });
  assert.equal(partialReport.status, 'PARTIAL_FAILURE');
  assert.deepEqual(partialReport.writtenPaths, ['src/a.ts', 'src/c.ts']);
  assert.equal(partialReport.failedFiles.length, 1);
  assert.equal(partialReport.failedFiles[0].path, 'schemas/b.json');

  // Case 2: Mid-flight LOCKDOWN aborts remaining files after 1st file completes
  let currentState = readyState;
  const controller = new AbortController();
  const lockdownHandle: any = {
    name: 'mock-host-dir',
    async getDirectoryHandle() {
      return {
        async getFileHandle() {
          return {
            async createWritable() {
              return {
                async write() {},
                async close() {
                  // Simulate LOCKDOWN firing immediately after first file write
                  currentState = transitionGlobalMode(currentState, 'LOCKDOWN', 'Mid-flight lockdown', 1200);
                  controller.abort('GLOBAL_MODE_LOCKDOWN');
                },
              };
            },
          };
        },
      };
    },
  };

  const abortReport = await syncFilesToDeviceWithRecovery(lockdownHandle, files, {
    getControlState: () => currentState,
    getPermit: () => currentState.activePermit,
    signal: controller.signal,
    now: () => 1250,
  });
  assert.equal(abortReport.status, 'ABORTED_LOCKDOWN');
  assert.deepEqual(abortReport.writtenPaths, ['src/a.ts']);
  assert.deepEqual(abortReport.abortedPaths, ['schemas/b.json', 'src/c.ts']);
});

import {
  executeAtomicIngestionTransaction,
} from './ingestionControlPlane';
import {
  createAuthoritativeControlPlaneEngine,
  verifyEd25519Receipt,
} from './serverControlPlane';

test('ING-05 & ING-06 Fault-Injection: atomic commit rollback on commit/publish faults and recovery queue persistence failure reporting', async () => {
  const active = transitionGlobalMode(createUninitializedControlPlaneState(), 'ACTIVE', 'init');
  const { state: readyState, permit } = issueIngestionPermit(active);
  const files = makeFiles();

  const initialProj: Project = {
    id: 'p_atomic',
    name: 'Atomic Test',
    description: '',
    currentBranch: 'main',
    branches: { main: { name: 'main', currentCommitId: '' } },
    commits: [],
    files: [files[0]],
    createdAt: 1000,
    updatedAt: 1000,
  };
  const { project: baseProj, commit: genesisCommit } = createCommit(initialProj, 'genesis', 'Mercy');

  // 1. Fault injected before commit completes -> project unchanged, rollback logged
  const faultCommitOutcome = await executeAtomicIngestionTransaction({
    project: baseProj,
    uploadedFiles: [files[1]],
    getControlState: () => readyState,
    getPermit: () => permit,
    auditLedger: [],
    beforeCommitStep: () => {
      throw new Error('Disk quota exhausted during commit hashing');
    },
  });
  assert.equal(faultCommitOutcome.ok, false);
  assert.equal(faultCommitOutcome.stage, 'commit_creation');
  assert.equal(faultCommitOutcome.project.commits.length, 1);
  assert.equal(faultCommitOutcome.project.files.length, 1);
  assert.equal(faultCommitOutcome.project.branches.main.currentCommitId, genesisCommit.id);
  assert.ok(faultCommitOutcome.auditLedger.some((e) => e.action === 'workspace_commit_failed'));

  // 2. Fault injected in publishProject -> project remains pre-upload state
  const faultPublishOutcome = await executeAtomicIngestionTransaction({
    project: baseProj,
    uploadedFiles: [files[1]],
    getControlState: () => readyState,
    getPermit: () => permit,
    auditLedger: [],
    publishProject: () => {
      throw new Error('Publication channel disconnected');
    },
  });
  assert.equal(faultPublishOutcome.ok, false);
  assert.equal(faultPublishOutcome.project.commits.length, 1);

  // 3. Device partial failure + recovery queue persistence failure -> explicitly flagged
  const failingDevice: any = {
    name: 'host-dir',
    async getDirectoryHandle() {
      return failingDevice;
    },
    async getFileHandle(name: string) {
      if (name === 'c.ts') throw new Error('EIO: I/O device error');
      return {
        async createWritable() {
          return { async write() {}, async close() {} };
        },
      };
    },
  };

  const partialWithPersistFault = await executeAtomicIngestionTransaction({
    project: baseProj,
    uploadedFiles: [files[1], files[2]],
    getControlState: () => readyState,
    getPermit: () => permit,
    auditLedger: [],
    deviceHandle: failingDevice,
    autoSyncDevice: true,
    persistRecoveryQueue: () => ({ ok: false, error: 'IndexedDB/localStorage quota full' }),
  });

  assert.equal(partialWithPersistFault.ok, true);
  assert.equal(partialWithPersistFault.syncReport?.status, 'PARTIAL_FAILURE');
  assert.deepEqual(partialWithPersistFault.pendingRecoveryPaths, ['src/c.ts']);
  assert.equal(partialWithPersistFault.recoveryPersisted, false);
  assert.ok(
    partialWithPersistFault.auditLedger.some((e) => e.action === 'recovery_queue_persistence_failed')
  );
});

test('ING-11 Concurrency Race: async LOCKDOWN during delayed in-flight multi-file sync stops subsequent writes without post-lockdown close', async () => {
  const active = transitionGlobalMode(createUninitializedControlPlaneState(), 'ACTIVE', 'init');
  let sharedState = issueIngestionPermit(active).state;
  const controller = new AbortController();
  const committedOnDisk: string[] = [];

  const slowDeviceHandle: any = {
    name: 'slow-host-dir',
    async getDirectoryHandle() {
      return slowDeviceHandle;
    },
    async getFileHandle(fname: string) {
      await new Promise((r) => setTimeout(r, 15));
      return {
        async createWritable() {
          let buf = '';
          let streamAborted = false;
          return {
            async write(chunk: string) {
              await new Promise((r) => setTimeout(r, 35));
              buf = chunk;
            },
            async close() {
              if (!streamAborted && buf.length >= 0) {
                committedOnDisk.push(fname);
              }
            },
            async abort() {
              streamAborted = true;
            },
          };
        },
      };
    },
  };

  const files = makeFiles();
  const syncPromise = syncFilesToDeviceWithRecovery(slowDeviceHandle, files, {
    getControlState: () => sharedState,
    getPermit: () => sharedState.activePermit,
    signal: controller.signal,
  });

  const lockdownPromise = (async () => {
    await new Promise((r) => setTimeout(r, 20));
    sharedState = transitionGlobalMode(sharedState, 'LOCKDOWN', 'Concurrent operator kill-switch');
    controller.abort('GLOBAL-MODE-001_LOCKDOWN');
  })();

  const [report] = await Promise.all([syncPromise, lockdownPromise]);
  assert.equal(report.status, 'ABORTED_LOCKDOWN');
  assert.equal(committedOnDisk.length, 0);
  assert.deepEqual(report.writtenPaths, []);
  assert.equal(report.abortedPaths.length, 3);
});

test('Server-Side Control Plane & Ed25519 Custody: fail-closed boot, server-enforced permit/epoch,Watch Mode esbuild+JSON verification', () => {
  // 1. Fail-closed uninitialized boot refuses operations
  const uninitEngine = createAuthoritativeControlPlaneEngine({ initialActive: false });
  assert.equal(uninitEngine.getPublicState().state.mode, 'UNINITIALIZED');
  assert.equal(
    uninitEngine.authorizeOperation({ permitId: 'forged', scope: 'workspace_commit' }).authorized,
    false
  );

  // 2. Active server engine keeps Ed25519 private key inside closure & exports verifiable publicKeyPem
  const engine = createAuthoritativeControlPlaneEngine({ initialActive: true });
  const bootPublic = engine.getPublicState();
  assert.equal(bootPublic.state.mode, 'ACTIVE');
  assert.ok(bootPublic.publicKeyPem.includes('BEGIN PUBLIC KEY'));
  assert.equal((bootPublic as any).privateKey, undefined);

  const initialPermit = bootPublic.state.activePermit!;
  assert.ok(initialPermit.serverSignature && initialPermit.serverSignature.length > 20);

  // Forged permit ID rejected server-side even with matching epoch claim
  const forged = engine.authorizeOperation({
    permitId: 'perm_forged_client',
    scope: 'workspace_commit',
    clientEpoch: bootPublic.state.epoch,
  });
  assert.equal(forged.authorized, false);
  assert.equal(forged.status, 403);

  // Valid upload authorization issues Ed25519-signed AN-EVC-001 receipt with untested claimStatus
  const files = makeFiles();
  const ingestAuth = engine.authorizeIngestionCommit({
    permitId: initialPermit.permitId,
    uploadedFiles: [files[0], files[1]],
    expectedEpoch: bootPublic.state.epoch,
  });
  assert.equal(ingestAuth.ok, true);
  if (ingestAuth.ok) {
    assert.equal(
      verifyEd25519Receipt(
        bootPublic.publicKeyPem,
        ingestAuth.receipt.canonicalPayload,
        ingestAuth.receipt.signature
      ),
      true
    );
    const parsedReceipt = JSON.parse(ingestAuth.receipt.canonicalPayload);
    assert.equal(parsedReceipt.claimStatus, 'untested');
    assert.equal(parsedReceipt.trustSource, 'external_user_drop');
    // Tampering signed payload invalidates Ed25519 verification
    assert.equal(
      verifyEd25519Receipt(
        bootPublic.publicKeyPem,
        ingestAuth.receipt.canonicalPayload.replace('untested', 'tested'),
        ingestAuth.receipt.signature
      ),
      false
    );
  }

  // Server rejects unsafe path even if client skips client-side check
  const serverPathReject = engine.authorizeIngestionCommit({
    permitId: initialPermit.permitId,
    uploadedFiles: [{ ...files[0], path: '../../etc/passwd' }],
  });
  assert.equal(serverPathReject.ok, false);
  assert.equal(serverPathReject.status, 400);

  // Watch Mode real verification passes clean TS+JSON, catches syntax errors & unsafe 2^53-1 JSON ints
  const watchOk = engine.verifyUploadedFilesWatchMode({
    commitHash: 'c'.repeat(64),
    files: [files[0], files[1]],
  });
  assert.equal(watchOk.allPassed, true);
  assert.equal(watchOk.claimStatus, 'tested');
  assert.equal(
    verifyEd25519Receipt(
      watchOk.serverReceipt!.publicKeyPem,
      watchOk.serverReceipt!.canonicalPayload,
      watchOk.serverReceipt!.signature
    ),
    true
  );

  const watchFail = engine.verifyUploadedFilesWatchMode({
    commitHash: 'd'.repeat(64),
    files: [
      { ...files[0], content: 'export const broken = (' },
      { ...files[1], content: '{"big": 9007199254740993}' },
    ],
  });
  assert.equal(watchFail.allPassed, false);
  assert.equal(watchFail.claimStatus, 'untested');
  assert.equal(watchFail.entries[0].passed, false);
  assert.equal(watchFail.entries[1].passed, false);

  // LOCKDOWN revokes permit permanently; returning to ACTIVE does NOT revive initialPermit
  engine.transitionMode('LOCKDOWN', 'Incident');
  assert.equal(engine.issuePermit().ok, false);
  engine.transitionMode('ACTIVE', 'Recovered');
  const replay = engine.authorizeOperation({
    permitId: initialPermit.permitId,
    scope: 'workspace_commit',
  });
  assert.equal(replay.authorized, false);
  assert.equal(replay.check.code, 'ERR_IAM_PERMIT_REVOKED');
  assert.equal(engine.getAuditSnapshot().integrity.checkpointVerification.valid, true);
});

test('FIV-004: Concurrent LOCKDOWN explicitly distinguishes already-committed files from aborted uncommitted writables', async () => {
  const active = transitionGlobalMode(createUninitializedControlPlaneState(), 'ACTIVE', 'init');
  let sharedState = issueIngestionPermit(active).state;
  const controller = new AbortController();
  const committedOnDisk: string[] = [];
  const abortedWritables: string[] = [];

  const stagedHandle: any = {
    name: 'host-dir',
    async getDirectoryHandle() {
      return stagedHandle;
    },
    async getFileHandle(fname: string) {
      return {
        async createWritable() {
          let buf = '';
          let aborted = false;
          return {
            async write(chunk: string) {
              buf = chunk;
              if (fname === 'b.json') {
                // Async LOCKDOWN fires after a.ts closed, while b.json is in-flight before close()!
                await new Promise((r) => setTimeout(r, 25));
              }
            },
            async close() {
              if (!aborted && buf.length >= 0) {
                committedOnDisk.push(fname);
              }
            },
            async abort() {
              aborted = true;
              abortedWritables.push(fname);
            },
          };
        },
      };
    },
  };

  const files = makeFiles();
  const syncPromise = syncFilesToDeviceWithRecovery(stagedHandle, files, {
    getControlState: () => sharedState,
    getPermit: () => sharedState.activePermit,
    signal: controller.signal,
  });

  const lockdownTimer = (async () => {
    await new Promise((r) => setTimeout(r, 10));
    sharedState = transitionGlobalMode(sharedState, 'LOCKDOWN', 'Mid-batch LOCKDOWN trigger');
    controller.abort('GLOBAL-MODE-001_LOCKDOWN');
  })();

  const [report] = await Promise.all([syncPromise, lockdownTimer]);
  assert.equal(report.status, 'ABORTED_LOCKDOWN');
  assert.deepEqual(committedOnDisk, ['a.ts']);
  assert.deepEqual(report.writtenPaths, ['src/a.ts']);
  assert.deepEqual(abortedWritables, ['b.json']);
  assert.deepEqual(report.abortedPaths, ['schemas/b.json', 'src/c.ts']);
});


