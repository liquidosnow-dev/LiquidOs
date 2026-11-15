"""Emit deterministic SHA-256 workspace manifest from a paths list (enforces 33-artifact B1 scope)."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from an_nexus.digests import d_raw_file
from an_nexus.manifest import ManifestError, write as write_manifest

EXPECTED_SCOPE_COUNT = 33


def load_paths(paths_file: Path) -> list[str]:
    return [
        line.strip()
        for line in paths_file.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Emit workspace manifest.json")
    parser.add_argument("--paths", required=True, help="Newline-delimited artifact paths file")
    parser.add_argument("--workspace", default=".", help="Workspace root directory")
    parser.add_argument("--out", default="manifest.json", help="Output manifest JSON path")
    parser.add_argument(
        "--expected-count",
        type=int,
        default=EXPECTED_SCOPE_COUNT,
        help="Required artifact count (default: 33)",
    )
    args = parser.parse_args(argv)

    paths = load_paths(Path(args.paths))
    if len(paths) != args.expected_count:
        print(
            f"[FAIL] B1 blocker: expected {args.expected_count} paths, got {len(paths)}",
            file=sys.stderr,
        )
        return 5

    ws = Path(args.workspace)
    entries: list[dict[str, str]] = []
    for rel in paths:
        target = ws / rel
        if not target.is_file():
            print(f"[FAIL] Missing artifact file: {target}", file=sys.stderr)
            return 5
        entries.append({"path": rel, "sha256": d_raw_file(target)})

    try:
        digest = write_manifest(args.out, entries, expected_count=args.expected_count)
    except ManifestError as exc:
        print(f"[FAIL] Manifest validation failed: {exc}", file=sys.stderr)
        return 5

    print(f"[PASS] Wrote manifest ({len(entries)} artifacts) D_MANIFEST={digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
