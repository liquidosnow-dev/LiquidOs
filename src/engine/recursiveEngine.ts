/**
 * Hardened recursive execution engine.
 *
 * - Policy check is mandatory and fail-closed.
 * - Tests run before attestation.
 * - Git is used only as a recovery checkpoint, never as the root of trust.
 * - A successful return means the mutation is authorized and cryptographically attested.
 */

import { createCommit, rollbackToCommit } from '../utils/versionControl';
import { nexusBridge, AttestationEnvelope } from '../services/nexusBridge';

export interface ExecutionResult {
  success: boolean;
  errorCount: number;
  attestationDigest?: string;
  auditLogSeq?: number;
  reason?: string;
}

export async function executeRecursiveCycle(
  stepName: string,
  prompt: string,
  mutationFn: () => Promise<string>, // Returns the AST diff / draft content
  testRunnerFn: () => Promise<number> // Returns error count
): Promise<ExecutionResult> {
  // 1. Establish pre-mutation recovery checkpoint (Git is a fallback, not the authority)
  const commitId = createCommit(`Pre-execution checkpoint: ${stepName}`);

  try {
    // 2. Governance Check (Fail-closed)
    const policyResult = await nexusBridge.checkPolicy('code_mutation', {
      stepName,
      prompt,
    });

    if (!policyResult.authorized) {
      return {
        success: false,
        errorCount: 0,
        reason: `Policy Violation: ${policyResult.reason}`,
      };
    }

    // 3. Execute autonomous mutation (in memory / draft)
    const draftDiff = await mutationFn();

    // 4. Run invariant test suite
    const errorCount = await testRunnerFn();

    if (errorCount > 0) {
      console.warn(
        `[Recursive Engine] Invariant violation (${errorCount} errors). Rolling back...`
      );
      rollbackToCommit(commitId);
      return {
        success: false,
        errorCount,
        reason: 'Invariant test failure',
      };
    }

    // 5. Cryptographic Attestation (an-nexus)
    // If this throws, the catch block performs the rollback.
    const envelope: AttestationEnvelope = await nexusBridge.signAndAnchor({
      stepName,
      prompt,
      diff: draftDiff,
      testResults: { errorCount, passed: true },
      priorCommit: commitId,
      timestamp: new Date().toISOString(),
    });

    // 6. Mutation is authorized and anchored.
    // The actual application of the mutation is the caller's responsibility
    // after receiving a successful result with a real attestationDigest.
    return {
      success: true,
      errorCount: 0,
      attestationDigest: envelope.d_attest,
      auditLogSeq: envelope.audit_log_seq,
    };
  } catch (err: any) {
    console.error(
      `[Recursive Engine] Fatal exception during ${stepName}:`,
      err.message
    );
    rollbackToCommit(commitId);
    return {
      success: false,
      errorCount: 1,
      reason: err.message,
    };
  }
}
