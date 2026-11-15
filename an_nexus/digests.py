"""Deterministic SHA-256 digests over raw files and JCS-canonicalized objects."""
from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from .jcs import canonical_bytes


def d_raw_file(path: Path | str) -> str:
    p = Path(path)
    return hashlib.sha256(p.read_bytes()).hexdigest()


def d_jcs_obj(obj: Any) -> str:
    return hashlib.sha256(canonical_bytes(obj)).hexdigest()


def d_manifest(entries: list[dict[str, Any]]) -> str:
    ordered = sorted(entries, key=lambda e: str(e.get("path", "")))
    return d_jcs_obj({"schema": "an-nexus.manifest.v4", "entries": ordered})


def d_attest(envelope: dict[str, Any]) -> str:
    return d_jcs_obj(envelope)
