import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  validateSqlRuleS4,
  verifyIngressToken,
  appendSubstrateLedger,
  verifySubstrateLedger,
  MCP_22_TOOL_CATALOG,
  dispatchSubstrateToolLocal,
} from './sovereignSubstrate';

test('Rule S4 AST Guard allows bare SELECT and WITH queries while stripping comments/literals', () => {
  const selectRes = validateSqlRuleS4(
    "/* lead comment */ SELECT id, '-- not a comment DELETE' AS note FROM pages WHERE domain = 'cloudflare.com' -- trailing"
  );
  assert.equal(selectRes.allowed, true);
  assert.equal(selectRes.normalizedPrefix, 'SELECT');

  const cteRes = validateSqlRuleS4(
    'WITH recent AS (SELECT id FROM pages LIMIT 10) SELECT * FROM recent'
  );
  assert.equal(cteRes.allowed, true);
  assert.equal(cteRes.normalizedPrefix, 'WITH');
});

test('Rule S4 AST Guard rejects chained statements, mutations, and INTO OUTFILE', () => {
  const chained = validateSqlRuleS4('SELECT * FROM pages; DROP TABLE pages');
  assert.equal(chained.allowed, false);
  assert.match(chained.reason || '', /CHAINED_STATEMENTS/);

  const del = validateSqlRuleS4('DELETE FROM pages WHERE id = 1');
  assert.equal(del.allowed, false);
  assert.match(del.reason || '', /RULE_S4_REJECTION/);

  const outfile = validateSqlRuleS4("SELECT * FROM pages INTO OUTFILE '/tmp/leak.csv'");
  assert.equal(outfile.allowed, false);

  const disguised = validateSqlRuleS4('/* harmless */ UPDATE pages SET url = "x"');
  assert.equal(disguised.allowed, false);
});

test('verifyIngressToken validates equal tokens in constant time and rejects mismatches', () => {
  assert.equal(verifyIngressToken('los_tok_9f8a7b', 'los_tok_9f8a7b'), true);
  assert.equal(verifyIngressToken('los_tok_9f8a7c', 'los_tok_9f8a7b'), false);
  assert.equal(verifyIngressToken('short', 'los_tok_9f8a7b'), false);
  assert.equal(verifyIngressToken('', 'los_tok_9f8a7b'), false);
});

test('LOS-CAP-REG-001 domain-separated ledger chains hashes and detects tampering', () => {
  let ledger: any[] = [];
  const step1 = appendSubstrateLedger(ledger, 'vault_sql', 'Vault Query', { sql: 'SELECT 1' });
  ledger = step1.ledger;
  const step2 = appendSubstrateLedger(ledger, 'proxy_health', 'Egress', { healthy: true });
  ledger = step2.ledger;

  assert.equal(verifySubstrateLedger(ledger).valid, true);

  // Tamper payloadDigest on entry 0
  const mutated = ledger.map((e, i) =>
    i === 0 ? { ...e, payloadDigest: 'f'.repeat(64) } : e
  );
  const check = verifySubstrateLedger(mutated);
  assert.equal(check.valid, false);
  assert.equal(check.failedAtSequence, 0);
});

test('Master 22-Tool MCP Catalog has 22 tools across 5 planes and enforces Rule S4 + Auth state machine', () => {
  assert.equal(MCP_22_TOOL_CATALOG.length, 22);

  const okDispatch = dispatchSubstrateToolLocal('vault_sql', { sql: 'SELECT id FROM pages' });
  assert.equal(okDispatch.isError, false);
  assert.equal(okDispatch.finalState, 'CONFIRMED');
  assert.deepEqual(okDispatch.transitions, ['PREPARED', 'SIGNED', 'READ', 'CONFIRMED']);

  const badSql = dispatchSubstrateToolLocal('vault_sql', { sql: 'DROP TABLE pages' });
  assert.equal(badSql.isError, true);
  assert.equal(badSql.finalState, 'FAILED');

  const badAuth = dispatchSubstrateToolLocal(
    'proxy_health',
    {},
    { clientToken: 'wrong', expectedToken: 'expected' }
  );
  assert.equal(badAuth.isError, true);
  assert.equal(badAuth.finalState, 'FAILED');
});
