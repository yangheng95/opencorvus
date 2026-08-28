#!/usr/bin/env python3

from __future__ import annotations

import copy
import hashlib
import itertools
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
from verify_automationbench_replay import _assert_scorer_world_stable, _canonical_world_bytes  # noqa: E402


class AutomationBenchScorerReplayTest(unittest.TestCase):
    def test_accepts_exact_sealed_bytes_with_valid_set_order_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            events = root / "events.jsonl"
            initial_world = root / "initial-world.json"
            final_world = root / "final-world.json"
            bridge = BridgeState(
                "operations",
                "operations.mailchimp_ecommerce_sync",
                events,
                initial_world,
                final_world,
            )
            bridge.fetch(
                {
                    "method": "POST",
                    "url": "https://us1.api.mailchimp.com/3.0/lists/aud_main/members",
                    "params": None,
                    "body": json.dumps(
                        {
                            "email_address": "set-order@example.com",
                            "status": "subscribed",
                            "tags": ["repeat-customer", "vip-eligible", "high-value"],
                        }
                    ),
                }
            )
            score = bridge.score()
            raw_world = json.loads(final_world.read_text(encoding="utf-8"))
            sealed_bytes = None
            for subscriber_index, subscriber in enumerate(raw_world["mailchimp"]["subscribers"]):
                tags = subscriber.get("tags", [])
                for tag_order in itertools.permutations(tags):
                    candidate = copy.deepcopy(raw_world)
                    candidate["mailchimp"]["subscribers"][subscriber_index]["tags"] = list(tag_order)
                    candidate_bytes = json.dumps(
                        candidate,
                        ensure_ascii=False,
                        sort_keys=True,
                        separators=(",", ":"),
                    ).encode("utf-8")
                    parsed = WorldState.model_validate_json(candidate_bytes)
                    if candidate_bytes != _canonical_world_bytes(parsed):
                        sealed_bytes = candidate_bytes
                        break
                if sealed_bytes is not None:
                    break
            self.assertIsNotNone(sealed_bytes)
            assert sealed_bytes is not None
            sealed_sha256 = hashlib.sha256(sealed_bytes).hexdigest()
            final_world.write_bytes(sealed_bytes)
            score.update(
                {
                    "initial_world_sha256": bridge.initial_world_sha256,
                    "final_world_sha256": sealed_sha256,
                    "end_state_sha256": sealed_sha256,
                }
            )
            event_rows = [json.loads(line) for line in events.read_text(encoding="utf-8").splitlines()]
            stateful_event = next(row for row in event_rows if row.get("tool") == "api_fetch")
            stateful_event["world_after_sha256"] = sealed_sha256
            score_event = next(row for row in event_rows if row["kind"] == "score")
            score_event["final_world_sha256"] = sealed_sha256
            score_event["end_state_sha256"] = sealed_sha256
            events.write_text(
                "".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n" for row in event_rows),
                encoding="utf-8",
            )

            replay = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT_DIRECTORY / "verify_automationbench_replay.py"),
                    "--domain",
                    "operations",
                    "--task",
                    "operations.mailchimp_ecommerce_sync",
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
            replay_audit = json.loads(replay.stdout)
            self.assertTrue(replay_audit["passed"])
            self.assertTrue(replay_audit["checks"]["scorer_world_stable"])

    def test_reports_replay_scorer_world_mutation(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            bridge = BridgeState(
                "operations",
                "operations.mailchimp_ecommerce_sync",
                root / "events.jsonl",
                root / "initial-world.json",
                root / "final-world.json",
            )
            bridge.fetch(
                {
                    "method": "POST",
                    "url": "https://us1.api.mailchimp.com/3.0/lists/aud_main/members",
                    "params": None,
                    "body": json.dumps(
                        {
                            "email_address": "mutation@example.com",
                            "status": "subscribed",
                            "tags": ["baseline"],
                        }
                    ),
                }
            )
            before = _canonical_world_bytes(bridge.world)
            bridge.world.mailchimp.subscribers[0].tags.add("replay-mutation-probe")
            with self.assertRaisesRegex(RuntimeError, "replay scorer mutated the parsed final world"):
                _assert_scorer_world_stable(before, bridge.world)

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
