# Decisions — Spec 10

Bound to `an_nexus` as it exists on `main`. These rules do not add a layer and do not replace schema `an-nexus.manifest.v4`.

## D1 — What a signature is

`an_nexus/manifest.py` writes schema `an-nexus.manifest.v4`:

- `artifact_count`
- `d_manifest` — SHA-256 over the RFC 8785 JCS of `{schema, entries}`
- `entries[]` — `{path, sha256}`, unique paths, lowercase hex, sorted by path

`an_nexus/continuity.py` anchors that digest:

- `seq`, `prev_hash`, `attest_pin`, `note`, `signer_id`, `sig`
- `prev_hash` is the content hash of the previous anchor, or null at seq 0
- signature domain is `continuity_anchor`: Ed25519 over `AN-NEXUS:{domain}:` plus JCS bytes

A deploy attestation is that manifest only when the entries include all three of:

- the container config that actually ran
- the source revision that was built
- each model weight file that was loaded

Checksums are `d_raw_file`: SHA-256 of the file bytes. GGUF and safetensors both use that until the code has a tensor hash. A status flag is not an attestation. `d_attest` hashes an envelope. It does not invent a second manifest schema.

## D12 — Who is allowed to say yes

Two human doors. They are not interchangeable.

| Door | Covers | Does not cover |
| --- | --- | --- |
| Methodology sign-off | The design and the implementation plan | Starting a service, loading a model, signing continuity |
| Plannotator | Deployment plans, compose files, and model selections | Substituting for a continuity signature |

Continuity roles that may sign, from `CONTINUITY_ALLOWED_ROLES` in `an_nexus/continuity.py`:

- `AUDIT_SIGNER`
- `CONTINUITY_AUTHORITY`
- `AUDIT_AND_ISSUER`

The agent that authored the change holds none of these roles.

## D17 — One writer for the canon

`Knowledge/` has a single writer: LoopForge, and only after `verify_chain` accepts the new anchor.

A second run must not replace an unanchored delta. There is no lock in the repository yet. This decision is the rule that writer has to obey before the lock exists.

Rejected: two LoopForge processes writing the same directory, last write wins.
