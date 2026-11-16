from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

try:
    import requests  # type: ignore
except ImportError:  # pragma: no cover
    requests = None


def derive_ollama_base_url(chat_endpoint: str) -> str:
    parsed = urlparse(chat_endpoint or "http://127.0.0.1:11434/api/chat")
    if parsed.scheme and parsed.netloc:
        return f"{parsed.scheme}://{parsed.netloc}"
    return "http://127.0.0.1:11434"


def find_ollama_executable() -> Path | None:
    """
    Detect Ollama binary across PATH and common user-local locations
    without requiring administrator privileges.
    """
    if found := shutil.which("ollama"):
        return Path(found)

    candidates: list[Path] = [
        Path.home() / "Applications" / "Ollama.app" / "Contents" / "MacOS" / "ollama",
        Path("/Applications/Ollama.app/Contents/MacOS/ollama"),
        Path.home() / ".local" / "bin" / "ollama",
        Path("/usr/local/bin/ollama"),
        Path("/usr/bin/ollama"),
    ]
    if sys.platform == "win32":
        local_app = os.environ.get("LOCALAPPDATA")
        if local_app:
            candidates.insert(0, Path(local_app) / "Programs" / "Ollama" / "ollama.exe")

    for cand in candidates:
        if cand.exists() and cand.is_file():
            return cand
    return None


def find_macos_ollama_app() -> Path | None:
    for cand in (
        Path.home() / "Applications" / "Ollama.app",
        Path("/Applications/Ollama.app"),
    ):
        if cand.exists() and cand.is_dir():
            return cand
    return None


def fetch_ollama_tags(base_url: str, timeout_sec: float = 2.0) -> list[str] | None:
    tags_url = f"{base_url.rstrip('/')}/api/tags"
    try:
        if requests is not None:
            resp = requests.get(tags_url, timeout=timeout_sec)
            if resp.status_code != 200:
                return None
            data = resp.json()
        else:
            with urllib.request.urlopen(tags_url, timeout=timeout_sec) as resp:
                if getattr(resp, "status", 200) != 200:
                    return None
                data = json.loads(resp.read().decode("utf-8"))
        models = data.get("models") if isinstance(data, dict) else None
        if isinstance(models, list):
            return [str(m.get("name")) for m in models if isinstance(m, dict) and m.get("name")]
        return []
    except Exception:
        return None


def is_ollama_running(base_url: str, timeout_sec: float = 1.5) -> bool:
    return fetch_ollama_tags(base_url, timeout_sec=timeout_sec) is not None


def ensure_ollama_ready(
    chat_endpoint: str = "http://127.0.0.1:11434/api/chat",
    *,
    wait_seconds: float = 12.0,
) -> tuple[bool, str, list[str]]:
    """
    Verify Ollama API availability. On macOS, opens Ollama.app silently in the background
    with `open -gj Ollama.app` (or user-local path) if not yet running.
    """
    base_url = derive_ollama_base_url(chat_endpoint)
    tags = fetch_ollama_tags(base_url, timeout_sec=1.5)
    if tags is not None:
        return True, f"Ollama API reachable at {base_url}", tags

    exe = find_ollama_executable()
    if sys.platform == "darwin":
        app_bundle = find_macos_ollama_app()
        target = str(app_bundle) if app_bundle else "Ollama.app"
        try:
            subprocess.Popen(
                ["open", "-gj", target],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
        except Exception:
            if exe is not None:
                subprocess.Popen(
                    [str(exe), "serve"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    start_new_session=True,
                )
            else:
                return (
                    False,
                    f"Ollama is not reachable at {base_url} and no local Ollama installation was found.",
                    [],
                )
    else:
        if exe is None:
            return (
                False,
                f"Ollama is not reachable at {base_url} and 'ollama' was not found in PATH or user-local folders.",
                [],
            )
        try:
            subprocess.Popen(
                [str(exe), "serve"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
        except Exception as exc:
            return False, f"Failed to launch local Ollama process: {exc}", []

    deadline = time.monotonic() + max(0.5, wait_seconds)
    while time.monotonic() < deadline:
        tags = fetch_ollama_tags(base_url, timeout_sec=1.0)
        if tags is not None:
            return True, f"Ollama started cleanly at {base_url}", tags
        time.sleep(0.4)

    return (
        False,
        f"Timed out waiting for {base_url}/api/tags. Start Ollama manually or verify port 11434.",
        [],
    )
