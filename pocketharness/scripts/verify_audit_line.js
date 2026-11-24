#!/usr/bin/env node
/**
 * Verify the last (or specified) audit.jsonl line against an Ed25519 public key.
 *
 * Usage:
 *   node verify_audit_line.js [--audit path] [--pub path]
 * Env defaults: bridge/audit.jsonl, bridge/.ed25519_pub.pem (cwd-relative)
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const auditPath = path.resolve(arg("--audit", path.join("bridge", "audit.jsonl")));
const pubPath = path.resolve(arg("--pub", path.join("bridge", ".ed25519_pub.pem")));

if (!fs.existsSync(auditPath)) {
  console.error("FAIL: audit file missing:", auditPath);
  process.exit(2);
}
if (!fs.existsSync(pubPath)) {
  console.error("FAIL: public key missing:", pubPath);
  process.exit(2);
}

const pubPem = fs.readFileSync(pubPath, "utf8");
const lines = fs
  .readFileSync(auditPath, "utf8")
  .trim()
  .split("\n")
  .filter(Boolean);

if (!lines.length) {
  console.error("FAIL: audit.jsonl empty");
  process.exit(2);
}

const last = JSON.parse(lines[lines.length - 1]);
const payload = last.canonicalPayload;
const sigB64 = last.ed25519Signature;

if (typeof payload !== "string" || typeof sigB64 !== "string") {
  console.error("FAIL: missing canonicalPayload or ed25519Signature on last line");
  process.exit(2);
}

let valid = false;
try {
  valid = crypto.verify(
    null,
    Buffer.from(payload, "utf8"),
    pubPem,
    Buffer.from(sigB64, "base64")
  );
} catch (e) {
  console.error("FAIL: verify threw:", e.message);
  process.exit(1);
}

const fingerprint = last.publicKeyFingerprint || "(none)";
console.log(JSON.stringify({
  ok: valid,
  publicKeyFingerprint: fingerprint,
  auditPath,
  lines: lines.length,
}, null, 2));

process.exit(valid ? 0 : 1);
