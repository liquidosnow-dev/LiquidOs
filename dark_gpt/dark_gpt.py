#!/usr/bin/env python3
"""
DARK-GPT // LOCAL AI TERMINAL
Created by M4TH4CK3R — POWERED BY OLLAMA FREE
"""
from __future__ import annotations

import argparse
import itertools
import os
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Callable

from dark_gpt_pkg import __app_name__, __creator__, __subtitle__, __version__
from dark_gpt_pkg.chat_logic import process_chat_turn
from dark_gpt_pkg.config import (
    DEFAULT_SYSTEM_INSTRUCTION,
    AppConfig,
    load_config,
    reset_config,
    save_config,
)
from dark_gpt_pkg.memory import DEFAULT_SESSION_ID, SessionStore
from dark_gpt_pkg.ollama_lifecycle import (
    derive_ollama_base_url,
    ensure_ollama_ready,
    fetch_ollama_tags,
)
from dark_gpt_pkg.paths import get_app_root, get_data_dir
from dark_gpt_pkg.projects import ProjectManager
from dark_gpt_pkg.theme import (
    box_lines,
    clear_screen,
    enable_windows_vt_mode,
    red,
    white,
)

BANNER_ART = [
    "██████╗  █████╗ ██████╗ ██╗  ██╗      ██████╗ ██████╗ ████████╗",
    "██╔══██╗██╔══██╗██╔══██╗██║ ██╔╝     ██╔════╝ ██╔══██╗╚══██╔══╝",
    "██║  ██║███████║██████╔╝█████╔╝█████╗██║  ███╗██████╔╝   ██║   ",
    "██║  ██║██╔══██║██╔══██╗██╔═██╗╚════╝██║   ██║██╔═══╝    ██║   ",
    "██████╔╝██║  ██║██║  ██║██║  ██╗     ╚██████╔╝██║        ██║   ",
    "╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝      ╚═════╝ ╚═╝        ╚═╝   ",
]

MASCOT_FRAME = "[x_x]  [x_x]  [x_x]  [x_x]"


def _safe_input(prompt_text: str) -> str:
    try:
        return input(prompt_text)
    except (EOFError, KeyboardInterrupt):
        print()
        return ""


def _yes_no(prompt_label: str, default_no: bool = True) -> bool:
    suffix = "[y/N]" if default_no else "[Y/n]"
    ans = _safe_input(white(f"{prompt_label} {suffix} > ", bold=True)).strip().lower()
    if not ans:
        return not default_no
    return ans in ("y", "yes", "o", "oui")


class RedSpinner:
    """Thread-safe vivid-red terminal spinner while awaiting local inference."""

    def __init__(self, label: str = "[x_x] DARK-GPT is thinking...") -> None:
        self.label = label
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._is_tty = hasattr(sys.stdout, "isatty") and sys.stdout.isatty()

    def __enter__(self) -> "RedSpinner":
        if self._is_tty:
            self._thread = threading.Thread(target=self._spin, daemon=True)
            self._thread.start()
        else:
            sys.stdout.write(red(f"{self.label}\n"))
            sys.stdout.flush()
        return self

    def _spin(self) -> None:
        frames = itertools.cycle(["|", "/", "-", "\\"])
        while not self._stop.is_set():
            ch = next(frames)
            sys.stdout.write("\r" + red(f"{self.label} [{ch}]", bold=True))
            sys.stdout.flush()
            self._stop.wait(0.1)

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=0.5)
            sys.stdout.write("\r" + (" " * (len(self.label) + 12)) + "\r")
            sys.stdout.flush()


