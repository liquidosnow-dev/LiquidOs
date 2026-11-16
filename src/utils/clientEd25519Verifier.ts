/**
 * @file Client-Side Control Plane Ed25519 Receipt Verifier
 *
 * Independently validates Ed25519 cryptographic signatures from the server
 * Control Plane inside the browser/client deployment pipeline using WebCrypto
 * (crypto.subtle) before accepting or activating Cloudflare Workers / Pages /
 * Edge deployments.
 *
 * Security guarantees (fail-closed):
 *  1. Rejects missing, malformed, or non-Ed25519 receipts.
 *  2. Resolves signer public keys strictly from the Control Plane's pinned
 *     public keyring (/api/control-plane/keys), rejecting unknown keyIds or
 *     PEM mismatches and validating any key rotation transitions.
 *  3. Verifies the Ed25519 signature over the canonical JSON payload using
 *     WebCrypto SPKI verification.
 *  4. Recomputes SHA-256 digests over all shipped workspace files, Wrangler/Hono
 *     configs, Cloudflare D1/KV/R2 bindings, and any binary artifacts, asserting
 *     exact equality with the signed receipt's treeDigest and bindingsDigest.
 */

import type { ProjectFile } from '../types/index.ts';
import type { CloudflareAccountConfig, CloudflareBindings } from '../types/sandbox.ts';
import { assertSafeIntegerLiterals, canonicalize } from './contractRegistry.ts';
import { INITIAL_CLOUDFLARE_ACCOUNT, INITIAL_CLOUDFLARE_BINDINGS } from './sandboxEngine.ts';
import { sha256Hex } from './securityCrypto.ts';

export interface ClientSignedReceipt {
  receiptId: string;
  keyId: string;
  action: string;
  canonicalPayload: string;
  signature: string;
  publicKeyPem?: string;
  algorithm: 'Ed25519';
  linearizationSeq: number;
}

export interface ControlPlaneKeyTransition {
  prevKeyId: string;
  nextKeyId: string;
  nextPublicKeyPem: string;
  rotatedAt: number;
  actor: string;
  canonicalPayload: string;
  signedByPreviousKey: string;
  signedByNewKey: string;
}

export interface ControlPlanePublicKeyring {
  activeKeyId: string;
  publicKeyPem: string;
  publicKeysById: Record<string, string>;
  keyTransitions?: ControlPlaneKeyTransition[];
}

export interface BinaryArtifactInput {
  path: string;
  bytes: Uint8Array;
}

export type ClientReceiptErrorCode =
  | 'CLIENT_ED25519_VERIFIED'
  | 'ERR_MISSING_RECEIPT'
  | 'ERR_MALFORMED_RECEIPT'
  | 'ERR_UNSUPPORTED_ALGORITHM'
  | 'ERR_UNTRUSTED_KEY_ID'
  | 'ERR_KEY_TRANSITION_INVALID'
  | 'ERR_WEBCRYPTO_ED25519_UNAVAILABLE'
  | 'ERR_INVALID_ED25519_SIGNATURE'
  | 'ERR_PAYLOAD_UNSAFE_JSON'
  | 'ERR_TREE_DIGEST_MISMATCH'
  | 'ERR_BINDINGS_DIGEST_MISMATCH'
  | 'ERR_ARTIFACT_DIGEST_MISMATCH'
  | 'ERR_CHANNEL_MISMATCH'
  | 'ERR_PROJECT_MISMATCH'
  | 'ERR_WORKSPACE_MISMATCH'
  | 'ERR_CONTROL_PLANE_KEYRING_UNREACHABLE';

export interface ClientReceiptVerificationResult {
  verified: boolean;
  code: ClientReceiptErrorCode;
  reason: string;
  receiptId?: string;
  keyId?: string;
  algorithm: 'Ed25519';
  computedTreeDigest?: string;
  receiptTreeDigest?: string;
  computedBindingsDigest?: string;
  receiptBindingsDigest?: string;
  artifactCount: number;
  verifiedKeyTransitionChain?: boolean;
  verifiedAt: number;
}

function normalizePem(pem: string): string {
  return pem
    .replace(/\r\n/g, '\n')
    .trim();
}

