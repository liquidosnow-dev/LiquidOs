"""Verify Annex A contract JCS digest ledger (exit 0 if clean, 1 on any failure/anomaly)."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from an_nexus.annex import detect_annex_anomalies


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Verify Annex A JCS digest ledger")
    parser.add_argument(
        "--ledger",
        default="data/annex_a_ledger.json",
        help="Path to Annex A digest ledger JSON",
    )
    args = parser.parse_args(argv)

    ledger_path = Path(args.ledger)
    if not ledger_path.exists():
        print(f"[FAIL] Annex A ledger not found: {ledger_path}", file=sys.stderr)
        return 1

    try:
        doc = json.loads(ledger_path.read_text(encoding="utf-8"))
    except ValueError as exc:
        print(f"[FAIL] Malformed Annex A JSON: {exc}", file=sys.stderr)
        return 1

    anomalies = detect_annex_anomalies(doc)
    failed = len(anomalies)
    for item in anomalies:
        print(f"[FAIL] {item}", file=sys.stderr)

    if failed == 0:
        print(f"[PASS] Annex A ledger verified cleanly ({len(doc.get('entries', []))} entries)")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
