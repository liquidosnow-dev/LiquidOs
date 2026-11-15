"""Annex A digest ledger validation and G6 anomaly detector."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

_LOWER_HEX64_RE = re.compile(r"^[0-9a-f]{64}$")
_HEX_CHARS_RE = re.compile(r"^[0-9a-fA-F]+$")


class AnnexError(RuntimeError):
    """Raised when Annex A ledger structure or G6 digest invariants fail."""


def detect_annex_anomalies(ledger: Any) -> list[str]:
    """Return human-readable anomaly descriptions; empty list means clean."""
    anomalies: list[str] = []
    if not isinstance(ledger, dict):
        return ["ANNEX_SHAPE: ledger root must be a JSON object"]

    if ledger.get("schema") != "an-nexus.annex-a.v4":
        anomalies.append(f"ANNEX_SHAPE: unexpected schema {ledger.get('schema')!r}")

    entries = ledger.get("entries")
    if not isinstance(entries, list) or not entries:
        anomalies.append("ANNEX_SHAPE: 'entries' must be a non-empty list")
        return anomalies

    seen_ids: set[str] = set()
    for idx, entry in enumerate(entries):
        if not isinstance(entry, dict):
            anomalies.append(f"ANNEX_SHAPE: entry #{idx} must be an object")
            continue

        contract_id = entry.get("id")
        if not isinstance(contract_id, str) or not contract_id.strip():
            anomalies.append(f"ANNEX_SHAPE: entry #{idx} missing valid 'id'")
            continue
        if contract_id in seen_ids:
            anomalies.append(f"ANNEX_SHAPE: duplicate contract id {contract_id!r}")
        seen_ids.add(contract_id)

        digest = entry.get("jcs_sha256")
        if not isinstance(digest, str):
            anomalies.append(f"ANNEX_SHAPE: {contract_id} missing string 'jcs_sha256'")
            continue
        if len(digest) != 64:
            anomalies.append(
                f"G6_ANOMALY: {contract_id} jcs_sha256 has length {len(digest)} (expected 64): {digest!r}"
            )
            continue
        if not _HEX_CHARS_RE.fullmatch(digest):
            anomalies.append(f"G6_ANOMALY: {contract_id} jcs_sha256 contains non-hex characters")
        elif not _LOWER_HEX64_RE.fullmatch(digest):
            anomalies.append(f"G6_ANOMALY: {contract_id} jcs_sha256 must be lowercase hex")

    return anomalies


def validate_annex_ledger(ledger: Any) -> None:
    anomalies = detect_annex_anomalies(ledger)
    if anomalies:
        raise AnnexError("; ".join(anomalies))


def verify_annex_file(path: Path | str) -> list[dict[str, Any]]:
    doc = json.loads(Path(path).read_text(encoding="utf-8"))
    validate_annex_ledger(doc)
    return list(doc["entries"])
