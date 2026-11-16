from __future__ import annotations

import json
import shutil
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from .paths import get_config_path

DEFAULT_SYSTEM_INSTRUCTION = (
    "You are DARK-GPT, a focused, accurate local AI terminal assistant built for lawful personal use, "
    "learning, software engineering, and authorized cybersecurity research. "
    "Analyze the conversation context carefully, answer directly and clearly, and refuse harmful or unauthorized "
    "actions cleanly."
)


@dataclass
class AppConfig:
    provider: str = "ollama"
    endpoint: str = "http://127.0.0.1:11434/api/chat"
    model: str = "llama3.2"
    keep_alive: str = "10m"
    max_tokens: int = 512
    short_max_tokens: int = 96
    temperature: float = 0.4
    request_timeout_sec: int = 120
    system_instruction: str = DEFAULT_SYSTEM_INSTRUCTION
    active_session_id: str = "default"
    active_project: str | None = None
    authorized_security_research: bool = False
    extra_providers: dict[str, dict[str, Any]] = field(
        default_factory=lambda: {
            "openai_compatible": {
                "endpoint": "https://api.openai.com/v1/chat/completions",
                "model": "gpt-4o-mini",
                "api_key_env": "OPENAI_API_KEY",
            },
            "anthropic": {
                "endpoint": "https://api.anthropic.com/v1/messages",
                "model": "claude-3-5-sonnet-latest",
                "api_key_env": "ANTHROPIC_API_KEY",
            },
        }
    )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "AppConfig":
        defaults = cls()
        return cls(
            provider=str(raw.get("provider") or defaults.provider),
            endpoint=str(raw.get("endpoint") or defaults.endpoint),
            model=str(raw.get("model") or defaults.model),
            keep_alive=str(raw.get("keep_alive") or defaults.keep_alive),
            max_tokens=max(32, min(4096, int(raw.get("max_tokens", defaults.max_tokens)))),
            short_max_tokens=max(16, min(512, int(raw.get("short_max_tokens", defaults.short_max_tokens)))),
            temperature=max(0.0, min(2.0, float(raw.get("temperature", defaults.temperature)))),
            request_timeout_sec=max(5, min(600, int(raw.get("request_timeout_sec", defaults.request_timeout_sec)))),
            system_instruction=str(raw.get("system_instruction") or defaults.system_instruction),
            active_session_id=str(raw.get("active_session_id") or defaults.active_session_id),
            active_project=raw.get("active_project") if isinstance(raw.get("active_project"), str) else None,
            authorized_security_research=bool(raw.get("authorized_security_research", False)),
            extra_providers=raw.get("extra_providers")
            if isinstance(raw.get("extra_providers"), dict)
            else defaults.extra_providers,
        )


def load_config(data_dir: Path | None = None) -> tuple[AppConfig, str | None]:
    """Load configuration cleanly, backing up any corrupted JSON and restoring defaults."""
    cfg_path = get_config_path(data_dir)
    if not cfg_path.exists():
        cfg = AppConfig()
        save_config(cfg, data_dir)
        return cfg, None

    try:
        raw_text = cfg_path.read_text(encoding="utf-8")
        parsed = json.loads(raw_text)
        if not isinstance(parsed, dict):
            raise ValueError("Configuration root must be a JSON object.")
        return AppConfig.from_dict(parsed), None
    except Exception as exc:
        backup_path = cfg_path.with_name(f"config.corrupt.{int(time.time())}.json")
        try:
            shutil.copy2(cfg_path, backup_path)
        except Exception:
            pass
        cfg = AppConfig()
        save_config(cfg, data_dir)
        return cfg, f"Malformed configuration detected ({exc}); backed up to {backup_path.name} and restored defaults."


def save_config(cfg: AppConfig, data_dir: Path | None = None) -> Path:
    cfg_path = get_config_path(data_dir)
    cfg_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = cfg_path.with_name(f".config.tmp.{int(time.time() * 1000)}")
    tmp_path.write_text(json.dumps(cfg.to_dict(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp_path.replace(cfg_path)
    return cfg_path


def reset_config(data_dir: Path | None = None) -> AppConfig:
    cfg = AppConfig()
    save_config(cfg, data_dir)
    return cfg
