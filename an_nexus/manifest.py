"""Workspace manifest read/write and structural validation helpers."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .digests import d_manifest

_HEX64_RE = re.compile(r"^[0-9a-f]{64}$")


class ManifestError(ValueError):
    """Raised when a manifest or entry fails structural validation."""


def is_valid_sha256_hex(digest: Any) -> bool:
    return isinstance(digest, str) and bool(_HEX64_RE.fullmatch(digest))


def validate_entries(
    entries: list[dict[str, Any]],
    expected_count: int | None = None,
) -> list[dict[str, Any]]:
    if not isinstance(entries, list):
        raise ManifestError("Manifest entries must be a list")

    seen_paths: set[str] = set()
    for idx, entry in enumerate(entries):
        if not isinstance(entry, dict):
            raise ManifestError(f"Manifest entry #{idx} must be an object")
        path = entry.get("path")
        sha256 = entry.get("sha256")
        if not isinstance(path, str) or not path.strip():
            raise ManifestError(f"Manifest entry #{idx} missing valid path")
        if path in seen_paths:
            raise ManifestError(f"Duplicate artifact path in manifest: {path!r}")
        seen_paths.add(path)
        if not is_valid_sha256_hex(sha256):
            raise ManifestError(f"Invalid SHA-256 hex digest for {path!r}: {sha256!r}")

    if expected_count is not None and len(entries) != expected_count:
        raise ManifestError(
            f"Manifest entry count mismatch: expected {expected_count}, got {len(entries)}"
        )

    return sorted(entries, key=lambda e: str(e["path"]))


def validate_manifest_doc(
    doc: dict[str, Any],
    expected_count: int | None = None,
) -> dict[str, Any]:
    if not isinstance(doc, dict):
        raise ManifestError("Manifest document must be a JSON object")
    if doc.get("schema") != "an-nexus.manifest.v4":
        raise ManifestError(f"Unexpected manifest schema: {doc.get('schema')!r}")

    entries = validate_entries(doc.get("entries", []), expected_count=expected_count)
    declared_count = doc.get("artifact_count")
    if declared_count != len(entries):
        raise ManifestError(
            f"Manifest artifact_count mismatch: declared={declared_count}, actual={len(entries)}"
        )

    expected_digest = d_manifest(entries)
    if doc.get("d_manifest") != expected_digest:
        raise ManifestError(
            f"Manifest d_manifest mismatch: recorded={doc.get('d_manifest')!r}, computed={expected_digest!r}"
        )
    return doc


def write(
    path: Path | str,
    entries: list[dict[str, Any]],
    expected_count: int | None = None,
) -> str:
    ordered = validate_entries(entries, expected_count=expected_count)
    digest = d_manifest(ordered)
    doc = {
        "schema": "an-nexus.manifest.v4",
        "artifact_count": len(ordered),
        "d_manifest": digest,
        "entries": ordered,
    }
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(doc, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return digest


def read(
    path: Path | str,
    validate: bool = True,
    expected_count: int | None = None,
) -> dict[str, Any]:
    doc = json.loads(Path(path).read_text(encoding="utf-8"))
    if validate:
        return validate_manifest_doc(doc, expected_count=expected_count)
    return doc
