#!/usr/bin/env python3

from __future__ import annotations

import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_DIRECTORY = Path(__file__).resolve().parents[2] / "script" / "benchmark" / "external-agent"
sys.path.insert(0, str(SCRIPT_DIRECTORY))

from automationbench.rubric import partial_credit  # noqa: E402
from automationbench.runner import strip_none_values  # noqa: E402
from automationbench.schema.world import WorldState  # noqa: E402
from automationbench_bridge import BridgeState, _load_task  # noqa: E402


class AutomationBenchScorerReplayTest(unittest.TestCase):
    def test_replays_transient_row_write_state_after_final_value_is_restored(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            events = root / "events.jsonl"
            initial_world = root / "initial-world.json"
            final_world = root / "final-world.json"
            bridge = BridgeState(
                "hr",
                "hr.salary_adjustment_processing",
                events,
                initial_world,
                final_world,
            )
            url = (
                "https://sheets.googleapis.com/v4/spreadsheets/ss_comp_5101/values/"
                "Pending%20Adjustments%21J5%3AJ5"
            )
            for value in ("Processed", "Pending"):
                bridge.fetch(
                    {
                        "method": "PUT",
                        "url": url,
                        "params": None,
                        "body": json.dumps(
                            {
                                "range": "Pending Adjustments!J5:J5",
                                "majorDimension": "ROWS",
                                "values": [[value]],
                            }
                        ),
                    }
                )

            score = bridge.score()
            score["initial_world_sha256"] = bridge.initial_world_sha256
            self.assertEqual(score["scorer_state_schema"], 2)
            self.assertEqual(
                score["transient_assertion_state"]["google_sheets_updated_row_keys"],
                ["ss_comp_5101:ws_adjustments_5101:5"],
            )
            self.assertEqual(
                score["assertion_results"][6],
                {
                    "type": "google_sheets_row_not_updated",
                    "passed": False,
                    "excluded": False,
                    "params": {"spreadsheet_id": "ss_comp_5101", "row_id": 5},
                },
            )

            _, info = _load_task("hr", "hr.salary_adjustment_processing")
            initial = strip_none_values(copy.deepcopy(info["initial_state"]))
            info["assertions"] = [strip_none_values(item) for item in info["assertions"]]
            bare_state = {
                "info": info,
                "world": WorldState.model_validate_json(final_world.read_bytes()),
                "initial_state": initial,
            }
            partial_credit(bare_state)
            self.assertEqual(
                bare_state["_assertion_results"][6],
                {
                    "type": "google_sheets_row_not_updated",
                    "passed": True,
                    "excluded": True,
                    "params": {"spreadsheet_id": "ss_comp_5101", "row_id": 5},
                },
            )

            replay = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT_DIRECTORY / "verify_automationbench_replay.py"),
                    "--domain",
                    "hr",
                    "--task",
                    "hr.salary_adjustment_processing",
                    "--events",
                    str(events),
                    "--initial-world",
                    str(initial_world),
                    "--final-world",
                    str(final_world),
                ],
                input=json.dumps(score),
                text=True,
                capture_output=True,
                check=True,
            )
            self.assertTrue(json.loads(replay.stdout)["passed"])


if __name__ == "__main__":
    unittest.main()
