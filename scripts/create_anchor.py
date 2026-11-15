"""Create and append a signed continuity anchor to the hash-linked chain."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from an_nexus.continuity import append_anchor, create_anchor, read_chain
from an_nexus.keystore import SignatureError, load_private_pem


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Append signed continuity anchor")
    parser.add_argument("--key", required=True, help="Signer private PEM file")
    parser.add_argument("--signer-id", required=True, help="Signer key_id")
    parser.add_argument("--chain", required=True, help="Continuity JSONL file")
    parser.add_argument("--attest-pin", required=True, help="Pinned attestation digest")
    parser.add_argument("--note", default="", help="Anchor note")
    args = parser.parse_args(argv)

    try:
        key = load_private_pem(args.key)
        chain_path = Path(args.chain)
        existing = read_chain(chain_path) if chain_path.exists() else []
        prev = existing[-1] if existing else None
        seq = len(existing)
        anchor = create_anchor(key, args.signer_id, seq, prev, args.attest_pin, args.note)
        append_anchor(chain_path, anchor)
    except SignatureError as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        return 1

    print(f"[PASS] Appended continuity anchor seq={anchor.seq} head={anchor.content_hash()[:16]}…")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
