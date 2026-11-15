"""Preflight verification gate running compute_all (spec exit codes 0/1/2/3/4/5)."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from an_nexus.assertions import EXIT_B1_SCOPE_MISSING, compute_all
from an_nexus.manifest import read as read_manifest


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Preflight A1-A4 verification gate")
    parser.add_argument("--manifest", default="manifest.json", help="Workspace manifest JSON path")
    parser.add_argument(
        "--envelope",
        default="signed_master_evidence_envelope.json",
        help="Signed evidence envelope JSON path",
    )
    parser.add_argument(
        "--registry",
        default="public_key_trust_registry.json",
        help="Trust registry JSON path",
    )
    parser.add_argument("--paths", default=None, help="Optional workspace paths file for B1 check")
    parser.add_argument(
        "--expected-count",
        type=int,
        default=None,
        help="Optional required artifact count (e.g. 33)",
    )
    parser.add_argument(
        "--out",
        default=None,
        help="Optional output path for evidence_preflight.json",
    )
    args = parser.parse_args(argv)

    if args.paths is not None:
        p = Path(args.paths)
        if not p.exists():
            print(f"[FAIL] B1 blocker: missing paths file {p}", file=sys.stderr)
            return EXIT_B1_SCOPE_MISSING
        path_lines = [
            ln.strip()
            for ln in p.read_text(encoding="utf-8").splitlines()
            if ln.strip() and not ln.strip().startswith("#")
        ]
        target_count = args.expected_count if args.expected_count is not None else 33
        if len(path_lines) != target_count:
            print(
                f"[FAIL] B1 blocker: expected {target_count} workspace paths, got {len(path_lines)}",
                file=sys.stderr,
            )
            return EXIT_B1_SCOPE_MISSING

    manifest_path = Path(args.manifest)
    if not manifest_path.exists():
        print(f"[FAIL] Missing manifest: {manifest_path}", file=sys.stderr)
        return EXIT_B1_SCOPE_MISSING

    try:
        manifest_doc = read_manifest(manifest_path, expected_count=args.expected_count)
        entries = list(manifest_doc.get("entries", []))
    except Exception as exc:
        print(f"[FAIL] Invalid manifest: {exc}", file=sys.stderr)
        return EXIT_B1_SCOPE_MISSING

    rc, result = compute_all(
        entries=entries,
        manifest_path=manifest_path,
        envelope_path=args.envelope,
        registry_path=args.registry,
        expected_count=args.expected_count,
    )

    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    if rc != 0:
        print(f"[FAIL] Preflight halted ({result.get('stage')}): {result.get('error')}", file=sys.stderr)
        return rc

    print(f"[PASS] Preflight A1-A4 verified (pin={result['d_attest'][:16]}…)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
