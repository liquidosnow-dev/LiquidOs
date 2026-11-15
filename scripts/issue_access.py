"""Issue a signed capability AccessState JSON document."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from an_nexus.access_state import issue
from an_nexus.keystore import SignatureError, load_private_pem


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Issue signed AccessState JSON")
    parser.add_argument("--key", required=True, help="Issuer private PEM file")
    parser.add_argument("--issuer-id", required=True, help="Issuer key_id")
    parser.add_argument("--subject", required=True, help="Capability subject")
    parser.add_argument("--scopes", nargs="+", required=True, help="Capability scopes")
    parser.add_argument("--attest-pin", required=True, help="Pinned attestation digest")
    parser.add_argument("--fencing-version", type=int, default=1, help="Monotonic fence version")
    parser.add_argument("--ttl-seconds", type=int, default=3600, help="Lifetime in seconds")
    parser.add_argument("--out", required=True, help="Output AccessState JSON path")
    args = parser.parse_args(argv)

    try:
        key = load_private_pem(args.key)
        st = issue(
            key,
            args.issuer_id,
            args.subject,
            args.scopes,
            args.attest_pin,
            fencing_version=args.fencing_version,
            ttl_seconds=args.ttl_seconds,
        )
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(st.to_dict(), indent=2, sort_keys=True) + "\n", encoding="utf-8")
    except SignatureError as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        return 1

    print(f"[PASS] Issued AccessState session={st.session_id[:8]}… fence={st.fencing_version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
