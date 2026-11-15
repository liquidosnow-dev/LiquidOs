"""Ed25519 key management backed strictly by PyPI cryptography (fail-closed)."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


class SignatureError(RuntimeError):
    """Raised when cryptography is unavailable or key/signature checks fail."""


try:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import (
        Ed25519PrivateKey,
        Ed25519PublicKey,
    )

    HAS_CRYPTOGRAPHY = True
    _CRYPTO_IMPORT_ERR: BaseException | None = None
except ImportError as exc:
    HAS_CRYPTOGRAPHY = False
    _CRYPTO_IMPORT_ERR = exc
    Ed25519PrivateKey = Any  # type: ignore[misc,assignment]
    Ed25519PublicKey = Any  # type: ignore[misc,assignment]


def _require_cryptography() -> None:
    if not HAS_CRYPTOGRAPHY:
        raise SignatureError("cryptography required; pip install cryptography") from _CRYPTO_IMPORT_ERR


def generate_private_key() -> Ed25519PrivateKey:
    _require_cryptography()
    return Ed25519PrivateKey.generate()


def public_pem(key: Ed25519PrivateKey | Ed25519PublicKey) -> str:
    _require_cryptography()
    pub = key.public_key() if hasattr(key, "public_key") else key
    pub_bytes = pub.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return pub_bytes.decode("utf-8")


def private_pem(key: Ed25519PrivateKey) -> str:
    _require_cryptography()
    priv_bytes = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    return priv_bytes.decode("utf-8")


def save_private_pem(key: Ed25519PrivateKey, path: Path | str) -> Path:
    _require_cryptography()
    dest = Path(path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(private_pem(key), encoding="utf-8")
    os.chmod(dest, 0o600)
    return dest


def load_private_pem(path_or_pem: Path | str) -> Ed25519PrivateKey:
    _require_cryptography()
    raw = (
        path_or_pem.read_text(encoding="utf-8")
        if isinstance(path_or_pem, Path)
        else (
            Path(path_or_pem).read_text(encoding="utf-8")
            if "-----BEGIN " not in path_or_pem
            else path_or_pem
        )
    )
    key = serialization.load_pem_private_key(raw.encode("utf-8"), password=None)
    if not isinstance(key, Ed25519PrivateKey):
        raise SignatureError(f"Expected Ed25519PrivateKey, got {type(key).__name__}")
    return key


def load_public_pem(pem_text: str) -> Ed25519PublicKey:
    _require_cryptography()
    key = serialization.load_pem_public_key(pem_text.encode("utf-8"))
    if not isinstance(key, Ed25519PublicKey):
        raise SignatureError(f"Expected Ed25519PublicKey, got {type(key).__name__}")
    return key


def register_key(registry: dict[str, Any], key_id: str, role: str, key: Any) -> dict[str, Any]:
    _require_cryptography()
    keys = [entry for entry in registry.get("keys", []) if entry.get("key_id") != key_id]
    keys.append(
        {
            "key_id": key_id,
            "role": role,
            "public_key_pem": public_pem(key),
        }
    )
    keys.sort(key=lambda item: item["key_id"])
    registry["keys"] = keys
    return registry


def lookup_key(registry_path: Path | str, key_id: str) -> dict[str, Any]:
    reg = json.loads(Path(registry_path).read_text(encoding="utf-8"))
    for entry in reg.get("keys", []):
        if entry.get("key_id") == key_id:
            return entry
    raise SignatureError(f"Key {key_id!r} missing from trust registry")
