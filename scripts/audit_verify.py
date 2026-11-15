"""Verify chained Ed25519-signed JSONL audit log."""
from __future__ import annotations

import argparse
import sys

from an_nexus.assertions import AssertionFailure
from an_nexus.audit_log import verify_log
from an_nexus.keystore import SignatureError


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Verify chained audit JSONL log")
    parser.add_argument("--log", required=True, help="Audit JSONL path")
    parser.add_argument("--registry", required=True, help="Trust registry JSON path")
    args = parser.parse_args(argv)

    try:
        count = verify_log(args.log, args.registry)
    except (AssertionFailure, SignatureError, FileNotFoundError, ValueError) as exc:
        print(f"[FAIL] Audit verification failed: {exc}", file=sys.stderr)
        return 1

    print(f"[PASS] Audit log verified ({count} entries)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
