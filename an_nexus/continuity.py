"""Tamper-evident hash-linked continuity anchor chain."""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from .assertions import AssertionFailure
from .digests import d_jcs_obj
from .signing import sign, strip_sig, verify_sig

CONTINUITY_ALLOWED_ROLES = frozenset(
    {"AUDIT_SIGNER", "CONTINUITY_AUTHORITY", "AUDIT_AND_ISSUER"}
)


@dataclass(frozen=True)
class Anchor:
    seq: int
    prev_hash: str | None
    attest_pin: str
    note: str
    signer_id: str
    sig: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def content_hash(self) -> str:
        return d_jcs_obj(self.to_dict())


def create_anchor(
    signer_key: Any,
    signer_id: str,
    seq: int,
    prev_anchor: Anchor | None,
    attest_pin: str,
    note: str,
) -> Anchor:
    prev_hash = prev_anchor.content_hash() if prev_anchor is not None else None
    body: dict[str, Any] = {
        "seq": seq,
        "prev_hash": prev_hash,
        "attest_pin": attest_pin,
        "note": note,
        "signer_id": signer_id,
    }
    sig = sign(signer_key, "continuity_anchor", body)
    return Anchor(
        seq=seq,
        prev_hash=prev_hash,
        attest_pin=attest_pin,
        note=note,
        signer_id=signer_id,
        sig=sig,
    )


def append_anchor(chain_path: Path | str, anchor: Anchor) -> None:
    p = Path(chain_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(anchor.to_dict(), sort_keys=True) + "\n")


def read_chain(chain_path: Path | str) -> list[Anchor]:
    lines = Path(chain_path).read_text(encoding="utf-8").splitlines()
    anchors: list[Anchor] = []
    for raw in lines:
        stripped = raw.strip()
        if not stripped:
            continue
        data = json.loads(stripped)
        anchors.append(Anchor(**data))
    return anchors


def verify_chain(
    anchors: list[Anchor],
    registry_path: Path | str,
    allowed_roles: frozenset[str] = CONTINUITY_ALLOWED_ROLES,
) -> None:
    if not anchors:
        raise AssertionFailure("Continuity chain is empty")

    reg = json.loads(Path(registry_path).read_text(encoding="utf-8"))
    keys_by_id = {k["key_id"]: k for k in reg.get("keys", [])}

    prev: Anchor | None = None
    pubs: list[tuple[int, str, Anchor]] = []
    for idx, anchor in enumerate(anchors):
        if anchor.seq != idx:
            raise AssertionFailure(f"Continuity seq gap at {idx}: got {anchor.seq}")
        expected_prev = prev.content_hash() if prev is not None else None
        if anchor.prev_hash != expected_prev:
            raise AssertionFailure(f"Continuity prev_hash mismatch at seq {idx}")
        key_entry = keys_by_id.get(anchor.signer_id)
        if not key_entry:
            raise AssertionFailure(f"Missing continuity signer key {anchor.signer_id!r}")
        role = str(key_entry.get("role", ""))
        if role not in allowed_roles:
            raise AssertionFailure(
                f"Continuity signer {anchor.signer_id!r} role {role!r} not authorized"
            )
        pub_pem = str(key_entry.get("public_key_pem", ""))
        pubs.append((idx, pub_pem, anchor))
        prev = anchor

    for idx, pub_pem, anchor in pubs:
        if not verify_sig(pub_pem, "continuity_anchor", strip_sig(anchor.to_dict()), anchor.sig):
            raise AssertionFailure(f"Invalid continuity signature at seq {idx}")
