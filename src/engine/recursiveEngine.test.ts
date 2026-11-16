import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { Project } from '../types';
import { createCommit, verifyCommitIntegrity } from '../utils/versionControl';
import {
  createAuthoritativeControlPlaneEngine,
  verifyEd25519Receipt,
} from '../utils/serverControlPlane';
import { clearVectorVault } from '../services/vectorStore';
import { readDuckDbVault, readLanceDbVault } from '../adapters/vaultAdapters';
import {
  classifyAndPlanRequest,
  decomposePromptIntoTasks,
  evaluateFileModifications,
  executeRecursiveCycle,
  runRecursiveLoop,
} from './recursiveEngine';

function makeTestProject(): Project {
  const base: Project = {
    id: 'proj_test_recursive',
    name: 'Recursive Test Workspace',
    description: 'Autonomous loop test project',
    currentBranch: 'main',
    branches: { main: { name: 'main', currentCommitId: '' } },
    commits: [],
    files: [
      {
        name: 'index.html',
        path: 'index.html',
        language: 'html',
        content: '<!doctype html><html><body><h1>Initial</h1></body></html>',
        lastModified: 1000,
      },
      {
        name: 'config.json',
        path: 'config.json',
        language: 'json',
        content: '{"version": 1, "mode": "safe"}\n',
        lastModified: 1000,
      },
    ],
    createdAt: 1000,
    updatedAt: 1000,
  };
  return createCommit(base, 'Initial baseline', 'test').project;
}

