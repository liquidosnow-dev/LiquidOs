"""Verify continuity anchor chain against trust registry."""
from __future__ import annotations

import argparse
import sys

from an_nexus.assertions import AssertionFailure
from an_nexus.continuity import read_chain, verify_chain
from an_nexus.keystore import SignatureError


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Verify continuity JSONL chain")
    parser.add_argument("--chain", required=True, help="Continuity JSONL file")
    parser.add_argument("--registry", required=True, help="Trust registry JSON file")
    args = parser.parse_args(argv)

    try:
        anchors = read_chain(args.chain)
        verify_chain(anchors, args.registry)
    except (AssertionFailure, SignatureError, FileNotFoundError, ValueError) as exc:
        print(f"[FAIL] Continuity verification failed: {exc}", file=sys.stderr)
        return 1

    print(f"[PASS] Continuity chain verified ({len(anchors)} anchors)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
