from __future__ import annotations

import json
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .paths import get_exports_dir, get_sessions_dir, slugify_name

DEFAULT_SESSION_ID = "default"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@dataclass
class Session:
    id: str
    title: str
    created_at: str
    updated_at: str
    messages: list[dict[str, str]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "Session":
        now = utc_now_iso()
        raw_msgs = raw.get("messages")
        messages: list[dict[str, str]] = []
        if isinstance(raw_msgs, list):
            for item in raw_msgs:
                if isinstance(item, dict) and item.get("role") in ("user", "assistant", "system"):
                    messages.append(
                        {
                            "role": str(item["role"]),
                            "content": str(item.get("content") or ""),
                            "timestamp": str(item.get("timestamp") or now),
                        }
                    )
        return cls(
            id=str(raw.get("id") or DEFAULT_SESSION_ID),
            title=str(raw.get("title") or "Default Session"),
            created_at=str(raw.get("created_at") or now),
            updated_at=str(raw.get("updated_at") or now),
            messages=messages,
        )


class SessionStore:
    """
    File-based local conversation memory manager.

    Memory architecture note:
    - Sessions provide *contextual memory* (persisted conversation history sent in
      subsequent model requests), NOT model weight training or fine-tuning.
    - Storage operations are isolated behind this class so a future multi-user
      web backend can implement user-scoped session persistence without altering
      the chat engine.
    """

    def __init__(self, data_dir: Path | None = None) -> None:
        self.data_dir = data_dir
        self.sessions_dir = get_sessions_dir(data_dir)
        self.state_path = self.sessions_dir / ".active_state.json"
        self.ensure_default_session()

    @staticmethod
    def get_memory_model_note() -> str:
        return (
            "Contextual session memory: saved conversations are replayed as message context "
            "to the local model. It does not retrain model weights."
        )

    def _session_path(self, session_id: str) -> Path:
        safe_id = slugify_name(session_id)
        return self.sessions_dir / f"{safe_id}.json"

    def _save_session(self, session: Session) -> None:
        path = self._session_path(session.id)
        tmp = path.with_name(f".{path.stem}.tmp.{int(time.time() * 1000)}")
        tmp.write_text(json.dumps(session.to_dict(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        tmp.replace(path)

    def _load_session_file(self, path: Path) -> Session | None:
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(raw, dict):
                return None
            return Session.from_dict(raw)
        except Exception:
            return None

    def ensure_default_session(self) -> Session:
        default_path = self._session_path(DEFAULT_SESSION_ID)
        if default_path.exists():
            loaded = self._load_session_file(default_path)
            if loaded is not None:
                return loaded
        now = utc_now_iso()
        session = Session(
            id=DEFAULT_SESSION_ID,
            title="Default Session",
            created_at=now,
            updated_at=now,
            messages=[],
        )
        self._save_session(session)
        return session

    def get_active_session_id(self) -> str:
        if self.state_path.exists():
            try:
                state = json.loads(self.state_path.read_text(encoding="utf-8"))
                sid = state.get("active_session_id")
                if isinstance(sid, str) and self._session_path(sid).exists():
                    return sid
            except Exception:
                pass
        return DEFAULT_SESSION_ID

    def set_active_session_id(self, session_id: str) -> None:
        if not self._session_path(session_id).exists():
            raise FileNotFoundError(f"Session '{session_id}' does not exist.")
        tmp = self.state_path.with_name(f".state.tmp.{int(time.time() * 1000)}")
        tmp.write_text(json.dumps({"active_session_id": session_id}, indent=2) + "\n", encoding="utf-8")
        tmp.replace(self.state_path)

    def get_active_session(self) -> Session:
        sid = self.get_active_session_id()
        return self.open_session(sid)

    def create_session(self, title: str | None = None, *, activate: bool = True) -> Session:
        now = utc_now_iso()
        clean_title = (title or "").strip() or f"Session {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        short_uid = uuid.uuid4().hex[:6]
        sid = f"{slugify_name(clean_title)[:28]}-{short_uid}"
        session = Session(
            id=sid,
            title=clean_title,
            created_at=now,
            updated_at=now,
            messages=[],
        )
        self._save_session(session)
        if activate:
            self.set_active_session_id(session.id)
        return session

    def open_session(self, session_id: str) -> Session:
        path = self._session_path(session_id)
        if not path.exists():
            raise FileNotFoundError(f"Session '{session_id}' not found.")
        session = self._load_session_file(path)
        if session is None:
            raise ValueError(f"Session '{session_id}' could not be parsed.")
        self.set_active_session_id(session.id)
        return session

    def list_sessions(self) -> list[Session]:
        self.ensure_default_session()
        sessions: list[Session] = []
        for path in sorted(self.sessions_dir.glob("*.json")):
            if path.name.startswith("."):
                continue
            loaded = self._load_session_file(path)
            if loaded is not None:
                sessions.append(loaded)
        sessions.sort(key=lambda s: (s.id != DEFAULT_SESSION_ID, s.updated_at), reverse=False)
        # Keep default first, then newest updated first
        default = [s for s in sessions if s.id == DEFAULT_SESSION_ID]
        others = sorted([s for s in sessions if s.id != DEFAULT_SESSION_ID], key=lambda s: s.updated_at, reverse=True)
        return default + others

    def rename_session(self, session_id: str, new_title: str) -> Session:
        clean = new_title.strip()
        if not clean:
            raise ValueError("Session title cannot be empty.")
        path = self._session_path(session_id)
        if not path.exists():
            raise FileNotFoundError(f"Session '{session_id}' not found.")
        session = self._load_session_file(path)
        if session is None:
            raise ValueError(f"Session '{session_id}' is unreadable.")
        session.title = clean
        session.updated_at = utc_now_iso()
        self._save_session(session)
        return session

    def delete_session(self, session_id: str) -> None:
        if session_id == DEFAULT_SESSION_ID:
            raise ValueError("The default session cannot be deleted.")
        path = self._session_path(session_id)
        if not path.exists():
            raise FileNotFoundError(f"Session '{session_id}' not found.")
        active = self.get_active_session_id()
        path.unlink()
        if active == session_id:
            self.set_active_session_id(DEFAULT_SESSION_ID)

    def append_message(self, session_id: str, role: str, content: str) -> Session:
        if role not in ("user", "assistant", "system"):
            raise ValueError(f"Unsupported role: {role}")
        path = self._session_path(session_id)
        if not path.exists():
            raise FileNotFoundError(f"Session '{session_id}' not found.")
        session = self._load_session_file(path)
        if session is None:
            raise ValueError(f"Session '{session_id}' is unreadable.")
        now = utc_now_iso()
        session.messages.append({"role": role, "content": content, "timestamp": now})
        session.updated_at = now
        self._save_session(session)
        return session

    def get_messages_for_model(self, session_id: str, max_messages: int = 30) -> list[dict[str, str]]:
        path = self._session_path(session_id)
        if not path.exists():
            return []
        session = self._load_session_file(path)
        if session is None:
            return []
        recent = session.messages[-max_messages:] if max_messages > 0 else session.messages
        return [{"role": m["role"], "content": m["content"]} for m in recent]

    def search_messages(self, query: str) -> list[dict[str, Any]]:
        needle = query.strip().lower()
        if not needle:
            return []
        hits: list[dict[str, Any]] = []
        for session in self.list_sessions():
            for idx, msg in enumerate(session.messages):
                content = msg.get("content", "")
                if needle in content.lower() or needle in session.title.lower():
                    hits.append(
                        {
                            "session_id": session.id,
                            "session_title": session.title,
                            "message_index": idx,
                            "role": msg.get("role", ""),
                            "timestamp": msg.get("timestamp", ""),
                            "content": content,
                        }
                    )
        return hits

    def export_session(self, session_id: str, fmt: str = "txt", output_dir: Path | None = None) -> Path:
        path = self._session_path(session_id)
        if not path.exists():
            raise FileNotFoundError(f"Session '{session_id}' not found.")
        session = self._load_session_file(path)
        if session is None:
            raise ValueError(f"Session '{session_id}' is unreadable.")

        norm_fmt = fmt.strip().lower()
        if norm_fmt not in ("txt", "json"):
            raise ValueError("Export format must be 'txt' or 'json'.")

        target_dir = output_dir or get_exports_dir(self.data_dir)
        target_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_path = target_dir / f"{slugify_name(session.id)}_{stamp}.{norm_fmt}"

        if norm_fmt == "json":
            out_path.write_text(json.dumps(session.to_dict(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        else:
            lines = [
                f"DARK-GPT Session Export: {session.title} ({session.id})",
                f"Created: {session.created_at}",
                f"Updated: {session.updated_at}",
                "=" * 60,
                "",
            ]
            for msg in session.messages:
                role_label = "YOU" if msg["role"] == "user" else "DARK-GPT"
                lines.append(f"[{msg.get('timestamp', '')}] {role_label}:")
                lines.append(msg.get("content", ""))
                lines.append("")
            out_path.write_text("\n".join(lines), encoding="utf-8")
        return out_path
