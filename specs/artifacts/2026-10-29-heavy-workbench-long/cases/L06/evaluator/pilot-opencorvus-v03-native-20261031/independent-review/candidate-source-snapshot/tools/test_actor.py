"""Positive current-contract and explicit negative packet/replay tests."""

import copy
import json
import subprocess
import sys
import unittest
from common import ROOT, PUBLIC, load_data, event, save
from tree_business import packet, append, BusinessError, canonical, action_at


class ActorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data, _ = load_data(PUBLIC)
        cls.policy = json.loads((ROOT / "policy.json").read_text())
        cls.journals = json.loads((ROOT / "exercise/run-001/journals.json").read_text())

    def invoke(self, packets):
        return subprocess.run(
            [
                sys.executable,
                "-u",
                "-B",
                str(ROOT / "actor/actor.py"),
                "--public",
                str(PUBLIC),
            ],
            input="".join(canonical(p) + "\n" for p in packets),
            text=True,
            encoding="utf-8",
            capture_output=True,
        )

    def test_all_current_packets_match_executed_policy(self):
        packets, expected = [], []
        for path in self.data["scenarios"]:
            rows = self.journals[path["id"]]
            for t in range(16):
                packets.append(packet(self.data, rows[:t], event(path, t)))
                expected.append(rows[t])
        result = self.invoke(packets)
        self.assertEqual(result.returncode, 0, result.stderr)
        responses = [json.loads(line) for line in result.stdout.splitlines()]
        self.assertEqual(len(responses), 128)
        for response, committed in zip(responses, expected):
            self.assertEqual(response["action"], committed["action"])
            self.assertEqual(response["request_id"], committed["request_id"])

    def test_fresh_actor_resume_and_duplicate_packet(self):
        path = self.data["scenarios"][5]
        rows = self.journals[path["id"]]
        p = packet(self.data, rows[:8], event(path, 8))
        one = self.invoke([p])
        two = self.invoke([p, p])
        self.assertEqual(one.returncode, 0, one.stderr)
        self.assertEqual(two.stdout.splitlines(), one.stdout.splitlines() * 2)

    def test_forged_derived_state_is_rejected(self):
        path = self.data["scenarios"][0]
        p = packet(self.data, [], event(path, 0))
        p["post_week_state"]["cash"] += 1
        result = self.invoke([p])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("authoritative committed prefix", result.stderr)
        save(
            ROOT / "results/negative-packet-diagnostic.json",
            {
                "purpose": "deliberate forged state rejection",
                "exit": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
            },
        )

    def test_original_receipt_and_conflicting_id(self):
        rows = self.journals["T00"][:8]
        item = rows[-1]
        same, receipt, replayed = append(
            self.data, rows, item["event"], item["action"], item["request_id"]
        )
        self.assertTrue(replayed)
        self.assertEqual(same, rows)
        self.assertEqual(receipt, item["receipt"])
        wrong = copy.deepcopy(item["action"])
        wrong["truck_on"][0] = 1 - wrong["truck_on"][0]
        with self.assertRaises(BusinessError) as caught:
            append(self.data, rows, item["event"], wrong, item["request_id"])
        self.assertEqual(caught.exception.code, "idempotency_payload_conflict")

    def test_boolean_action_is_not_integer(self):
        from tree_business import validate_action

        action = action_at(self.policy, "T00", 0)
        action["order_lots"][0][0] = True
        with self.assertRaises(BusinessError) as caught:
            validate_action(self.data, action, 0)
        self.assertEqual(caught.exception.code, "decision_integer")

    def test_changed_historical_receipt_is_rejected(self):
        path = self.data["scenarios"][0]
        rows = copy.deepcopy(self.journals[path["id"]][:8])
        rows[-1]["receipt"]["cash_minor"] += 1
        with self.assertRaises(BusinessError) as caught:
            packet(self.data, rows, event(path, 8))
        self.assertEqual(caught.exception.code, "receipt_state_mismatch")


if __name__ == "__main__":
    unittest.main()
