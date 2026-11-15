"""Environment capability probe. Safe to run anywhere; fails closed without cryptography."""
from __future__ import annotations

import os
import platform
import shutil
import sys
import tempfile
from pathlib import Path


def _check(label: str, ok: bool, detail: str = "") -> bool:
    print(f"[{'PASS' if ok else 'FAIL'}] {label:<28} {detail}")
    return ok


def main() -> int:
    results = []

    py_ok = _check("python >= 3.10", sys.version_info >= (3, 10), sys.version.split()[0])
    results.append(py_ok)

    results.append(_check("platform", True, f"{platform.system()} {platform.release()}"))

    has_cryptography = False
    try:
        import cryptography

        has_cryptography = True
        results.append(_check("cryptography importable", True, cryptography.__version__))
    except ImportError:
        results.append(
            _check("cryptography importable", False, "not installed (pip install cryptography)")
        )

    fs_ok = False
    try:
        tmp = Path(tempfile.mkdtemp())
        (tmp / "x").write_text("x", encoding="utf-8")
        fs_ok = _check("filesystem writable", True, str(tmp))
        results.append(fs_ok)
        shutil.rmtree(tmp, ignore_errors=True)
    except Exception as exc:
        results.append(_check("filesystem writable", False, str(exc)))

    try:
        fd, raw_path = tempfile.mkstemp()
        os.close(fd)
        f = Path(raw_path)
        f.write_text("x", encoding="utf-8")
        os.chmod(f, 0o600)
        mode = oct(f.stat().st_mode & 0o777)
        results.append(_check("chmod 0600", mode == "0o600", mode))
        f.unlink(missing_ok=True)
    except Exception as exc:
        results.append(_check("chmod 0600", False, str(exc)))

    bash = shutil.which("bash")
    bash_ok = _check("bash shell", bool(bash), bash or "not found")
    results.append(bash_ok)

    for cmd in ("git", "pip", "python3"):
        found = shutil.which(cmd)
        results.append(_check(f"command: {cmd}", bool(found), found or "not found"))

    print()
    ok = sum(results)
    total = len(results)
    print(f"Smoke: {ok}/{total}")

    if not py_ok or not has_cryptography or not fs_ok:
        print("\n[VERDICT] NOT READY — cryptography required; pip install cryptography")
        return 1
    if not bash_ok:
        print("\n[VERDICT] READY FOR PYTHON DEMO ONLY (no shell pipeline)")
        return 0
    print("\n[VERDICT] READY FOR FULL PIPELINE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
