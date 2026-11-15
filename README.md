# an-nexus v4.2

Portable evidence-integrity, hash-linked continuity, monotonic access-transfer, and signed audit-log toolchain.

## Installation & Environment

This toolchain fails closed without PyPI `cryptography` (no fallback Ed25519 backend is permitted).

In a Python >= 3.10 environment with `pip`:

```bash
pip install -e .
an-smoke
an-demo
python3 -m unittest discover -s tests -v
```

In bare containers without `pip` / `cryptography`:
- `python3 -m an_nexus.smoke` reports `[FAIL] cryptography importable` and exits `1`.
- `python3 -m an_nexus.demo` fails closed with `SignatureError` and exits `1`.
- Non-crypto structural tests, JCS compliance tests, Annex A / G6 shape tests, B1 scope tests, and fail-closed `SignatureError` tests run via `python3 -m unittest discover -s tests -v`; the 18 live Ed25519 tests skip explicitly until `cryptography` is installed.

## Exit-Code Reference

### `an-preflight` / `scripts/preflight.py`
| Code | Gate / Meaning |
| --- | --- |
| `0` | All `A1–A4` integrity gates pass |
| `1` | `A1` aliasing failure (duplicate paths, `D_MANIFEST == D_ATTEST`, or historical pin collision) |
| `2` | `A2` pinned attestation mismatch (`D_ATTEST` does not match expected pin) |
| `3` | `A3` scope parity failure against `manifest.json` |
| `4` | `A4` signature invalid or `cryptography` unavailable (`SignatureError`) |
| `5` | `B1` workspace scope / required manifest or envelope input incomplete or missing |

### `an-emit-manifest` / `scripts/emit_manifest.py`
| Code | Meaning |
| --- | --- |
| `0` | Validated manifest written (`artifact_count == expected_count`, default 33) |
| `5` | `B1` blocker — path count mismatch, missing workspace file, or manifest validation error |

### `an-verify-annex` / `scripts/verify_annex_a.py`
| Code | Meaning |
| --- | --- |
| `0` | Annex A digest ledger valid (`failed == 0`, all `jcs_sha256` entries 64 lowercase hex chars) |
| `1` | Annex A validation failure (e.g. `G6` 65-char `GLOBAL-MODE-001` digest anomaly, malformed JSON, duplicate ID) |

### `an-summary` / `scripts/continuity_summary.py`
| Code | Meaning |
| --- | --- |
| `0` | All summary components healthy (`preflight.ok`, continuity chain, audit log, and fencing state present) — or `--allow-zero-state` passed explicitly on empty state |
| `1` | Incomplete, failing, or uninitialized state (`zero_state` without `--allow-zero-state`) |

### `an-smoke` / `an-demo`
| Command | `0` | `1` |
| --- | --- | --- |
| `an-smoke` (`python3 -m an_nexus.smoke`) | Python >= 3.10, `cryptography` importable, writable FS | Missing `cryptography` or failed runtime prerequisite |
| `an-demo` (`python3 -m an_nexus.demo`) | End-to-end synthetic demo (`DEMO pin`, never `2aba2e55…`) passed | Missing `cryptography` (`SignatureError`) or assertion failure |

## Digest Namespace

- `D_MANIFEST`: JCS-canonical SHA-256 of `{"schema": "an-nexus.manifest.v4", "entries": sorted_entries}`.
- `D_ATTEST`: JCS-canonical SHA-256 of the signed master evidence envelope, pinned unconditionally by `an_nexus.assertions.EXPECTED_D_ATTEST` (`2aba2e55…`).
- `extra_pins`: Optional set of prohibited digests passed to `a1_no_aliasing(..., extra_pins=...)` covering both Annex A contract digests (`contract_digests`) and historical attestation pins so neither `D_MANIFEST` nor any individual artifact entry `sha256` can alias an Annex A contract or roll back to a prior attestation pin.

## Changelog (v4.2 Hardening)

- Removed `--pin` from `scripts/preflight.py`; `A2` enforces `EXPECTED_D_ATTEST` without CLI override.
- `A1` (`a1_no_aliasing`) validates `extra_pins` (contract digests + historical pins) against both `D_MANIFEST` and every artifact entry `sha256`.
