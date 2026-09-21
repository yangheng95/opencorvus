from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("compose-v5c-cartoon-trials.py")
SPEC = importlib.util.spec_from_file_location("compose_v5c_trials", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ComposeV5CCartoonTrialsTest(unittest.TestCase):
    def test_all_four_sources_are_manually_accepted_and_hash_bound(self) -> None:
        sources, gates = MODULE.accepted_sources()
        self.assertEqual([path.stem for path in sources], MODULE.ORDER)
        self.assertEqual([gates["shots"][shot]["status"] for shot in MODULE.ORDER], ["accepted"] * 4)
        self.assertGreaterEqual(sum(len(gates["shots"][shot]["rejected"]) for shot in MODULE.ORDER), 8)


if __name__ == "__main__":
    unittest.main()