function base64ToUint8Array(b64: string): Uint8Array {
  const cleaned = b64.replace(/\s+/g, '');
  if (!cleaned || !/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) {
    throw new Error('Malformed base64 input');
  }
  if (typeof atob === 'function') {
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  // Fallback for Node test environments lacking global atob
  return new Uint8Array(Buffer.from(cleaned, 'base64'));
}

function pemSpkiToDerBytes(publicKeyPem: string): Uint8Array {
  const normalized = normalizePem(publicKeyPem);
  const beginMarker = '-----BEGIN PUBLIC KEY-----';
  const endMarker = '-----END PUBLIC KEY-----';
  if (!normalized.includes(beginMarker) || !normalized.includes(endMarker)) {
    throw new Error('Invalid SPKI Ed25519 PEM framing');
  }
  const body = normalized
    .replace(beginMarker, '')
    .replace(endMarker, '')
    .replace(/\s+/g, '');
  return base64ToUint8Array(body);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

async function sha256BytesHex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('WebCrypto subtle.digest unavailable');
  }
  const digest = await subtle.digest('SHA-256', toArrayBuffer(bytes));
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Verifies an Ed25519 signature over canonicalPayload using WebCrypto (browser-safe).
 */
export async function verifyEd25519SignatureWebCrypto(
  publicKeyPem: string,
  canonicalPayload: string,
  signatureBase64: string
): Promise<{ valid: boolean; code?: ClientReceiptErrorCode; reason?: string }> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    return {
      valid: false,
      code: 'ERR_WEBCRYPTO_ED25519_UNAVAILABLE',
      reason: 'WebCrypto crypto.subtle is unavailable in this runtime.',
    };
  }

  let spkiBytes: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    spkiBytes = pemSpkiToDerBytes(publicKeyPem);
    sigBytes = base64ToUint8Array(signatureBase64);
  } catch (err: any) {
    return {
      valid: false,
      code: 'ERR_INVALID_ED25519_SIGNATURE',
      reason: err?.message || 'Malformed Ed25519 key or signature encoding.',
    };
  }

  if (sigBytes.byteLength !== 64) {
    return {
      valid: false,
      code: 'ERR_INVALID_ED25519_SIGNATURE',
      reason: `Expected 64-byte Ed25519 signature, received ${sigBytes.byteLength} bytes.`,
    };
  }

  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await subtle.importKey(
      'spki',
      toArrayBuffer(spkiBytes),
      { name: 'Ed25519' },
      false,
      ['verify']
    );
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    const unsupported =
      err?.name === 'NotSupportedError' || msg.toLowerCase().includes('not supported');
    return {
      valid: false,
      code: unsupported ? 'ERR_WEBCRYPTO_ED25519_UNAVAILABLE' : 'ERR_UNTRUSTED_KEY_ID',
      reason: unsupported
        ? 'Browser WebCrypto runtime does not support Ed25519 verification.'
        : `Invalid Ed25519 SPKI public key: ${msg}`,
    };
  }

  try {
    const payloadBytes = new TextEncoder().encode(canonicalPayload);
    const verified = await subtle.verify(
      'Ed25519',
      cryptoKey,
      toArrayBuffer(sigBytes),
      toArrayBuffer(payloadBytes)
    );
    return verified
      ? { valid: true }
      : {
          valid: false,
          code: 'ERR_INVALID_ED25519_SIGNATURE',
          reason: 'Ed25519 signature failed cryptographic verification against Control Plane key.',
        };
  } catch (err: any) {
    return {
      valid: false,
      code: 'ERR_INVALID_ED25519_SIGNATURE',
      reason: err?.message || 'Ed25519 verify threw an unexpected error.',
    };
  }
}

/**
 * Verifies every key rotation transition in the Control Plane keyring so
 * rotated signing keys are cryptographically chained rather than accepted blindly.
 */
