"""Append a signed event to the hash-chained JSONL audit log."""
from __future__ import annotations

import argparse
import json
import sys

from an_nexus.audit_log import append as audit_append
from an_nexus.keystore import SignatureError, load_private_pem


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Append signed audit entry")
    parser.add_argument("--key", required=True, help="Audit signer private PEM file")
    parser.add_argument("--signer-id", required=True, help="Audit signer key_id")
    parser.add_argument("--log", required=True, help="Audit JSONL path")
    parser.add_argument("--event", required=True, help="Event name")
    parser.add_argument("--mode", default="real", help="Execution mode (e.g. demo or real)")
    parser.add_argument("--detail", default="{}", help="JSON object string with event detail")
    args = parser.parse_args(argv)

    try:
        detail = json.loads(args.detail)
        if not isinstance(detail, dict):
            raise ValueError("--detail must decode to a JSON object")
        key = load_private_pem(args.key)
        entry = audit_append(key, args.signer_id, args.log, args.event, args.mode, detail)
    except (SignatureError, ValueError) as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        return 1

    print(f"[PASS] Appended audit entry seq={entry['seq']} event={args.event}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