describe('RecursiveEngine + Vault Adapters + Control Plane Ed25519 Attestation', () => {
  const tempDirs: string[] = [];

  function makeControlPlane() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-rec-'));
    tempDirs.push(dir);
    return createAuthoritativeControlPlaneEngine({
      initialActive: true,
      stateDir: dir,
      workspaceId: 'ws_test_recursive',
    });
  }

  afterEach(() => {
    clearVectorVault();
    for (const d of tempDirs.splice(0)) {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  it('reads DuckDB (Rule S4 guarded) and LanceDB (1536-dim vector) vault adapters', async () => {
    const project = makeTestProject();

    await expect(
      readDuckDbVault({
        sql: 'DROP TABLE workspace_files; SELECT 1',
        project,
      })
    ).rejects.toThrow(/CHAINED_STATEMENTS|RULE_S4_REJECTION/i);

    const duckRes = await readDuckDbVault({
      sql: 'SELECT language, COUNT(*) FROM workspace_files GROUP BY language',
      project,
    });
    expect(duckRes.adapter).toBe('duckdb');
    expect(duckRes.rowCount).toBe(2);
    expect(duckRes.payloadDigest).toMatch(/^[0-9a-f]{64}$/);

    const lanceRes = await readLanceDbVault({
      query: 'config safe mode html',
      topK: 2,
      projectFiles: project.files,
      autoIndexWorkspace: true,
    });
    expect(lanceRes.adapter).toBe('lancedb');
    expect(lanceRes.totalIndexedChunks).toBe(2);
    expect(lanceRes.hits.length).toBeGreaterThan(0);
    expect(lanceRes.payloadDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('executes multi-step tasks autonomously across iterations and obtains verified Ed25519 attestations', async () => {
    const project = makeTestProject();
    const cp = makeControlPlane();

    const result = await runRecursiveLoop({
      goal: 'Create analytics module and update dashboard',
      project,
      maxIterations: 4,
      getControlPlaneState: () => cp.getPublicState().state,
      initialTasks: [
        {
          id: 't1',
          title: 'Create analytics helper',
          description: 'Add src/analytics.ts',
        },
        {
          id: 't2',
          title: 'Update dashboard html',
          description: 'Add summary section',
        },
      ],
      executeTask: async ({ task, vault }) => {
        expect(vault.duckdb.rowCount).toBeGreaterThan(0);
        expect(vault.lancedb.hits.length).toBeGreaterThan(0);

        if (task.id === 't1') {
          return {
            summary: 'Synthesized src/analytics.ts',
            modifications: [
              {
                path: 'src/analytics.ts',
                action: 'create',
                content: 'export function computeScore(a: number, b: number): number { return a + b; }\n',
              },
            ],
            followUpTasks: [
              {
                id: 't3_followup',
                title: 'Update manifest metadata',
                description: 'Record analytics module in config.json',
              },
            ],
          };
        }

        if (task.id === 't2') {
          return {
            summary: 'Updated index.html',
            modifications: [
              {
                path: 'index.html',
                action: 'modify',
                content: '<!doctype html><html><body><h1>Analytics Ready</h1></body></html>',
              },
            ],
          };
        }

        return {
          summary: 'Finalized config.json in follow-up iteration',
          modifications: [
            {
              path: 'config.json',
              action: 'modify',
              content: '{"version": 2, "analytics": true}\n',
            },
          ],
        };
      },
      requestAttestation: async (req) => {
        const res = cp.issueExecutionAttestation({
          permitId: req.permitId,
          cycleId: req.cycleId,
          stepName: req.stepName,
          iteration: req.iteration,
          taskIds: req.taskIds,
          modifiedFiles: req.modifiedFiles,
          vaultDigest: req.vaultDigest,
          evaluationPassed: req.evaluationPassed,
          evaluationDiagnostics: req.evaluationDiagnostics,
          expectedEpoch: req.expectedEpoch,
          expectedFencingVersion: req.expectedFencingVersion,
        });
        if (!res.ok) {
          return { ok: false, status: res.status, code: res.code, error: res.error };
        }
        const verified = verifyEd25519Receipt(
          res.publicKeyPem,
          res.receipt.canonicalPayload,
          res.receipt.signature
        );
        return { ...res, verified };
      },
    });

    expect(result.success).toBe(true);
    expect(result.iterationsCompleted).toBe(2);
    expect(result.totalTasksExecuted).toBe(3);
    expect(result.remainingTasks).toHaveLength(0);
    expect(result.attestations).toHaveLength(2);
    expect(result.attestations.every((a) => a.ok && a.verified && a.receipt?.algorithm === 'Ed25519')).toBe(
      true
    );
    expect(result.project.files.some((f) => f.path === 'src/analytics.ts')).toBe(true);
    expect(result.project.files.find((f) => f.path === 'config.json')?.content).toContain('"analytics": true');
    expect(verifyCommitIntegrity(result.project.commits[0]).valid).toBe(true);
    expect(result.project.commits[0].provenance?.claimLevel).toBe('signed');
  });

  it('auto-repairs failed file evaluations on the next iteration and rolls back bad drafts', async () => {
    const project = makeTestProject();
    const cp = makeControlPlane();
    let attempt = 0;

    const result = await runRecursiveLoop({
      goal: 'Write valid JSON configuration',
      project,
      maxIterations: 3,
      autoRepairOnEvalFailure: true,
      getControlPlaneState: () => cp.getPublicState().state,
      initialTasks: [
        {
          id: 'write_cfg',
          title: 'Write config.json',
          description: 'Update config.json',
        },
      ],
      executeTask: async () => {
        attempt += 1;
        return {
          summary: attempt === 1 ? 'Wrote malformed JSON' : 'Repaired JSON',
          modifications: [
            {
              path: 'config.json',
              action: 'modify',
              content: attempt === 1 ? '{"broken": ' : '{"repaired": true}\n',
            },
          ],
        };
      },
      requestAttestation: async (req) => {
        const res = cp.issueExecutionAttestation({
          permitId: req.permitId,
          cycleId: req.cycleId,
          stepName: req.stepName,
          iteration: req.iteration,
          modifiedFiles: req.modifiedFiles,
          vaultDigest: req.vaultDigest,
          evaluationPassed: req.evaluationPassed,
          expectedEpoch: req.expectedEpoch,
          expectedFencingVersion: req.expectedFencingVersion,
        });
        return res.ok ? { ...res, verified: true } : { ok: false, error: res.error };
      },
    });

    expect(result.success).toBe(true);
    expect(result.iterationsCompleted).toBe(2);
    expect(result.traces[0].rolledBack).toBe(true);
    expect(result.traces[0].evaluation.passed).toBe(false);
    expect(result.traces[1].rolledBack).toBe(false);
    expect(result.traces[1].evaluation.passed).toBe(true);
    expect(result.project.files.find((f) => f.path === 'config.json')?.content).toBe(
      '{"repaired": true}\n'
    );
  });

  it('fails closed when Control Plane is in LOCKDOWN or blocks unsafe path traversal', async () => {
    const project = makeTestProject();
    const cp = makeControlPlane();

    const evalUnsafe = await evaluateFileModifications({
      project,
      modifications: [
        {
          path: '../../etc/passwd',
          action: 'create',
          content: 'pwned',
        },
      ],
    });
    expect(evalUnsafe.passed).toBe(false);
    expect(evalUnsafe.diagnostics[0]).toMatch(/Unsafe modification path/i);

    cp.transitionMode('LOCKDOWN', 'Incident lockdown test', 'security:admin');

    const cycleRes = await executeRecursiveCycle({
      stepName: 'Blocked mutation',
      prompt: 'Attempt write during lockdown',
      project,
      controlPlaneState: cp.getPublicState().state,
      modificationsFn: async () => [
        { path: 'index.html', action: 'modify', content: '<h1>Should not commit</h1>' },
      ],
    });

    expect(cycleRes.success).toBe(false);
    expect(cycleRes.reason).toMatch(/LOCKDOWN/i);
    expect(cycleRes.project?.files.find((f) => f.path === 'index.html')?.content).toContain('Initial');
  });

  it('aborts cleanly via AbortSignal', async () => {
    const project = makeTestProject();
    const cp = makeControlPlane();
    const controller = new AbortController();
    controller.abort();

    const result = await runRecursiveLoop({
      goal: 'Aborted goal',
      project,
      signal: controller.signal,
      getControlPlaneState: () => cp.getPublicState().state,
      initialTasks: [{ id: 't1', title: 'Task 1', description: 'Should not run' }],
      executeTask: async () => ({ summary: 'unreachable', modifications: [] }),
    });

    expect(result.success).toBe(false);
    expect(result.aborted).toBe(true);
    expect(result.totalTasksExecuted).toBe(0);
  });

  it('routes complex and multi-step requests through recursive_loop and keeps simple prompts single_turn', () => {
    const simpleGreeting = classifyAndPlanRequest('Hello, what does JCS stand for?');
    expect(simpleGreeting.route).toBe('single_turn');
    expect(simpleGreeting.tasks).toHaveLength(0);

    const simpleMath = classifyAndPlanRequest('calculate 12 * (4 + 5)');
    expect(simpleMath.route).toBe('single_turn');

    const optOut = classifyAndPlanRequest(
      '1. Build auth handler\n2. Add unit tests\n3. Update index.html',
      { autonomousMode: false }
    );
    expect(optOut.route).toBe('single_turn');

    const numberedMultiStep = classifyAndPlanRequest(
      '1. Create src/auth.ts\n2. Wire rate limiter into server.ts\n3. Add vitest security checks'
    );
    expect(numberedMultiStep.route).toBe('recursive_loop');
    expect(numberedMultiStep.tasks).toHaveLength(3);
    expect(numberedMultiStep.tasks[0].description).toContain('Create src/auth.ts');

    const chainedMultiStep = classifyAndPlanRequest(
      'Refactor src/App.tsx to add telemetry and then update index.html and config.json'
    );
    expect(chainedMultiStep.route).toBe('recursive_loop');
    expect(chainedMultiStep.tasks.length).toBeGreaterThanOrEqual(2);

    const singleComplexArch = classifyAndPlanRequest(
      'Build an end-to-end Hono Cloudflare D1 API with DuckDB analytics and Ed25519 attestation verification across the workspace'
    );
    expect(singleComplexArch.route).toBe('recursive_loop');
    expect(singleComplexArch.tasks).toHaveLength(2);
    expect(decomposePromptIntoTasks('Add A; Update B; Verify C')).toHaveLength(3);
  });
});
