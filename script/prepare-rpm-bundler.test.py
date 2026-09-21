import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("rpm_bundler", Path(__file__).with_name("prepare-rpm-bundler.py"))
bundler = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bundler)


class FrozenRpmGraph(unittest.TestCase):
    def setUp(self):
        self.before = {"package": [
            {"name": "rpm", "version": "0.16.0", "source": "registry+https://github.com/rust-lang/crates.io-index",
             "checksum": "locked-crate", "dependencies": ["flate2"]},
            {"name": "flate2", "version": "1.1.1", "source": "registry+https://github.com/rust-lang/crates.io-index",
             "checksum": "locked-compressor"},
        ]}
        self.after = copy.deepcopy(self.before)
        self.after["package"][0].pop("source")
        self.after["package"][0].pop("checksum")

    def test_accepts_one_local_patch_with_the_exact_compressor_graph(self):
        self.assertEqual(bundler.verify_patch_lock(self.before, self.after), 2)
        self.assertEqual(bundler.rpm_lock_entry(self.after)["version"], "0.16.0")

    def test_reports_unrelated_dependency_drift(self):
        self.after["package"][1]["version"] = "1.1.9"
        with self.assertRaisesRegex(ValueError, "changed dependencies beyond the single local source patch"):
            bundler.verify_patch_lock(self.before, self.after)

    def test_requires_review_when_the_upstream_rpm_version_changes(self):
        self.before["package"][0]["version"] = "0.23.0"
        with self.assertRaisesRegex(ValueError, "requires exactly locked rpm 0.16.0"):
            bundler.rpm_lock_entry(self.before)


if __name__ == "__main__":
    unittest.main()
