import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  computeArtifactBundleDigest,
  computeClientBindingsDigest,
  validateControlPlaneDeploymentReceipt,
  verifyCloudflareShipmentWithControlPlane,
  type ControlPlanePublicKeyring,
} from './clientEd25519Verifier';
import { createDeploymentOrchestrator } from './deploymentOrchestrator';
import {
  INITIAL_CLOUDFLARE_ACCOUNT,
  INITIAL_CLOUDFLARE_BINDINGS,
  getHonoFullstackInitialFiles,
} from './sandboxEngine';
import { createAuthoritativeControlPlaneEngine } from './serverControlPlane';
import { canonicalize } from './contractRegistry';

function makeTmpDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('Client-Side Control Plane Ed25519 Deployment Receipt Verifier', () => {
  it('validates real Control Plane Ed25519 receipts across Cloudflare files, configs, and bindings via WebCrypto', async () => {
    const tmpDir = makeTmpDir('client-ed25519-');
    try {
      const cp = createAuthoritativeControlPlaneEngine({
        initialActive: true,
        stateDir: tmpDir,
        workspaceId: 'ws_unified_one',
      });
      const permitRes = cp.issuePermit({
        subject: 'human:mercy',
        scopes: ['workspace_ingest', 'workspace_commit', 'device_sync'],
      });
      expect(permitRes.ok).toBe(true);

      const orchestrator = createDeploymentOrchestrator({
        controlPlane: cp,
        stateDir: tmpDir,
      });
      const files = getHonoFullstackInitialFiles();

      const shipped = orchestrator.shipVerifiedDeployment({
        permitId: permitRes.permit!.permitId,
        projectName: 'LiquidOS Hono',
        channel: 'cloudflare',
        files,
        cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
        cloudflareConfig: INITIAL_CLOUDFLARE_ACCOUNT,
        workspaceId: 'ws_unified_one',
      });
      expect(shipped.ok).toBe(true);
      if (!shipped.ok) return;

      // Client-computed bindings digest matches server bindings digest bit-for-bit
      const clientBindingsDigest = computeClientBindingsDigest({
        channel: 'cloudflare',
        projectName: 'LiquidOS Hono',
        files,
        cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
        cloudflareConfig: INITIAL_CLOUDFLARE_ACCOUNT,
      });
      expect(clientBindingsDigest).toBe(shipped.bindingsDigest);

      const keyring = cp.getPublicKeysSnapshot();
      const result = await verifyCloudflareShipmentWithControlPlane({
        receipt: shipped.receipt,
        files,
        cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
        cloudflareConfig: INITIAL_CLOUDFLARE_ACCOUNT,
        projectName: 'LiquidOS Hono',
        channel: 'cloudflare',
        workspaceId: 'ws_unified_one',
        fetchImpl: async () =>
          new Response(JSON.stringify(keyring), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      });

      expect(result.verified).toBe(true);
      expect(result.code).toBe('CLIENT_ED25519_VERIFIED');
      expect(result.keyId).toBe(shipped.receipt.keyId);
      expect(result.computedTreeDigest).toBe(shipped.treeDigest);
      expect(result.computedBindingsDigest).toBe(shipped.bindingsDigest);
      expect(result.verifiedKeyTransitionChain).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('verifies receipts signed after Control Plane Ed25519 key rotation and validates transition chain', async () => {
    const tmpDir = makeTmpDir('client-ed25519-rotate-');
    try {
      const cp = createAuthoritativeControlPlaneEngine({
        initialActive: true,
        stateDir: tmpDir,
        workspaceId: 'ws_unified_one',
      });
      const permitRes = cp.issuePermit({
        subject: 'human:mercy',
        scopes: ['workspace_commit'],
      });
      const rotated = cp.rotateSigningKey('human:mercy');
      expect(rotated.ok).toBe(true);

      const orchestrator = createDeploymentOrchestrator({
        controlPlane: cp,
        stateDir: tmpDir,
      });
      const files = getHonoFullstackInitialFiles();
      const shipped = orchestrator.shipVerifiedDeployment({
        permitId: permitRes.permit!.permitId,
        projectName: 'LiquidOS Rotated',
        channel: 'cloudflare',
        files,
        cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
        cloudflareConfig: INITIAL_CLOUDFLARE_ACCOUNT,
        workspaceId: 'ws_unified_one',
      });
      expect(shipped.ok).toBe(true);
      if (!shipped.ok) return;

      expect(shipped.receipt.keyId).toBe(rotated.activeKeyId);

      const keyring = cp.getPublicKeysSnapshot();
      const verified = await validateControlPlaneDeploymentReceipt({
        receipt: shipped.receipt,
        keyring,
        files,
        cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
        cloudflareConfig: INITIAL_CLOUDFLARE_ACCOUNT,
        expectedProjectName: 'LiquidOS Rotated',
        expectedChannel: 'cloudflare',
        expectedWorkspaceId: 'ws_unified_one',
      });

      expect(verified.verified).toBe(true);
      expect(verified.verifiedKeyTransitionChain).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('fails closed on missing receipts, tampered signatures, untrusted keys, config/file drift, and binary mismatches', async () => {
    const tmpDir = makeTmpDir('client-ed25519-fail-');
    try {
      const cp = createAuthoritativeControlPlaneEngine({
        initialActive: true,
        stateDir: tmpDir,
        workspaceId: 'ws_unified_one',
      });
      const permitRes = cp.issuePermit({
        subject: 'human:mercy',
        scopes: ['workspace_commit'],
      });
      const orchestrator = createDeploymentOrchestrator({
        controlPlane: cp,
        stateDir: tmpDir,
      });
      const files = getHonoFullstackInitialFiles();

      const shipped = orchestrator.shipVerifiedDeployment({
        permitId: permitRes.permit!.permitId,
        projectName: 'LiquidOS Hono',
        channel: 'cloudflare',
        files,
        cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
        cloudflareConfig: INITIAL_CLOUDFLARE_ACCOUNT,
        workspaceId: 'ws_unified_one',
      });
      expect(shipped.ok).toBe(true);
      if (!shipped.ok) return;

      const keyring = cp.getPublicKeysSnapshot();

      // 1. Missing receipt
      const missingRes = await validateControlPlaneDeploymentReceipt({
        receipt: null,
        keyring,
        files,
        expectedProjectName: 'LiquidOS Hono',
        expectedChannel: 'cloudflare',
      });
      expect(missingRes.verified).toBe(false);
      expect(missingRes.code).toBe('ERR_MISSING_RECEIPT');

      // 2. Tampered Ed25519 signature
      const tamperedSigRes = await validateControlPlaneDeploymentReceipt({
        receipt: {
          ...shipped.receipt,
          signature: 'AAAA' + shipped.receipt.signature.slice(4),
        },
        keyring,
        files,
        cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
        expectedProjectName: 'LiquidOS Hono',
        expectedChannel: 'cloudflare',
      });
      expect(tamperedSigRes.verified).toBe(false);
      expect(tamperedSigRes.code).toBe('ERR_INVALID_ED25519_SIGNATURE');

      // 3. Untrusted / unknown signer keyId
      const unknownKeyRes = await validateControlPlaneDeploymentReceipt({
        receipt: {
          ...shipped.receipt,
          keyId: 'key_attacker_spoofed',
        },
        keyring,
        files,
        cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
        expectedProjectName: 'LiquidOS Hono',
        expectedChannel: 'cloudflare',
      });
      expect(unknownKeyRes.verified).toBe(false);
      expect(unknownKeyRes.code).toBe('ERR_UNTRUSTED_KEY_ID');

      // 4. Modified wrangler.jsonc or source file after signing
      const driftedFiles = files.map((f) =>
        f.path === 'wrangler.jsonc' ? { ...f, content: f.content + '\n// drift' } : f
      );
      const treeDriftRes = await validateControlPlaneDeploymentReceipt({
        receipt: shipped.receipt,
        keyring,
        files: driftedFiles,
        cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
        expectedProjectName: 'LiquidOS Hono',
        expectedChannel: 'cloudflare',
      });
      expect(treeDriftRes.verified).toBe(false);
      expect(treeDriftRes.code).toBe('ERR_TREE_DIGEST_MISMATCH');

      // 5. Modified Cloudflare D1/KV/R2 bindings after signing
      const bindingsDriftRes = await validateControlPlaneDeploymentReceipt({
        receipt: shipped.receipt,
        keyring,
        files,
        cloudflareBindings: {
          ...INITIAL_CLOUDFLARE_BINDINGS,
          d1Databases: [{ name: 'DB_PROD', id: 'd1-rogue-db', tables: [] }],
        },
        expectedProjectName: 'LiquidOS Hono',
        expectedChannel: 'cloudflare',
      });
      expect(bindingsDriftRes.verified).toBe(false);
      expect(bindingsDriftRes.code).toBe('ERR_BINDINGS_DIGEST_MISMATCH');

      // 6. Channel mismatch
      const channelMismatchRes = await validateControlPlaneDeploymentReceipt({
        receipt: shipped.receipt,
        keyring,
        files,
        cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
        expectedProjectName: 'LiquidOS Hono',
        expectedChannel: 'edge',
      });
      expect(channelMismatchRes.verified).toBe(false);
      expect(channelMismatchRes.code).toBe('ERR_CHANNEL_MISMATCH');

      // 7. Keyring fetch failure fails closed
      const unreachableRes = await verifyCloudflareShipmentWithControlPlane({
        receipt: shipped.receipt,
        files,
        cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
        projectName: 'LiquidOS Hono',
        channel: 'cloudflare',
        fetchImpl: async () => new Response('down', { status: 503 }),
      });
      expect(unreachableRes.verified).toBe(false);
      expect(unreachableRes.code).toBe('ERR_CONTROL_PLANE_KEYRING_UNREACHABLE');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('verifies binary artifact SHA-256 digests and rejects altered Worker binaries', async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const keyId = 'key_binary_test';
    const keyring: ControlPlanePublicKeyring = {
      activeKeyId: keyId,
      publicKeyPem: pubPem,
      publicKeysById: { [keyId]: pubPem },
      keyTransitions: [],
    };

    const files = getHonoFullstackInitialFiles();
    const workerWasm = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
    const bundle = await computeArtifactBundleDigest(files, [
      { path: 'dist/worker.wasm', bytes: workerWasm },
    ]);
    const bindingsDigest = computeClientBindingsDigest({
      channel: 'cloudflare',
      projectName: 'LiquidOS Binary',
      files,
      cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
      cloudflareConfig: INITIAL_CLOUDFLARE_ACCOUNT,
    });

    const payload = canonicalize({
      contract: 'AN-EVC-001',
      action: 'deployment_release_attestation',
      projectName: 'LiquidOS Binary',
      channel: 'cloudflare',
      workspaceId: 'ws_unified_one',
      treeDigest: bundle.treeDigest,
      binaryDigests: bundle.binaryDigests,
      bindingsDigest,
    });
    const signature = crypto
      .sign(null, Buffer.from(payload, 'utf8'), privateKey)
      .toString('base64');

    const receipt = {
      receiptId: 'rcpt_bin_1',
      keyId,
      action: 'deployment_release_attestation',
      canonicalPayload: payload,
      signature,
      publicKeyPem: pubPem,
      algorithm: 'Ed25519' as const,
      linearizationSeq: 1,
    };

    const okRes = await validateControlPlaneDeploymentReceipt({
      receipt,
      keyring,
      files,
      binaryArtifacts: [{ path: 'dist/worker.wasm', bytes: workerWasm }],
      cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
      cloudflareConfig: INITIAL_CLOUDFLARE_ACCOUNT,
      expectedProjectName: 'LiquidOS Binary',
      expectedChannel: 'cloudflare',
      expectedWorkspaceId: 'ws_unified_one',
    });
    expect(okRes.verified).toBe(true);
    expect(okRes.artifactCount).toBe(files.length + 1);

    // Mutate 1 byte of the WASM binary
    const tamperedWasm = new Uint8Array(workerWasm);
    tamperedWasm[7] = 0xff;
    const tamperedRes = await validateControlPlaneDeploymentReceipt({
      receipt,
      keyring,
      files,
      binaryArtifacts: [{ path: 'dist/worker.wasm', bytes: tamperedWasm }],
      cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
      cloudflareConfig: INITIAL_CLOUDFLARE_ACCOUNT,
      expectedProjectName: 'LiquidOS Binary',
      expectedChannel: 'cloudflare',
      expectedWorkspaceId: 'ws_unified_one',
    });
    expect(tamperedRes.verified).toBe(false);
    expect(tamperedRes.code).toBe('ERR_ARTIFACT_DIGEST_MISMATCH');
  });

  it('pre-ship ed25519Validator blocks tampered preflight receipts before any cloud deploy request is dispatched', async () => {
    const tmpDir = makeTmpDir('client-ed25519-preship-');
    try {
      const cp = createAuthoritativeControlPlaneEngine({
        initialActive: true,
        stateDir: tmpDir,
        workspaceId: 'ws_unified_one',
      });
      const permitRes = cp.issuePermit({
        subject: 'human:mercy',
        scopes: ['workspace_commit'],
      });
      const orchestrator = createDeploymentOrchestrator({
        controlPlane: cp,
        stateDir: tmpDir,
      });
      const files = getHonoFullstackInitialFiles();
      const preflight = orchestrator.runPreflight({
        permitId: permitRes.permit!.permitId,
        projectName: 'LiquidOS PreShip',
        channel: 'cloudflare',
        files,
        cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
        cloudflareConfig: INITIAL_CLOUDFLARE_ACCOUNT,
        workspaceId: 'ws_unified_one',
      });
      expect(preflight.ok).toBe(true);
      expect(preflight.receipt).toBeDefined();

      const keyring = cp.getPublicKeysSnapshot();
      const cloudEndpointCalls: string[] = [];
      const { ed25519Validator } = await import('./clientEd25519Verifier');

      const tamperedPreflightReceipt = {
        ...preflight.receipt!,
        signature: 'ZZZZ' + preflight.receipt!.signature.slice(4),
      };

      const gatedFetch: typeof fetch = async (input) => {
        const url = String(input);
        if (url.includes('/api/cloudflare/deploy')) {
          cloudEndpointCalls.push(url);
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        return new Response(JSON.stringify(keyring), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      const check = await ed25519Validator.verifyShipment({
        receipt: tamperedPreflightReceipt,
        files,
        cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
        cloudflareConfig: INITIAL_CLOUDFLARE_ACCOUNT,
        projectName: 'LiquidOS PreShip',
        channel: 'cloudflare',
        workspaceId: 'ws_unified_one',
        expectedBindingsDigest: preflight.bindingsDigest,
        fetchImpl: gatedFetch,
      });

      expect(check.verified).toBe(false);
      expect(check.code).toBe('ERR_INVALID_ED25519_SIGNATURE');
      // Cloud endpoint must remain untouched when pre-ship validation aborts
      expect(cloudEndpointCalls).toHaveLength(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
