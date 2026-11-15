"""Chained append-only Ed25519-signed JSONL audit log."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .assertions import AssertionFailure
from .digests import d_jcs_obj
from .signing import sign, strip_sig, verify_sig


def _read_entries(log_path: Path) -> list[dict[str, Any]]:
    if not log_path.exists():
        return []
    entries: list[dict[str, Any]] = []
    for raw in log_path.read_text(encoding="utf-8").splitlines():
        stripped = raw.strip()
        if stripped:
            entries.append(json.loads(stripped))
    return entries


def append(
    signer_key: Any,
    signer_id: str,
    log_path: Path | str,
    event: str,
    mode: str,
    detail: dict[str, Any],
) -> dict[str, Any]:
    p = Path(log_path)
    existing = _read_entries(p)
    prev_hash = d_jcs_obj(existing[-1]) if existing else None
    entry: dict[str, Any] = {
        "seq": len(existing),
        "prev_hash": prev_hash,
        "event": event,
        "mode": mode,
        "detail": detail,
        "signer_id": signer_id,
    }
    entry["sig"] = sign(signer_key, "audit_entry", entry)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, sort_keys=True) + "\n")
    return entry


def verify_log(log_path: Path | str, registry_path: Path | str) -> int:
    entries = _read_entries(Path(log_path))
    if not entries:
        raise AssertionFailure("Audit log is empty")

    reg = json.loads(Path(registry_path).read_text(encoding="utf-8"))
    keys_by_id = {k["key_id"]: k["public_key_pem"] for k in reg.get("keys", [])}

    prev_entry: dict[str, Any] | None = None
    for idx, entry in enumerate(entries):
        if entry.get("seq") != idx:
            raise AssertionFailure(f"Audit log seq mismatch at {idx}: got {entry.get('seq')}")
        expected_prev = d_jcs_obj(prev_entry) if prev_entry is not None else None
        if entry.get("prev_hash") != expected_prev:
            raise AssertionFailure(f"Audit log prev_hash mismatch at {idx}")
        signer_id = str(entry.get("signer_id", ""))
        pub_pem = keys_by_id.get(signer_id)
        if not pub_pem:
            raise AssertionFailure(f"Missing audit signer key {signer_id!r}")
        sig = entry.get("sig", "")
        if not verify_sig(pub_pem, "audit_entry", strip_sig(entry), sig):
            raise AssertionFailure(f"Invalid audit log signature at seq {idx}")
        prev_entry = entry

    return len(entries)
