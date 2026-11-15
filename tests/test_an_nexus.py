"""Unit tests for JCS RFC 8785, digests, manifest validation, Annex A/G6, and A1-A4 gates."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from an_nexus.annex import AnnexError, detect_annex_anomalies, validate_annex_ledger, verify_annex_file
from an_nexus.assertions import AssertionFailure, a1_no_aliasing, a2_pinned_attestation
from an_nexus.digests import d_attest, d_jcs_obj, d_manifest, d_raw_file
from an_nexus.jcs import MAX_SAFE_INT, MIN_SAFE_INT, canonical_bytes, canonicalize
from an_nexus.manifest import ManifestError, read as read_manifest, write as write_manifest

V4_REAL_PIN = "2aba2e55" + "0" * 56
REPO_ROOT = Path(__file__).resolve().parents[1]


class JcsComplianceTests(unittest.TestCase):
    def test_jcs_primitives_null_bool_strings(self) -> None:
        self.assertEqual(canonicalize(None), "null")
        self.assertEqual(canonicalize(True), "true")
        self.assertEqual(canonicalize(False), "false")
        self.assertEqual(canonicalize([True, False, 1, 0]), "[true,false,1,0]")
        self.assertEqual(canonicalize('a"b\\c'), '"a\\"b\\\\c"')

    def test_jcs_key_sorting_ascii_and_utf16(self) -> None:
        # U+10000 in UTF-16 is D800 DC00 (< U+E000 in UTF-16BE, > in UTF-8)
        payload = {"\ue000": 1, "\U00010000": 2, "b": 3, "a": 4}
        self.assertEqual(canonicalize(payload), '{"a":4,"b":3,"\U00010000":2,"\ue000":1}')

    def test_jcs_nested_arrays_and_objects(self) -> None:
        obj = {"z": [{"b": 2, "a": 1}], "a": {"d": 4, "c": 3}}
        self.assertEqual(canonicalize(obj), '{"a":{"c":3,"d":4},"z":[{"a":1,"b":2}]}')

    def test_jcs_negative_zero_and_integer_floats(self) -> None:
        self.assertEqual(canonicalize(-0.0), "0")
        self.assertEqual(canonicalize(0.0), "0")
        self.assertEqual(canonicalize(10.0), "10")
        self.assertEqual(canonicalize(-42.0), "-42")

    def test_jcs_non_finite_floats_rejected(self) -> None:
        with self.assertRaises(ValueError):
            canonicalize(float("nan"))
        with self.assertRaises(ValueError):
            canonicalize(float("inf"))
        with self.assertRaises(ValueError):
            canonicalize(float("-inf"))

    def test_jcs_int_range_bounds_enforced(self) -> None:
        self.assertEqual(canonicalize(MAX_SAFE_INT), str(MAX_SAFE_INT))
        self.assertEqual(canonicalize(MIN_SAFE_INT), str(MIN_SAFE_INT))
        with self.assertRaises(ValueError):
            canonicalize(MAX_SAFE_INT + 1)
        with self.assertRaises(ValueError):
            canonicalize(MIN_SAFE_INT - 1)

    def test_jcs_lone_surrogate_in_value_rejected(self) -> None:
        with self.assertRaises(ValueError):
            canonicalize("\ud800")
        with self.assertRaises(ValueError):
            canonicalize(["ok", "\udfff"])

    def test_jcs_lone_surrogate_in_key_rejected(self) -> None:
        with self.assertRaises(ValueError):
            canonicalize({"\ud800": "bad"})
        with self.assertRaises(ValueError):
            canonicalize({"nested": {"\udc00": 1}})

    def test_jcs_line_separators_u2028_u2029_preserved_utf8(self) -> None:
        text = "line1\u2028line2\u2029end"
        encoded = canonical_bytes({"msg": text})
        self.assertIn(b"\xe2\x80\xa8", encoded)
        self.assertIn(b"\xe2\x80\xa9", encoded)

    def test_jcs_non_string_dict_key_and_unsupported_type_rejected(self) -> None:
        with self.assertRaises(TypeError):
            canonicalize({1: "bad-key"})  # type: ignore[dict-item]
        with self.assertRaises(TypeError):
            canonicalize({1, 2, 3})  # type: ignore[arg-type]


class DigestsTests(unittest.TestCase):
    def test_digests_raw_file_jcs_manifest_and_attest_deterministic(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            f = Path(td) / "sample.bin"
            f.write_bytes(b"an-nexus-v4.2\n")
            raw_hex = d_raw_file(f)
            self.assertEqual(len(raw_hex), 64)
            self.assertEqual(d_jcs_obj({"b": 1, "a": 2}), d_jcs_obj({"a": 2, "b": 1}))
            e1 = [{"path": "z", "sha256": raw_hex}, {"path": "a", "sha256": raw_hex}]
            e2 = [{"path": "a", "sha256": raw_hex}, {"path": "z", "sha256": raw_hex}]
            self.assertEqual(d_manifest(e1), d_manifest(e2))
            self.assertNotEqual(d_attest({"x": 1}), d_attest({"x": 2}))


class ManifestValidationTests(unittest.TestCase):
    def test_manifest_roundtrip_and_sorting(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "manifest.json"
            entries = [
                {"path": "z.txt", "sha256": "aa" * 32},
                {"path": "a.txt", "sha256": "bb" * 32},
            ]
            digest = write_manifest(p, entries)
            doc = read_manifest(p)
            self.assertEqual(doc["d_manifest"], digest)
            self.assertEqual([e["path"] for e in doc["entries"]], ["a.txt", "z.txt"])

    def test_manifest_rejects_duplicate_paths(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "manifest.json"
            with self.assertRaises(ManifestError):
                write_manifest(
                    p,
                    [
                        {"path": "dup.txt", "sha256": "aa" * 32},
                        {"path": "dup.txt", "sha256": "bb" * 32},
                    ],
                )

    def test_manifest_rejects_bad_hex_digests(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "manifest.json"
            for bad in ("aa" * 31, "aa" * 32 + "0", "AA" * 32, "zz" * 32, ""):
                with self.assertRaises(ManifestError):
                    write_manifest(p, [{"path": "x.txt", "sha256": bad}])

    def test_manifest_rejects_wrong_artifact_count(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "manifest.json"
            entries = [{"path": "a.txt", "sha256": "11" * 32}]
            write_manifest(p, entries)
            with self.assertRaises(ManifestError):
                read_manifest(p, expected_count=33)

            doc = json.loads(p.read_text(encoding="utf-8"))
            doc["artifact_count"] = 2
            p.write_text(json.dumps(doc), encoding="utf-8")
            with self.assertRaises(ManifestError):
                read_manifest(p)

    def test_manifest_rejects_d_manifest_tamper_and_bad_schema(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "manifest.json"
            write_manifest(p, [{"path": "a.txt", "sha256": "11" * 32}])
            doc = json.loads(p.read_text(encoding="utf-8"))
            doc["d_manifest"] = "ff" * 32
            p.write_text(json.dumps(doc), encoding="utf-8")
            with self.assertRaises(ManifestError):
                read_manifest(p)

            doc["schema"] = "wrong.schema"
            p.write_text(json.dumps(doc), encoding="utf-8")
            with self.assertRaises(ManifestError):
                read_manifest(p)


class AnnexLedgerShapeTests(unittest.TestCase):
    def test_annex_valid_ledger_passes(self) -> None:
        valid = {
            "schema": "an-nexus.annex-a.v4",
            "entries": [
                {"id": "AN-EVC-001", "jcs_sha256": "a" * 64},
                {"id": "GLOBAL-MODE-001", "jcs_sha256": "b" * 64},
            ],
        }
        validate_annex_ledger(valid)

    def test_annex_repo_ledger_detects_g6_65_char_anomaly(self) -> None:
        ledger_path = REPO_ROOT / "data" / "annex_a_ledger.json"
        doc = json.loads(ledger_path.read_text(encoding="utf-8"))
        anomalies = detect_annex_anomalies(doc)
        self.assertTrue(any("GLOBAL-MODE-001" in msg and "65" in msg for msg in anomalies))
        with self.assertRaises(AnnexError):
            verify_annex_file(ledger_path)

    def test_annex_rejects_malformed_shape_and_missing_fields(self) -> None:
        for bad in (
            [],
            {"schema": "wrong", "entries": [{"id": "X", "jcs_sha256": "a" * 64}]},
            {"schema": "an-nexus.annex-a.v4", "entries": []},
            {"schema": "an-nexus.annex-a.v4", "entries": [{"id": "X"}]},
        ):
            with self.assertRaises(AnnexError):
                validate_annex_ledger(bad)

    def test_annex_rejects_duplicate_ids_and_uppercase_non_hex(self) -> None:
        dup = {
            "schema": "an-nexus.annex-a.v4",
            "entries": [
                {"id": "DUP", "jcs_sha256": "a" * 64},
                {"id": "DUP", "jcs_sha256": "b" * 64},
            ],
        }
        upper = {
            "schema": "an-nexus.annex-a.v4",
            "entries": [{"id": "UP", "jcs_sha256": "A" * 64}],
        }
        nonhex = {
            "schema": "an-nexus.annex-a.v4",
            "entries": [{"id": "NH", "jcs_sha256": "z" * 64}],
        }
        for bad in (dup, upper, nonhex):
            with self.assertRaises(AnnexError):
                validate_annex_ledger(bad)


class AssertionsA1AndA2Tests(unittest.TestCase):
    def test_a1_entry_digest_colliding_with_pin_fails(self) -> None:
        pin = "ab" * 32
        entries = [{"path": "entry.txt", "sha256": pin}]
        with self.assertRaises(AssertionFailure):
            a1_no_aliasing(entries, "cd" * 32, "ef" * 32, extra_pins={pin})

    def test_a1_d_manifest_aliasing_d_attest_fails(self) -> None:
        same = "11" * 32
        entries = [{"path": "a.txt", "sha256": "22" * 32}]
        with self.assertRaises(AssertionFailure):
            a1_no_aliasing(entries, same, same)

    def test_a1_duplicate_artifact_paths_and_historical_pin_collision_fail(self) -> None:
        dup = [{"path": "x.txt", "sha256": "11" * 32}, {"path": "x.txt", "sha256": "22" * 32}]
        with self.assertRaises(AssertionFailure):
            a1_no_aliasing(dup, "aa" * 32, "bb" * 32)
        with self.assertRaises(AssertionFailure):
            a1_no_aliasing(
                [{"path": "x.txt", "sha256": "11" * 32}],
                "aa" * 32,
                "bb" * 32,
                extra_pins={"aa" * 32},
            )

    def test_a1_clean_non_aliasing_passes(self) -> None:
        entries = [{"path": "x.txt", "sha256": "11" * 32}]
        a1_no_aliasing(entries, "aa" * 32, "bb" * 32, extra_pins={"cc" * 32})

    def test_a2_exact_pin_match_passes(self) -> None:
        a2_pinned_attestation(V4_REAL_PIN, V4_REAL_PIN)

    def test_a2_v4_pin_mismatch_fails(self) -> None:
        with self.assertRaises(AssertionFailure):
            a2_pinned_attestation("f5d157bf" + "0" * 56, V4_REAL_PIN)


if __name__ == "__main__":
    unittest.main()
