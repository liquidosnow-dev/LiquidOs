"""Unit and integration tests for keystore, signing, continuity, access transfer, audit log, and scripts."""
from __future__ import annotations

import json
import os
import stat
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

import an_nexus.assertions as assertions_mod
import an_nexus.keystore as keystore_mod
import an_nexus.signing as signing_mod
import scripts.preflight as preflight_mod
from an_nexus.access_state import (
    AccessState,
    check_and_bump_fence,
    issue,
    make_receipt,
    verify as verify_access,
    verify_receipt,
)
from an_nexus.assertions import (
    EXIT_A1_ALIASING,
    EXIT_A2_PIN_MISMATCH,
    EXIT_A3_SCOPE_PARITY,
    EXIT_A4_SIGNATURE,
    AssertionFailure,
    a1_no_aliasing,
    a2_pinned_attestation,
    a3_scope_parity,
    a4_signature_valid,
    compute_all,
)
from an_nexus.audit_log import append as audit_append, verify_log
from an_nexus.continuity import Anchor, append_anchor, create_anchor, read_chain, verify_chain
from an_nexus.digests import d_attest
from an_nexus.keystore import (
    HAS_CRYPTOGRAPHY,
    SignatureError,
    generate_private_key,
    load_private_pem,
    lookup_key,
    public_pem,
    register_key,
    save_private_pem,
)
from an_nexus.manifest import write as write_manifest
from an_nexus.signing import sign, strip_sig, verify_sig

REPO_ROOT = Path(__file__).resolve().parents[1]