export async function verifyKeyRotationChainWebCrypto(
  keyring: ControlPlanePublicKeyring
): Promise<{ valid: boolean; reason?: string }> {
  const transitions = Array.isArray(keyring.keyTransitions) ? keyring.keyTransitions : [];
  for (const tr of transitions) {
    const prevPem = keyring.publicKeysById[tr.prevKeyId];
    if (!prevPem) {
      return {
        valid: false,
        reason: `Key rotation references unknown previous keyId "${tr.prevKeyId}".`,
      };
    }
    const prevCheck = await verifyEd25519SignatureWebCrypto(
      prevPem,
      tr.canonicalPayload,
      tr.signedByPreviousKey
    );
    if (!prevCheck.valid) {
      return {
        valid: false,
        reason: `Key rotation ${tr.prevKeyId} -> ${tr.nextKeyId} failed previous-key signature check.`,
      };
    }
    const nextCheck = await verifyEd25519SignatureWebCrypto(
      tr.nextPublicKeyPem,
      tr.canonicalPayload,
      tr.signedByNewKey
    );
    if (!nextCheck.valid) {
      return {
        valid: false,
        reason: `Key rotation ${tr.prevKeyId} -> ${tr.nextKeyId} failed new-key signature check.`,
      };
    }
    const pinnedNextPem = keyring.publicKeysById[tr.nextKeyId];
    if (pinnedNextPem && normalizePem(pinnedNextPem) !== normalizePem(tr.nextPublicKeyPem)) {
      return {
        valid: false,
        reason: `Key rotation PEM for "${tr.nextKeyId}" does not match keyring entry.`,
      };
    }
  }
  return { valid: true };
}

/**
 * Comment/trailing-comma stripper mirroring deploymentOrchestrator.stripJsonCommentsSafe
 * so client-side wrangler.jsonc parsing matches server-side bindingsDigest exactly.
 */
export function stripJsonCommentsClient(input: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];
    const next = input[i + 1];

    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      i += 1;
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === '/' && next === '/') {
      i += 2;
      while (i < input.length && input[i] !== '\n') {
        i += 1;
      }
      continue;
    }

    if (ch === '/' && next === '*') {
      i += 2;
      while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) {
        i += 1;
      }
      i += 2;
      continue;
    }

    out += ch;
    i += 1;
  }

  return out.replace(/,\s*([}\]])/g, '$1');
}

function extractWorkerNameFromFiles(
  files: ProjectFile[],
  projectName: string,
  cloudflareConfig?: Partial<CloudflareAccountConfig>
): string {
  const wranglerFile = files.find(
    (f) => f.path === 'wrangler.jsonc' || f.path === 'wrangler.json'
  );
  if (wranglerFile) {
    try {
      const parsed = JSON.parse(stripJsonCommentsClient(wranglerFile.content || '{}')) as Record<
        string,
        unknown
      >;
      if (typeof parsed.name === 'string' && parsed.name.trim()) {
        return parsed.name;
      }
    } catch {
      // Fall through to account/project fallback
    }
  }
  const effectiveAccount = {
    ...INITIAL_CLOUDFLARE_ACCOUNT,
    ...(cloudflareConfig || {}),
  };
  return (
    effectiveAccount.projectName ||
    projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  );
}

/**
 * Recomputes the canonical SHA-256 bindingsDigest for Wrangler + Cloudflare D1/KV/R2,
 * matching deploymentOrchestrator.verifyHonoCloudflareServiceLink bit-for-bit.
 */
export function computeClientBindingsDigest(params: {
  channel: 'edge' | 'genspark' | 'cloudflare';
  projectName: string;
  files: ProjectFile[];
  cloudflareBindings?: Partial<CloudflareBindings>;
  cloudflareConfig?: Partial<CloudflareAccountConfig>;
}): string {
  const effectiveBindings: CloudflareBindings = {
    d1Databases:
      params.cloudflareBindings?.d1Databases && params.cloudflareBindings.d1Databases.length > 0
        ? params.cloudflareBindings.d1Databases
        : INITIAL_CLOUDFLARE_BINDINGS.d1Databases,
    kvNamespaces:
      params.cloudflareBindings?.kvNamespaces && params.cloudflareBindings.kvNamespaces.length > 0
        ? params.cloudflareBindings.kvNamespaces
        : INITIAL_CLOUDFLARE_BINDINGS.kvNamespaces,
    r2Buckets:
      params.cloudflareBindings?.r2Buckets && params.cloudflareBindings.r2Buckets.length > 0
        ? params.cloudflareBindings.r2Buckets
        : INITIAL_CLOUDFLARE_BINDINGS.r2Buckets,
  };

  const workerName = extractWorkerNameFromFiles(
    params.files,
    params.projectName,
    params.cloudflareConfig
  );

  return sha256Hex(
    canonicalize({
      channel: params.channel,
      workerName,
      d1: effectiveBindings.d1Databases.map((d) => d.id),
      kv: effectiveBindings.kvNamespaces.map((k) => k.id),
      r2: effectiveBindings.r2Buckets.map((r) => r.name),
    })
  );
}

