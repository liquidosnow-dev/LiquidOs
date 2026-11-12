import { AuditLedgerEntry } from '../types';

/**
 * Fast synchronous SHA-256 hex string generator (using standard JS bitwise operations)
 */
function rightRotate(value: number, amount: number) {
  return (value >>> amount) | (value << (32 - amount));
}

export function sha256Hex(ascii: string): string {


  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i: number, j: number;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0x0bef9a3f, 0xc67178f2,
  ];

  ascii += '\x80';
  while (ascii.length % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return ''; // ASCII only
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0;

      const s1ch = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + s1ch + ch + k[i] + w[i]) | 0;
      const s0maj = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0maj + maj) | 0;

      hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? 0 : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Appends a tamper-evident entry to the Liquid Mercury SHA-256 Audit Ledger
 */
export function appendAuditLedger(
  ledger: AuditLedgerEntry[],
  action: string,
  entityId: string,
  author: string,
  data: any
): { ledger: AuditLedgerEntry[]; newEntry: AuditLedgerEntry } {
  const previousHash = ledger.length > 0 ? ledger[ledger.length - 1].hash : '0000000000000000000000000000000000000000000000000000000000000000';
  const index = ledger.length;
  const timestamp = Date.now();

  const serializedData = typeof data === 'string' ? data : JSON.stringify(data);
  const payloadToHash = `${index}:${action}:${entityId}:${author}:${timestamp}:${serializedData}:${previousHash}`;
  const hash = sha256Hex(payloadToHash);

  const newEntry: AuditLedgerEntry = {
    index,
    action,
    entityId,
    author,
    timestamp,
    data,
    previousHash,
    hash,
  };

  return {
    ledger: [...ledger, newEntry],
    newEntry,
  };
}

/**
 * Validates the cryptographic integrity of the entire audit ledger chain
 */
export function verifyAuditLedgerIntegrity(ledger: AuditLedgerEntry[]): { valid: boolean; corruptedIndex?: number } {
  for (let i = 0; i < ledger.length; i++) {
    const entry = ledger[i];
    const expectedPrev = i === 0 ? '0000000000000000000000000000000000000000000000000000000000000000' : ledger[i - 1].hash;

    if (entry.previousHash !== expectedPrev) {
      return { valid: false, corruptedIndex: i };
    }

    const serializedData = typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data);
    const payloadToHash = `${entry.index}:${entry.action}:${entry.entityId}:${entry.author}:${entry.timestamp}:${serializedData}:${entry.previousHash}`;
    const calculatedHash = sha256Hex(payloadToHash);

    if (calculatedHash !== entry.hash) {
      return { valid: false, corruptedIndex: i };
    }
  }
  return { valid: true };
}

/**
 * Simulates AES-GCM 256-bit encryption at rest
 */
export function simulateAesGcmEncrypt(plaintext: string): { ciphertext: string; iv: string; tag: string; algorithm: string } {
  const iv = Array.from({ length: 12 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
  const tag = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
  // Simple obfuscated base64 simulation representing encrypted block
  let encoded = '';
  try {
    encoded = btoa(unescape(encodeURIComponent(plaintext)));
  } catch {
    encoded = Buffer.from(plaintext).toString('base64');
  }

  return {
    ciphertext: `enc_v1:${encoded}`,
    iv,
    tag,
    algorithm: 'AES-256-GCM',
  };
}

/**
 * Simulates MFA TOTP 6-digit verification
 */
export function verifyMfaCode(enteredCode: string): boolean {
  const cleaned = enteredCode.replace(/\s+/g, '');
  // Validates any 6-digit number (in demo mode: 123456 or matching regular numeric 6-digit format)
  return /^[0-9]{6}$/.test(cleaned);
}