def run_startup_animation(*, delay: float | None = None, stream=None) -> None:
    """
    Startup animation strictly in BLACK, WHITE, and RED:
    1. Clear screen
    2. Type DARK-GPT character-by-character in red
    3. Transition to [x_x]  [x_x]  [x_x]  [x_x] in red
    4. Show DARK-GPT // INITIALIZING progress bar
    5. Display DARK-GPT ONLINE in red
    6. Clear screen ready for the main banner
    """
    out = stream or sys.stdout
    step = (
        delay
        if delay is not None
        else float(os.environ.get("DARK_GPT_ANIM_DELAY", "0.035"))
    )
    is_tty = hasattr(out, "isatty") and out.isatty()
    if not is_tty and os.environ.get("DARK_GPT_FORCE_ANIM") != "1":
        step = 0.0

    clear_screen()
    out.write("\n")
    for ch in __app_name__:
        out.write(red(ch, bold=True))
        out.flush()
        if step > 0:
            time.sleep(step)
    out.write("\n\n")
    out.write(red(MASCOT_FRAME, bold=True) + "\n\n")
    out.flush()
    if step > 0:
        time.sleep(step * 4)

    total_blocks = 20
    for pct in (20, 40, 60, 80, 100):
        filled = int((pct / 100) * total_blocks)
        bar = "#" * filled + "-" * (total_blocks - filled)
        line = f"DARK-GPT // INITIALIZING: [{bar}] {pct}%"
        if is_tty:
            out.write("\r" + red(line, bold=True))
        else:
            out.write(red(line, bold=True) + "\n")
        out.flush()
        if step > 0:
            time.sleep(step * 2)

    out.write("\n\n" + red("DARK-GPT ONLINE", bold=True) + "\n")
    out.flush()
    if step > 0:
        time.sleep(step * 5)
    clear_screen()


def render_main_banner(
    cfg: AppConfig,
    session_store: SessionStore,
    *,
    force_color: bool | None = None,
) -> str:
    active_session = session_store.get_active_session()
    inner_width = 68
    border_top = "+" + ("=" * (inner_width - 2)) + "+"
    border_mid = "+" + ("-" * (inner_width - 2)) + "+"

    lines: list[str] = [
        red(border_top, bold=True, force_color=force_color),
        red("| ", force_color=force_color)
        + red("DARK-GPT // LOCAL AI TERMINAL", bold=True, force_color=force_color)
        + (" " * (inner_width - 4 - len("DARK-GPT // LOCAL AI TERMINAL")))
        + red(" |", force_color=force_color),
        red(border_mid, force_color=force_color),
    ]
    for art_row in BANNER_ART:
        pad = max(0, inner_width - 4 - len(art_row))
        lines.append(
            red("| ", force_color=force_color)
            + red(art_row, bold=True, force_color=force_color)
            + (" " * pad)
            + red(" |", force_color=force_color)
        )

    creator_line = f"Created by {__creator__}"
    subtitle_line = __subtitle__
    for txt, is_red in ((creator_line, True), (subtitle_line, False)):
        pad = max(0, inner_width - 4 - len(txt))
        styled = (
            red(txt, bold=True, force_color=force_color)
            if is_red
            else white(txt, bold=True, force_color=force_color)
        )
        lines.append(
            red("| ", force_color=force_color)
            + styled
            + (" " * pad)
            + red(" |", force_color=force_color)
        )

    lines.append(red(border_mid, force_color=force_color))
    status_lines = [
        f"Provider: {cfg.provider} | Model: {cfg.model} | Session: {active_session.title}",
        f"Active Project: {cfg.active_project or 'none'} | v{__version__}",
        "Notice: Lawful personal use, dev & authorized research only.",
    ]
    for st in status_lines:
        clipped = st[: inner_width - 4]
        pad = max(0, inner_width - 4 - len(clipped))
        lines.append(
            red("| ", force_color=force_color)
            + white(clipped, force_color=force_color)
            + (" " * pad)
            + red(" |", force_color=force_color)
        )
    lines.append(red(border_top, bold=True, force_color=force_color))
    return "\n".join(lines)


def render_home_menu(*, force_color: bool | None = None) -> str:
    menu_rows = [
        "WORKSPACE:",
        "1. Chat with DARK-GPT",
        "2. Create a project",
        "",
        "PROJECTS:",
        "3. List projects",
        "4. Edit a project",
        "5. Delete a project",
        "6. Run a project",
        "",
        "CONFIGURATION:",
        "7. API/provider settings",
        "8. Edit system instructions",
        "9. Change model",
        "10. Reset settings",
        "11. Check for updates",
        "12. Manage sessions",
        "",
        "0. Exit",
    ]
    return box_lines("DARK-GPT // COMMAND MENU", menu_rows, width=68, force_color=force_color)


