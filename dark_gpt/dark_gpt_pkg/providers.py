from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

from .config import AppConfig

try:
    import requests  # type: ignore
except ImportError:  # pragma: no cover - stdlib fallback handles minimal containers
    requests = None


class ProviderError(RuntimeError):
    """Raised on explicit backend connectivity, HTTP, or payload errors."""


@dataclass
class ProviderResponse:
    content: str
    model: str
    provider: str
    raw: dict[str, Any]


def _post_json(url: str, payload: dict[str, Any], headers: dict[str, str], timeout_sec: int) -> dict[str, Any]:
    if requests is not None:
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=timeout_sec)
        except requests.RequestException as exc:
            raise ProviderError(f"Network error contacting {url}: {exc}") from exc
        if resp.status_code >= 400:
            detail = resp.text.strip()[:300]
            raise ProviderError(f"HTTP {resp.status_code} from {url}: {detail or 'request failed'}")
        try:
            data = resp.json()
        except ValueError as exc:
            raise ProviderError(f"Malformed JSON response from {url}: {exc}") from exc
        if not isinstance(data, dict):
            raise ProviderError(f"Unexpected JSON root type from {url}")
        return data

    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            raw_bytes = resp.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace").strip()[:300]
        raise ProviderError(f"HTTP {exc.code} from {url}: {detail or exc.reason}") from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise ProviderError(f"Network error contacting {url}: {exc}") from exc

    try:
        data = json.loads(raw_bytes.decode("utf-8"))
    except ValueError as exc:
        raise ProviderError(f"Malformed JSON response from {url}: {exc}") from exc
    if not isinstance(data, dict):
        raise ProviderError(f"Unexpected JSON root type from {url}")
    return data


class BaseProvider(ABC):
    name: str

    @abstractmethod
    def chat(
        self,
        messages: list[dict[str, str]],
        *,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> ProviderResponse:
        raise NotImplementedError


class OllamaProvider(BaseProvider):
    name = "ollama"

    def __init__(self, config: AppConfig) -> None:
        self.config = config

    def chat(
        self,
        messages: list[dict[str, str]],
        *,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> ProviderResponse:
        endpoint = self.config.endpoint.strip() or "http://127.0.0.1:11434/api/chat"
        payload: dict[str, Any] = {
            "model": self.config.model,
            "messages": messages,
            "stream": False,
            "keep_alive": self.config.keep_alive,
            "options": {
                "num_predict": max_tokens if max_tokens is not None else self.config.max_tokens,
                "temperature": temperature if temperature is not None else self.config.temperature,
            },
        }
        data = _post_json(endpoint, payload, {}, self.config.request_timeout_sec)
        if isinstance(data.get("error"), str) and data["error"].strip():
            raise ProviderError(f"Ollama returned error: {data['error']}")

        msg = data.get("message")
        if not isinstance(msg, dict) or not isinstance(msg.get("content"), str):
            raise ProviderError("Malformed Ollama /api/chat response: missing message.content")

        return ProviderResponse(
            content=msg["content"],
            model=str(data.get("model") or self.config.model),
            provider=self.name,
            raw=data,
        )


class OpenAICompatibleProvider(BaseProvider):
    """Extensible provider adapter for OpenAI-compatible HTTP endpoints (explicit opt-in)."""

    name = "openai_compatible"

    def __init__(self, config: AppConfig) -> None:
        self.config = config

    def chat(
        self,
        messages: list[dict[str, str]],
        *,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> ProviderResponse:
        meta = self.config.extra_providers.get("openai_compatible", {})
        env_var = str(meta.get("api_key_env") or "OPENAI_API_KEY")
        api_key = os.environ.get(env_var, "").strip()
        if not api_key:
            raise ProviderError(
                f"Provider 'openai_compatible' requires environment variable {env_var} (never stored in repo files)."
            )
        endpoint = str(meta.get("endpoint") or "https://api.openai.com/v1/chat/completions")
        model = str(meta.get("model") or self.config.model)
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens if max_tokens is not None else self.config.max_tokens,
            "temperature": temperature if temperature is not None else self.config.temperature,
        }
        data = _post_json(
            endpoint,
            payload,
            {"Authorization": f"Bearer {api_key}"},
            self.config.request_timeout_sec,
        )
        choices = data.get("choices")
        if not isinstance(choices, list) or not choices:
            raise ProviderError("Malformed OpenAI-compatible response: missing choices")
        content = choices[0].get("message", {}).get("content")
        if not isinstance(content, str):
            raise ProviderError("Malformed OpenAI-compatible response: missing message content")
        return ProviderResponse(content=content, model=model, provider=self.name, raw=data)


class AnthropicProvider(BaseProvider):
    """Extensible provider adapter for Claude / Anthropic Messages API (explicit opt-in)."""

    name = "anthropic"

    def __init__(self, config: AppConfig) -> None:
        self.config = config

    def chat(
        self,
        messages: list[dict[str, str]],
        *,
        max_tokens: int | None = None,
        temperature: float | None = None,
    ) -> ProviderResponse:
        meta = self.config.extra_providers.get("anthropic", {})
        env_var = str(meta.get("api_key_env") or "ANTHROPIC_API_KEY")
        api_key = os.environ.get(env_var, "").strip()
        if not api_key:
            raise ProviderError(
                f"Provider 'anthropic' requires environment variable {env_var} (never stored in repo files)."
            )
        endpoint = str(meta.get("endpoint") or "https://api.anthropic.com/v1/messages")
        model = str(meta.get("model") or "claude-3-5-sonnet-latest")
        system_msgs = [m["content"] for m in messages if m.get("role") == "system"]
        chat_msgs = [m for m in messages if m.get("role") in ("user", "assistant")]
        payload: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens if max_tokens is not None else self.config.max_tokens,
            "temperature": temperature if temperature is not None else self.config.temperature,
            "messages": chat_msgs,
        }
        if system_msgs:
            payload["system"] = "\n".join(system_msgs)
        data = _post_json(
            endpoint,
            payload,
            {"x-api-key": api_key, "anthropic-version": "2023-06-01"},
            self.config.request_timeout_sec,
        )
        blocks = data.get("content")
        if not isinstance(blocks, list) or not blocks or not isinstance(blocks[0].get("text"), str):
            raise ProviderError("Malformed Anthropic response: missing content text")
        return ProviderResponse(content=blocks[0]["text"], model=model, provider=self.name, raw=data)


def get_provider(config: AppConfig) -> BaseProvider:
    name = (config.provider or "ollama").strip().lower()
    if name == "ollama":
        return OllamaProvider(config)
    if name in ("openai", "openai_compatible"):
        return OpenAICompatibleProvider(config)
    if name in ("claude", "anthropic"):
        return AnthropicProvider(config)
    raise ProviderError(f"Unknown provider '{config.provider}'. Expected ollama, openai_compatible, or anthropic.")
