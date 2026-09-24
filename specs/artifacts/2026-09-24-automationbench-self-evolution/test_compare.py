"""Local arithmetic and evidence contracts; not model capability acceptance."""

import copy
import unittest

from compare import paired_report


def inputs():
    cases = [
        {"domain": "example", "task": f"example.{i}", "example_id": i}
        for i in range(10)
    ]
    manifest = {"cases": cases, "benchmark": "frozen"}
    baseline = {
        "model": "openai/gpt-5.6-luna",
        "benchmark": "frozen",
        "timeout_policy": "idle",
        "execution_settings": {"max_samples": 2, "epochs": 1, "timeout_seconds": 300},
        "squad_version": "baseline",
        "mean_sample_seconds": 10,
        "official_tool_calls": 20,
        "reported_usage": {"output": 30},
        "cases": [
            {
                **case,
                "task_id": f"base-{i}",
                "strict": int(i < 2),
                "partial": 0.5,
                "execution": {"status": "scored"},
                "inspect_error": None,
                "lifecycle": "completed",
            }
            for i, case in enumerate(cases)
        ],
    }
    candidate = copy.deepcopy(baseline)
    candidate["squad_version"] = "candidate"
    for i, row in enumerate(candidate["cases"]):
        row.update(task_id=f"candidate-{i}", strict=int(i < 4), partial=0.7)
    return manifest, baseline, candidate


class PairedComparison(unittest.TestCase):
    def test_measured_improvement_reports_fixed_pair_deltas(self):
        report = paired_report(*inputs())
        self.assertEqual(report["verdict"], "improved")
        self.assertEqual(report["paired_measured"], 10)
        self.assertEqual(report["strict_win_tie_loss"], {"win": 2, "tie": 8, "loss": 0})
        self.assertAlmostEqual(report["strict_rate_delta"], 0.2)
        self.assertAlmostEqual(report["partial_mean_delta"], 0.2)

    def test_unavailable_case_yields_explicit_inconclusive_comparison(self):
        manifest, baseline, candidate = inputs()
        candidate["cases"][0].update(
            strict=None,
            partial=None,
            execution={"status": "error"},
            inspect_error="idle",
        )
        report = paired_report(manifest, baseline, candidate)
        self.assertEqual(report["verdict"], "inconclusive")
        self.assertEqual(report["candidate"]["unavailable"], 1)
        self.assertIsNone(report["strict_rate_delta"])
        self.assertEqual(report["cases"][0]["candidate_error"], "idle")

    def test_quality_regression_keeps_the_incumbent_criterion(self):
        manifest, baseline, candidate = inputs()
        for row in candidate["cases"]:
            row["partial"] = 0.4
        report = paired_report(manifest, baseline, candidate)
        self.assertEqual(report["verdict"], "criterion_not_met")
        self.assertAlmostEqual(report["partial_mean_delta"], -0.1)

    def test_different_cohort_has_an_identity_error(self):
        manifest, baseline, candidate = inputs()
        candidate["cases"][0]["example_id"] = 999
        with self.assertRaisesRegex(ValueError, "identity differs"):
            paired_report(manifest, baseline, candidate)

    def test_different_execution_settings_have_a_pairing_error(self):
        manifest, baseline, candidate = inputs()
        candidate["execution_settings"]["max_samples"] = 4
        with self.assertRaisesRegex(ValueError, "disagree on execution_settings"):
            paired_report(manifest, baseline, candidate)


if __name__ == "__main__":
    unittest.main()
