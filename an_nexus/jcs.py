"""RFC 8785 JSON Canonicalization Scheme (JCS) implementation."""
from __future__ import annotations

import json
import math
from typing import Any

MAX_SAFE_INT = (1 << 53) - 1
MIN_SAFE_INT = -MAX_SAFE_INT


def _reject_lone_surrogates(text: str) -> None:
    for ch in text:
        code = ord(ch)
        if 0xD800 <= code <= 0xDFFF:
            raise ValueError(f"Lone surrogate code point U+{code:04X} not allowed in JCS")


def _utf16_sort_key(s: str) -> bytes:
    """Sort object keys by UTF-16 code units per RFC 8785 Section 3.2.3."""
    _reject_lone_surrogates(s)
    return s.encode("utf-16-be")


def _format_number(val: int | float) -> str:
    if isinstance(val, int) and not isinstance(val, bool):
        if val < MIN_SAFE_INT or val > MAX_SAFE_INT:
            raise ValueError(
                f"Integer {val} outside IEEE 754 safe range [{MIN_SAFE_INT}, {MAX_SAFE_INT}]"
            )
        return str(val)
    if not math.isfinite(val):
        raise ValueError(f"Non-finite number not allowed in JCS: {val!r}")
    if val == 0.0:
        return "0"
    if float(val).is_integer() and abs(val) <= MAX_SAFE_INT:
        return str(int(val))
    return json.dumps(val)


def canonicalize(value: Any) -> str:
    """Serialize any JSON-compatible value into an RFC 8785 canonical JSON string."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return _format_number(value)
    if isinstance(value, str):
        _reject_lone_surrogates(value)
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(canonicalize(item) for item in value) + "]"
    if isinstance(value, dict):
        for k in value.keys():
            if not isinstance(k, str):
                raise TypeError(f"JCS object keys must be strings, got {type(k).__name__}")
            _reject_lone_surrogates(k)
        items = sorted(value.items(), key=lambda kv: _utf16_sort_key(kv[0]))
        parts = [f"{canonicalize(k)}:{canonicalize(v)}" for k, v in items]
        return "{" + ",".join(parts) + "}"
    raise TypeError(f"Unsupported type for JCS canonicalization: {type(value).__name__}")


def canonical_bytes(value: Any) -> bytes:
    """Encode the RFC 8785 canonical JSON string as UTF-8 bytes."""
    return canonicalize(value).encode("utf-8")
