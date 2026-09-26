"""Contracts for verifying an operator-selected sample without resampling it."""
import importlib.util
from pathlib import Path
import unittest

MODULE_PATH = Path(__file__).resolve().parents[2] / "packages/opencorvus/script/benchmark/external-agent/freeze_automationbench_case_set.py"
SPEC = importlib.util.spec_from_file_location("frozen_case_identity", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class CaseSetIdentityTests(unittest.TestCase):
    def setUp(self):
        self.identities = [{"domain": "support", "task": f"support.task_{i}", "example_id": i,
                            "task_contract_sha256": str(i) * 64, "selection_rank_sha256": str(i + 1) * 64}
                           for i in range(1, 6)]
        self.metadata = {"schema_version": 1, "benchmark": "AutomationBench"}
        self.manifest = {**self.metadata, "selection": {"count": 5, "algorithm": "operator-selected order",
                          "dataset_index_sha256": MODULE.dataset_index_sha256(self.identities)},
                         "cases": [{**item, "case_index": i, "batch_index": 1}
                                   for i, item in enumerate(reversed(self.identities), start=1)]}

    def verify(self, manifest):
        return MODULE.verify_manifest(manifest, self.identities, self.metadata)

    def test_selected_order_is_verified_against_the_same_official_identities(self):
        self.assertEqual(self.verify(self.manifest), {"passed": True, "violations": [], "case_count": 5,
                         "dataset_index_sha256": self.manifest["selection"]["dataset_index_sha256"]})

    def test_changed_official_contract_returns_identity_error(self):
        self.manifest["cases"][0]["task_contract_sha256"] = "f" * 64
        self.assertEqual(self.verify(self.manifest)["violations"], ["official_case_identity_mismatch:1"])

    def test_duplicate_identity_returns_exact_error(self):
        self.manifest["cases"][1] = {**self.manifest["cases"][0], "case_index": 2}
        self.assertEqual(self.verify(self.manifest)["violations"], ["duplicate_case_identity:2"])

    def test_count_and_dataset_digest_have_explicit_errors(self):
        self.manifest["selection"]["count"] = True
        self.assertEqual(self.verify(self.manifest)["violations"], ["manifest_case_count_invalid"])
        self.manifest["selection"]["count"] = 5
        self.manifest["selection"]["dataset_index_sha256"] = "f" * 64
        self.assertEqual(self.verify(self.manifest)["violations"], ["dataset_index_mismatch"])

    def test_boolean_schema_and_example_id_are_not_integer_identities(self):
        self.manifest["schema_version"] = True
        self.manifest["cases"][-1]["example_id"] = True
        self.assertEqual(self.verify(self.manifest)["violations"],
                         ["manifest_metadata_mismatch:schema_version", "official_case_identity_mismatch:5"])

    def test_invalid_schema_and_order_have_explicit_errors(self):
        self.assertEqual(self.verify([]), {"passed": False, "violations": ["manifest_schema_invalid"]})
        self.manifest["cases"][0]["case_index"] = True
        self.assertEqual(self.verify(self.manifest)["violations"], ["case_order_mismatch:1"])


if __name__ == "__main__":
    unittest.main()
