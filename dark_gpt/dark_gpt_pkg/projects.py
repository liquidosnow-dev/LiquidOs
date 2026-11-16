from __future__ import annotations

import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from .paths import get_projects_dir, resolve_safe_child_path, slugify_name


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class ProjectManager:
    """
    Safe local workspace manager for DARK-GPT projects.
    Enforces strict path containment within each project's root directory unless
    explicit confirmation is supplied.
    """

    def __init__(self, data_dir: Path | None = None) -> None:
        self.projects_dir = get_projects_dir(data_dir)

    def _project_root(self, name_or_slug: str) -> Path:
        slug = slugify_name(name_or_slug)
        return resolve_safe_child_path(self.projects_dir, slug)

    def create_project(
        self,
        name: str,
        description: str = "",
        template: str = "python",
    ) -> Path:
        clean_name = name.strip()
        if not clean_name:
            raise ValueError("Project name cannot be empty.")
        slug = slugify_name(clean_name)
        root = resolve_safe_child_path(self.projects_dir, slug)
        if root.exists():
            raise FileExistsError(f"Project '{slug}' already exists.")
        root.mkdir(parents=True, exist_ok=False)

        now = _utc_now()
        meta = {
            "name": clean_name,
            "slug": slug,
            "description": description.strip(),
            "template": template,
            "created_at": now,
            "updated_at": now,
        }
        (root / "project.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
        (root / "README.md").write_text(
            f"# {clean_name}\n\n{description.strip() or 'Local DARK-GPT project workspace.'}\n",
            encoding="utf-8",
        )
        if template == "python":
            (root / "main.py").write_text(
                '"""Local project entrypoint created in DARK-GPT."""\n\n\n'
                'def main() -> None:\n'
                f'    print("Running {clean_name}")\n\n\n'
                'if __name__ == "__main__":\n'
                '    main()\n',
                encoding="utf-8",
            )
        elif template == "shell":
            script = root / "run.sh"
            script.write_text(f"#!/usr/bin/env sh\necho \"Running {clean_name}\"\n", encoding="utf-8")
            script.chmod(0o755)
        return root

    def list_projects(self) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        for entry in sorted(self.projects_dir.iterdir()):
            if not entry.is_dir() or entry.name.startswith("."):
                continue
            meta_file = entry / "project.json"
            meta: dict[str, Any] = {}
            if meta_file.exists():
                try:
                    loaded = json.loads(meta_file.read_text(encoding="utf-8"))
                    if isinstance(loaded, dict):
                        meta = loaded
                except Exception:
                    pass
            files = self.list_project_files(entry.name)
            items.append(
                {
                    "slug": entry.name,
                    "name": str(meta.get("name") or entry.name),
                    "description": str(meta.get("description") or ""),
                    "template": str(meta.get("template") or "python"),
                    "updated_at": str(meta.get("updated_at") or ""),
                    "file_count": len(files),
                    "path": str(entry),
                }
            )
        return items

    def get_project_root(self, name_or_slug: str) -> Path:
        root = self._project_root(name_or_slug)
        if not root.exists() or not root.is_dir():
            raise FileNotFoundError(f"Project '{name_or_slug}' not found.")
        return root

    def list_project_files(self, name_or_slug: str) -> list[str]:
        root = self.get_project_root(name_or_slug)
        files: list[str] = []
        for p in sorted(root.rglob("*")):
            if p.is_file():
                files.append(p.relative_to(root).as_posix())
        return files

    def read_project_file(self, name_or_slug: str, relative_path: str) -> str:
        root = self.get_project_root(name_or_slug)
        target = resolve_safe_child_path(root, relative_path)
        if not target.exists() or not target.is_file():
            raise FileNotFoundError(f"File '{relative_path}' not found in project '{name_or_slug}'.")
        return target.read_text(encoding="utf-8")

    def write_project_file(
        self,
        name_or_slug: str,
        relative_path: str,
        content: str,
        *,
        confirm_outside: Callable[[Path], bool] | None = None,
    ) -> Path:
        root = self.get_project_root(name_or_slug)
        try:
            target = resolve_safe_child_path(root, relative_path)
        except ValueError as exc:
            # Only permit outside writes if explicit confirmation callback approves a non-NUL target.
            if "\x00" in relative_path or confirm_outside is None:
                raise
            candidate = (root / relative_path).expanduser().resolve()
            if not confirm_outside(candidate):
                raise ValueError(f"Write outside project root denied: {relative_path}") from exc
            target = candidate

        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        meta_path = root / "project.json"
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                if isinstance(meta, dict):
                    meta["updated_at"] = _utc_now()
                    meta_path.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
            except Exception:
                pass
        return target

    def delete_project(self, name_or_slug: str, *, confirmed: bool = False) -> None:
        if not confirmed:
            raise PermissionError("Explicit confirmation is required to delete a project.")
        root = self.get_project_root(name_or_slug)
        shutil.rmtree(root)

    def resolve_entrypoint(self, name_or_slug: str, entrypoint: str | None = None) -> Path:
        root = self.get_project_root(name_or_slug)
        if entrypoint:
            target = resolve_safe_child_path(root, entrypoint)
            if not target.exists() or not target.is_file():
                raise FileNotFoundError(f"Entrypoint '{entrypoint}' not found.")
            return target

        for default_name in ("main.py", "app.py", "run.sh"):
            candidate = root / default_name
            if candidate.exists() and candidate.is_file():
                return candidate

        for rel in self.list_project_files(name_or_slug):
            if rel.endswith(".py") or rel.endswith(".sh"):
                return root / rel
        raise FileNotFoundError(f"No runnable .py or .sh entrypoint found in project '{name_or_slug}'.")

    def run_project(
        self,
        name_or_slug: str,
        entrypoint: str | None = None,
        *,
        authorized: bool = False,
        timeout_sec: int = 30,
    ) -> tuple[int, str, str]:
        if not authorized:
            raise PermissionError(
                "Explicit confirmation and authorization check required before running project code."
            )
        root = self.get_project_root(name_or_slug)
        target = self.resolve_entrypoint(name_or_slug, entrypoint)

        if target.suffix == ".py":
            cmd = [sys.executable, str(target)]
        elif target.suffix == ".sh":
            shell = shutil.which("bash") or shutil.which("sh") or "/bin/sh"
            cmd = [shell, str(target)]
        else:
            raise ValueError(f"Unsupported project entrypoint type '{target.suffix}'. Expected .py or .sh.")

        proc = subprocess.run(
            cmd,
            cwd=str(root),
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            check=False,
        )
        return proc.returncode, proc.stdout, proc.stderr
