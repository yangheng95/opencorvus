import copy
import unittest
import hashlib
import json
import tempfile
from pathlib import Path

from audit_execution_condition import audit_task, audit_directory


def evidence():
    occurrences, messages = [], []
    for agent, start, end in [("developer", 10, 20), ("tester", 30, 40)]:
        event = {"sequence": 1, "status": {"type": "terminal", "reason": "completed"}, "emittedAt": end}
        occurrences.append({"agent": agent, "sessionID": agent, "inputMessageID": agent + "-input",
                            "preparedAt": start, "latest": event, "events": [event]})
        messages.append({"info": {"id": agent + "-input", "sessionID": agent, "role": "user"}})
        messages.append({"info": {"agent": "orchestrator", "role": "assistant"}, "parts": [{
            "id": agent + "-dispatch", "tool": "dispatch_agent", "state": {"status": "completed",
            "input": {"dispatch": {"target": agent, "turn": {"kind": "initial", "workflow_subject": {
                "kind": "virtual_workflow", "workflow_id": "verify", "node_id": agent}}}},
            "output": '{"kind":"accepted","session_id":"' + agent + '"}'}}]})
    return {"task": {"id": "task", "completionDecision": {"workflowBinding": {"kind": "virtual_workflow", "workflow_id": "verify"}}}, "executionProjection": {"taskID": "task", "occurrences": occurrences}}, messages


def audit(board, messages):
    return audit_task(board, messages, "verify", "developer", "tester")


class ExecutionConditionTests(unittest.TestCase):
    def test_completed_independent_verification(self):
        board, messages = evidence()
        result = audit(board, messages)
        self.assertEqual((result["task_id"], result["satisfied"]), ("task", True))
        self.assertEqual([o["agent"] for o in result["occurrences"]], ["developer", "tester"])

    def test_missing_verifier_is_explicit(self):
        board, messages = evidence()
        board["executionProjection"]["occurrences"].pop()
        result = audit(board, messages)
        self.assertEqual(result["satisfied"], False)
        self.assertIn("missing_execution:tester", result["issues"])

    def test_direct_subject_is_condition_deviation(self):
        board, messages = evidence()
        messages[1]["parts"][0]["state"]["input"]["dispatch"]["turn"]["workflow_subject"] = {"kind": "direct"}
        self.assertEqual(audit(board, messages)["issues"], ["workflow_subject_mismatch:developer"])

    def test_repair_requires_later_verification(self):
        board, messages = evidence()
        repair = copy.deepcopy(board["executionProjection"]["occurrences"][0])
        repair.update(inputMessageID="repair", preparedAt=50)
        repair["latest"]["emittedAt"] = 60
        board["executionProjection"]["occurrences"].append(repair)
        messages.append({"info": {"id": "repair", "sessionID": "developer", "role": "user"}})
        self.assertEqual(audit(board, messages)["issues"], ["verification_predates_latest_execution_settlement"])
        verifier = board["executionProjection"]["occurrences"][1]
        verifier["preparedAt"] = 70
        verifier["latest"]["emittedAt"] = 80
        self.assertEqual(audit(board, messages)["satisfied"], True)

    def test_failed_latest_verification_has_explicit_outcome(self):
        board, messages = evidence()
        board["executionProjection"]["occurrences"][1]["latest"]["status"]["reason"] = "error"
        self.assertEqual(audit(board, messages)["issues"], ["unsettled_execution:tester:tester-input"])

    def test_dispatch_receipt_owns_actual_session(self):
        board, messages = evidence()
        messages[3]["parts"][0]["state"]["output"] = '{"kind":"accepted","session_id":"another"}'
        self.assertEqual(audit(board, messages)["issues"], ["dispatch_execution_identity_mismatch:tester"])

    def test_reversed_event_time_has_typed_error(self):
        board, messages = evidence()
        board["executionProjection"]["occurrences"][1]["latest"]["emittedAt"] = 29
        with self.assertRaisesRegex(ValueError, "execution_event_order_invalid"):
            audit(board, messages)


