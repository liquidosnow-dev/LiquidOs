"""Domain-separated Ed25519 signing and verification over RFC 8785 JCS bytes."""
from __future__ import annotations

import base64
from typing import Any

from .jcs import canonical_bytes
from .keystore import HAS_CRYPTOGRAPHY, SignatureError, _require_cryptography

if HAS_CRYPTOGRAPHY:
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import (
        Ed25519PrivateKey,
        Ed25519PublicKey,
    )


def strip_sig(obj: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in obj.items() if k != "sig"}


def _domain_message(domain: str, payload: dict[str, Any]) -> bytes:
    if not domain or not isinstance(domain, str):
        raise ValueError("Signing domain must be a non-empty string")
    return f"AN-NEXUS:{domain}:".encode("utf-8") + canonical_bytes(strip_sig(payload))


def sign(key: Any, domain: str, payload: dict[str, Any]) -> str:
    _require_cryptography()
    if not isinstance(key, Ed25519PrivateKey):
        raise SignatureError(f"Expected Ed25519PrivateKey, got {type(key).__name__}")
    msg = _domain_message(domain, payload)
    raw_sig = key.sign(msg)
    return base64.b64encode(raw_sig).decode("ascii")


def verify_sig(public_key_pem: str, domain: str, payload: dict[str, Any], sig_b64: str) -> bool:
    _require_cryptography()
    try:
        raw_sig = base64.b64decode(sig_b64, validate=True)
    except Exception:
        return False
    msg = _domain_message(domain, payload)
    try:
        pub = serialization.load_pem_public_key(public_key_pem.encode("utf-8"))
        if not isinstance(pub, Ed25519PublicKey):
            return False
        pub.verify(raw_sig, msg)
        return True
    except InvalidSignature:
        return False
    except Exception:
        return False
