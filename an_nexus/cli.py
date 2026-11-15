"""Console entrypoints for the an-nexus toolchain.

Each function is a thin adapter over the corresponding scripts/*.py main().
Lets AI Studio run `pip install -e .` once and call `an-demo`, `an-preflight`,
etc., without sys.path hacks.
"""
from __future__ import annotations

import importlib
import sys


def _run(module_name: str) -> int:
    """Import scripts.<name> as a module and call main()."""
    try:
        mod = importlib.import_module(f"scripts.{module_name}")
    except ImportError as exc:
        print(f"[ERROR] cannot import scripts.{module_name}: {exc}", file=sys.stderr)
        return 7
    return mod.main()


def preflight() -> int:
    return _run("preflight")


def emit_manifest() -> int:
    return _run("emit_manifest")


def verify_annex() -> int:
    return _run("verify_annex_a")


def gen_key() -> int:
    return _run("gen_key")


def create_anchor() -> int:
    return _run("create_anchor")


def verify_chain() -> int:
    return _run("verify_continuity")


def issue_access() -> int:
    return _run("issue_access")


def transfer_access() -> int:
    return _run("transfer_access")


def audit_append() -> int:
    return _run("audit_append")


def audit_verify() -> int:
    return _run("audit_verify")


def continuity_summary() -> int:
    return _run("continuity_summary")


def demo() -> int:
    from an_nexus.demo import main as demo_main

    return demo_main()


def smoke() -> int:
    from an_nexus.smoke import main as smoke_main

    return smoke_main()
