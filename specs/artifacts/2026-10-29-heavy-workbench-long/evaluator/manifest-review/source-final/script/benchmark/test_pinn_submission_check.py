"""Synthetic metadata tests certify only the thin reader contract, never training."""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

import pinn_submission_check as check


PROFILE = Path(__file__).resolve().parents[2] / "specs/artifacts/2026-10-29-heavy-workbench-long/public/profile.json"


class SubmissionContracts(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "results").mkdir()
        self.profile = check.read_json(PROFILE)
        self.manifest = {"format": "heavy-pinn-study/1", "benchmark": self.profile["benchmark"], "case": self.profile["case"],
                         "runs": [], "solution_checkpoints": dict.fromkeys(("convection", "reaction", "wave"))}
        phase_names = {"adam": ["adam"], "lbfgs": ["lbfgs"], "hybrid": ["adam", "lbfgs"], "gd": ["gd"], "nncg": ["nncg"]}
        for spec in self.profile["base_configurations"] + self.profile["continuations"]:
            self.manifest["runs"].append({"config_id": spec["id"], "status": "incomplete" if "problem" in spec else "dependency_incomplete",
                "reason": "Synthetic unstarted record for reader-contract test", "parent_id": None,
                "phases": {name: {"attempts": 0, "accepted_updates": 0} for name in phase_names[spec["method"]]},
                "costs": dict.fromkeys(("closure_calls", "gradient_calls", "hvp_calls", "lbfgs_native_iterations"), 0),
                "checkpoints": dict.fromkeys(("initial", "switch", "final")), "trace": None, "receipt": None})

    def write(self, manifest="results/manifest.json"):
        path = self.root / manifest
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.manifest), encoding="utf8")

    def validate(self):
        self.write()
        return check.check_submission(self.root, self.profile, "results/manifest.json")

    def run_record(self, name):
        return next(record for record in self.manifest["runs"] if record["config_id"] == name)

    def export(self, name, output_bias=0.0):
        shapes = ((100, 2), (100, 100), (100, 100), (1, 100))
        values = {f"weight_{i}": np.zeros(shape, dtype=np.float64) for i, shape in enumerate(shapes)}
        values.update({f"bias_{i}": np.zeros(shape[0], dtype=np.float64) for i, shape in enumerate(shapes)})
        values["bias_3"][:] = output_bias
        np.savez(self.root / name, **values)
        return name

    def synthetic_finite_run(self, key):
        """Deliberately declared counters: the checker must not certify their origin."""
        record = self.run_record(key)
        spec = next(spec for spec in self.profile["base_configurations"] if spec["id"] == key)
        path = self.export("zero.npz")
        record.update(status="max_updates", trace="trace.jsonl", receipt="execution.json")
        (self.root / "trace.jsonl").write_text("", encoding="utf8")
        (self.root / "execution.json").write_text('{"synthetic":true}', encoding="utf8")
        record["checkpoints"].update(initial=path, final=path)
        for phase, counters in record["phases"].items():
            updates = 11000 if spec["method"] == "hybrid" and phase == "adam" else 30000 if spec["method"] == "hybrid" else 41000
            counters.update(attempts=updates, accepted_updates=updates)
        if spec["method"] == "hybrid":
            record["checkpoints"]["switch"] = path
        if "lbfgs" in record["phases"]:
            record["costs"].update(closure_calls=record["phases"]["lbfgs"]["attempts"], lbfgs_native_iterations=record["phases"]["lbfgs"]["attempts"])
        self.manifest["solution_checkpoints"][spec["problem"]] = key
        return record

    def test_complete_registry_of_unstarted_runs_remains_unassessed(self):
        result = self.validate()
        self.assertEqual(result["registered_runs"], 24)
        self.assertEqual(result["continuation_parent"], None)
        self.assertEqual(result["solution_checkpoints"], {"convection": None, "reaction": None, "wave": None})
        self.assertEqual(result["study_complete"], "unassessed")
        self.assertEqual(result["solution_reproduced"], "unassessed")

    def test_real_weight_reader_cli_returns_endpoint_and_unassessed_training(self):
        key = "wave-adam-s345-lr1e-03"
        self.synthetic_finite_run(key)
        self.write()
        receipt = self.root / "audit.json"
        process = subprocess.run([sys.executable, str(Path(check.__file__).resolve()), "--root", str(self.root),
                                  "--manifest", "results/manifest.json", "--profile", str(PROFILE), "--out", str(receipt)], capture_output=True, text=True)
        self.assertEqual(process.returncode, 0, process.stderr)
        result = json.loads(receipt.read_text())
        self.assertAlmostEqual(result["observations"][key]["metrics"]["l2re"], 1.0)
        self.assertEqual(result["observations"][key]["metrics"]["constraint_families"]["initial_velocity"]["count"], 257)
        self.assertEqual(result["training_attestation"].split(";")[0], "not_performed")
        self.assertEqual(result["solution_reproduced"], "unassessed")

    def test_selection_uses_train_loss_and_registered_tie_rule(self):
        observations = {"high": {"status": "max_updates", "metrics": {"total_loss": 2.0, "l2re": 0.001}},
                        "low": {"status": "optimizer_stalled", "metrics": {"total_loss": 1.0, "l2re": 0.9}},
                        "failed": {"status": "numerical_failure", "metrics": {"total_loss": 0.0, "l2re": 0.0}}}
        ids = list(observations)
        states = self.profile["selection"]["eligible_terminal_states"]
        self.assertEqual(check.select_minimum(ids, observations, states, lambda key: key), "low")
        observations["high"]["metrics"]["total_loss"] = 1.0
        self.assertEqual(check.select_minimum(ids, observations, states, lambda key: {"high": 1e-4, "low": 1e-3}[key]), "high")

    def test_selected_parent_and_continuation_same_initial_are_checked(self):
        key = "convection-hybrid-s345-lr1e-04"
        self.synthetic_finite_run(key)
        for spec in self.profile["continuations"]:
            record = self.run_record(spec["id"])
            record.update(status="incomplete", parent_id=key)
            record["checkpoints"]["initial"] = "zero.npz"
        result = self.validate()
        self.assertEqual(result["continuation_parent"], key)
        self.assertEqual(result["solution_checkpoints"]["convection"], key)
        self.run_record(self.profile["continuations"][0]["id"])["checkpoints"]["initial"] = self.export("different.npz", 1.0)
        with self.assertRaises(check.ContractError) as caught:
            self.validate()
        self.assertEqual(caught.exception.code, "continuation_initial")

    def test_phase_count_error_has_explicit_contract_code(self):
        self.manifest["runs"][0]["phases"]["adam"].update(attempts=1, accepted_updates=2)
        with self.assertRaises(check.ContractError) as caught:
            self.validate()
        self.assertEqual(caught.exception.code, "phase_counts")

    def test_unknown_terminal_value_has_explicit_contract_code(self):
        self.manifest["runs"][0]["status"] = ["completed"]
        with self.assertRaises(check.ContractError) as caught:
            self.validate()
        self.assertEqual(caught.exception.code, "terminal_state")

    def test_incomplete_registry_has_explicit_coverage_error(self):
        self.manifest["runs"].pop()
        with self.assertRaises(check.ContractError) as caught:
            self.validate()
        self.assertEqual(caught.exception.code, "run_coverage")

    def test_path_outside_project_has_explicit_scope_error(self):
        with self.assertRaises(check.ContractError) as caught:
            check.artifact(self.root, "../elsewhere.npz", "checkpoint")
        self.assertEqual(caught.exception.code, "artifact_scope")

    def test_duplicate_json_key_has_explicit_input_error(self):
        file = self.root / "bad.json"
        file.write_text('{"runs":[],"runs":[]}', encoding="utf8")
        with self.assertRaises(check.ContractError) as caught:
            check.read_json(file)
        self.assertEqual(caught.exception.code, "duplicate_json_key")

    def test_cli_error_writes_machine_receipt(self):
        self.manifest["runs"][0]["phases"]["adam"]["attempts"] = True
        self.write()
        receipt = self.root / "error.json"
        process = subprocess.run([sys.executable, str(Path(check.__file__).resolve()), "--root", str(self.root),
                                  "--manifest", "results/manifest.json", "--profile", str(PROFILE), "--out", str(receipt)], capture_output=True, text=True)
        self.assertEqual(process.returncode, 2)
        self.assertEqual(json.loads(receipt.read_text())["error"], "counter")

    def test_selected_new_output_root_is_read_without_renaming(self):
        manifest = "runs/independent fresh replay/manifest.json"
        self.write(manifest)
        result = check.check_submission(self.root, self.profile, manifest)
        self.assertEqual(result["registered_runs"], 24)
        self.assertEqual(result["study_complete"], "unassessed")

    def test_unstarted_nonnull_evidence_has_a_path_contract(self):
        record = self.manifest["runs"][0]
        for value, code in (("../outside.json", "artifact_scope"), ({"path": "anything"}, "artifact_path")):
            record["receipt"] = value
            with self.assertRaises(check.ContractError) as caught:
                self.validate()
            self.assertEqual(caught.exception.code, code)

    def test_nul_path_cli_writes_explicit_error_receipt(self):
        self.manifest["runs"][0]["trace"] = "invalid\u0000name.jsonl"
        self.write()
        receipt = self.root / "nul-error.json"
        process = subprocess.run([sys.executable, str(Path(check.__file__).resolve()), "--root", str(self.root),
                                  "--manifest", "results/manifest.json", "--profile", str(PROFILE), "--out", str(receipt)], capture_output=True, text=True)
        self.assertEqual(process.returncode, 2)
        self.assertEqual(json.loads(receipt.read_text())["error"], "artifact_path")


if __name__ == "__main__":
    unittest.main()
