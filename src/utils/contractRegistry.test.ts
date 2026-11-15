import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  canonicalize,
  assertSafeIntegerLiterals,
  validateEnvelope,
  SAMPLE_ENVELOPES,
  DIVERGENCE_PROBES,
  getUnifiedOneProjectFiles,
} from './contractRegistry';

test('Contract Registry: RFC 8785 handles float, -0, astral UTF-16 sorting, and non-ASCII', () => {
  assert.equal(canonicalize({ a: 1.0 }), '{"a":1}');
  assert.equal(canonicalize({ a: -0 }), '{"a":0}');
  assert.equal(canonicalize({ 'é': 'ü' }), '{"é":"ü"}');
  assert.equal(canonicalize(['\u2028', '\u2029']), '["\u2028","\u2029"]');
  // Astral emoji U+1F600 (UTF-16 0xD83D) must sort BEFORE 0xFFFF in JCS
  assert.equal(canonicalize({ '\uFFFF': 1, '😀': 2 }), '{"😀":2,"\uFFFF":1}');
});

test('Contract Registry: assertSafeIntegerLiterals catches 2^53+1 and overflow while allowing 1e21', () => {
  assert.throws(() => assertSafeIntegerLiterals('{"n":9007199254740993}'), { code: 'EVC_INT_UNSAFE' });
  assert.throws(() => assertSafeIntegerLiterals('{"n":1e999}'), { code: 'EVC_NONFINITE' });
  assert.doesNotThrow(() => assertSafeIntegerLiterals('{"n":1e21}'));
  assert.doesNotThrow(() => assertSafeIntegerLiterals('{"n":"9007199254740993"}'));
});

test('Contract Registry: rejects lone surrogates and Infinity/NaN', () => {
  assert.throws(() => canonicalize('\ud800'), { code: 'EVC_LONE_SURROGATE' });
  assert.throws(() => canonicalize({ n: Infinity }), { code: 'EVC_NONFINITE' });
  assert.throws(() => canonicalize({ n: NaN }), { code: 'EVC_NONFINITE' });
});

test('Contract Registry: validateEnvelope enforces all semantic checks and explicit NOT_RUN boundary', () => {
  for (const sample of SAMPLE_ENVELOPES) {
    const res = validateEnvelope(sample.payload);
    assert.equal(res.verdict, sample.expected, `Expected ${sample.id} to be ${sample.expected}`);
    assert.equal(res.scope, 'structural_validation_only');
    assert.equal(res.verification.signature, 'NOT_RUN');
    assert.equal(res.verification.authorization, 'NOT_RUN');
    assert.equal(res.verification.trustAnchor, 'NOT_RUN');
  }
});

test('Contract Registry: Divergence probes cover all 7 cross-runtime cases', () => {
  assert.equal(DIVERGENCE_PROBES.length, 7);
});

test('Unified Project ONE master file tree includes verification-tools, schemas, tests, and src', () => {
  const files = getUnifiedOneProjectFiles();
  const paths = files.map((f) => f.path);
  assert.ok(paths.includes('verification-tools/canonical.ts'));
  assert.ok(paths.includes('verification-tools/canonical.py'));
  assert.ok(paths.includes('schemas/evidence-envelope.schema.json'));
  assert.ok(paths.includes('src/index.ts'));
  assert.ok(paths.includes('index.html'));
});
