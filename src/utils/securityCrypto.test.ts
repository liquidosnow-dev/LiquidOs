import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex, appendAuditLedger, verifyAuditLedgerIntegrity, simulateAesGcmEncrypt, verifyMfaCode } from './securityCrypto';

test('sha256Hex produces standard 64-char hex hash and is deterministic', () => {
  const hash1 = sha256Hex('hello world');
  const hash2 = sha256Hex('hello world');
  const hash3 = sha256Hex('hello world 2');

  assert.equal(hash1.length, 64);
  assert.equal(/^[0-9a-f]{64}$/.test(hash1), true);
  assert.equal(hash1, hash2);
  assert.notEqual(hash1, hash3);
});

test('appendAuditLedger builds verifiable cryptographic chain', () => {
  let ledger: any[] = [];
  const res1 = appendAuditLedger(ledger, 'HOOK_INGRESS', 'evt_1', 'Mercy', { packets: 1232 });
  ledger = res1.ledger;

  const res2 = appendAuditLedger(ledger, 'VAULT_COMMIT', 'evt_2', 'Mercy', { table: 'wal_sqlite' });
  ledger = res2.ledger;

  assert.equal(ledger.length, 2);
  assert.equal(ledger[1].previousHash, ledger[0].hash);

  const verification = verifyAuditLedgerIntegrity(ledger);
  assert.equal(verification.valid, true);
});

test('verifyAuditLedgerIntegrity detects tamper modifications', () => {
  let ledger: any[] = [];
  const res1 = appendAuditLedger(ledger, 'HOOK_INGRESS', 'evt_1', 'Mercy', { test: true });
  ledger = res1.ledger;
  const res2 = appendAuditLedger(ledger, 'VAULT_COMMIT', 'evt_2', 'Mercy', { test: true });
  ledger = res2.ledger;

  // Tamper with first entry
  ledger[0].data = { test: false }; // Tampered!

  const verification = verifyAuditLedgerIntegrity(ledger);
  assert.equal(verification.valid, false);
});

test('simulateAesGcmEncrypt provides AES-256-GCM package', () => {
  const enc = simulateAesGcmEncrypt('secret-config-data');
  assert.equal(enc.algorithm, 'AES-256-GCM');
  assert.equal(enc.iv.length, 24);
  assert.equal(enc.tag.length, 32);
  assert.equal(enc.ciphertext.startsWith('enc_v1:'), true);
});

test('verifyMfaCode validates 6-digit TOTP tokens', () => {
  assert.equal(verifyMfaCode('123456'), true);
  assert.equal(verifyMfaCode(' 987654 '), true);
  assert.equal(verifyMfaCode('12345'), false);
  assert.equal(verifyMfaCode('abcdef'), false);
});