def _select_project(pm: ProjectManager) -> str | None:
    projects = pm.list_projects()
    if not projects:
        print(white("No projects found yet. Use option 2 to create one."))
        return None
    lines = [
        f"{idx}. {p['name']} ({p['slug']}) - {p['file_count']} files"
        for idx, p in enumerate(projects, start=1)
    ]
    print(box_lines("PROJECTS", lines, width=68))
    choice = _safe_input(white("Select project number or slug (blank to cancel) > ", bold=True)).strip()
    if not choice:
        return None
    if choice.isdigit():
        num = int(choice)
        if 1 <= num <= len(projects):
            return projects[num - 1]["slug"]
        print(red("Invalid project number.", bold=True))
        return None
    return choice


def _build_project_context(pm: ProjectManager, active_project: str | None) -> str | None:
    if not active_project:
        return None
    try:
        files = pm.list_project_files(active_project)
    except Exception:
        return None
    return f"Project '{active_project}' files: {', '.join(files[:20]) or '(empty)'}"


def handle_chat(
    cfg: AppConfig,
    session_store: SessionStore,
    pm: ProjectManager,
    data_dir: Path,
) -> None:
    if cfg.provider == "ollama":
        ok, status_msg, tags = ensure_ollama_ready(cfg.endpoint, wait_seconds=8.0)
        if ok:
            print(white(f"[OK] {status_msg}"))
            if tags and cfg.model not in tags and not any(t.startswith(cfg.model + ":") for t in tags):
                print(
                    red(
                        f"Note: model '{cfg.model}' was not listed in /api/tags ({', '.join(tags[:5])}). "
                        f"Run: ollama pull {cfg.model}",
                        bold=True,
                    )
                )
        else:
            print(red(f"[!] {status_msg}", bold=True))
            print(white("You can still ask who created DARK-GPT, or start Ollama and retry."))

    session = session_store.get_active_session()
    print(
        box_lines(
            f"CHAT // {session.title}",
            [
                f"Model: {cfg.model} ({cfg.provider})",
                SessionStore.get_memory_model_note(),
                "Commands: /help  /new <title>  /sessions  /clear  /exit",
            ],
            width=68,
        )
    )

    while True:
        try:
            user_text = input(white("YOU > ", bold=True)).strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not user_text:
            continue
        low = user_text.lower()
        if low in ("/exit", "/quit", "/back", "exit", "quit"):
            break
        if low == "/help":
            print(
                box_lines(
                    "CHAT COMMANDS",
                    [
                        "/exit or /back   Return to main menu",
                        "/new <title>     Create and switch to a new session",
                        "/sessions        List saved sessions",
                        "/clear           Clear terminal screen",
                        "/model           Show active provider & model",
                    ],
                    width=68,
                )
            )
            continue
        if low == "/clear":
            clear_screen()
            continue
        if low == "/model":
            print(white(f"Active provider={cfg.provider}, model={cfg.model}, endpoint={cfg.endpoint}"))
            continue
        if low == "/sessions":
            for s in session_store.list_sessions():
                marker = "*" if s.id == session.id else " "
                print(white(f" {marker} [{s.id}] {s.title} ({len(s.messages)} msgs)"))
            continue
        if low.startswith("/new"):
            title = user_text[4:].strip() or None
            session = session_store.create_session(title)
            cfg.active_session_id = session.id
            save_config(cfg, data_dir)
            print(white(f"Switched to new session: {session.title} ({session.id})"))
            continue

        proj_ctx = _build_project_context(pm, cfg.active_project)
        with RedSpinner():
            result = process_chat_turn(
                user_text,
                config=cfg,
                session_store=session_store,
                session_id=session.id,
                project_context=proj_ctx,
            )

        if result.error:
            print(red(f"[x_x] ERROR > {result.error}", bold=True))
        else:
            print(red(f"[x_x] DARK-GPT > {result.reply}", bold=True))


