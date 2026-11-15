import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  INITIAL_SANDBOX_SPECS,
  INITIAL_CLOUDFLARE_BINDINGS,
  INITIAL_GENSPARK_SITE,
  INITIAL_CLOUDFLARE_ACCOUNT,
  INITIAL_GITHUB_REPO,
  INITIAL_BACKUPS,
  getHonoFullstackInitialFiles,
  executeTerminalCommand,
} from './sandboxEngine';

test('Sandbox Engine: Initial specs reflect Pro 4 vCPU / 8 GB RAM / NVIDIA GPU', () => {
  assert.equal(INITIAL_SANDBOX_SPECS.plan, 'Pro');
  assert.equal(INITIAL_SANDBOX_SPECS.cpus, 4);
  assert.equal(INITIAL_SANDBOX_SPECS.ramGb, 8);
  assert.ok(INITIAL_SANDBOX_SPECS.gpu.includes('NVIDIA'));
  assert.equal(INITIAL_SANDBOX_SPECS.autoPauseMinutes, 60);
});

test('Sandbox Engine: Cloudflare bindings include D1, KV, and R2', () => {
  assert.ok(INITIAL_CLOUDFLARE_BINDINGS.d1Databases.some(d => d.name === 'DB_PROD'));
  assert.ok(INITIAL_CLOUDFLARE_BINDINGS.kvNamespaces.some(k => k.name === 'CACHE_KV'));
  assert.ok(INITIAL_CLOUDFLARE_BINDINGS.r2Buckets.some(r => r.name === 'ASSETS_R2'));
});

test('Sandbox Engine: Genspark configuration provides edge domain and SSL status', () => {
  assert.equal(INITIAL_GENSPARK_SITE.subdomain, 'liquidos-hono');
  assert.ok(INITIAL_GENSPARK_SITE.permanentUrl.includes('gensparksite.com'));
  assert.equal(INITIAL_GENSPARK_SITE.sslStatus, 'ACTIVE');
});

test('Sandbox Engine: Initial fullstack files generate Hono router, wrangler.jsonc and package.json', () => {
  const files = getHonoFullstackInitialFiles();
  const indexTs = files.find(f => f.path === 'src/index.ts');
  const wrangler = files.find(f => f.path === 'wrangler.jsonc');
  const pkg = files.find(f => f.path === 'package.json');
  const indexHtml = files.find(f => f.path === 'index.html');

  assert.ok(indexTs && indexTs.content.includes("new Hono<{ Bindings: Env }>()"));
  assert.ok(wrangler && wrangler.content.includes('"binding": "DB"'));
  assert.ok(pkg && pkg.content.includes('"hono"'));
  assert.ok(indexHtml && indexHtml.content.includes('Enterprise Cloud Sandbox'));
});

test('Sandbox Engine: Terminal simulator executes common Linux and cloud dev commands', () => {
  const files = getHonoFullstackInitialFiles();
  
  // pwd
  const pwdRes = executeTerminalCommand('pwd', files, INITIAL_SANDBOX_SPECS, INITIAL_CLOUDFLARE_BINDINGS);
  assert.equal(pwdRes.exitCode, 0);
  assert.equal(pwdRes.output, '/home/user/webapp');

  // uname -a
  const unameRes = executeTerminalCommand('uname -a', files, INITIAL_SANDBOX_SPECS, INITIAL_CLOUDFLARE_BINDINGS);
  assert.equal(unameRes.exitCode, 0);
  assert.ok(unameRes.output.includes('Linux'));

  // pnpm run dev
  const devRes = executeTerminalCommand('pnpm run dev', files, INITIAL_SANDBOX_SPECS, INITIAL_CLOUDFLARE_BINDINGS);
  assert.equal(devRes.exitCode, 0);
  assert.ok(devRes.output.includes('Hono API: http://localhost:8787/api'));

  // wrangler d1 execute
  const d1Res = executeTerminalCommand('wrangler d1 execute DB_PROD', files, INITIAL_SANDBOX_SPECS, INITIAL_CLOUDFLARE_BINDINGS);
  assert.equal(d1Res.exitCode, 0);
  assert.ok(d1Res.output.includes('Executing on DB_PROD'));

  // curl /api/health
  const curlRes = executeTerminalCommand('curl http://localhost:8787/api/health', files, INITIAL_SANDBOX_SPECS, INITIAL_CLOUDFLARE_BINDINGS);
  assert.equal(curlRes.exitCode, 0);
  assert.ok(curlRes.output.includes('Cloudflare Edge / Node.js Sandbox'));

  // unknown command
  const unknownRes = executeTerminalCommand('invalid_cmd_123', files, INITIAL_SANDBOX_SPECS, INITIAL_CLOUDFLARE_BINDINGS);
  assert.equal(unknownRes.exitCode, 127);
});
