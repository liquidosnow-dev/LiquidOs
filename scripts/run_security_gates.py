#!/usr/bin/env python3
"""Unified CI security gate runner (Increment B).

Executes substrate security suites in order:
  1. tests/test_rule_s4.py
  2. tests/test_fts5_hybrid_search.py
  3. tests/test_dual_layer_security.py

On full pass, writes a PVA-001 style verification receipt JSON.
Exits non-zero on any failure (CI-blocking).
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

DEFAULT_SUITES = [
    "tests/test_rule_s4.py",
    "tests/test_fts5_hybrid_search.py",
    "tests/test_dual_layer_security.py",
]


def _run_suite(repo: Path, suite: Path) -> dict:
    started = time.time()
    target = repo / suite
    if not target.exists():
        return {
            "suite": str(suite),
            "status": "MISSING",
            "returncode": 127,
            "seconds": 0.0,
            "detail": f"file not found: {target}",
        }

    # Prefer pytest if available; fall back to unittest module path
    cmd = [sys.executable, "-m", "pytest", str(target), "-q", "--tb=short"]
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(repo),
            capture_output=True,
            text=True,
            timeout=600,
        )
    except FileNotFoundError:
        proc = subprocess.run(
            [sys.executable, str(target)],
            cwd=str(repo),
            capture_output=True,
            text=True,
            timeout=600,
        )
    except subprocess.TimeoutExpired:
        return {
            "suite": str(suite),
            "status": "TIMEOUT",
            "returncode": 124,
            "seconds": round(time.time() - started, 3),
            "detail": "suite exceeded 600s",
        }

    # If pytest module missing, retry plain execution
    if proc.returncode != 0 and "No module named pytest" in (proc.stderr or ""):
        proc = subprocess.run(
            [sys.executable, str(target)],
            cwd=str(repo),
            capture_output=True,
            text=True,
            timeout=600,
        )

    status = "PASS" if proc.returncode == 0 else "FAIL"
    detail = (proc.stdout or "")[-2000:]
    if proc.returncode != 0 and proc.stderr:
        detail = (detail + "\n" + proc.stderr)[-4000:]

    return {
        "suite": str(suite),
        "status": status,
        "returncode": proc.returncode,
        "seconds": round(time.time() - started, 3),
        "detail": detail.strip() or None,
    }


def build_receipt(results: list[dict], repo: Path) -> dict:
    all_pass = all(r["status"] == "PASS" for r in results)
    return {
        "contract": "PVA-001",
        "kind": "security_gate_receipt",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "repository": str(repo),
        "verdict": "PASS" if all_pass else "FAIL",
        "suites": results,
        "invariants": ["D-18", "D-19", "D-20", "LIQ-LEDGER-CONTRACT-v1.0"],
        "layers": [
            "rule_s4_ast",
            "vdbe_authorizer",
            "jcs_gate",
            "fts5_hybrid",
        ],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Liquid OS unified security gate runner")
    parser.add_argument(
        "--repo",
        type=Path,
        default=ROOT,
        help="Repository root (default: parent of scripts/)",
    )
    parser.add_argument(
        "--receipt",
        type=Path,
        default=None,
        help="Write PVA-001 receipt JSON to this path (default: artifacts/pva_security_receipt.json)",
    )
    parser.add_argument(
        "--suite",
        action="append",
        default=[],
        help="Additional/override suite path (repeatable). Default suites used if omitted.",
    )
    args = parser.parse_args(argv)

    repo = args.repo.resolve()
    suites = [Path(s) for s in args.suite] if args.suite else [Path(s) for s in DEFAULT_SUITES]
    receipt_path = args.receipt or (repo / "artifacts" / "pva_security_receipt.json")

    print("=== Liquid OS Security Gates ===")
    print(f"repo: {repo}")
    results: list[dict] = []
    for suite in suites:
        print(f"-- running {suite} ...")
        result = _run_suite(repo, suite)
        results.append(result)
        print(f"   {result['status']} ({result['seconds']}s) rc={result['returncode']}")
        if result["status"] != "PASS" and result.get("detail"):
            print(result["detail"][:1500])

    receipt = build_receipt(results, repo)
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    receipt_path.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"receipt: {receipt_path}")
    print(f"verdict: {receipt['verdict']}")

    return 0 if receipt["verdict"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