def handle_create_project(cfg: AppConfig, pm: ProjectManager, data_dir: Path) -> None:
    name = _safe_input(white("Project name > ", bold=True)).strip()
    if not name:
        print(white("Cancelled."))
        return
    desc = _safe_input(white("Description (optional) > ", bold=True)).strip()
    template = _safe_input(white("Template [python/shell/blank] (default python) > ", bold=True)).strip().lower() or "python"
    if template not in ("python", "shell", "blank"):
        template = "python"
    try:
        root = pm.create_project(name, description=desc, template=template)
        cfg.active_project = root.name
        save_config(cfg, data_dir)
        print(white(f"Created project '{root.name}' at {root} and set as active project."))
    except Exception as exc:
        print(red(f"Failed to create project: {exc}", bold=True))


def handle_list_projects(cfg: AppConfig, pm: ProjectManager) -> None:
    projects = pm.list_projects()
    if not projects:
        print(white("No projects found."))
        return
    rows = []
    for p in projects:
        mark = "*" if p["slug"] == cfg.active_project else " "
        desc = f" — {p['description']}" if p["description"] else ""
        rows.append(f"{mark} {p['slug']} ({p['file_count']} files){desc}")
    print(box_lines("PROJECT WORKSPACES", rows, width=68))


def handle_edit_project(cfg: AppConfig, pm: ProjectManager, data_dir: Path) -> None:
    slug = _select_project(pm)
    if not slug:
        return
    while True:
        try:
            files = pm.list_project_files(slug)
        except Exception as exc:
            print(red(f"Error reading project: {exc}", bold=True))
            return
        rows = [
            f"Files ({len(files)}): {', '.join(files) if files else '(none)'}",
            "",
            "1. Read a file",
            "2. Create or overwrite a file",
            "3. Set as active project",
            "0. Back",
        ]
        print(box_lines(f"EDIT PROJECT // {slug}", rows, width=68))
        action = _safe_input(white("SELECT > ", bold=True)).strip()
        if action in ("0", ""):
            break
        if action == "1":
            rel = _safe_input(white("Relative file path > ", bold=True)).strip()
            try:
                print(white(pm.read_project_file(slug, rel)))
            except Exception as exc:
                print(red(f"Read failed: {exc}", bold=True))
        elif action == "2":
            rel = _safe_input(white("Relative file path > ", bold=True)).strip()
            print(white("Enter content (end with a single line containing EOF):"))
            buf: list[str] = []
            while True:
                line = _safe_input("")
                if line == "EOF":
                    break
                buf.append(line)
            content = "\n".join(buf) + ("\n" if buf else "")
            try:
                written = pm.write_project_file(
                    slug,
                    rel,
                    content,
                    confirm_outside=lambda p: _yes_no(
                        f"WARNING: '{p}' is outside project root. Allow write?"
                    ),
                )
                print(white(f"Saved {written}"))
            except Exception as exc:
                print(red(f"Write blocked: {exc}", bold=True))
        elif action == "3":
            cfg.active_project = slug
            save_config(cfg, data_dir)
            print(white(f"Active project set to '{slug}'."))


def handle_delete_project(cfg: AppConfig, pm: ProjectManager, data_dir: Path) -> None:
    slug = _select_project(pm)
    if not slug:
        return
    confirm = _safe_input(white(f"Type DELETE {slug} to confirm removal > ", bold=True)).strip()
    if confirm != f"DELETE {slug}":
        print(white("Deletion cancelled."))
        return
    try:
        pm.delete_project(slug, confirmed=True)
        if cfg.active_project == slug:
            cfg.active_project = None
            save_config(cfg, data_dir)
        print(white(f"Deleted project '{slug}'."))
    except Exception as exc:
        print(red(f"Delete failed: {exc}", bold=True))


def handle_run_project(pm: ProjectManager) -> None:
    slug = _select_project(pm)
    if not slug:
        return
    try:
        files = pm.list_project_files(slug)
        print(white(f"Files in '{slug}': {', '.join(files)}"))
        entry = _safe_input(white("Entrypoint (blank for auto main.py/run.sh) > ", bold=True)).strip() or None
        print(red("AUTHORIZATION CHECK: Execute only lawful code you own or are authorized to run.", bold=True))
        if not _yes_no(f"Confirm execution of project '{slug}'?", default_no=True):
            print(white("Execution cancelled."))
            return
        code, stdout, stderr = pm.run_project(slug, entry, authorized=True)
        print(white(f"Exit code: {code}"))
        if stdout:
            print(white("--- STDOUT ---\n" + stdout.rstrip()))
        if stderr:
            print(red("--- STDERR ---\n" + stderr.rstrip()))
    except Exception as exc:
        print(red(f"Execution error: {exc}", bold=True))


