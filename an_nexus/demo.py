"""Self-contained end-to-end demo.

Creates a temporary workspace, generates synthetic artifacts + keys,
builds a manifest + envelope, runs A1–A4 against a DEMO pin, creates a
continuity anchor, issues access, transfers it, emits + verifies a
receipt, appends + verifies an audit log.

DEMO MODE DOES NOT VERIFY THE v4 EVIDENCE.  It proves the toolchain works.
The v4 pin (2aba2e55…) is NOT used here.  A distinct DEMO pin is generated
and printed.  Do not conflate the two.
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

from .access_state import (
    check_and_bump_fence,
    issue,
    make_receipt,
    verify as verify_access,
    verify_receipt,
)
from .assertions import (
    a1_no_aliasing,
    a2_pinned_attestation,
    a3_scope_parity,
    a4_signature_valid,
)
from .audit_log import append as audit_append, verify_log
from .continuity import append_anchor, create_anchor, read_chain, verify_chain
from .digests import d_attest, d_manifest, d_raw_file
from .keystore import SignatureError, generate_private_key, public_pem
from .manifest import write as write_manifest
from .signing import sign, strip_sig

DEMO_ARTIFACT_COUNT = 33


def _build_workspace(root: Path) -> list[dict]:
    """Create 33 synthetic artifacts with distinct content."""
    entries = []
    for i in range(DEMO_ARTIFACT_COUNT):
        name = f"artifact_{i:02d}.txt"
        (root / name).write_text(f"demo artifact {i}\n", encoding="utf-8")
        entries.append({"path": name, "sha256": d_raw_file(root / name)})
    return entries


def _build_envelope(entries: list[dict], registry_entries: list[dict], signer_key) -> dict:
    """Synthetic envelope whose JCS digest becomes the DEMO pin."""
    envelope = {
        "attestation_id": "DEMO-PVA-INTERNAL",
        "manifest_digest": d_manifest(entries),
        "registry_keys": sorted(k["key_id"] for k in registry_entries),
        "verifier_key_id": "demo_verifier",
        "harness": "an_nexus.demo",
    }
    envelope["sig"] = sign(signer_key, "attestation", strip_sig(envelope))
    return envelope


def main() -> int:
    print("=" * 70)
    print(" an-nexus v4.2 — SELF-CONTAINED DEMO")
    print(" (toolchain proof, NOT v4 evidence verification)")
    print("=" * 70)

    try:
        verifier_key = generate_private_key()
        auditor_key = generate_private_key()
        issuer_key = generate_private_key()
    except SignatureError as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        return 1

    tmp = Path(tempfile.mkdtemp(prefix="an_nexus_demo_"))
    print(f"[demo] workspace : {tmp}")

    # --- 1. keys + registry ------------------------------------------------
    registry_path = tmp / "registry.json"
    registry: dict = {
        "keys": sorted(
            [
                {
                    "key_id": "demo_verifier",
                    "role": "INDEPENDENT_VERIFIER",
                    "public_key_pem": public_pem(verifier_key),
                },
                {
                    "key_id": "demo_auditor",
                    "role": "AUDIT_SIGNER",
                    "public_key_pem": public_pem(auditor_key),
                },
                {
                    "key_id": "demo_issuer",
                    "role": "PROJECT_ISSUER",
                    "public_key_pem": public_pem(issuer_key),
                },
            ],
            key=lambda k: k["key_id"],
        )
    }
    registry_path.write_text(
        json.dumps(registry, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(f"[demo] registry  : {len(registry['keys'])} keys")

    # --- 2. workspace + manifest ------------------------------------------
    ws = tmp / "workspace"
    ws.mkdir()
    entries = _build_workspace(ws)
    manifest_path = tmp / "manifest.json"
    d_manifest_val = write_manifest(manifest_path, entries)
    print(f"[demo] manifest  : {len(entries)} artifacts  D_MANIFEST={d_manifest_val[:16]}…")

    # --- 3. envelope + DEMO pin -------------------------------------------
    envelope = _build_envelope(entries, registry["keys"], verifier_key)
    envelope_path = tmp / "envelope.json"
    envelope_path.write_text(
        json.dumps(envelope, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    demo_pin = d_attest(envelope)
    print(f"[demo] DEMO pin  : {demo_pin}")

    # --- 4. A1–A4 against DEMO pin ----------------------------------------
    a1_no_aliasing(entries, d_manifest_val, demo_pin, set())
    print("[PASS] A1 non-aliasing (demo)")
    a2_pinned_attestation(demo_pin, demo_pin)
    print("[PASS] A2 pinned (demo)")
    a3_scope_parity(entries, manifest_path)
    print("[PASS] A3 scope parity (demo)")
    a4_signature_valid(envelope_path, registry_path)
    print("[PASS] A4 signature (demo)")

    # --- 5. continuity anchor ---------------------------------------------
    chain_path = tmp / "chain.jsonl"
    a0 = create_anchor(auditor_key, "demo_auditor", 0, None, demo_pin, "demo")
    append_anchor(chain_path, a0)
    a1 = create_anchor(auditor_key, "demo_auditor", 1, a0, demo_pin, "demo")
    append_anchor(chain_path, a1)
    verify_chain(read_chain(chain_path), registry_path)
    print(f"[PASS] continuity  : 2 anchors, head={a1.content_hash()[:16]}…")

    # --- 6. access state + transfer + receipt -----------------------------
    st = issue(
        issuer_key,
        "demo_issuer",
        "demo:operator",
        ["read", "write"],
        demo_pin,
        fencing_version=1,
        ttl_seconds=3600,
    )
    verify_access(st, registry_path)
    print(f"[PASS] access      : session={st.session_id[:8]}…  fence=1")

    ledger_path = tmp / "fencing.json"
    check_and_bump_fence(ledger_path, st.session_id, st.fencing_version)
    receipt = make_receipt(st, issuer_key, "demo_issuer")
    verify_receipt(receipt, st, registry_path)
    print(f"[PASS] transfer    : receipt state_hash={receipt.state_hash[:16]}…")

    # --- 7. audit log -----------------------------------------------------
    log_path = tmp / "audit.jsonl"
    audit_append(
        auditor_key,
        "demo_auditor",
        log_path,
        "anchor.created",
        "demo",
        {"head": a1.content_hash()},
    )
    audit_append(
        auditor_key,
        "demo_auditor",
        log_path,
        "access.issued",
        "demo",
        {"session": st.session_id},
    )
    audit_append(
        auditor_key,
        "demo_auditor",
        log_path,
        "receipt.issued",
        "demo",
        {"state_hash": receipt.state_hash},
    )
    verify_log(log_path, registry_path)
    print("[PASS] audit       : 3 entries chained + verified")

    # --- 8. summary -------------------------------------------------------
    print("=" * 70)
    print(" DEMO RESULT: toolchain works end-to-end")
    print(" DEMO pin   :", demo_pin)
    print(" NOTE       : the v4 pin (2aba2e55…) was NOT verified here;")
    print("              A2 will fail in real mode until the envelope is")
    print("              byte-exact against the pin.")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
