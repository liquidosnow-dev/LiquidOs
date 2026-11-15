"""Strict A1–A4 verification gates and spec exit-code runner for an-nexus v4.2."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .digests import d_attest, d_manifest
from .keystore import SignatureError
from .manifest import read as read_manifest
from .signing import strip_sig, verify_sig

VERIFIER_ALLOWED_ROLES = frozenset({"INDEPENDENT_VERIFIER"})
EXPECTED_D_ATTEST = "2aba2e55"

EXIT_OK = 0
EXIT_A1_ALIASING = 1
EXIT_A2_PIN_MISMATCH = 2
EXIT_A3_SCOPE_PARITY = 3
EXIT_A4_SIGNATURE = 4
EXIT_B1_SCOPE_MISSING = 5


class AssertionFailure(RuntimeError):
    """Raised when a strict A1–A4 integrity gate fails."""


def a1_no_aliasing(
    entries: list[dict[str, Any]],
    d_manifest_val: str,
    d_attest_val: str,
    extra_pins: set[str] | None = None,
) -> None:
    paths = [str(e.get("path", "")) for e in entries]
    if len(paths) != len(set(paths)):
        raise AssertionFailure("A1 FAIL: duplicate artifact paths detected")
    if d_manifest_val == d_attest_val:
        raise AssertionFailure("A1 FAIL: D_MANIFEST aliases D_ATTEST")
    if extra_pins and d_manifest_val in extra_pins:
        raise AssertionFailure("A1 FAIL: D_MANIFEST collides with historical pin set")
    for entry in entries:
        sha = str(entry.get("sha256", ""))
        if sha and (sha == d_attest_val or sha == d_manifest_val or (extra_pins and sha in extra_pins)):
            raise AssertionFailure(
                f"A1 FAIL: entry {entry.get('path')!r} sha256 aliases pinned/manifest digest"
            )


def a2_pinned_attestation(observed_pin: str, expected_pin: str = EXPECTED_D_ATTEST) -> None:
    if not observed_pin or not expected_pin or observed_pin != expected_pin:
        raise AssertionFailure(
            f"A2 FAIL: D_ATTEST mismatch (observed={observed_pin!r}, expected={expected_pin!r})"
        )


def a3_scope_parity(
    entries: list[dict[str, Any]],
    manifest_path: Path | str,
    expected_count: int | None = None,
) -> None:
    manifest = read_manifest(manifest_path, expected_count=expected_count)
    recorded = manifest.get("entries", [])
    if len(entries) != len(recorded) or d_manifest(entries) != manifest.get("d_manifest"):
        raise AssertionFailure("A3 FAIL: workspace scope parity mismatch against manifest")


def _lookup_key(registry_path: Path | str, key_id: str) -> dict[str, Any]:
    reg = json.loads(Path(registry_path).read_text(encoding="utf-8"))
    for entry in reg.get("keys", []):
        if entry.get("key_id") == key_id:
            return entry
    raise AssertionFailure(f"A4 FAIL: key_id {key_id!r} missing from trust registry")


def a4_signature_valid(envelope_path: Path | str, registry_path: Path | str) -> None:
    envelope = json.loads(Path(envelope_path).read_text(encoding="utf-8"))
    sig = envelope.get("sig")
    verifier_key_id = envelope.get("verifier_key_id")
    if not isinstance(sig, str) or not verifier_key_id:
        raise AssertionFailure("A4 FAIL: envelope missing signature or verifier_key_id")

    key_entry = _lookup_key(registry_path, str(verifier_key_id))
    role = str(key_entry.get("role", ""))
    if role not in VERIFIER_ALLOWED_ROLES:
        raise AssertionFailure(
            f"A4 FAIL: key {verifier_key_id!r} role {role!r} is not INDEPENDENT_VERIFIER"
        )
    pub_pem = key_entry.get("public_key_pem", "")
    if not verify_sig(pub_pem, "attestation", strip_sig(envelope), sig):
        raise AssertionFailure(f"A4 FAIL: invalid Ed25519 signature for {verifier_key_id!r}")


def compute_all(
    entries: list[dict[str, Any]],
    manifest_path: Path | str,
    envelope_path: Path | str,
    registry_path: Path | str,
    expected_pin: str | None = None,
    extra_pins: set[str] | None = None,
    expected_count: int | None = None,
) -> tuple[int, dict[str, Any]]:
    """Run A1 -> A2 -> A3 -> A4 in order and map each gate to its spec exit code (0..5)."""
    resolved_pin = EXPECTED_D_ATTEST if expected_pin is None else expected_pin
    try:
        envelope = json.loads(Path(envelope_path).read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError) as exc:
        return EXIT_B1_SCOPE_MISSING, {"ok": False, "stage": "inputs", "error": str(exc)}

    d_manifest_val = d_manifest(entries)
    observed_pin = d_attest(envelope)

    try:
        a1_no_aliasing(entries, d_manifest_val, observed_pin, extra_pins=extra_pins)
    except AssertionFailure as exc:
        return EXIT_A1_ALIASING, {"ok": False, "stage": "A1", "error": str(exc)}

    try:
        a2_pinned_attestation(observed_pin, resolved_pin)
    except AssertionFailure as exc:
        return EXIT_A2_PIN_MISMATCH, {"ok": False, "stage": "A2", "error": str(exc)}

    try:
        a3_scope_parity(entries, manifest_path, expected_count=expected_count)
    except (AssertionFailure, FileNotFoundError, ValueError) as exc:
        return EXIT_A3_SCOPE_PARITY, {"ok": False, "stage": "A3", "error": str(exc)}

    try:
        a4_signature_valid(envelope_path, registry_path)
    except (AssertionFailure, SignatureError, FileNotFoundError, ValueError) as exc:
        return EXIT_A4_SIGNATURE, {"ok": False, "stage": "A4", "error": str(exc)}

    return EXIT_OK, {
        "ok": True,
        "d_manifest": d_manifest_val,
        "d_attest": observed_pin,
        "artifact_count": len(entries),
    }
