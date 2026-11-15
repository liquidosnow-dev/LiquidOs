"""Signed capability access state, expiry, monotonic fencing ledger, and transfer receipts."""
from __future__ import annotations

import json
import secrets
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from .assertions import AssertionFailure
from .digests import d_jcs_obj
from .signing import sign, strip_sig, verify_sig

ACCESS_ISSUER_ROLES = frozenset({"PROJECT_ISSUER", "ACCESS_ISSUER", "AUDIT_AND_ISSUER"})
RECEIPT_SIGNER_ROLES = frozenset(
    {"PROJECT_ISSUER", "ACCESS_ISSUER", "AUDIT_SIGNER", "AUDIT_AND_ISSUER"}
)


@dataclass(frozen=True)
class AccessState:
    session_id: str
    issuer_id: str
    subject: str
    scopes: list[str]
    attest_pin: str
    fencing_version: int
    sig: str
    expires_at: int | None = None

    def to_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "session_id": self.session_id,
            "issuer_id": self.issuer_id,
            "subject": self.subject,
            "scopes": list(self.scopes),
            "attest_pin": self.attest_pin,
            "fencing_version": self.fencing_version,
            "sig": self.sig,
        }
        if self.expires_at is not None:
            data["expires_at"] = self.expires_at
        return data

    def state_hash(self) -> str:
        return d_jcs_obj(self.to_dict())


@dataclass(frozen=True)
class TransferReceipt:
    session_id: str
    state_hash: str
    fencing_version: int
    signer_id: str
    sig: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def issue(
    issuer_key: Any,
    issuer_id: str,
    subject: str,
    scopes: list[str],
    attest_pin: str,
    fencing_version: int = 1,
    ttl_seconds: int | None = None,
    expires_at: int | None = None,
) -> AccessState:
    session_id = secrets.token_hex(16)
    resolved_exp = expires_at
    if resolved_exp is None and ttl_seconds is not None:
        resolved_exp = int(time.time()) + int(ttl_seconds)

    sorted_scopes = sorted(scopes)
    body: dict[str, Any] = {
        "session_id": session_id,
        "issuer_id": issuer_id,
        "subject": subject,
        "scopes": sorted_scopes,
        "attest_pin": attest_pin,
        "fencing_version": fencing_version,
    }
    if resolved_exp is not None:
        body["expires_at"] = resolved_exp

    sig = sign(issuer_key, "access_state", body)
    return AccessState(
        session_id=session_id,
        issuer_id=issuer_id,
        subject=subject,
        scopes=sorted_scopes,
        attest_pin=attest_pin,
        fencing_version=fencing_version,
        sig=sig,
        expires_at=resolved_exp,
    )


def verify(
    state: AccessState,
    registry_path: Path | str,
    now: int | None = None,
    allowed_roles: frozenset[str] = ACCESS_ISSUER_ROLES,
) -> None:
    if state.expires_at is not None:
        check_ts = int(time.time()) if now is None else int(now)
        if check_ts > state.expires_at:
            raise AssertionFailure(
                f"Access state expired at {state.expires_at} (now={check_ts})"
            )

    reg = json.loads(Path(registry_path).read_text(encoding="utf-8"))
    keys_by_id = {k["key_id"]: k for k in reg.get("keys", [])}
    key_entry = keys_by_id.get(state.issuer_id)
    if not key_entry:
        raise AssertionFailure(f"Missing issuer key {state.issuer_id!r}")
    role = str(key_entry.get("role", ""))
    if role not in allowed_roles:
        raise AssertionFailure(f"Access issuer {state.issuer_id!r} role {role!r} not authorized")
    pub_pem = str(key_entry.get("public_key_pem", ""))
    if not verify_sig(pub_pem, "access_state", strip_sig(state.to_dict()), state.sig):
        raise AssertionFailure("Invalid access state signature")


def check_and_bump_fence(
    ledger_path: Path | str,
    session_id: str,
    fencing_version: int,
) -> int:
    p = Path(ledger_path)
    if p.exists():
        ledger = json.loads(p.read_text(encoding="utf-8"))
    else:
        ledger = {"sessions": {}}

    sessions = ledger.setdefault("sessions", {})
    last_fence = int(sessions.get(session_id, 0))
    if fencing_version <= last_fence:
        raise AssertionFailure(
            f"Stale fencing token for {session_id}: got {fencing_version}, last={last_fence}"
        )

    sessions[session_id] = fencing_version
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(ledger, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return fencing_version


def make_receipt(state: AccessState, signer_key: Any, signer_id: str) -> TransferReceipt:
    state_hash = state.state_hash()
    body: dict[str, Any] = {
        "session_id": state.session_id,
        "state_hash": state_hash,
        "fencing_version": state.fencing_version,
        "signer_id": signer_id,
    }
    sig = sign(signer_key, "transfer_receipt", body)
    return TransferReceipt(
        session_id=state.session_id,
        state_hash=state_hash,
        fencing_version=state.fencing_version,
        signer_id=signer_id,
        sig=sig,
    )


def verify_receipt(
    receipt: TransferReceipt,
    state: AccessState,
    registry_path: Path | str,
    allowed_roles: frozenset[str] = RECEIPT_SIGNER_ROLES,
) -> None:
    if receipt.session_id != state.session_id or receipt.state_hash != state.state_hash():
        raise AssertionFailure("Transfer receipt does not match access state")
    if receipt.fencing_version != state.fencing_version:
        raise AssertionFailure("Transfer receipt fencing version mismatch")

    reg = json.loads(Path(registry_path).read_text(encoding="utf-8"))
    keys_by_id = {k["key_id"]: k for k in reg.get("keys", [])}
    key_entry = keys_by_id.get(receipt.signer_id)
    if not key_entry:
        raise AssertionFailure(f"Missing receipt signer key {receipt.signer_id!r}")
    role = str(key_entry.get("role", ""))
    if role not in allowed_roles:
        raise AssertionFailure(
            f"Transfer receipt signer {receipt.signer_id!r} role {role!r} not authorized"
        )
    pub_pem = str(key_entry.get("public_key_pem", ""))
    if not verify_sig(pub_pem, "transfer_receipt", strip_sig(receipt.to_dict()), receipt.sig):
        raise AssertionFailure("Invalid transfer receipt signature")