def handle_api_settings(cfg: AppConfig, data_dir: Path) -> None:
    while True:
        rows = [
            f"1. Provider: {cfg.provider} (ollama / openai_compatible / anthropic)",
            f"2. Endpoint: {cfg.endpoint}",
            f"3. Keep alive: {cfg.keep_alive}",
            f"4. Max tokens: {cfg.max_tokens} (short: {cfg.short_max_tokens})",
            f"5. Temperature: {cfg.temperature}",
            f"6. Timeout (sec): {cfg.request_timeout_sec}",
            f"7. Authorized security research acknowledgement: {cfg.authorized_security_research}",
            "0. Back",
        ]
        print(box_lines("API / PROVIDER SETTINGS", rows, width=68))
        choice = _safe_input(white("SELECT > ", bold=True)).strip()
        if choice in ("0", ""):
            break
        if choice == "1":
            val = _safe_input(white("Provider [ollama/openai_compatible/anthropic] > ", bold=True)).strip().lower()
            if val in ("ollama", "openai_compatible", "anthropic"):
                cfg.provider = val
            else:
                print(red("Unsupported provider.", bold=True))
        elif choice == "2":
            val = _safe_input(white("Endpoint URL > ", bold=True)).strip()
            if val:
                cfg.endpoint = val
        elif choice == "3":
            val = _safe_input(white("Ollama keep_alive (e.g. 10m, 30m, 0) > ", bold=True)).strip()
            if val:
                cfg.keep_alive = val
        elif choice == "4":
            val = _safe_input(white("Max tokens (32..4096) > ", bold=True)).strip()
            if val.isdigit():
                cfg.max_tokens = max(32, min(4096, int(val)))
        elif choice == "5":
            try:
                cfg.temperature = max(0.0, min(2.0, float(_safe_input(white("Temperature (0.0..2.0) > ", bold=True)))))
            except ValueError:
                print(red("Invalid float.", bold=True))
        elif choice == "6":
            val = _safe_input(white("Timeout seconds (5..600) > ", bold=True)).strip()
            if val.isdigit():
                cfg.request_timeout_sec = max(5, min(600, int(val)))
        elif choice == "7":
            cfg.authorized_security_research = _yes_no(
                "Confirm all cybersecurity research tasks are strictly authorized?",
                default_no=True,
            )
        save_config(cfg, data_dir)
        print(white("Settings saved."))


def handle_edit_system_instructions(cfg: AppConfig, data_dir: Path) -> None:
    print(box_lines("CURRENT SYSTEM INSTRUCTIONS", [cfg.system_instruction], width=68))
    print(white("1. Replace system instructions   2. Restore default   0. Back"))
    choice = _safe_input(white("SELECT > ", bold=True)).strip()
    if choice == "1":
        new_inst = _safe_input(white("New system instruction > ", bold=True)).strip()
        if new_inst:
            cfg.system_instruction = new_inst
            save_config(cfg, data_dir)
            print(white("System instructions updated."))
    elif choice == "2":
        cfg.system_instruction = DEFAULT_SYSTEM_INSTRUCTION
        save_config(cfg, data_dir)
        print(white("Restored default system instructions."))


def handle_change_model(cfg: AppConfig, data_dir: Path) -> None:
    base_url = derive_ollama_base_url(cfg.endpoint)
    models = fetch_ollama_tags(base_url, timeout_sec=2.0) or []
    rows = [f"Current model: {cfg.model}"]
    if models:
        rows.append("Installed local Ollama models:")
        for idx, m in enumerate(models, start=1):
            rows.append(f"  {idx}. {m}")
    else:
        rows.append("No running Ollama tags detected; enter any model tag manually (e.g. llama3.2).")
    print(box_lines("CHANGE MODEL", rows, width=68))
    choice = _safe_input(white("Enter model number or name (blank to cancel) > ", bold=True)).strip()
    if not choice:
        return
    if choice.isdigit() and models:
        idx = int(choice)
        if 1 <= idx <= len(models):
            cfg.model = models[idx - 1]
        else:
            print(red("Invalid selection.", bold=True))
            return
    else:
        cfg.model = choice
    save_config(cfg, data_dir)
    print(white(f"Active model changed to '{cfg.model}'."))


