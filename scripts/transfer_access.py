"""Verify AccessState, enforce monotonic fencing ledger, and emit signed TransferReceipt."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from an_nexus.access_state import (
    AccessState,
    check_and_bump_fence,
    make_receipt,
    verify as verify_access,
    verify_receipt,
)
from an_nexus.assertions import AssertionFailure
from an_nexus.keystore import SignatureError, load_private_pem


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Transfer AccessState and emit TransferReceipt")
    parser.add_argument("--state", required=True, help="Input AccessState JSON path")
    parser.add_argument("--registry", required=True, help="Trust registry JSON path")
    parser.add_argument("--ledger", required=True, help="Monotonic fencing ledger JSON path")
    parser.add_argument("--key", required=True, help="Receipt signer private PEM path")
    parser.add_argument("--signer-id", required=True, help="Receipt signer key_id")
    parser.add_argument("--receipt-out", required=True, help="Output TransferReceipt JSON path")
    args = parser.parse_args(argv)

    try:
        raw = json.loads(Path(args.state).read_text(encoding="utf-8"))
        st = AccessState(**raw)
        verify_access(st, args.registry)
        check_and_bump_fence(args.ledger, st.session_id, st.fencing_version)
        signer_key = load_private_pem(args.key)
        receipt = make_receipt(st, signer_key, args.signer_id)
        verify_receipt(receipt, st, args.registry)
        out = Path(args.receipt_out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(receipt.to_dict(), indent=2, sort_keys=True) + "\n", encoding="utf-8")
    except (AssertionFailure, SignatureError, FileNotFoundError, TypeError, ValueError) as exc:
        print(f"[FAIL] Access transfer blocked: {exc}", file=sys.stderr)
        return 1

    print(f"[PASS] Transfer receipt emitted state_hash={receipt.state_hash[:16]}…")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
