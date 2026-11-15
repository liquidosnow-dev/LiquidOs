"""Generate an Ed25519 keypair and register its public key in the trust registry."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from an_nexus.keystore import (
    SignatureError,
    generate_private_key,
    register_key,
    save_private_pem,
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate Ed25519 key and register public key")
    parser.add_argument("--key-id", required=True, help="Unique key identifier")
    parser.add_argument("--role", required=True, help="Registry role (e.g. AUDIT_SIGNER)")
    parser.add_argument("--key-out", required=True, help="Output PKCS#8 private PEM file")
    parser.add_argument("--registry", required=True, help="Trust registry JSON file")
    args = parser.parse_args(argv)

    try:
        key = generate_private_key()
        save_private_pem(key, args.key_out)
        reg_path = Path(args.registry)
        registry = (
            json.loads(reg_path.read_text(encoding="utf-8"))
            if reg_path.exists()
            else {"keys": []}
        )
        register_key(registry, args.key_id, args.role, key)
        reg_path.parent.mkdir(parents=True, exist_ok=True)
        reg_path.write_text(json.dumps(registry, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    except SignatureError as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        return 1

    print(f"[PASS] Generated key {args.key_id!r} ({args.role}) -> {args.key_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