def handle_reset_settings(cfg: AppConfig, data_dir: Path) -> AppConfig:
    if not _yes_no("Reset configuration to defaults (keeps sessions and projects)?", default_no=True):
        print(white("Cancelled."))
        return cfg
    new_cfg = reset_config(data_dir)
    print(white("Configuration reset to defaults."))
    return new_cfg


def handle_check_updates(cfg: AppConfig) -> None:
    app_root = get_app_root()
    rows = [
        f"Installed DARK-GPT version: v{__version__}",
        f"Installation root: {app_root}",
    ]
    git_bin = shutil.which("git")
    if git_bin and (app_root / ".git").exists():
        try:
            proc = subprocess.run(
                [git_bin, "status", "-sb"],
                cwd=str(app_root),
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
            status_line = (proc.stdout.strip().splitlines() or ["git repository clean"])[0]
            rows.append(f"Git status: {status_line}")
        except Exception as exc:
            rows.append(f"Git check skipped: {exc}")
    else:
        rows.append("Portable directory mode: replace files or run `git pull` in a cloned repo to update.")

    if cfg.provider == "ollama":
        tags = fetch_ollama_tags(derive_ollama_base_url(cfg.endpoint), timeout_sec=1.5)
        if tags is not None:
            rows.append(f"Ollama reachable: {len(tags)} local model(s) installed.")
            rows.append(f"To refresh model weights locally: ollama pull {cfg.model}")
        else:
            rows.append("Ollama offline: start Ollama to check local models.")
    print(box_lines("UPDATE CHECK", rows, width=68))


def handle_manage_sessions(cfg: AppConfig, session_store: SessionStore, data_dir: Path) -> None:
    while True:
        active = session_store.get_active_session()
        rows = [
            f"Active session: {active.title} [{active.id}] ({len(active.messages)} msgs)",
            SessionStore.get_memory_model_note(),
            "",
            "1. Create new session",
            "2. Open / switch session",
            "3. List sessions",
            "4. Rename session",
            "5. Search across sessions",
            "6. Export session (.txt / .json)",
            "7. Delete session",
            "0. Back",
        ]
        print(box_lines("MANAGE SESSIONS", rows, width=68))
        choice = _safe_input(white("SELECT > ", bold=True)).strip()
        if choice in ("0", ""):
            break
        if choice == "1":
            title = _safe_input(white("New session title > ", bold=True)).strip() or None
            created = session_store.create_session(title)
            cfg.active_session_id = created.id
            save_config(cfg, data_dir)
            print(white(f"Created & opened session '{created.title}' ({created.id})."))
        elif choice == "2":
            sessions = session_store.list_sessions()
            for idx, s in enumerate(sessions, start=1):
                print(white(f" {idx}. {s.title} [{s.id}] ({len(s.messages)} msgs)"))
            pick = _safe_input(white("Session number or id > ", bold=True)).strip()
            if not pick:
                continue
            sid = sessions[int(pick) - 1].id if pick.isdigit() and 1 <= int(pick) <= len(sessions) else pick
            try:
                opened = session_store.open_session(sid)
                cfg.active_session_id = opened.id
                save_config(cfg, data_dir)
                print(white(f"Active session switched to '{opened.title}'."))
            except Exception as exc:
                print(red(f"Could not open session: {exc}", bold=True))
        elif choice == "3":
            for s in session_store.list_sessions():
                mark = "*" if s.id == active.id else " "
                print(white(f" {mark} [{s.id}] {s.title} — {len(s.messages)} msgs (updated {s.updated_at})"))
        elif choice == "4":
            sid = _safe_input(white(f"Session id (blank for active '{active.id}') > ", bold=True)).strip() or active.id
            new_title = _safe_input(white("New title > ", bold=True)).strip()
            try:
                renamed = session_store.rename_session(sid, new_title)
                print(white(f"Renamed to '{renamed.title}'."))
            except Exception as exc:
                print(red(f"Rename failed: {exc}", bold=True))
        elif choice == "5":
            query = _safe_input(white("Search keyword > ", bold=True)).strip()
            hits = session_store.search_messages(query)
            if not hits:
                print(white("No matching messages found."))
            else:
                for h in hits[:20]:
                    snippet = h["content"].replace("\n", " ")[:70]
                    print(white(f" [{h['session_id']}] {h['role']}: {snippet}"))
        elif choice == "6":
            sid = _safe_input(white(f"Session id (blank for active '{active.id}') > ", bold=True)).strip() or active.id
            fmt = _safe_input(white("Format [txt/json] (default txt) > ", bold=True)).strip().lower() or "txt"
            try:
                out_file = session_store.export_session(sid, fmt=fmt)
                print(white(f"Exported to {out_file}"))
            except Exception as exc:
                print(red(f"Export failed: {exc}", bold=True))
        elif choice == "7":
            sid = _safe_input(white("Session id to delete > ", bold=True)).strip()
            if not sid:
                continue
            if sid == DEFAULT_SESSION_ID:
                print(red("Default session cannot be deleted.", bold=True))
                continue
            if _yes_no(f"Delete session '{sid}' permanently?", default_no=True):
                try:
                    session_store.delete_session(sid)
                    cfg.active_session_id = session_store.get_active_session_id()
                    save_config(cfg, data_dir)
                    print(white(f"Deleted session '{sid}'."))
                except Exception as exc:
                    print(red(f"Delete failed: {exc}", bold=True))


def main(argv: list[str] | None = None, input_fn: Callable[[str], str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="DARK-GPT // Local AI Terminal by M4TH4CK3R")
    parser.add_argument("--no-animation", action="store_true", help="Skip startup animation")
    parser.add_argument("--smoke", action="store_true", help="Render startup + banner + menu and exit cleanly")
    args = parser.parse_args(argv)

    enable_windows_vt_mode()
    data_dir = get_data_dir()
    cfg, recovery_notice = load_config(data_dir)
    session_store = SessionStore(data_dir)
    if cfg.active_session_id:
        try:
            session_store.open_session(cfg.active_session_id)
        except Exception:
            cfg.active_session_id = session_store.get_active_session_id()
            save_config(cfg, data_dir)
    pm = ProjectManager(data_dir)

    if not args.no_animation:
        run_startup_animation()

    print(render_main_banner(cfg, session_store))
    if recovery_notice:
        print(red(f"[!] {recovery_notice}", bold=True))

    if args.smoke:
        print(render_home_menu())
        return 0

    read_prompt = input_fn or _safe_input

    while True:
        print()
        print(render_home_menu())
        choice = read_prompt(white("SELECT [0-12] > ", bold=True)).strip()
        if choice == "0":
            print(red("DARK-GPT OFFLINE // Session saved.", bold=True))
            return 0
        if choice == "1":
            handle_chat(cfg, session_store, pm, data_dir)
        elif choice == "2":
            handle_create_project(cfg, pm, data_dir)
        elif choice == "3":
            handle_list_projects(cfg, pm)
        elif choice == "4":
            handle_edit_project(cfg, pm, data_dir)
        elif choice == "5":
            handle_delete_project(cfg, pm, data_dir)
        elif choice == "6":
            handle_run_project(pm)
        elif choice == "7":
            handle_api_settings(cfg, data_dir)
        elif choice == "8":
            handle_edit_system_instructions(cfg, data_dir)
        elif choice == "9":
            handle_change_model(cfg, data_dir)
        elif choice == "10":
            cfg = handle_reset_settings(cfg, data_dir)
        elif choice == "11":
            handle_check_updates(cfg)
        elif choice == "12":
            handle_manage_sessions(cfg, session_store, data_dir)
        elif choice == "":
            # Cleanly exit on EOF when piped non-interactively
            if not sys.stdin.isatty():
                return 0
        else:
            print(red(f"Unknown option '{choice}'. Please choose 0-12.", bold=True))


if __name__ == "__main__":
    raise SystemExit(main())
