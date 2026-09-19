import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from reproduction_dashboard import (MODEL, Snapshot, SnapshotError, base_command_state, base_record_index,
                                    paired_summary, resolve_base_scores, scored_cell, summarize)


class DashboardProjectionTests(unittest.TestCase):
    def test_scored_denominator_and_in_progress_counts(self):
        cells = [scored_cell("a", 1, 1, 1000, 20), scored_cell("b", 0, .5, 2000, 40), {"state": "running"}, {"state": "pending"}]
        self.assertEqual(summarize(cells), {"total": 4, "scored": 2, "passed": 1, "strict_rate": .5,
                                          "running": 1, "awaiting": 0, "invalid": 0, "pending": 1})
        self.assertEqual(summarize([{"state": "running"}])["strict_rate"], None)

    def test_pair_transition_contract(self):
        rows = [{"native": scored_cell("n1", 1, 1, 5, 3), "base": scored_cell("b1", 0, .5, 6, 4)},
                {"native": scored_cell("n2", 0, .2, 5, 3), "base": {"state": "running"}}]
        self.assertEqual(paired_summary(rows), {"count": 1, "native_only_pass": 1, "base_only_pass": 0, "both_pass": 0, "both_fail": 0})

    def test_invalid_metric_error_contract(self):
        with self.assertRaisesRegex(SnapshotError, "invalid_strict_score"):
            scored_cell("bad", .5, .5, 1, 1)
        with self.assertRaisesRegex(SnapshotError, "invalid_partial_score"):
            scored_cell("bad", 0, float('nan'), 1, 1)

    def test_failed_base_start_projects_by_frozen_task_identity(self):
        case = {"case_index": 1, "domain": "marketing", "task": "marketing.linkedin_company_update",
                "example_id": "example", "task_contract_sha256": "hash"}
        record = {"run_id": "failed-start", "benchmark": {"domain": case["domain"], "task": case["task"],
                  "case_id": "marketing:marketing.linkedin_company_update"}, "failure": {"reason": "startup_error"}}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "base").mkdir()
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps({"cases": [case], "selection": {"count": 1}}), encoding="utf-8")
            native = root / "original/native/case-001"
            native.mkdir(parents=True)
            (native / "run-start.json").write_text(json.dumps({"run_id": "original-native", "case_index": 1}), encoding="utf-8")
            (native / "input.json").write_text(json.dumps({"case": case, "manifest_sha256": hashlib.sha256(manifest.read_bytes()).hexdigest()}), encoding="utf-8")
            (native / "result.json").write_text(json.dumps({"run_id": "original-native", "case_index": 1, "model": MODEL,
                "status": "scored", "replay": {"passed": True}, "score": {"task_completed_correctly": 1, "partial_credit": 1},
                "started_at": 0, "finished_at": 1000, "usage": {"totalTokens": 20}}), encoding="utf-8")
            (root / "base/evidence-catalog.json").write_text(json.dumps({"leaderboard": [], "candidates": [], "attempts": [record]}), encoding="utf-8")
            (root / "base/.automationbench-active-leases.json").write_text(json.dumps({"active": []}), encoding="utf-8")
            result = Snapshot(root / "original/native", root / "base", manifest).build()
            self.assertEqual(result["rows"][0]["base"], {"state": "invalid", "run_id": "failed-start"})
            self.assertEqual(result["base"]["invalid"], 1)
            self.assertEqual(result["rows"][0]["native"], scored_cell("original-native", 1, 1, 1000, 20))
        record["benchmark"]["case_index"] = 2
        with self.assertRaisesRegex(SnapshotError, "base_case_identity_mismatch"):
            base_record_index(record, {(case["domain"], case["task"]): 1}, {1: case})

    def test_base_process_ownership_state_contract(self):
        case = {"domain": "support", "task": "support.helpcrunch_trial_nurture"}
        lease = {"profile": "base", "batch_run_id": "batch"}
        evidence_root = Path("evidence/base").resolve()
        argv = ["bun", "run-automationbench.ts", "--domain", case["domain"], "--task", case["task"],
                "--profile", "base", "--output", str(evidence_root), "--batch-run-id", "batch"]
        self.assertEqual(base_command_state(argv, lease, case, evidence_root), "running")
        for option, value in [("--domain", "finance"), ("--task", "support.other_task"), ("--profile", "advanced"),
                              ("--output", str(evidence_root.parent / "other")), ("--batch-run-id", "other-batch")]:
            with self.subTest(option=option):
                other = argv.copy()
                other[other.index(option) + 1] = value
                self.assertEqual(base_command_state(other, lease, case, evidence_root), "interrupted")

    def test_base_duplicate_records_resolve_to_scored_or_conflict(self):
        record = {"run_id": "same-run", "benchmark": {"metrics": {"task_completed_correctly": 1, "partial_credit": 1}},
                  "duration_ms": 1000, "opencorvus": {"tokens": {"total": 20}}}
        self.assertEqual(resolve_base_scores([record, copy.deepcopy(record)]), scored_cell("same-run", 1, 1, 1000, 20))
        changed = copy.deepcopy(record)
        changed["benchmark"]["metrics"]["task_completed_correctly"] = 0
        self.assertEqual(resolve_base_scores([record, changed]), {"state": "conflict"})
        another = copy.deepcopy(record)
        another["run_id"] = "another-run"
        self.assertEqual(resolve_base_scores([record, another]), {"state": "conflict"})


if __name__ == "__main__":
    unittest.main()