class KeystoreTests(unittest.TestCase):
    def test_keystore_fail_closed_without_cryptography(self) -> None:
        with mock.patch.object(keystore_mod, "HAS_CRYPTOGRAPHY", False), mock.patch.object(
            signing_mod, "HAS_CRYPTOGRAPHY", False
        ):
            with self.assertRaisesRegex(SignatureError, "cryptography required"):
                keystore_mod.generate_private_key()
            with self.assertRaisesRegex(SignatureError, "cryptography required"):
                signing_mod.verify_sig("pem", "attestation", {"a": 1}, "AAAA")

    @unittest.skipUnless(HAS_CRYPTOGRAPHY, "cryptography required (pip install cryptography)")
    def test_keystore_roundtrip_0600_and_registry(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            priv_path = root / "auditor.pem"
            reg_path = root / "registry.json"
            key = generate_private_key()
            save_private_pem(key, priv_path)
            self.assertEqual(stat.S_IMODE(os.stat(priv_path).st_mode), 0o600)

            loaded = load_private_pem(priv_path)
            self.assertEqual(public_pem(loaded), public_pem(key))

            reg = register_key({"keys": []}, "aud1", "AUDIT_SIGNER", key)
            reg_path.write_text(json.dumps(reg), encoding="utf-8")
            found = lookup_key(reg_path, "aud1")
            self.assertEqual(found["role"], "AUDIT_SIGNER")


class SigningTests(unittest.TestCase):
    @unittest.skipUnless(HAS_CRYPTOGRAPHY, "cryptography required (pip install cryptography)")
    def test_sign_and_verify_roundtrip(self) -> None:
        key = generate_private_key()
        payload = {"id": "p1", "count": 33}
        sig = sign(key, "attestation", payload)
        self.assertTrue(verify_sig(public_pem(key), "attestation", payload, sig))

    @unittest.skipUnless(HAS_CRYPTOGRAPHY, "cryptography required (pip install cryptography)")
    def test_sign_tampered_payload_rejected(self) -> None:
        key = generate_private_key()
        payload = {"id": "p1", "count": 33}
        sig = sign(key, "attestation", payload)
        self.assertFalse(verify_sig(public_pem(key), "attestation", {"id": "p1", "count": 34}, sig))

    @unittest.skipUnless(HAS_CRYPTOGRAPHY, "cryptography required (pip install cryptography)")
    def test_cross_domain_rejected(self) -> None:
        key = generate_private_key()
        payload = {"seq": 0, "note": "cross-domain"}
        sig = sign(key, "continuity_anchor", payload)
        pub = public_pem(key)
        self.assertTrue(verify_sig(pub, "continuity_anchor", payload, sig))
        self.assertFalse(verify_sig(pub, "attestation", payload, sig))
        self.assertFalse(verify_sig(pub, "access_state", payload, sig))
        self.assertFalse(verify_sig(pub, "audit_entry", payload, sig))

    @unittest.skipUnless(HAS_CRYPTOGRAPHY, "cryptography required (pip install cryptography)")
    def test_sign_malformed_signature_and_bad_pem_rejected(self) -> None:
        key = generate_private_key()
        pub = public_pem(key)
        self.assertFalse(verify_sig(pub, "attestation", {"a": 1}, "not-base64!!!"))
        self.assertFalse(verify_sig("not-a-pem", "attestation", {"a": 1}, "AAAA"))


class ContinuityTests(unittest.TestCase):
    def test_continuity_empty_chain_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            reg_path = Path(td) / "registry.json"
            reg_path.write_text(json.dumps({"keys": []}), encoding="utf-8")
            with self.assertRaises(AssertionFailure):
                verify_chain([], reg_path)

    @unittest.skipUnless(HAS_CRYPTOGRAPHY, "cryptography required (pip install cryptography)")
    def test_continuity_chain_roundtrip_and_verify(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            auditor = generate_private_key()
            reg_path = root / "registry.json"
            reg_path.write_text(
                json.dumps(register_key({"keys": []}, "aud1", "AUDIT_SIGNER", auditor)),
                encoding="utf-8",
            )
            chain_path = root / "chain.jsonl"
            a0 = create_anchor(auditor, "aud1", 0, None, "pin0", "init")
            a1 = create_anchor(auditor, "aud1", 1, a0, "pin0", "next")
            append_anchor(chain_path, a0)
            append_anchor(chain_path, a1)
            verify_chain(read_chain(chain_path), reg_path)

    @unittest.skipUnless(HAS_CRYPTOGRAPHY, "cryptography required (pip install cryptography)")
    def test_continuity_seq_gap_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            auditor = generate_private_key()
            reg_path = Path(td) / "registry.json"
            reg_path.write_text(
                json.dumps(register_key({"keys": []}, "aud1", "AUDIT_SIGNER", auditor)),
                encoding="utf-8",
            )
            a0 = create_anchor(auditor, "aud1", 0, None, "pin0", "init")
            bad_seq = create_anchor(auditor, "aud1", 2, a0, "pin0", "gap")
            with self.assertRaisesRegex(AssertionFailure, "seq gap"):
                verify_chain([a0, bad_seq], reg_path)

    @unittest.skipUnless(HAS_CRYPTOGRAPHY, "cryptography required (pip install cryptography)")
    def test_continuity_prev_hash_tamper_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            auditor = generate_private_key()
            reg_path = Path(td) / "registry.json"
            reg_path.write_text(
                json.dumps(register_key({"keys": []}, "aud1", "AUDIT_SIGNER", auditor)),
                encoding="utf-8",
            )
            a0 = create_anchor(auditor, "aud1", 0, None, "pin0", "init")
            a1 = create_anchor(auditor, "aud1", 1, a0, "pin0", "next")
            tampered = Anchor(
                seq=1,
                prev_hash="dead" * 16,
                attest_pin="pin0",
                note="next",
                signer_id="aud1",
                sig=a1.sig,
            )
            with self.assertRaisesRegex(AssertionFailure, "prev_hash mismatch"):
                verify_chain([a0, tampered], reg_path)

    @unittest.skipUnless(HAS_CRYPTOGRAPHY, "cryptography required (pip install cryptography)")
    def test_continuity_payload_tamper_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            auditor = generate_private_key()
            reg_path = Path(td) / "registry.json"
            reg_path.write_text(
                json.dumps(register_key({"keys": []}, "aud1", "AUDIT_SIGNER", auditor)),
                encoding="utf-8",
            )
            a0 = create_anchor(auditor, "aud1", 0, None, "pin0", "init")
            a1 = create_anchor(auditor, "aud1", 1, a0, "pin0", "next")
            tampered = Anchor(
                seq=1,
                prev_hash=a1.prev_hash,
                attest_pin="pin0",
                note="TAMPERED",
                signer_id="aud1",
                sig=a1.sig,
            )
            with self.assertRaisesRegex(AssertionFailure, "Invalid continuity signature"):
                verify_chain([a0, tampered], reg_path)

    @unittest.skipUnless(HAS_CRYPTOGRAPHY, "cryptography required (pip install cryptography)")
    def test_continuity_unauthorized_role_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            verifier = generate_private_key()
            reg_path = Path(td) / "registry.json"
            reg_path.write_text(
                json.dumps(register_key({"keys": []}, "v1", "INDEPENDENT_VERIFIER", verifier)),
                encoding="utf-8",
            )
            bad = create_anchor(verifier, "v1", 0, None, "pin0", "wrong-role")
            with self.assertRaisesRegex(AssertionFailure, "not authorized"):
                verify_chain([bad], reg_path)


class AccessTransferTests(unittest.TestCase):
    @unittest.skipUnless(HAS_CRYPTOGRAPHY, "cryptography required (pip install cryptography)")
    def test_access_issue_and_verify_roundtrip(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            issuer = generate_private_key()
            reg_path = Path(td) / "registry.json"
            reg_path.write_text(
                json.dumps(register_key({"keys": []}, "iss1", "PROJECT_ISSUER", issuer)),
                encoding="utf-8",
            )
            st = issue(issuer, "iss1", "op:alice", ["read", "write"], "pin0", fencing_version=1, ttl_seconds=600)
            verify_access(st, reg_path)

    @unittest.skipUnless(HAS_CRYPTOGRAPHY, "cryptography required (pip install cryptography)")
    def test_access_expiry_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            issuer = generate_private_key()
            reg_path = Path(td) / "registry.json"
            reg_path.write_text(
                json.dumps(register_key({"keys": []}, "iss1", "PROJECT_ISSUER", issuer)),
                encoding="utf-8",
            )
            expired = issue(
                issuer,
                "iss1",
                "op:alice",
                ["read"],
                "pin0",
                fencing_version=1,
                expires_at=int(time.time()) - 30,
            )
            with self.assertRaisesRegex(AssertionFailure, "expired"):
                verify_access(expired, reg_path)

    @unittest.skipUnless(HAS_CRYPTOGRAPHY, "cryptography required (pip install cryptography)")
    def test_access_payload_tamper_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            issuer = generate_private_key()
            reg_path = Path(td) / "registry.json"
            reg_path.write_text(
                json.dumps(register_key({"keys": []}, "iss1", "PROJECT_ISSUER", issuer)),
                encoding="utf-8",
            )
            st = issue(issuer, "iss1", "op:alice", ["read"], "pin0", fencing_version=1, ttl_seconds=600)
            tampered = AccessState(
                session_id=st.session_id,
                issuer_id=st.issuer_id,
                subject="op:admin",
                scopes=["read", "write"],
                attest_pin=st.attest_pin,
                fencing_version=st.fencing_version,
                sig=st.sig,
                expires_at=st.expires_at,
            )
            with self.assertRaisesRegex(AssertionFailure, "Invalid access state signature"):
                verify_access(tampered, reg_path)

    @unittest.skipUnless(HAS_CRYPTOGRAPHY, "cryptography required (pip install cryptography)")
    def test_access_unauthorized_role_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            verifier = generate_private_key()
            reg_path = Path(td) / "registry.json"
            reg_path.write_text(
                json.dumps(register_key({"keys": []}, "v1", "INDEPENDENT_VERIFIER", verifier)),
                encoding="utf-8",
            )
            st = issue(verifier, "v1", "op:alice", ["read"], "pin0", fencing_version=1, ttl_seconds=600)
            with self.assertRaisesRegex(AssertionFailure, "not authorized"):
                verify_access(st, reg_path)

    def test_fencing_replay_monotonicity_enforced(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            ledger = Path(td) / "fencing.json"
            self.assertEqual(check_and_bump_fence(ledger, "sess1", 1), 1)
            with self.assertRaisesRegex(AssertionFailure, "Stale fencing token"):
                check_and_bump_fence(ledger, "sess1", 1)
            with self.assertRaisesRegex(AssertionFailure, "Stale fencing token"):
                check_and_bump_fence(ledger, "sess1", 0)
            self.assertEqual(check_and_bump_fence(ledger, "sess1", 2), 2)

    @unittest.skipUnless(HAS_CRYPTOGRAPHY, "cryptography required (pip install cryptography)")
    def test_receipt_state_hash_mismatch(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            issuer = generate_private_key()
            reg_path = Path(td) / "registry.json"
            reg_path.write_text(
                json.dumps(register_key({"keys": []}, "iss1", "PROJECT_ISSUER", issuer)),
                encoding="utf-8",
            )
            st = issue(issuer, "iss1", "op:alice", ["read"], "pin0", fencing_version=1, ttl_seconds=600)
            receipt = make_receipt(st, issuer, "iss1")
            verify_receipt(receipt, st, reg_path)

            other_st = issue(issuer, "iss1", "op:bob", ["read"], "pin0", fencing_version=1, ttl_seconds=600)
            with self.assertRaisesRegex(AssertionFailure, "does not match access state"):
                verify_receipt(receipt, other_st, reg_path)


class AuditLogTests(unittest.TestCase):
    @unittest.skipUnless(HAS_CRYPTOGRAPHY, "cryptography required (pip install cryptography)")
    def test_audit_log_append_and_verify_roundtrip(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            key = generate_private_key()
            reg_path = root / "registry.json"
            reg_path.write_text(
                json.dumps(register_key({"keys": []}, "aud1", "AUDIT_SIGNER", key)),
                encoding="utf-8",
            )
            log_path = root / "audit.jsonl"
            audit_append(key, "aud1", log_path, "evt.one", "test", {"ok": True})
            audit_append(key, "aud1", log_path, "evt.two", "test", {"n": 2})
            self.assertEqual(verify_log(log_path, reg_path), 2)

    @unittest.skipUnless(HAS_CRYPTOGRAPHY, "cryptography required (pip install cryptography)")
    def test_audit_log_tamper_and_chain_break_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            key = generate_private_key()
            reg_path = root / "registry.json"
            reg_path.write_text(
                json.dumps(register_key({"keys": []}, "aud1", "AUDIT_SIGNER", key)),
                encoding="utf-8",
            )
            log_path = root / "audit.jsonl"
            audit_append(key, "aud1", log_path, "evt.one", "test", {"ok": True})
            audit_append(key, "aud1", log_path, "evt.two", "test", {"n": 2})

            lines = [json.loads(ln) for ln in log_path.read_text(encoding="utf-8").splitlines()]
            lines[1]["detail"] = {"n": 999}
            log_path.write_text("\n".join(json.dumps(x) for x in lines) + "\n", encoding="utf-8")
            with self.assertRaises(AssertionFailure):
                verify_log(log_path, reg_path)


class IntegrationTests(unittest.TestCase):
    @unittest.skipUnless(HAS_CRYPTOGRAPHY, "cryptography required (pip install cryptography)")
    def test_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            vkey = generate_private_key()
            akey = generate_private_key()
            ikey = generate_private_key()

            reg = {"keys": []}
            register_key(reg, "ver", "INDEPENDENT_VERIFIER", vkey)
            register_key(reg, "aud", "AUDIT_SIGNER", akey)
            register_key(reg, "iss", "PROJECT_ISSUER", ikey)
            reg_path = root / "registry.json"
            reg_path.write_text(json.dumps(reg), encoding="utf-8")

            entries = [{"path": f"art_{i:02d}.txt", "sha256": f"{i:064x}"} for i in range(33)]
            mp = root / "manifest.json"
            dm = write_manifest(mp, entries, expected_count=33)

            env = {"attestation_id": "E2E", "manifest_digest": dm, "verifier_key_id": "ver"}
            env["sig"] = sign(vkey, "attestation", strip_sig(env))
            ep = root / "envelope.json"
            ep.write_text(json.dumps(env), encoding="utf-8")
            pin = d_attest(env)

            a1_no_aliasing(entries, dm, pin)
            a2_pinned_attestation(pin, pin)
            a3_scope_parity(entries, mp, expected_count=33)
            a4_signature_valid(ep, reg_path)

            chain_path = root / "chain.jsonl"
            a0 = create_anchor(akey, "aud", 0, None, pin, "e2e")
            append_anchor(chain_path, a0)
            verify_chain(read_chain(chain_path), reg_path)

            st = issue(ikey, "iss", "op:e2e", ["read"], pin, fencing_version=1, ttl_seconds=600)
            verify_access(st, reg_path)
            check_and_bump_fence(root / "fencing.json", st.session_id, st.fencing_version)
            rcpt = make_receipt(st, ikey, "iss")
            verify_receipt(rcpt, st, reg_path)

            log_path = root / "audit.jsonl"
            audit_append(akey, "aud", log_path, "pipeline.ok", "e2e", {"pin": pin})
            self.assertEqual(verify_log(log_path, reg_path), 1)

    @unittest.skipUnless(HAS_CRYPTOGRAPHY, "cryptography required (pip install cryptography)")
    def test_cross_domain_forgery_blocked(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            key = generate_private_key()
            reg_path = root / "registry.json"
            reg_path.write_text(
                json.dumps(register_key({"keys": []}, "v1", "INDEPENDENT_VERIFIER", key)),
                encoding="utf-8",
            )
            forged = {"attestation_id": "FORGED", "verifier_key_id": "v1"}
            forged["sig"] = sign(key, "audit_entry", forged)
            env_path = root / "envelope.json"
            env_path.write_text(json.dumps(forged), encoding="utf-8")
            with self.assertRaises(AssertionFailure):
                a4_signature_valid(env_path, reg_path)


class ScriptExitCodeTests(unittest.TestCase):
    def test_scripts_exit_codes_b1_annex_summary_and_preflight(self) -> None:
        emit_proc = subprocess.run(
            [sys.executable, "-m", "scripts.emit_manifest", "--paths", "data/workspace_v4.paths.example"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
        )
        self.assertEqual(emit_proc.returncode, 5)

        annex_proc = subprocess.run(
            [sys.executable, "-m", "scripts.verify_annex_a", "--ledger", "data/annex_a_ledger.json"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
        )
        self.assertEqual(annex_proc.returncode, 1)

        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            summary_fail = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "scripts.continuity_summary",
                    "--preflight",
                    str(root / "pf.json"),
                    "--manifest",
                    str(root / "m.json"),
                    "--chain",
                    str(root / "c.jsonl"),
                    "--ledger",
                    str(root / "f.json"),
                    "--audit",
                    str(root / "a.jsonl"),
                ],
                cwd=REPO_ROOT,
                capture_output=True,
                text=True,
            )
            self.assertEqual(summary_fail.returncode, 1)

            summary_zero = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "scripts.continuity_summary",
                    "--preflight",
                    str(root / "pf.json"),
                    "--manifest",
                    str(root / "m.json"),
                    "--chain",
                    str(root / "c.jsonl"),
                    "--ledger",
                    str(root / "f.json"),
                    "--audit",
                    str(root / "a.jsonl"),
                    "--allow-zero-state",
                ],
                cwd=REPO_ROOT,
                capture_output=True,
                text=True,
            )
            self.assertEqual(summary_zero.returncode, 0)

            entries = [{"path": "a.txt", "sha256": "11" * 32}]
            mp = root / "manifest.json"
            write_manifest(mp, entries)
            a3_scope_parity(entries, mp)

            reg_path = root / "registry.json"
            reg_path.write_text(
                json.dumps({"keys": [{"key_id": "v1", "role": "INDEPENDENT_VERIFIER", "public_key_pem": "PEM"}]}),
                encoding="utf-8",
            )
            env = {"attestation_id": "PF", "verifier_key_id": "v1", "sig": "AAAA"}
            ep = root / "env.json"
            ep.write_text(json.dumps(env), encoding="utf-8")

            # Dummy envelope against hardcoded v4 pin halts at A2 (exit 2), before A4
            pf_a2 = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "scripts.preflight",
                    "--manifest",
                    str(mp),
                    "--envelope",
                    str(ep),
                    "--registry",
                    str(reg_path),
                ],
                cwd=REPO_ROOT,
                capture_output=True,
                text=True,
            )
            self.assertEqual(pf_a2.returncode, EXIT_A2_PIN_MISMATCH)

            # --pin CLI override must not exist on preflight
            pf_no_flag = subprocess.run(
                [sys.executable, "-m", "scripts.preflight", "--pin", d_attest(env)],
                cwd=REPO_ROOT,
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(pf_no_flag.returncode, 0)
            self.assertIn("unrecognized arguments: --pin", pf_no_flag.stderr)

            # Isolate A4 in test memory only via mock.patch.object on EXPECTED_D_ATTEST
            with mock.patch.object(assertions_mod, "EXPECTED_D_ATTEST", d_attest(env)):
                rc_a4 = preflight_mod.main(
                    [
                        "--manifest",
                        str(mp),
                        "--envelope",
                        str(ep),
                        "--registry",
                        str(reg_path),
                    ]
                )
            self.assertEqual(rc_a4, EXIT_A4_SIGNATURE)

            # compute_all direct A1/A3 checks
            rc1, _ = compute_all(entries + entries, mp, ep, reg_path, expected_pin=d_attest(env))
            self.assertEqual(rc1, EXIT_A1_ALIASING)
            rc3, _ = compute_all(
                [{"path": "other.txt", "sha256": "22" * 32}],
                mp,
                ep,
                reg_path,
                expected_pin=d_attest(env),
            )
            self.assertEqual(rc3, EXIT_A3_SCOPE_PARITY)


if __name__ == "__main__":
    unittest.main()
