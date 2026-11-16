/**
 * NexusBridge — Fail-closed TypeScript bridge to the Python an-nexus cryptographic core.
 *
 * Security invariants:
 * 1. Never generates d_attest values.
 * 2. Throws on any CLI failure or malformed response.
 * 3. Offline mode is not supported for autonomous mutation.
 * 4. Git is a recovery checkpoint only; it is never the root of trust.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

export interface AttestationEnvelope {
  success: boolean;
  d_attest: string;
  audit_log_seq: number;
  error?: string;
}

export interface PolicyResult {
  authorized: boolean;
  reason: string;
}

export class NexusBridge {
  private pythonPath: string;
  private scriptPath: string;

  constructor() {
    this.pythonPath = process.env.NEXUS_PYTHON_PATH || 'python3';
    this.scriptPath = path.resolve(process.cwd(), 'an_nexus/cli.py');
  }

  /**
   * Execute an-nexus CLI command. Fail-closed: any error throws.
   * Payload is passed via stdin to avoid shell escaping / length issues.
   */
  private async runCommand(args: string[], stdinPayload?: string): Promise<string> {
    try {
      const options: { input?: string; maxBuffer?: number } = {
        maxBuffer: 10 * 1024 * 1024,
      };
      if (stdinPayload !== undefined) {
        options.input = stdinPayload;
      }

      const { stdout } = await execFileAsync(this.pythonPath, [this.scriptPath, ...args], options);
      return stdout.trim();
    } catch (error: any) {
      // FAIL-CLOSED: Any execution error throws, halting the caller.
      throw new Error(
        `[NexusBridge] Gateway unreachable or command failed: ${error.message}`
      );
    }
  }

  /**
   * Checks the IBM Praxis Policy Engine (or an-nexus policy wrapper).
   * If the gateway is down or returns malformed data, this throws.
   * It does NOT default to authorized: true.
   */
  async checkPolicy(action: string, payload: Record<string, unknown>): Promise<PolicyResult> {
    const stdout = await this.runCommand(
      ['policy-check', action],
      JSON.stringify(payload)
    );

    let result: PolicyResult;
    try {
      result = JSON.parse(stdout);
    } catch {
      throw new Error('[NexusBridge] Invalid policy response: not valid JSON');
    }

    if (typeof result.authorized !== 'boolean' || typeof result.reason !== 'string') {
      throw new Error('[NexusBridge] Invalid policy response format');
    }

    return result;
  }

  /**
   * Signs the envelope and appends to the continuity chain / audit log.
   * Returns the real d_attest and audit_log_seq.
   * Throws if attestation fails or response is malformed.
   */
  async signAndAnchor(payload: Record<string, unknown>): Promise<AttestationEnvelope> {
    const stdout = await this.runCommand(
      ['sign-and-anchor'],
      JSON.stringify(payload)
    );

    let result: AttestationEnvelope;
    try {
      result = JSON.parse(stdout);
    } catch {
      throw new Error('[NexusBridge] Invalid attestation response: not valid JSON');
    }

    if (
      !result.success ||
      typeof result.d_attest !== 'string' ||
      !/^[0-9a-f]{64}$/i.test(result.d_attest) ||
      typeof result.audit_log_seq !== 'number'
    ) {
      throw new Error(
        `[NexusBridge] Attestation failed: ${result.error || 'Invalid envelope shape or digest'}`
      );
    }

    return result;
  }

  /**
   * Retrieves the latest 64-character hex hash from the audit log for the HUD.
   * Throws if the gateway is unreachable or the head is malformed.
   */
  async getAuditHead(): Promise<string> {
    const stdout = await this.runCommand(['audit-head']);

    if (!/^[0-9a-f]{64}$/i.test(stdout)) {
      throw new Error('[NexusBridge] Invalid audit head format (expected 64-char hex)');
    }

    return stdout.toLowerCase();
  }
}

export const nexusBridge = new NexusBridge();