def sealed_directory(directory, mutate=lambda files: None):
    board, messages = evidence()
    binding = {"kind": "virtual_workflow", "workflow_id": "verify", "nodes": [
        {"node_id": "developer", "agent_id": "developer", "depends_on": []},
        {"node_id": "tester", "agent_id": "tester", "depends_on": ["developer"]}]}
    board["task"].update(packageRevisionBinding={"id": "base"}, completionDecision={"workflowBinding": binding})
    artifacts, canonical_messages = [], []
    for i, role in [(1, "developer"), (3, "tester")]:
        message, part = messages[i], messages[i]["parts"][0]
        message["info"].update(id=role + "-producer", sessionID="orchestrator")
        part["callID"] = role + "-call"
        lineage_id = role + "-lineage"
        part["state"]["output"] = json.dumps({"kind": "accepted", "session_id": role, "dispatch_lineage_id": lineage_id})
        payload = json.dumps({"task_id": "task", "child_session_id": role, "target_agent_id": role,
            "orchestrator_session_id": "orchestrator", "orchestrator_message_id": message["info"]["id"],
            "tool_part_id": part["id"], "tool_call_id": part["callID"], "tool_name": "dispatch_agent",
            "workflow_binding": binding, "workflow_node_id": role, "dispatch_id": role + "-dispatch-id",
            "workflow_occurrence_id": role + "-dispatch-id",
            "time_created": 8 if role == "developer" else 28})
        artifacts.append({"id": lineage_id, "task_id": "task", "kind": "dispatch_lineage", "payload": payload,
                          "payload_bytes": len(payload.encode()), "payload_sha256": hashlib.sha256(payload.encode()).hexdigest()})
        start, end = (10, 20) if role == "developer" else (30, 40)
        canonical_messages.extend([
            {"id": role + "-input", "session_id": role, "agent": role, "role": "user", "time_created": start - 1},
            {"id": role + "-final", "session_id": role, "agent": role, "role": "assistant", "parent_id": role + "-input",
             "time_created": end - 1, "time_completed": end, "finish": "stop", "error_name": None}])
        settlement = json.dumps({"task_id": "task", "dispatch_lineage_id": lineage_id, "dispatch_id": role + "-dispatch-id",
            "session_id": role, "outcome": {"kind": "terminal_success", "final_message_id": role + "-final"}, "time_created": end})
        artifacts.append({"id": role + "-settlement", "task_id": "task", "kind": "dispatch_settlement", "payload": settlement,
            "payload_bytes": len(settlement.encode()), "payload_sha256": hashlib.sha256(settlement.encode()).hexdigest()})
    case = {"case_index": 1, "domain": "finance", "task": "invoice", "example_id": 9, "task_contract_sha256": "contract"}
    system = {"profile": "base", "model": "luna", "commit": "revision", "task_ids": ["task"]}
    files = {"result.json": {"run": {"id": "run", "status": "scored"}, "benchmark": case, "opencorvus": system},
        "run-start.json": {"run": {"id": "run"}, "benchmark": dict(case), "opencorvus": system},
        "terminal-board.json": {"tasks": [{"task_id": "task", "board": board}]},
        "task-transcripts.json": [{"task_id": "task", "transcript": messages}],
        "runtime-database-snapshot.json": {"rows": {"engine_artifact": artifacts, "message": canonical_messages}}}
    frozen = {1: dict(case)}
    mutate(files)
    entries = []
    for name, value in files.items():
        data = json.dumps(value).encode()
        (directory / name).write_bytes(data)
        entries.append({"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    (directory / "evidence-manifest.json").write_text(json.dumps({"run_id": "run", "files": entries}))
    return frozen


def collection_frontiers(files):
    rows = files["runtime-database-snapshot.json"]["rows"]["engine_artifact"]
    for task in files["task-transcripts.json"]:
        for message in task["transcript"]:
            for part in message.get("parts", []):
                if part.get("tool") != "dispatch_agent":
                    continue
                state = part["state"]
                dispatch = state["input"]["dispatch"]
                result = json.loads(state["output"])
                name = part["id"]
                part["tool"] = "dispatch_agents"
                state["input"] = {"team": [{"name": name, "target": dispatch["target"],
                                           "responsibility": "Current ready node", "depends_on": []}],
                                  "dispatches": [{"dispatch": dispatch}]}
                state["output"] = json.dumps({"members": [{"member_index": 0, "name": name,
                    "target": dispatch["target"], "status": "completed", "outcome": result}]})
                for row in rows:
                    if row["kind"] != "dispatch_lineage":
                        continue
                    payload = json.loads(row["payload"])
                    if payload["tool_part_id"] != part["id"]:
                        continue
                    payload.update(tool_name="dispatch_agents", collection_member_index=0, collection_member_count=1)
                    row["payload"] = json.dumps(payload)
                    raw = row["payload"].encode()
                    row.update(payload_bytes=len(raw), payload_sha256=hashlib.sha256(raw).hexdigest())


class SealedDirectoryTests(unittest.TestCase):
    def run_audit(self, mutate=lambda files: None):
        with tempfile.TemporaryDirectory() as name:
            directory = Path(name)
            frozen = sealed_directory(directory, mutate)
            return audit_directory(directory, "verify", "developer", "tester", "revision", frozen)

    def test_sealed_completed_condition(self):
        result = self.run_audit()
        self.assertEqual((result["case_index"], result["condition_satisfied"]), (1, True))

    def test_lineage_written_after_input_is_reported(self):
        def mutate(files):
            rows = files["runtime-database-snapshot.json"]["rows"]["engine_artifact"]
            row = next(a for a in rows if a["id"] == "developer-lineage")
            value = json.loads(row["payload"])
            value["time_created"] = 10
            row["payload"] = json.dumps(value)
            data = row["payload"].encode()
            row.update(payload_bytes=len(data), payload_sha256=hashlib.sha256(data).hexdigest())
        self.assertEqual(self.run_audit(mutate)["tasks"][0]["issues"],
                         ["canonical_occurrence_lineage_order_mismatch"])

    def test_canonical_timestamp_values_have_explicit_errors(self):
        for identity, field, code in [
            ("developer-input", "time_created", "canonical_input_creation_time_invalid"),
            ("developer-final", "time_created", "canonical_final_creation_time_invalid"),
            ("developer-final", "time_completed", "canonical_final_completion_time_invalid"),
        ]:
            for invalid in (float("nan"), float("inf"), True, 0, 2**53, 10**400):
                with self.subTest(identity=identity, field=field, invalid=invalid):
                    def mutate(files):
                        row = next(m for m in files["runtime-database-snapshot.json"]["rows"]["message"]
                                   if m["id"] == identity)
                        row[field] = invalid
                    with self.assertRaisesRegex(ValueError, code):
                        self.run_audit(mutate)

    def test_collection_frontiers_keep_exact_member_lineage(self):
        result = self.run_audit(collection_frontiers)
        self.assertEqual(result["condition_satisfied"], True)
        self.assertEqual([(d["tool_name"], d["collection_member_index"], d["collection_member_count"])
                          for d in result["tasks"][0]["initial_dispatches"]],
                         [("dispatch_agents", 0, 1), ("dispatch_agents", 0, 1)])

    def test_collection_result_member_index_has_explicit_error(self):
        def mutate(files):
            collection_frontiers(files)
            part = files["task-transcripts.json"][0]["transcript"][1]["parts"][0]
            output = json.loads(part["state"]["output"])
            output["members"][0]["member_index"] = 1
            part["state"]["output"] = json.dumps(output)
        with self.assertRaisesRegex(ValueError, "dispatch_collection_member_set_mismatch"):
            self.run_audit(mutate)

    def test_collection_lineage_member_drift_is_reported(self):
        def mutate(files):
            collection_frontiers(files)
            row = next(a for a in files["runtime-database-snapshot.json"]["rows"]["engine_artifact"]
                       if a["id"] == "developer-lineage")
            payload = json.loads(row["payload"])
            payload.update(collection_member_index=1, collection_member_count=2)
            row["payload"] = json.dumps(payload)
            raw = row["payload"].encode()
            row.update(payload_bytes=len(raw), payload_sha256=hashlib.sha256(raw).hexdigest())
        self.assertEqual(self.run_audit(mutate)["tasks"][0]["issues"],
                         ["occurrence_dispatch_producer_mismatch", "dispatch_lineage_identity_mismatch"])

    def test_frozen_case_identity_error(self):
        with self.assertRaisesRegex(ValueError, "frozen_case_identity_mismatch"):
            self.run_audit(lambda f: f["result.json"]["benchmark"].update(case_index=2))

    def test_start_case_identity_error(self):
        with self.assertRaisesRegex(ValueError, "start_outcome_case_identity_mismatch"):
            self.run_audit(lambda f: f["run-start.json"]["benchmark"].update(task="another"))

    def test_foreign_dispatch_producer_is_reported(self):
        result = self.run_audit(lambda f: f["task-transcripts.json"][0]["transcript"][1]["info"].update(sessionID="other"))
        self.assertEqual(result["tasks"][0]["issues"], ["occurrence_dispatch_producer_mismatch", "dispatch_lineage_identity_mismatch"])

    def test_cross_role_continuation_predecessor_is_reported(self):
        def mutate(files):
            artifacts = files["runtime-database-snapshot.json"]["rows"]["engine_artifact"]
            row = next(a for a in artifacts if a["id"] == "tester-lineage")
            value = json.loads(row["payload"])
            value["continuation_of_dispatch_id"] = "developer-dispatch-id"
            row["payload"] = json.dumps(value)
            data = row["payload"].encode()
            row.update(payload_bytes=len(data), payload_sha256=hashlib.sha256(data).hexdigest())
            part = files["task-transcripts.json"][0]["transcript"][3]["parts"][0]
            part["state"]["input"]["dispatch"]["turn"] = {"kind": "continuation", "authority": {
                "kind": "prior_dispatch", "continuation_dispatch_id": "developer-dispatch-id"}}
        result = self.run_audit(mutate)
        self.assertIn("continuation_predecessor_mismatch", result["tasks"][0]["issues"])
        self.assertEqual(result["condition_satisfied"], False)

    @staticmethod
    def coordination_continuation(files):
        rows = files["runtime-database-snapshot.json"]["rows"]
        original = next(a for a in rows["engine_artifact"] if a["id"] == "tester-lineage")
        lineage = json.loads(original["payload"])
        lineage.update(dispatch_id="retry-dispatch", continuation_of_dispatch_id="tester-dispatch-id",
            coordination_action_id="coordination", time_created=45,
            orchestrator_message_id="retry-producer", tool_part_id="retry-part", tool_call_id="retry-call")
        settlement = {"task_id": "task", "dispatch_lineage_id": "retry-lineage", "dispatch_id": "retry-dispatch",
            "session_id": "tester", "outcome": {"kind": "terminal_success", "final_message_id": "retry-final"}, "time_created": 50}
        for identity, kind, value in [("retry-lineage", "dispatch_lineage", lineage), ("retry-settlement", "dispatch_settlement", settlement)]:
            payload = json.dumps(value)
            rows["engine_artifact"].append({"id": identity, "task_id": "task", "kind": kind, "payload": payload,
                "payload_bytes": len(payload.encode()), "payload_sha256": hashlib.sha256(payload.encode()).hexdigest()})
        rows["message"].extend([
            {"id": "retry-input", "session_id": "tester", "agent": "tester", "role": "user", "time_created": 46},
            {"id": "retry-final", "session_id": "tester", "agent": "tester", "role": "assistant", "parent_id": "retry-input",
             "time_created": 49, "time_completed": 50, "finish": "stop", "error_name": None}])
        event = {"sequence": 1, "status": {"type": "terminal", "reason": "completed"}, "emittedAt": 50}
        files["terminal-board.json"]["tasks"][0]["board"]["executionProjection"]["occurrences"].append({
            "agent": "tester", "sessionID": "tester", "inputMessageID": "retry-input", "preparedAt": 47,
            "events": [event], "latest": event})
        files["task-transcripts.json"][0]["transcript"].extend([
            {"info": {"id": "retry-input", "sessionID": "tester", "role": "user"}},
            {"info": {"id": "retry-producer", "sessionID": "orchestrator", "agent": "orchestrator", "role": "assistant"},
             "parts": [{"id": "retry-part", "callID": "retry-call", "tool": "dispatch_agent", "state": {
                 "status": "completed", "input": {"dispatch": {"target": "tester", "turn": {"kind": "continuation",
                     "authority": {"kind": "coordination_action", "coordination_action_id": "coordination"}}}},
                 "output": json.dumps({"kind": "accepted", "session_id": "tester", "dispatch_lineage_id": "retry-lineage"})}}]}])

    def test_coordination_action_continuation(self):
        self.assertEqual(self.run_audit(self.coordination_continuation)["condition_satisfied"], True)
        def collection(files):
            self.coordination_continuation(files)
            collection_frontiers(files)
        self.assertEqual(self.run_audit(collection)["condition_satisfied"], True)

    def test_continuation_accepted_receipt_identity_error(self):
        for collection in (False, True):
            with self.subTest(collection=collection):
                def mutate(files):
                    self.coordination_continuation(files)
                    part = files["task-transcripts.json"][0]["transcript"][-1]["parts"][0]
                    part["state"]["output"] = json.dumps({"kind": "accepted", "session_id": "foreign-session",
                                                        "dispatch_lineage_id": "foreign-lineage"})
                    if collection:
                        collection_frontiers(files)
                self.assertEqual(self.run_audit(mutate)["tasks"][0]["issues"],
                                 ["occurrence_dispatch_receipt_mismatch"])

    def test_continuation_terminal_receipt_final_identity(self):
        for collection in (False, True):
            for final_id in ("retry-final", "foreign-final"):
                with self.subTest(collection=collection, final_id=final_id):
                    def mutate(files):
                        self.coordination_continuation(files)
                        part = files["task-transcripts.json"][0]["transcript"][-1]["parts"][0]
                        part["state"]["output"] = json.dumps({"kind": "terminal_success", "session_id": "tester",
                                                            "final_message_id": final_id})
                        if collection:
                            collection_frontiers(files)
                    result = self.run_audit(mutate)
                    expected = [] if final_id == "retry-final" else ["occurrence_dispatch_receipt_mismatch"]
                    self.assertEqual(result["tasks"][0]["issues"], expected)
                    self.assertEqual(result["condition_satisfied"], final_id == "retry-final")

    def test_fabricated_verifier_occurrence_is_reported(self):
        def mutate(files):
            board = files["terminal-board.json"]["tasks"][0]["board"]
            later = copy.deepcopy(board["executionProjection"]["occurrences"][1])
            later.update(inputMessageID="fake", preparedAt=50)
            later["latest"]["emittedAt"] = 60
            board["executionProjection"]["occurrences"].append(later)
            files["task-transcripts.json"][0]["transcript"].append({"info": {"id": "fake", "role": "user", "sessionID": "tester"}})
        result = self.run_audit(mutate)
        self.assertEqual(result["condition_satisfied"], False)
        self.assertIn("canonical_occurrence_input_mismatch", result["tasks"][0]["issues"])
        self.assertIn("canonical_occurrence_set_mismatch", result["tasks"][0]["issues"])

    def test_terminal_success_receipt_with_final_message(self):
        def mutate(files):
            messages = files["task-transcripts.json"][0]["transcript"]
            part = messages[1]["parts"][0]
            receipt = json.loads(part["state"]["output"])
            receipt.update(kind="terminal_success", final_message_id="developer-final")
            del receipt["dispatch_lineage_id"]
            part["state"]["output"] = json.dumps(receipt)
            messages.append({"info": {"id": "developer-final", "parentID": "developer-input", "sessionID": "developer", "role": "assistant", "time": {"completed": 20}}})
        self.assertEqual(self.run_audit(mutate)["condition_satisfied"], True)
        def collection(files):
            mutate(files)
            collection_frontiers(files)
        self.assertEqual(self.run_audit(collection)["condition_satisfied"], True)

    def test_fabricated_terminal_final_is_reported(self):
        def mutate(files):
            messages = files["task-transcripts.json"][0]["transcript"]
            messages[1]["parts"][0]["state"]["output"] = json.dumps({
                "kind": "terminal_success", "session_id": "developer", "final_message_id": "invented"})
            messages.append({"info": {"id": "invented", "parentID": "developer-input", "sessionID": "developer",
                                       "role": "assistant", "time": {"completed": 20}}})
        self.assertEqual(self.run_audit(mutate)["tasks"][0]["issues"], ["occurrence_dispatch_receipt_mismatch", "terminal_receipt_final_message_mismatch"])

    def test_completion_binding_matches_condition(self):
        board, messages = evidence()
        board["task"]["completionDecision"]["workflowBinding"] = {"kind": "direct"}
        self.assertEqual(audit(board, messages)["issues"], ["completion_workflow_mismatch"])

    def test_conflicting_projection_has_typed_error(self):
        board, messages = evidence()
        board["executionProjection"]["taskID"] = "other"
        with self.assertRaisesRegex(ValueError, "execution_projection_task_identity_mismatch"):
            audit(board, messages)


if __name__ == "__main__":
    unittest.main()