/**
 * Recomputes SHA-256 digests over all workspace files/configs and optional binary artifacts,
 * matching serverControlPlane.computeWorkspaceFileHashes for source/config files.
 */
export async function computeArtifactBundleDigest(
  files: ProjectFile[],
  binaryArtifacts: BinaryArtifactInput[] = []
): Promise<{
  fileHashes: Record<string, string>;
  binaryDigests: Record<string, string>;
  treeDigest: string;
}> {
  const fileHashes: Record<string, string> = {};
  const sorted = files.slice().sort((a, b) => a.path.localeCompare(b.path));
  for (const file of sorted) {
    fileHashes[file.path] = sha256Hex(file.content);
  }
  const treeDigest = sha256Hex(canonicalize(fileHashes));

  const binaryDigests: Record<string, string> = {};
  const sortedBin = binaryArtifacts.slice().sort((a, b) => a.path.localeCompare(b.path));
  for (const bin of sortedBin) {
    binaryDigests[bin.path] = await sha256BytesHex(bin.bytes);
  }

  return {
    fileHashes,
    binaryDigests,
    treeDigest,
  };
}

/**
 * Client-side Ed25519 cryptographic validation for Control Plane deployment receipts.
 * Fails closed on missing receipts, untrusted keys, signature tampering, or payload/config drift.
 */
