import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildLocalAppBindingRecord,
  createInitialLiquidChromeOsDb,
  queryLiquidChromeOsDb,
} from './liquidChromeOs';
import {
  createAuthoritativeControlPlaneEngine,
  verifyEd25519Receipt,
} from './serverControlPlane';
import { createServerOsDatabaseEngine } from './serverOsDatabase';
import { readDuckDbVault } from '../adapters/vaultAdapters';
import type { Project } from '../types';

function makeTempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('Liquid Chrome OS Database & Plug-and-Play Wire-In', () => {
  it('initializes the 10-layer matrix, 5 build profiles (full=297), 25 CodexFlow workflows, and manifest mappings', () => {
    const db = createInitialLiquidChromeOsDb();
    expect(db.layers).toHaveLength(10);
    expect(db.buildProfiles).toHaveLength(5);
    expect(db.buildProfiles.find((p) => p.id === 'full')?.repoCount).toBe(297);
    expect(db.workflows).toHaveLength(25);
    expect(db.manifestMappings).toHaveLength(3);
  });

  it('executes Rule S4 AST-guarded SQL queries over all OS database tables and blocks mutations', () => {
    const db = createInitialLiquidChromeOsDb();

    const profilesRes = queryLiquidChromeOsDb(
      db,
      "SELECT * FROM os_build_profiles WHERE id = 'firmware' LIMIT 5"
    );
    expect(profilesRes.allowed).toBe(true);
    expect(profilesRes.rowCount).toBe(1);
    expect(profilesRes.rows[0].repo_count).toBe(69);

    const countRes = queryLiquidChromeOsDb(
      db,
      'SELECT COUNT(*) FROM os_codexflow_workflows'
    );
    expect(countRes.allowed).toBe(true);
    expect(countRes.rows[0].total_count).toBe(25);

    const blockedDrop = queryLiquidChromeOsDb(
      db,
      'SELECT * FROM os_layers; DROP TABLE os_layers;'
    );
    expect(blockedDrop.allowed).toBe(false);
    expect(blockedDrop.rowCount).toBe(0);

    const blockedUpdate = queryLiquidChromeOsDb(
      db,
      "UPDATE os_hardware_config SET security_chip = 'ti50'"
    );
    expect(blockedUpdate.allowed).toBe(false);
  });

  it('routes DuckDB vault adapter queries on os_* tables cleanly through Rule S4 OS DB engine', async () => {
    const dummyProject: Project = {
      id: 'proj_test',
      name: 'Test App',
      description: 'desc',
      currentBranch: 'main',
      branches: { main: { name: 'main', currentCommitId: 'c1' } },
      commits: [],
      files: [
        {
          name: 'index.html',
          path: 'index.html',
          language: 'html',
          content: '<h1>hello</h1>',
          lastModified: Date.now(),
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const res = await readDuckDbVault({
      sql: 'SELECT * FROM os_layers LIMIT 4',
      project: dummyProject,
      useServerGuard: false,
    });
    expect(res.adapter).toBe('duckdb');
    expect(res.rowCount).toBe(4);
    expect(res.rows[0].layer_name).toBe('Team Orchestration');
  });

  it('builds local app bindings with deterministic tree and OS database digests', () => {
    const db = createInitialLiquidChromeOsDb();
    const { nextDb, binding } = buildLocalAppBindingRecord({
      db,
      projectId: 'proj_app_1',
      projectName: 'Vault Explorer',
      buildProfile: 'crosvm',
      files: [
        {
          name: 'App.tsx',
          path: 'src/App.tsx',
          language: 'typescript',
          content: 'export const app = 1;',
          lastModified: 1000,
        },
      ],
    });
    expect(binding.buildProfile).toBe('crosvm');
    expect(binding.boundFilesCount).toBe(1);
    expect(binding.treeDigest).toHaveLength(64);
    expect(binding.osDbDigest).toHaveLength(64);
    expect(nextDb.appBindings).toHaveLength(1);
  });

  it('wires app, swaps hardware, executes 3-phase CodexFlow workflows with Ed25519 receipts, and persists state', () => {
    const tmpDir = makeTempDir('liquid-chrome-os-');
    try {
      const controlPlane = createAuthoritativeControlPlaneEngine({
        initialActive: true,
        stateDir: tmpDir,
        workspaceId: 'ws_test',
      });
      const permitRes = controlPlane.issuePermit({
        subject: 'human:mercy',
        scopes: ['workspace_ingest', 'workspace_commit', 'device_sync'],
      });
      expect(permitRes.ok).toBe(true);
      const permitId = permitRes.permit!.permitId;

      const osDb = createServerOsDatabaseEngine({
        controlPlane,
        stateDir: tmpDir,
        rootDir: process.cwd(),
      });

      const snapshot = osDb.getSnapshot();
      expect(snapshot.knowledgeCatalog.length).toBeGreaterThan(0);

      // Reject path traversal cleanly
      const badWire = osDb.wireAppToOs({
        permitId,
        projectId: 'proj_bad',
        projectName: 'Bad',
        files: [
          {
            name: 'passwd',
            path: '../etc/passwd',
            language: 'markdown',
            content: 'root:x:0:0',
            lastModified: Date.now(),
          },
        ],
      });
      expect(badWire.ok).toBe(false);
      expect(badWire.code).toBe('ERR_UNSAFE_PATH');

      // Valid Plug & Play wire
      const wireRes = osDb.wireAppToOs({
        permitId,
        projectId: 'proj_live',
        projectName: 'Live App',
        buildProfile: 'firmware',
        files: [
          {
            name: 'main.ts',
            path: 'src/main.ts',
            language: 'typescript',
            content: 'console.log("wired");',
            lastModified: Date.now(),
          },
        ],
      });
      expect(wireRes.ok).toBe(true);
      if (wireRes.ok) {
        expect(wireRes.binding.buildProfile).toBe('firmware');
        expect(
          verifyEd25519Receipt(
            wireRes.receipt.publicKeyPem,
            wireRes.receipt.canonicalPayload,
            wireRes.receipt.signature
          )
        ).toBe(true);
      }

      // Hot-swap hardware modules
      const hwRes = osDb.swapHardwareModule({
        permitId,
        hardwareSelection: {
          securityChip: 'ti50',
          ecFirmware: 'zephyr',
          bootloader: 'coreboot',
        },
      });
      expect(hwRes.ok).toBe(true);
      if (hwRes.ok) {
        expect(hwRes.hardwareSelection.securityChip).toBe('ti50');
        expect(hwRes.hardwareSelection.bootloader).toBe('coreboot');
      }

      // Execute CodexFlow 3-phase workflow
      const wfRes = osDb.runCodexFlowWorkflow({
        permitId,
        workflowSlugOrId: 'recursive-self-mutation',
        targetProjectId: 'proj_live',
      });
      expect(wfRes.ok).toBe(true);
      if (wfRes.ok) {
        expect(wfRes.phases).toHaveLength(3);
        expect(wfRes.phases[0].status).toBe('PASSED');
        expect(wfRes.phases[1].status).toBe('PASSED');
        expect(wfRes.phases[2].status).toBe('ATTESTED');
      }

      // Restart engine from disk and confirm persistence
      const restartedOsDb = createServerOsDatabaseEngine({
        controlPlane,
        stateDir: tmpDir,
        rootDir: process.cwd(),
      });
      const reloaded = restartedOsDb.querySql('SELECT * FROM os_app_bindings LIMIT 5');
      expect(reloaded.allowed).toBe(true);
      expect(reloaded.rowCount).toBe(1);
      expect(reloaded.rows[0].project_id).toBe('proj_live');

      // Fail-closed under GLOBAL-MODE-001 LOCKDOWN
      controlPlane.transitionMode('LOCKDOWN', 'Security test lockdown', 'human:mercy');
      const blockedWf = restartedOsDb.runCodexFlowWorkflow({
        permitId,
        workflowSlugOrId: 'edge-key-rotation',
      });
      expect(blockedWf.ok).toBe(false);
      expect(blockedWf.code).toBe('ERR_IBM_PRAXIS_PPE_BLOCKED');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
