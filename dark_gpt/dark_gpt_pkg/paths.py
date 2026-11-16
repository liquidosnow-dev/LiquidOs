from __future__ import annotations

import os
import re
from pathlib import Path


def get_app_root() -> Path:
    """Return the root directory of the DARK-GPT installation dynamically."""
    return Path(__file__).resolve().parent.parent


def get_data_dir(override: str | Path | None = None) -> Path:
    """
    Resolve user-writable application data directory without admin privileges
    and without hardcoded developer paths.
    """
    if override is not None:
        base = Path(override).expanduser().resolve()
    elif env_dir := os.environ.get("DARK_GPT_DATA_DIR"):
        base = Path(env_dir).expanduser().resolve()
    else:
        base = Path.home() / ".dark_gpt"
    base.mkdir(parents=True, exist_ok=True)
    return base


def get_config_path(data_dir: Path | None = None) -> Path:
    return (data_dir or get_data_dir()) / "config.json"


def get_sessions_dir(data_dir: Path | None = None) -> Path:
    d = (data_dir or get_data_dir()) / "sessions"
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_projects_dir(data_dir: Path | None = None) -> Path:
    d = (data_dir or get_data_dir()) / "projects"
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_exports_dir(data_dir: Path | None = None) -> Path:
    d = (data_dir or get_data_dir()) / "exports"
    d.mkdir(parents=True, exist_ok=True)
    return d


def slugify_name(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", name.strip()).strip(".-")
    return cleaned or "untitled"


def resolve_safe_child_path(base_dir: Path, relative_path: str) -> Path:
    """
    Resolve a user-supplied relative path strictly inside base_dir.
    Raises ValueError on absolute paths, NUL bytes, or directory traversal.
    """
    if not isinstance(relative_path, str) or not relative_path.strip():
        raise ValueError("Path must be a non-empty relative string.")
    if "\x00" in relative_path:
        raise ValueError("NUL bytes are not permitted in paths.")

    raw = relative_path.strip().replace("\\", "/")
    candidate = Path(raw)
    if candidate.is_absolute() or re.match(r"^[A-Za-z]:", raw):
        raise ValueError(f"Absolute paths are not permitted: {relative_path}")

    resolved_base = base_dir.resolve()
    resolved_target = (resolved_base / raw).resolve()
    if resolved_target != resolved_base and resolved_base not in resolved_target.parents:
        raise ValueError(f"Path traversal outside base directory rejected: {relative_path}")
    return resolved_target