export async function validateControlPlaneDeploymentReceipt(params: {
  receipt: Partial<ClientSignedReceipt> | null | undefined;
  keyring: ControlPlanePublicKeyring;
  files: ProjectFile[];
  binaryArtifacts?: BinaryArtifactInput[];
  cloudflareBindings?: Partial<CloudflareBindings>;
  cloudflareConfig?: Partial<CloudflareAccountConfig>;
  expectedProjectName?: string;
  expectedChannel?: 'edge' | 'genspark' | 'cloudflare';
  expectedWorkspaceId?: string;
  expectedBindingsDigest?: string;
}): Promise<ClientReceiptVerificationResult> {
  const verifiedAt = Date.now();
  const files = Array.isArray(params.files) ? params.files : [];
  const binaryArtifacts = Array.isArray(params.binaryArtifacts) ? params.binaryArtifacts : [];
  const artifactCount = files.length + binaryArtifacts.length;

  const receipt = params.receipt;
  if (!receipt || typeof receipt !== 'object') {
    return {
      verified: false,
      code: 'ERR_MISSING_RECEIPT',
      reason: 'Control Plane cryptographic receipt is missing; Cloudflare/Edge ship blocked.',
      algorithm: 'Ed25519',
      artifactCount,
      verifiedAt,
    };
  }

  if (
    typeof receipt.receiptId !== 'string' ||
    !receipt.receiptId.trim() ||
    typeof receipt.keyId !== 'string' ||
    !receipt.keyId.trim() ||
    typeof receipt.canonicalPayload !== 'string' ||
    !receipt.canonicalPayload.trim() ||
    typeof receipt.signature !== 'string' ||
    !receipt.signature.trim()
  ) {
    return {
      verified: false,
      code: 'ERR_MALFORMED_RECEIPT',
      reason: 'Control Plane receipt is missing required fields (receiptId, keyId, canonicalPayload, signature).',
      receiptId: typeof receipt.receiptId === 'string' ? receipt.receiptId : undefined,
      keyId: typeof receipt.keyId === 'string' ? receipt.keyId : undefined,
      algorithm: 'Ed25519',
      artifactCount,
      verifiedAt,
    };
  }

  if (receipt.algorithm && receipt.algorithm !== 'Ed25519') {
    return {
      verified: false,
      code: 'ERR_UNSUPPORTED_ALGORITHM',
      reason: `Unsupported receipt signature algorithm "${String(receipt.algorithm)}"; expected Ed25519.`,
      receiptId: receipt.receiptId,
      keyId: receipt.keyId,
      algorithm: 'Ed25519',
      artifactCount,
      verifiedAt,
    };
  }

  const trustedKeyPem = params.keyring?.publicKeysById?.[receipt.keyId];
  if (!trustedKeyPem) {
    return {
      verified: false,
      code: 'ERR_UNTRUSTED_KEY_ID',
      reason: `Signer keyId "${receipt.keyId}" is not present in the authoritative Control Plane public keyring.`,
      receiptId: receipt.receiptId,
      keyId: receipt.keyId,
      algorithm: 'Ed25519',
      artifactCount,
      verifiedAt,
    };
  }

  if (
    typeof receipt.publicKeyPem === 'string' &&
    receipt.publicKeyPem.trim() &&
    normalizePem(receipt.publicKeyPem) !== normalizePem(trustedKeyPem)
  ) {
    return {
      verified: false,
      code: 'ERR_UNTRUSTED_KEY_ID',
      reason: `Receipt embedded publicKeyPem does not match pinned Control Plane key "${receipt.keyId}".`,
      receiptId: receipt.receiptId,
      keyId: receipt.keyId,
      algorithm: 'Ed25519',
      artifactCount,
      verifiedAt,
    };
  }

  const transitionCheck = await verifyKeyRotationChainWebCrypto(params.keyring);
  if (!transitionCheck.valid) {
    return {
      verified: false,
      code: 'ERR_KEY_TRANSITION_INVALID',
      reason: transitionCheck.reason || 'Control Plane key rotation chain failed verification.',
      receiptId: receipt.receiptId,
      keyId: receipt.keyId,
      algorithm: 'Ed25519',
      artifactCount,
      verifiedKeyTransitionChain: false,
      verifiedAt,
    };
  }

  // Cryptographic Ed25519 signature check in browser WebCrypto
  const sigCheck = await verifyEd25519SignatureWebCrypto(
    trustedKeyPem,
    receipt.canonicalPayload,
    receipt.signature
  );
  if (!sigCheck.valid) {
    return {
      verified: false,
      code: sigCheck.code || 'ERR_INVALID_ED25519_SIGNATURE',
      reason: sigCheck.reason || 'Ed25519 signature verification failed.',
      receiptId: receipt.receiptId,
      keyId: receipt.keyId,
      algorithm: 'Ed25519',
      artifactCount,
      verifiedKeyTransitionChain: true,
      verifiedAt,
    };
  }

  // Safely parse canonical payload and enforce 2^53-1 safe integer bounds
  let parsedPayload: Record<string, unknown>;
  try {
    assertSafeIntegerLiterals(receipt.canonicalPayload);
    const parsed = JSON.parse(receipt.canonicalPayload);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Canonical payload must be a JSON object');
    }
    parsedPayload = parsed as Record<string, unknown>;
  } catch (err: any) {
    return {
      verified: false,
      code: 'ERR_PAYLOAD_UNSAFE_JSON',
      reason: `Receipt canonicalPayload rejected: ${err?.message || 'invalid JSON'}`,
      receiptId: receipt.receiptId,
      keyId: receipt.keyId,
      algorithm: 'Ed25519',
      artifactCount,
      verifiedKeyTransitionChain: true,
      verifiedAt,
    };
  }

  const bundleDigest = await computeArtifactBundleDigest(files, binaryArtifacts);
  const receiptTreeDigest =
    typeof parsedPayload.treeDigest === 'string' ? parsedPayload.treeDigest : undefined;

  if (!receiptTreeDigest || receiptTreeDigest !== bundleDigest.treeDigest) {
    return {
      verified: false,
      code: 'ERR_TREE_DIGEST_MISMATCH',
      reason: `Shipped files/configs digest mismatch (expected ${bundleDigest.treeDigest.slice(0, 16)}…, receipt ${receiptTreeDigest ? receiptTreeDigest.slice(0, 16) + '…' : 'missing'}).`,
      receiptId: receipt.receiptId,
      keyId: receipt.keyId,
      algorithm: 'Ed25519',
      computedTreeDigest: bundleDigest.treeDigest,
      receiptTreeDigest,
      artifactCount,
      verifiedKeyTransitionChain: true,
      verifiedAt,
    };
  }

  // If binary artifacts are present, confirm the signed payload attests each binary digest
  if (binaryArtifacts.length > 0) {
    const signedBinaryMap =
      parsedPayload.binaryDigests &&
      typeof parsedPayload.binaryDigests === 'object' &&
      !Array.isArray(parsedPayload.binaryDigests)
        ? (parsedPayload.binaryDigests as Record<string, unknown>)
        : null;

    for (const [binPath, binSha] of Object.entries(bundleDigest.binaryDigests)) {
      const signedDigest = signedBinaryMap?.[binPath];
      if (signedDigest !== binSha) {
        return {
          verified: false,
          code: 'ERR_ARTIFACT_DIGEST_MISMATCH',
          reason: `Binary artifact "${binPath}" SHA-256 (${binSha.slice(0, 16)}…) is not attested in the Control Plane receipt.`,
          receiptId: receipt.receiptId,
          keyId: receipt.keyId,
          algorithm: 'Ed25519',
          computedTreeDigest: bundleDigest.treeDigest,
          receiptTreeDigest,
          artifactCount,
          verifiedKeyTransitionChain: true,
          verifiedAt,
        };
      }
    }
  }

  const targetChannel =
    params.expectedChannel ||
    (parsedPayload.channel === 'cloudflare' ||
    parsedPayload.channel === 'genspark' ||
    parsedPayload.channel === 'edge'
      ? parsedPayload.channel
      : undefined);

  if (params.expectedChannel && parsedPayload.channel !== params.expectedChannel) {
    return {
      verified: false,
      code: 'ERR_CHANNEL_MISMATCH',
      reason: `Receipt channel "${String(parsedPayload.channel)}" does not match target channel "${params.expectedChannel}".`,
      receiptId: receipt.receiptId,
      keyId: receipt.keyId,
      algorithm: 'Ed25519',
      computedTreeDigest: bundleDigest.treeDigest,
      receiptTreeDigest,
      artifactCount,
      verifiedKeyTransitionChain: true,
      verifiedAt,
    };
  }

  if (
    params.expectedProjectName &&
    parsedPayload.projectName !== params.expectedProjectName
  ) {
    return {
      verified: false,
      code: 'ERR_PROJECT_MISMATCH',
      reason: `Receipt project "${String(parsedPayload.projectName)}" does not match "${params.expectedProjectName}".`,
      receiptId: receipt.receiptId,
      keyId: receipt.keyId,
      algorithm: 'Ed25519',
      computedTreeDigest: bundleDigest.treeDigest,
      receiptTreeDigest,
      artifactCount,
      verifiedKeyTransitionChain: true,
      verifiedAt,
    };
  }

  if (
    params.expectedWorkspaceId &&
    parsedPayload.workspaceId !== params.expectedWorkspaceId
  ) {
    return {
      verified: false,
      code: 'ERR_WORKSPACE_MISMATCH',
      reason: `Receipt workspace "${String(parsedPayload.workspaceId)}" does not match "${params.expectedWorkspaceId}".`,
      receiptId: receipt.receiptId,
      keyId: receipt.keyId,
      algorithm: 'Ed25519',
      computedTreeDigest: bundleDigest.treeDigest,
      receiptTreeDigest,
      artifactCount,
      verifiedKeyTransitionChain: true,
      verifiedAt,
    };
  }

  const computedBindingsDigest =
    params.expectedBindingsDigest ||
    (targetChannel && params.expectedProjectName
      ? computeClientBindingsDigest({
          channel: targetChannel,
          projectName: params.expectedProjectName,
          files,
          cloudflareBindings: params.cloudflareBindings,
          cloudflareConfig: params.cloudflareConfig,
        })
      : typeof parsedPayload.projectName === 'string' && targetChannel
      ? computeClientBindingsDigest({
          channel: targetChannel,
          projectName: parsedPayload.projectName,
          files,
          cloudflareBindings: params.cloudflareBindings,
          cloudflareConfig: params.cloudflareConfig,
        })
      : undefined);

  const receiptBindingsDigest =
    typeof parsedPayload.bindingsDigest === 'string'
      ? parsedPayload.bindingsDigest
      : undefined;

  if (
    computedBindingsDigest &&
    (!receiptBindingsDigest || receiptBindingsDigest !== computedBindingsDigest)
  ) {
    return {
      verified: false,
      code: 'ERR_BINDINGS_DIGEST_MISMATCH',
      reason: `Cloudflare/Wrangler bindings digest mismatch (expected ${computedBindingsDigest.slice(0, 16)}…, receipt ${receiptBindingsDigest ? receiptBindingsDigest.slice(0, 16) + '…' : 'missing'}).`,
      receiptId: receipt.receiptId,
      keyId: receipt.keyId,
      algorithm: 'Ed25519',
      computedTreeDigest: bundleDigest.treeDigest,
      receiptTreeDigest,
      computedBindingsDigest,
      receiptBindingsDigest,
      artifactCount,
      verifiedKeyTransitionChain: true,
      verifiedAt,
    };
  }

  return {
    verified: true,
    code: 'CLIENT_ED25519_VERIFIED',
    reason: `Client WebCrypto verified Ed25519 receipt ${receipt.receiptId} (key ${receipt.keyId}) across ${artifactCount} artifacts & Cloudflare bindings.`,
    receiptId: receipt.receiptId,
    keyId: receipt.keyId,
    algorithm: 'Ed25519',
    computedTreeDigest: bundleDigest.treeDigest,
    receiptTreeDigest,
    computedBindingsDigest,
    receiptBindingsDigest,
    artifactCount,
    verifiedKeyTransitionChain: true,
    verifiedAt,
  };
}

