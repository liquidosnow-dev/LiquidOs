import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  createDeploymentOrchestrator,
  parseWranglerConfig,
  verifyHonoCloudflareServiceLink,
} from './deploymentOrchestrator';
import {
  INITIAL_CLOUDFLARE_ACCOUNT,
  INITIAL_CLOUDFLARE_BINDINGS,
  getHonoFullstackInitialFiles,
} from './sandboxEngine';
import {
  createAuthoritativeControlPlaneEngine,
  verifyEd25519Receipt,
} from './serverControlPlane';

function makeTmpDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('Hono/Cloudflare Service-to-Service & Ed25519 Deployment Orchestrator', () => {
  it('parses wrangler.jsonc safely and verifies D1/KV/R2 service-to-service bindings', () => {
    const files = getHonoFullstackInitialFiles();
    const wrangler = parseWranglerConfig(files);
    expect(wrangler.found).toBe(true);
    expect(wrangler.workerName).toBe('liquidos-hono-app');
    expect(wrangler.compatibilityFlags).toContain('nodejs_compat');

    const report = verifyHonoCloudflareServiceLink({
      channel: 'cloudflare',
      projectName: 'LiquidOS Hono',
      files,
      cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
      cloudflareConfig: INITIAL_CLOUDFLARE_ACCOUNT,
    });
    expect(report.ok).toBe(true);
    expect(report.honoEntryPresent).toBe(true);
    expect(report.checks.every((c) => c.ok)).toBe(true);
  });

  it('detects Cloudflare D1 binding drift, missing nodejs_compat, and missing Cloudflare auth before shipping', () => {
    const baseFiles = getHonoFullstackInitialFiles();

    // 1. Disconnected Cloudflare account / empty token
    const noTokenReport = verifyHonoCloudflareServiceLink({
      channel: 'cloudflare',
      projectName: 'LiquidOS Hono',
      files: baseFiles,
      cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
      cloudflareConfig: { ...INITIAL_CLOUDFLARE_ACCOUNT, isConnected: false, apiToken: '' },
    });
    expect(noTokenReport.ok).toBe(false);
    expect(noTokenReport.failureCode).toBe('ERR_CLOUDFLARE_AUTH_MISSING');

    // 2. D1 database ID mismatch between wrangler.jsonc and active Cloudflare bindings
    const driftReport = verifyHonoCloudflareServiceLink({
      channel: 'cloudflare',
      projectName: 'LiquidOS Hono',
      files: baseFiles,
      cloudflareBindings: {
        ...INITIAL_CLOUDFLARE_BINDINGS,
        d1Databases: [{ name: 'DB_PROD', id: 'd1-other-id', tables: [] }],
      },
      cloudflareConfig: INITIAL_CLOUDFLARE_ACCOUNT,
    });
    expect(driftReport.ok).toBe(false);
    expect(driftReport.failureCode).toBe('ERR_CF_D1_BINDING_MISMATCH');

    // 3. Missing nodejs_compat flag in wrangler.jsonc
    const noCompatFiles = baseFiles.map((f) =>
      f.path === 'wrangler.jsonc'
        ? { ...f, content: f.content.replace('"nodejs_compat"', '"other_flag"') }
        : f
    );
    const compatReport = verifyHonoCloudflareServiceLink({
      channel: 'cloudflare',
      projectName: 'LiquidOS Hono',
      files: noCompatFiles,
      cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
      cloudflareConfig: INITIAL_CLOUDFLARE_ACCOUNT,
    });
    expect(compatReport.ok).toBe(false);
    expect(compatReport.failureCode).toBe('ERR_MISSING_NODEJS_COMPAT');
  });

  it('validates Control Plane Ed25519 signatures before shipping and rejects tampered receipts or LOCKDOWN', () => {
    const tmpDir = makeTmpDir('deploy-orchestrator-');
    try {
      const cp = createAuthoritativeControlPlaneEngine({
        initialActive: true,
        stateDir: tmpDir,
        workspaceId: 'ws_deploy',
      });
      const permitRes = cp.issuePermit({
        subject: 'human:mercy',
        scopes: ['workspace_ingest', 'workspace_commit', 'device_sync'],
      });
      expect(permitRes.ok).toBe(true);
      const permitId = permitRes.permit!.permitId;

      const orchestrator = createDeploymentOrchestrator({
        controlPlane: cp,
        stateDir: tmpDir,
      });
      const files = getHonoFullstackInitialFiles();

      // 1. Preflight passes
      const preflight = orchestrator.runPreflight({
        permitId,
        projectName: 'LiquidOS Hono',
        channel: 'cloudflare',
        files,
        cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
        cloudflareConfig: INITIAL_CLOUDFLARE_ACCOUNT,
      });
      expect(preflight.ok).toBe(true);
      expect(preflight.status).toBe(200);

      // 2. Ship verified Cloudflare deployment + inspect Ed25519 signature
      const shipped = orchestrator.shipVerifiedDeployment({
        permitId,
        projectName: 'LiquidOS Hono',
        channel: 'cloudflare',
        files,
        cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
        cloudflareConfig: INITIAL_CLOUDFLARE_ACCOUNT,
      });
      expect(shipped.ok).toBe(true);
      if (shipped.ok) {
        expect(shipped.ed25519Verification.verified).toBe(true);
        expect(
          verifyEd25519Receipt(
            shipped.receipt.publicKeyPem,
            shipped.receipt.canonicalPayload,
            shipped.receipt.signature
          )
        ).toBe(true);

        // 3. Reject deployment when supplied Ed25519 signature is tampered
        const tampered = orchestrator.shipVerifiedDeployment({
          permitId,
          projectName: 'LiquidOS Hono',
          channel: 'cloudflare',
          files,
          cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
          cloudflareConfig: INITIAL_CLOUDFLARE_ACCOUNT,
          suppliedReceipt: {
            ...shipped.receipt,
            signature: 'AAAA' + shipped.receipt.signature.slice(4),
          },
        });
        expect(tampered.ok).toBe(false);
        expect(tampered.httpStatus).toBe(403);
        expect(tampered.code).toBe('ERR_INVALID_ED25519_SIGNATURE');

        // 4. Reject valid receipt from another bundle when workspace files change (payload mismatch)
        const modifiedFiles = files.map((f) =>
          f.path === 'index.html' ? { ...f, content: f.content + '\n<!-- mutated -->' } : f
        );
        const mismatched = orchestrator.shipVerifiedDeployment({
          permitId,
          projectName: 'LiquidOS Hono',
          channel: 'cloudflare',
          files: modifiedFiles,
          cloudflareBindings: INITIAL_CLOUDFLARE_BINDINGS,
          cloudflareConfig: INITIAL_CLOUDFLARE_ACCOUNT,
          suppliedReceipt: shipped.receipt,
        });
        expect(mismatched.ok).toBe(false);
        expect(mismatched.httpStatus).toBe(403);
        expect(mismatched.code).toBe('ERR_RECEIPT_PAYLOAD_MISMATCH');
      }

      // 5. Fail-closed under GLOBAL-MODE-001 LOCKDOWN
      cp.transitionMode('LOCKDOWN', 'Pre-ship security lockdown', 'human:mercy');
      const blocked = orchestrator.shipVerifiedDeployment({
        permitId,
        projectName: 'LiquidOS Hono',
        channel: 'edge',
        files,
      });
      expect(blocked.ok).toBe(false);
      expect(blocked.httpStatus).toBe(403);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
