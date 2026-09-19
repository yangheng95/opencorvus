"""Positive sealed-evidence and explicit error-contract checks."""
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("recovery", Path(__file__).with_name("recover-automationbench.py"))
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)


class SealedEvidenceTests(unittest.TestCase):
    def test_sealed_official_score_inputs(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            names = ["result.json", "automationbench-events.jsonl", "automationbench-initial-world.json", "automationbench-final-world.json"]
            files = []
            for name in names:
                content = b'{}\n'
                (root / name).write_bytes(content)
                files.append({"path": name, "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()})
            self.assertEqual(recovery.check_seal(root, {"files": files}), {"passed": True, "files_checked": 4, "violations": []})
            (root / "result.json").write_bytes(b'{"changed":true}\n')
            self.assertEqual(recovery.check_seal(root, {"files": files})["violations"], [{"path": "result.json", "contract": "sealed_bytes_match"}])

    def test_outside_path_error_contract(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaisesRegex(ValueError, "evidence_path_outside_root"):
                recovery.contained(Path(temp), "../outside")


if __name__ == "__main__":
    unittest.main()