/**
 * Fetches the authoritative Ed25519 public keyring from the server Control Plane.
 */
export async function fetchControlPlaneKeyring(
  fetchImpl: typeof fetch = fetch
): Promise<ControlPlanePublicKeyring> {
  const res = await fetchImpl('/api/control-plane/keys', {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Control Plane public keyring request failed (HTTP ${res.status}).`);
  }
  const json = (await res.json()) as Partial<ControlPlanePublicKeyring> | null;
  if (
    !json ||
    typeof json.activeKeyId !== 'string' ||
    !json.publicKeysById ||
    typeof json.publicKeysById !== 'object'
  ) {
    throw new Error('Control Plane returned malformed public keyring payload.');
  }
  return {
    activeKeyId: json.activeKeyId,
    publicKeyPem: typeof json.publicKeyPem === 'string' ? json.publicKeyPem : '',
    publicKeysById: json.publicKeysById,
    keyTransitions: Array.isArray(json.keyTransitions) ? json.keyTransitions : [],
  };
}

/**
 * End-to-end client-side deployment gate: fetches the Control Plane public keyring
 * and cryptographically validates the Ed25519 receipt against all shipped files,
 * binaries, and Cloudflare bindings before the client accepts the deployment.
 */
export async function verifyCloudflareShipmentWithControlPlane(params: {
  receipt: Partial<ClientSignedReceipt> | null | undefined;
  files: ProjectFile[];
  binaryArtifacts?: BinaryArtifactInput[];
  cloudflareBindings?: Partial<CloudflareBindings>;
  cloudflareConfig?: Partial<CloudflareAccountConfig>;
  projectName: string;
  channel: 'edge' | 'genspark' | 'cloudflare';
  workspaceId?: string;
  expectedBindingsDigest?: string;
  fetchImpl?: typeof fetch;
}): Promise<ClientReceiptVerificationResult> {
  let keyring: ControlPlanePublicKeyring;
  try {
    keyring = await fetchControlPlaneKeyring(params.fetchImpl || fetch);
  } catch (err: any) {
    return {
      verified: false,
      code: 'ERR_CONTROL_PLANE_KEYRING_UNREACHABLE',
      reason:
        err?.message ||
        'Fail-closed: Cannot fetch Control Plane Ed25519 public keyring to verify receipt.',
      algorithm: 'Ed25519',
      artifactCount:
        (Array.isArray(params.files) ? params.files.length : 0) +
        (Array.isArray(params.binaryArtifacts) ? params.binaryArtifacts.length : 0),
      verifiedAt: Date.now(),
    };
  }

  return validateControlPlaneDeploymentReceipt({
    receipt: params.receipt,
    keyring,
    files: params.files,
    binaryArtifacts: params.binaryArtifacts,
    cloudflareBindings: params.cloudflareBindings,
    cloudflareConfig: params.cloudflareConfig,
    expectedProjectName: params.projectName,
    expectedChannel: params.channel,
    expectedWorkspaceId: params.workspaceId,
    expectedBindingsDigest: params.expectedBindingsDigest,
  });
}

/**
 * Primary client-side Ed25519 cryptographic receipt validator used prior to
 * issuing network deployment requests to Cloudflare / Genspark / Edge endpoints.
 */
export const ed25519Validator = {
  verifySignature: verifyEd25519SignatureWebCrypto,
  verifyKeyTransitions: verifyKeyRotationChainWebCrypto,
  fetchKeyring: fetchControlPlaneKeyring,
  computeBindingsDigest: computeClientBindingsDigest,
  computeBundleDigest: computeArtifactBundleDigest,
  validateReceipt: validateControlPlaneDeploymentReceipt,
  verifyShipment: verifyCloudflareShipmentWithControlPlane,
};

