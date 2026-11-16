from __future__ import annotations

import io
import json
import os
import re
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest import mock

DARK_GPT_ROOT = Path(__file__).resolve().parent.parent
if str(DARK_GPT_ROOT) not in sys.path:
    sys.path.insert(0, str(DARK_GPT_ROOT))

import dark_gpt  # noqa: E402
from dark_gpt_pkg.chat_logic import CREATOR_ANSWER, process_chat_turn  # noqa: E402
from dark_gpt_pkg.config import AppConfig, load_config, save_config  # noqa: E402
from dark_gpt_pkg.memory import DEFAULT_SESSION_ID, SessionStore  # noqa: E402
from dark_gpt_pkg.ollama_lifecycle import ensure_ollama_ready, find_ollama_executable  # noqa: E402
from dark_gpt_pkg.projects import ProjectManager  # noqa: E402


class _MockOllamaState:
    def __init__(self) -> None:
        self.chat_requests: list[dict] = []
        self.next_reply: str = "Mock local response"
        self.models: list[str] = ["llama3.2:latest", "qwen2.5:7b"]


def _start_mock_ollama_server():
    state = _MockOllamaState()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):  # noqa: A002
            return

        def do_GET(self):
            if self.path == "/api/tags":
                payload = json.dumps({"models": [{"name": m} for m in state.models]}).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return
            self.send_response(404)
            self.end_headers()

        def do_POST(self):
            if self.path == "/api/chat":
                length = int(self.headers.get("Content-Length", "0"))
                body = json.loads(self.rfile.read(length).decode("utf-8"))
                state.chat_requests.append(body)
                reply = state.next_reply
                if callable(reply):
                    reply = reply(body)
                payload = json.dumps(
                    {
                        "model": body.get("model", "llama3.2"),
                        "message": {"role": "assistant", "content": reply},
                        "done": True,
                    }
                ).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return
            self.send_response(404)
            self.end_headers()

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, state


class DarkGptTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.data_dir = Path(self._tmp.name)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_theme_colors_and_no_color_mode(self) -> None:
        cfg = AppConfig()
        store = SessionStore(self.data_dir)

        banner_color = dark_gpt.render_main_banner(cfg, store, force_color=True)
        menu_color = dark_gpt.render_home_menu(force_color=True)
        combined = banner_color + "\n" + menu_color

        # Only allowed ANSI codes: 0, 1, 91, 97 (strictly black/white/red)
        ansi_codes = re.findall(r"\033\[([0-9;]+)m", combined)
        self.assertTrue(len(ansi_codes) > 0)
        for code in ansi_codes:
            for part in code.split(";"):
                self.assertIn(part, {"0", "1", "91", "97"}, f"Disallowed ANSI color code: {code}")

        banner_plain = dark_gpt.render_main_banner(cfg, store, force_color=False)
        self.assertNotIn("\033[", banner_plain)
        self.assertIn("M4TH4CK3R", banner_plain)
        self.assertIn("POWERED BY OLLAMA FREE", banner_plain)
        self.assertIn("DARK-GPT // LOCAL AI TERMINAL", banner_plain)
        self.assertLess(banner_plain.index("██████╗"), banner_plain.index("Created by M4TH4CK3R"))

        menu_plain = dark_gpt.render_home_menu(force_color=False)
        for idx in range(0, 13):
            self.assertIn(f"{idx}. ", menu_plain)

    def test_startup_animation_sequence(self) -> None:
        buf = io.StringIO()
        with mock.patch.dict(os.environ, {"DARK_GPT_NO_CLEAR": "1", "DARK_GPT_FORCE_COLOR": "1"}):
            dark_gpt.run_startup_animation(delay=0.0, stream=buf)
        out = buf.getvalue()
        self.assertIn("DARK-GPT", out)
        self.assertIn("[x_x]  [x_x]  [x_x]  [x_x]", out)
        self.assertIn("DARK-GPT // INITIALIZING:", out)
        self.assertIn("DARK-GPT ONLINE", out)

    def test_creator_intercept_bypasses_ollama(self) -> None:
        server, state = _start_mock_ollama_server()
        try:
            port = server.server_address[1]
            cfg = AppConfig(endpoint=f"http://127.0.0.1:{port}/api/chat")
            store = SessionStore(self.data_dir)
            for prompt in (
                "Qui t'a créé ?",
                "Who created DARK-GPT?",
                "who made you",
                "qui est ton créateur",
            ):
                res = process_chat_turn(prompt, config=cfg, session_store=store)
                self.assertFalse(res.called_provider)
                self.assertTrue(res.is_creator_intercept)
                self.assertEqual(res.reply, CREATOR_ANSWER)
                self.assertEqual(res.reply, "DARK-GPT a été créé par M4TH4CK3R.")
            self.assertEqual(len(state.chat_requests), 0)
        finally:
            server.shutdown()
            server.server_close()

    def test_short_prompts_call_real_ollama_and_normalize_confirmation(self) -> None:
        server, state = _start_mock_ollama_server()
        try:
            port = server.server_address[1]
            cfg = AppConfig(endpoint=f"http://127.0.0.1:{port}/api/chat", short_max_tokens=72)
            store = SessionStore(self.data_dir)

            # 1) Confirmation prompt receives trivial "OK." from real Ollama -> normalized display
            state.next_reply = "OK."
            res1 = process_chat_turn("T'as compris ?", config=cfg, session_store=store)
            self.assertTrue(res1.called_provider)
            self.assertEqual(res1.reply, "Oui, j'ai compris.")
            self.assertEqual(len(state.chat_requests), 1)
            self.assertEqual(state.chat_requests[0]["options"]["num_predict"], 72)

            # 2) Greeting calls real Ollama and passes through normal model reply
            state.next_reply = "Bonjour ! Comment puis-je vous aider ?"
            res2 = process_chat_turn("Bonjour", config=cfg, session_store=store)
            self.assertTrue(res2.called_provider)
            self.assertEqual(res2.reply, "Bonjour ! Comment puis-je vous aider ?")
            self.assertEqual(len(state.chat_requests), 2)

            # 3) Multi-turn context includes prior turns
            state.next_reply = "Voici l'analyse demandée."
            res3 = process_chat_turn("Explique TCP", config=cfg, session_store=store)
            self.assertEqual(res3.reply, "Voici l'analyse demandée.")
            sent_msgs = state.chat_requests[2]["messages"]
            user_contents = [m["content"] for m in sent_msgs if m["role"] == "user"]
            self.assertEqual(user_contents, ["T'as compris ?", "Bonjour", "Explique TCP"])
        finally:
            server.shutdown()
            server.server_close()

    def test_session_lifecycle_and_restart_persistence(self) -> None:
        store1 = SessionStore(self.data_dir)
        s2 = store1.create_session("Pentest Lab")
        store1.append_message(s2.id, "user", "Check headers")
        store1.append_message(s2.id, "assistant", "Reviewing CSP and HSTS headers.")
        store1.rename_session(s2.id, "Authorized Web Audit")

        # Restart SessionStore cleanly from disk
        store2 = SessionStore(self.data_dir)
        active = store2.get_active_session()
        self.assertEqual(active.id, s2.id)
        self.assertEqual(active.title, "Authorized Web Audit")
        self.assertEqual(len(active.messages), 2)

        hits = store2.search_messages("HSTS")
        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0]["session_id"], s2.id)

        txt_export = store2.export_session(s2.id, fmt="txt")
        json_export = store2.export_session(s2.id, fmt="json")
        self.assertTrue(txt_export.exists())
        self.assertTrue(json_export.exists())
        self.assertIn("Reviewing CSP", txt_export.read_text(encoding="utf-8"))
        exported_json = json.loads(json_export.read_text(encoding="utf-8"))
        self.assertEqual(exported_json["title"], "Authorized Web Audit")

        with self.assertRaises(ValueError):
            store2.delete_session(DEFAULT_SESSION_ID)

        store2.delete_session(s2.id)
        self.assertEqual(store2.get_active_session_id(), DEFAULT_SESSION_ID)

    def test_projects_containment_and_authorized_execution(self) -> None:
        pm = ProjectManager(self.data_dir)
        root = pm.create_project("net-audit", description="Authorized tool", template="python")
        self.assertTrue((root / "main.py").exists())

        with self.assertRaises(ValueError):
            pm.write_project_file("net-audit", "../outside.txt", "blocked")
        with self.assertRaises(ValueError):
            pm.write_project_file("net-audit", "/tmp/abs.txt", "blocked")
        with self.assertRaises(ValueError):
            pm.write_project_file("net-audit", "bad\x00name.txt", "blocked")

        pm.write_project_file("net-audit", "notes/checklist.md", "# Checklist\n- Verify scope\n")
        self.assertIn("Verify scope", pm.read_project_file("net-audit", "notes/checklist.md"))

        with self.assertRaises(PermissionError):
            pm.run_project("net-audit", authorized=False)

        rc, stdout, _ = pm.run_project("net-audit", authorized=True)
        self.assertEqual(rc, 0)
        self.assertIn("Running net-audit", stdout)

        with self.assertRaises(PermissionError):
            pm.delete_project("net-audit", confirmed=False)
        pm.delete_project("net-audit", confirmed=True)
        self.assertEqual(pm.list_projects(), [])

    def test_corrupted_config_recovery_and_non_admin_ollama_detection(self) -> None:
        cfg_path = self.data_dir / "config.json"
        cfg_path.write_text("{broken json!!!", encoding="utf-8")
        cfg, notice = load_config(self.data_dir)
        self.assertIsNotNone(notice)
        self.assertEqual(cfg.model, "llama3.2")
        backups = list(self.data_dir.glob("config.corrupt.*.json"))
        self.assertEqual(len(backups), 1)

        fake_home = self.data_dir / "fake_home"
        local_ollama = fake_home / "Applications" / "Ollama.app" / "Contents" / "MacOS" / "ollama"
        local_ollama.parent.mkdir(parents=True, exist_ok=True)
        local_ollama.write_text("#!/bin/sh\necho ollama\n", encoding="utf-8")

        with mock.patch("shutil.which", return_value=None), mock.patch("pathlib.Path.home", return_value=fake_home):
            found = find_ollama_executable()
            self.assertEqual(found, local_ollama)

    def test_cli_smoke_and_interactive_end_to_end(self) -> None:
        server, _state = _start_mock_ollama_server()
        try:
            port = server.server_address[1]
            cli_data = self.data_dir / "cli_run"
            cli_data.mkdir(parents=True, exist_ok=True)
            cfg = AppConfig(endpoint=f"http://127.0.0.1:{port}/api/chat")
            save_config(cfg, cli_data)

            env = os.environ.copy()
            env["DARK_GPT_DATA_DIR"] = str(cli_data)
            env["NO_COLOR"] = "1"
            env["DARK_GPT_NO_CLEAR"] = "1"

            # Smoke test
            smoke = subprocess.run(
                [sys.executable, str(DARK_GPT_ROOT / "dark_gpt.py"), "--smoke", "--no-animation"],
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(smoke.returncode, 0, smoke.stderr)
            self.assertIn("M4TH4CK3R", smoke.stdout)
            self.assertIn("12. Manage sessions", smoke.stdout)

            # Live interactive stdin flow: enter chat -> creator question -> confirmation check -> exit chat -> exit app
            _state.next_reply = "OK."
            scripted_input = "\n".join(
                [
                    "1",
                    "Qui t'a créé ?",
                    "T'as compris ?",
                    "/exit",
                    "0",
                ]
            ) + "\n"

            e2e = subprocess.run(
                [sys.executable, str(DARK_GPT_ROOT / "dark_gpt.py"), "--no-animation"],
                input=scripted_input,
                env=env,
                capture_output=True,
                text=True,
                timeout=15,
                check=False,
            )
            self.assertEqual(e2e.returncode, 0, e2e.stderr)
            self.assertIn("DARK-GPT a été créé par M4TH4CK3R.", e2e.stdout)
            self.assertIn("Oui, j'ai compris.", e2e.stdout)
            self.assertIn("DARK-GPT OFFLINE", e2e.stdout)
            ok, _msg, tags = ensure_ollama_ready(cfg.endpoint, wait_seconds=1.0)
            self.assertTrue(ok)
            self.assertIn("llama3.2:latest", tags)
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    unittest.main()
