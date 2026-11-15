"""Summarize preflight, continuity chain, audit log, and fencing state (returns 1 unless all ok)."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from an_nexus.continuity import read_chain


def _read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except ValueError:
        return {}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Summarize an-nexus continuity & state files")
    parser.add_argument(
        "--preflight",
        default="evidence_preflight.json",
        help="Preflight result JSON path",
    )
    parser.add_argument("--manifest", default="manifest.json", help="Manifest JSON path")
    parser.add_argument("--chain", default="chain.jsonl", help="Continuity JSONL path")
    parser.add_argument("--ledger", default="fencing.json", help="Fencing ledger JSON path")
    parser.add_argument("--audit", default="audit.jsonl", help="Audit JSONL path")
    parser.add_argument(
        "--allow-zero-state",
        action="store_true",
        help="Exit 0 when no state files are populated yet (default preserves spec: exit 1)",
    )
    args = parser.parse_args(argv)

    pf = _read_json(Path(args.preflight))

    cp = Path(args.chain)
    if cp.exists():
        anchors = read_chain(cp)
        c: dict[str, Any] = {
            "ok": len(anchors) > 0,
            "anchors": len(anchors),
            "head": anchors[-1].content_hash() if anchors else None,
        }
    else:
        c = {"ok": False, "anchors": 0, "head": None}

    ap = Path(args.audit)
    if ap.exists():
        audit_lines = [ln for ln in ap.read_text(encoding="utf-8").splitlines() if ln.strip()]
        a: dict[str, Any] = {"ok": len(audit_lines) > 0, "entries": len(audit_lines)}
    else:
        a = {"ok": False, "entries": 0}

    st_doc = _read_json(Path(args.ledger))
    sessions = st_doc.get("sessions") if isinstance(st_doc.get("sessions"), dict) else {}
    st = bool(sessions)

    mp = Path(args.manifest)
    manifest_doc = _read_json(mp)

    ok = bool(pf.get("ok") and c.get("ok") and a.get("ok") and st)
    zero_state = not pf and not cp.exists() and not ap.exists() and not st_doc and not mp.exists()

    summary = {
        "ok": ok,
        "preflight_ok": bool(pf.get("ok")),
        "manifest_artifacts": manifest_doc.get("artifact_count"),
        "d_manifest": manifest_doc.get("d_manifest"),
        "continuity": c,
        "audit": a,
        "fenced_sessions": len(sessions),
        "zero_state": zero_state,
    }
    print(json.dumps(summary, indent=2, sort_keys=True))

    if ok:
        return 0
    if zero_state and args.allow_zero_state:
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
