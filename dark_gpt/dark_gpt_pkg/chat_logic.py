from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from .config import AppConfig
from .memory import SessionStore
from .providers import BaseProvider, ProviderError, get_provider

CREATOR_ANSWER = "DARK-GPT a été créé par M4TH4CK3R."

_SHORT_CONCISE_INSTRUCTION = (
    "Reply naturally and concisely in the user's language in 1 or 2 short sentences. "
    "Do not repeat instructions or write an essay."
)

_GREETING_OR_ACK_SET = {
    "bonjour",
    "salut",
    "coucou",
    "bonsoir",
    "hello",
    "hi",
    "hey",
    "yo",
    "merci",
    "merci beaucoup",
    "thanks",
    "thank you",
    "ca va",
    "ca va ?",
    "comment ca va",
    "how are you",
    "ok",
    "okay",
    "d accord",
    "daccord",
}

_CONFIRMATION_PATTERNS = [
    r"\bt\s*as\s+compris\b",
    r"\btu\s+as\s+compris\b",
    r"\bas\s*tu\s+compris\b",
    r"\bcompris\b",
    r"\bdid\s+you\s+understand\b",
    r"\bdo\s+you\s+understand\b",
    r"\byou\s+understand\b",
    r"\bunderstood\b",
    r"\bgot\s+it\b",
]

_CREATOR_PATTERNS = [
    r"\bwho\s+(?:created|made|built|developed|wrote|designed)\s+(?:you|this(?:\s+app(?:lication)?|\s+assistant|\s+tool)?|dark[\s\-_]*gpt)\b",
    r"\bwho\s+is\s+(?:your|the|dark[\s\-_]*gpt(?:'s)?)\s+creator\b",
    r"\bqui\s+(?:t['’ ]?a|a)\s+(?:cree|creer|fait|developpe|fabrique|concu)\b",
    r"\bqui\s+est\s+(?:ton|le)\s+createur\b",
    r"\bton\s+createur\b",
    r"\byour\s+creator\b",
    r"\bcree\s+par\s+qui\b",
    r"\bcreated\s+by\s+whom\b",
]

_TRIVIAL_OK_REPLIES = {"ok", "ok.", "okay", "okay.", "yes", "yes.", "oui", "oui."}


def _normalize_text(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    ascii_ish = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    lowered = ascii_ish.lower().strip()
    lowered = lowered.replace("'", " ").replace("’", " ").replace("-", " ")
    lowered = re.sub(r"[^\w\s?]", " ", lowered)
    return re.sub(r"\s+", " ", lowered).strip()


def is_creator_question(user_text: str) -> bool:
    norm = _normalize_text(user_text)
    if not norm:
        return False
    if norm in {"creator", "createur", "creator?", "createur?"}:
        return True
    return any(re.search(pat, norm) for pat in _CREATOR_PATTERNS)


def is_confirmation_check(user_text: str) -> bool:
    norm = _normalize_text(user_text).rstrip("? ").strip()
    if not norm:
        return False
    if len(norm.split()) > 6:
        return False
    return any(re.search(pat, norm) for pat in _CONFIRMATION_PATTERNS)


def is_short_conversational_prompt(user_text: str) -> bool:
    if is_confirmation_check(user_text):
        return True
    norm = _normalize_text(user_text).rstrip("?!. ").strip()
    if not norm:
        return False
    if norm in _GREETING_OR_ACK_SET:
        return True
    return False


@dataclass
class ChatTurnResult:
    reply: str
    called_provider: bool
    is_creator_intercept: bool
    model: str
    provider: str
    error: str | None = None


def process_chat_turn(
    user_text: str,
    *,
    config: AppConfig,
    session_store: SessionStore,
    session_id: str | None = None,
    provider: BaseProvider | None = None,
    project_context: str | None = None,
) -> ChatTurnResult:
    """
    Process a single user chat message:
    - Intercepts creator questions deterministically without calling Ollama.
    - Sends all other prompts (including short conversational prompts like
      "T'as compris ?", "Ça va ?", "Bonjour", "Merci") to the configured provider
      with full conversation history.
    - On confirmation checks, passes a concise hint & small max_tokens, and if the
      real model response is a trivial "OK"/"OK."/"okay", displays "Oui, j'ai compris.".
    """
    sid = session_id or session_store.get_active_session_id()
    cleaned = user_text.strip()
    if not cleaned:
        return ChatTurnResult(
            reply="",
            called_provider=False,
            is_creator_intercept=False,
            model=config.model,
            provider=config.provider,
        )

    if is_creator_question(cleaned):
        session_store.append_message(sid, "user", cleaned)
        session_store.append_message(sid, "assistant", CREATOR_ANSWER)
        return ChatTurnResult(
            reply=CREATOR_ANSWER,
            called_provider=False,
            is_creator_intercept=True,
            model="deterministic",
            provider="local-identity",
        )

    active_provider = provider or get_provider(config)

    # Build message payload including full contextual history before appending current prompt
    history = session_store.get_messages_for_model(sid)
    system_parts = [config.system_instruction.strip()]
    if project_context:
        system_parts.append(f"Active workspace context:\n{project_context.strip()}")

    confirmation = is_confirmation_check(cleaned)
    short_prompt = is_short_conversational_prompt(cleaned)
    if short_prompt:
        system_parts.append(_SHORT_CONCISE_INSTRUCTION)

    messages: list[dict[str, str]] = [
        {"role": "system", "content": "\n\n".join(p for p in system_parts if p)},
        *history,
        {"role": "user", "content": cleaned},
    ]

    max_tokens = config.short_max_tokens if short_prompt else config.max_tokens

    try:
        resp = active_provider.chat(messages, max_tokens=max_tokens, temperature=config.temperature)
    except ProviderError as exc:
        return ChatTurnResult(
            reply="",
            called_provider=True,
            is_creator_intercept=False,
            model=config.model,
            provider=config.provider,
            error=str(exc),
        )

    reply_text = resp.content.strip()
    if confirmation and reply_text.lower() in _TRIVIAL_OK_REPLIES:
        reply_text = "Oui, j'ai compris."

    session_store.append_message(sid, "user", cleaned)
    session_store.append_message(sid, "assistant", reply_text)

    return ChatTurnResult(
        reply=reply_text,
        called_provider=True,
        is_creator_intercept=False,
        model=resp.model,
        provider=resp.provider,
    )
