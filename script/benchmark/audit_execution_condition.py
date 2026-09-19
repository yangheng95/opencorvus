"""Audit declared executor/verifier conditions from sealed execution evidence, retaining every case."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

from measure_publication_overhead import measurement_inputs


def valid_timestamp(value):
    return type(value) in (int, float) and 0 < value <= 2**53 - 1 and math.isfinite(value)


def dispatch_members(part):
    """Read members of a real persisted dispatch Tool, preserving outer identity."""
    tool = part.get("tool")
    state = part.get("state", {})
    if tool not in ("dispatch_agent", "dispatch_agents") or state.get("status") != "completed":
        return []
    request, receipt = state["input"], json.loads(state["output"])
    if tool == "dispatch_agent":
        return [{"dispatch": request["dispatch"], "receipt": receipt, "tool_name": tool,
                 "collection_member_index": None, "collection_member_count": None}]
    requests, team, results = request["dispatches"], request["team"], receipt["members"]
    count = len(requests)
    if (count == 0 or len(team) != count or len(results) != count
            or any(type(r.get("member_index")) is not int for r in results)
            or [r.get("member_index") for r in results] != list(range(count))
            or len({m["name"] for m in team}) != count):
        raise ValueError("dispatch_collection_member_set_mismatch")
    members = []
    for index, (entry, owner, result) in enumerate(zip(requests, team, results)):
        dispatch = entry["dispatch"]
        if (owner["target"] != dispatch["target"] or result["target"] != dispatch["target"]
                or owner["name"] != result["name"]):
            raise ValueError("dispatch_collection_member_identity_mismatch")
        if result["status"] == "failed":
            continue
        if result["status"] != "completed":
            raise ValueError("dispatch_collection_member_status_invalid")
        members.append({"dispatch": dispatch, "receipt": result["outcome"], "tool_name": tool,
                        "collection_member_index": index, "collection_member_count": count})
    return members


def member_matches_lineage(member, lineage):
    if member["tool_name"] != lineage.get("tool_name"):
        return False
    fields = ("collection_member_index", "collection_member_count")
    if member["tool_name"] == "dispatch_agent":
        return all(key not in lineage for key in fields)
    return all(type(lineage.get(key)) is int and lineage[key] == member[key] for key in fields)


def audit_task(board, messages, workflow, executor, verifier):
    issues = []
    task_id = board["task"]["id"]
    projection = board["executionProjection"]
    if projection["taskID"] != task_id:
        raise ValueError("execution_projection_task_identity_mismatch")
    occurrences = projection["occurrences"]
    completion = board["task"].get("completionDecision")
    binding = completion.get("workflowBinding") if completion else None
    if not binding or binding.get("kind") != "virtual_workflow" or binding.get("workflow_id") != workflow:
        issues.append("completion_workflow_mismatch")
    identities = [(o["sessionID"], o["inputMessageID"]) for o in occurrences]
    if len(set(identities)) != len(identities):
        raise ValueError("duplicate_execution_occurrence")
    roles = {}
    for role in (executor, verifier):
        owned = [o for o in occurrences if o["agent"] == role]
        roles[role] = owned
        if not owned:
            issues.append(f"missing_execution:{role}")
        for occurrence in owned:
            times = [occurrence.get("preparedAt")] + [e.get("emittedAt") for e in occurrence.get("events", [])]
            sequences = [e.get("sequence") for e in occurrence.get("events", [])]
            if (any(not valid_timestamp(t) for t in times)
                    or times != sorted(times)
                    or any(type(s) is not int for s in sequences)
                    or sequences != sorted(set(sequences))):
                raise ValueError("execution_event_order_invalid")
            latest = occurrence["events"][-1] if occurrence.get("events") else None
            if latest != occurrence.get("latest"):
                raise ValueError("execution_latest_event_mismatch")
            current = occurrence is max(owned, key=lambda o: o["preparedAt"])
            if current and (not latest or latest["status"].get("type") != "terminal" or latest["status"].get("reason") != "completed"):
                issues.append(f"unsettled_execution:{role}:{occurrence['inputMessageID']}")
            if not any(m["info"].get("id") == occurrence["inputMessageID"]
                       and m["info"].get("sessionID") == occurrence["sessionID"]
                       and m["info"].get("role") == "user" for m in messages):
                issues.append(f"missing_input_message:{role}:{occurrence['inputMessageID']}")
    starts = []
    for message in messages:
        if message["info"].get("role") != "assistant" or message["info"].get("agent") != "orchestrator":
            continue
        for part in message.get("parts", []):
            for member in dispatch_members(part):
                dispatch, receipt = member["dispatch"], member["receipt"]
                turn = dispatch["turn"]
                if dispatch["target"] in (executor, verifier) and turn["kind"] == "initial":
                    starts.append({"target": dispatch["target"], "subject": turn["workflow_subject"], "part_id": part["id"],
                                   "session_id": receipt.get("session_id"), "receipt_kind": receipt["kind"],
                                   "lineage_id": receipt.get("dispatch_lineage_id"),
                                   "producer_session_id": message["info"].get("sessionID"),
                                   "producer_message_id": message["info"].get("id"),
                                   "call_id": part.get("callID"), "final_message_id": receipt.get("final_message_id"),
                                   **{key: member[key] for key in ("tool_name", "collection_member_index", "collection_member_count")}})
    for role in (executor, verifier):
        selected = [d for d in starts if d["target"] == role]
        if len(selected) != 1 or selected[0]["subject"] != {
            "kind": "virtual_workflow", "workflow_id": workflow, "node_id": role,
        }:
            issues.append(f"workflow_subject_mismatch:{role}")
        if len(selected) == 1 and (selected[0]["receipt_kind"] not in ("accepted", "terminal_success") or
                {o["sessionID"] for o in roles[role]} != {selected[0]["session_id"]}):
            issues.append(f"dispatch_execution_identity_mismatch:{role}")
    developers, testers = roles[executor], roles[verifier]
    if developers and testers:
        if {o["sessionID"] for o in developers} & {o["sessionID"] for o in testers}:
            issues.append("verification_session_not_independent")
        last_developer = max(developers, key=lambda o: o["preparedAt"])
        last_tester = max(testers, key=lambda o: o["preparedAt"])
        if last_tester["preparedAt"] < last_developer["latest"]["emittedAt"]:
            issues.append("verification_predates_latest_execution_settlement")
    return {"task_id": task_id, "satisfied": not issues, "issues": issues, "initial_dispatches": starts,
            "occurrences": [{k: o.get(k) for k in ("agent", "sessionID", "inputMessageID", "preparedAt", "latest")}
                            for o in occurrences if o["agent"] in (executor, verifier)]}


def audit_lineages(task, board, messages, snapshot):
    artifacts = snapshot["rows"]["engine_artifact"]
    if len({a["id"] for a in artifacts}) != len(artifacts):
        raise ValueError("duplicate_artifact_identity")
    by_id = {a["id"]: a for a in artifacts}
    lineage_rows = [a for a in artifacts if a["kind"] == "dispatch_lineage" and a["task_id"] == task["task_id"]]
    lineages = []
    for artifact in lineage_rows:
        payload = artifact["payload"].encode()
        if hashlib.sha256(payload).hexdigest() != artifact["payload_sha256"] or len(payload) != artifact["payload_bytes"]:
            raise ValueError("lineage_payload_digest_mismatch")
        lineage = json.loads(payload)
        created = lineage["time_created"]
        if not valid_timestamp(created):
            raise ValueError("lineage_creation_time_invalid")
        lineages.append(lineage)
    canonical_messages = snapshot["rows"]["message"]
    settlements = []
    for artifact in artifacts:
        if artifact["kind"] == "dispatch_settlement" and artifact["task_id"] == task["task_id"]:
            payload = artifact["payload"].encode()
            if hashlib.sha256(payload).hexdigest() != artifact["payload_sha256"] or len(payload) != artifact["payload_bytes"]:
                raise ValueError("settlement_payload_digest_mismatch")
            settlement = json.loads(payload)
            if not valid_timestamp(settlement["time_created"]):
                raise ValueError("settlement_creation_time_invalid")
            settlements.append(settlement)
    for occurrence in task["occurrences"]:
        users = [m for m in canonical_messages if m["id"] == occurrence["inputMessageID"]
                 and m["session_id"] == occurrence["sessionID"] and m["role"] == "user"
                 and m["agent"] == occurrence["agent"]]
        if len(users) != 1:
            task["issues"].append("canonical_occurrence_input_mismatch")
            continue
        if not valid_timestamp(users[0]["time_created"]):
            raise ValueError("canonical_input_creation_time_invalid")
        if users[0]["time_created"] > occurrence["preparedAt"]:
            task["issues"].append("canonical_occurrence_input_mismatch")
            continue
        if occurrence["latest"]["status"].get("reason") != "completed":
            continue
        finals = [m for m in canonical_messages if m.get("parent_id") == occurrence["inputMessageID"]
                  and m["session_id"] == occurrence["sessionID"] and m["role"] == "assistant"]
        if any(not valid_timestamp(m["time_created"]) for m in finals):
            raise ValueError("canonical_final_creation_time_invalid")
        final = max(finals, key=lambda m: (m["time_created"], m["id"])) if finals else None
        if final and final.get("time_completed") is not None and not valid_timestamp(final["time_completed"]):
            raise ValueError("canonical_final_completion_time_invalid")
        matches = [s for s in settlements if final and s["outcome"].get("final_message_id") == final["id"]
                   and s["session_id"] == occurrence["sessionID"] and s["outcome"]["kind"] == "terminal_success"]
        if (final is None or len(matches) != 1 or not final.get("time_completed") or final.get("error_name")
                or final.get("finish") == "error" or
                not (final["time_completed"] <= occurrence["latest"]["emittedAt"] <= matches[0]["time_created"])):
            task["issues"].append("canonical_occurrence_settlement_mismatch")
            continue
        owner = by_id.get(matches[0]["dispatch_lineage_id"])
        lineage = json.loads(owner["payload"]) if owner else None
        if (not lineage or owner["kind"] != "dispatch_lineage" or owner["task_id"] != task["task_id"]
                or lineage["child_session_id"] != occurrence["sessionID"]
                or lineage["target_agent_id"] != occurrence["agent"]
                or lineage["dispatch_id"] != matches[0]["dispatch_id"]):
            task["issues"].append("canonical_occurrence_lineage_mismatch")
        elif board["task"].get("completionDecision"):
            # Current admission commits lineage before the input and descriptor.
            # The input <= preparedAt boundary was checked above.
            if lineage["time_created"] > users[0]["time_created"]:
                task["issues"].append("canonical_occurrence_lineage_order_mismatch")
            producers = [(m, p, member) for m in messages for p in m.get("parts", [])
                         if m["info"].get("id") == lineage["orchestrator_message_id"]
                         and m["info"].get("sessionID") == lineage["orchestrator_session_id"]
                         and m["info"].get("agent") == "orchestrator" and m["info"].get("role") == "assistant"
                         and p.get("id") == lineage["tool_part_id"] and p.get("callID") == lineage["tool_call_id"]
                         for member in dispatch_members(p) if member_matches_lineage(member, lineage)]
            if len(producers) != 1:
                task["issues"].append("occurrence_dispatch_producer_mismatch")
            else:
                requested = producers[0][2]["dispatch"]
                receipt = producers[0][2]["receipt"]
                receipt_matches = receipt.get("session_id") == occurrence["sessionID"] and (
                    (receipt.get("kind") == "accepted" and receipt.get("dispatch_lineage_id") == owner["id"])
                    or (receipt.get("kind") == "terminal_success" and receipt.get("final_message_id") == final["id"])
                )
                if not receipt_matches:
                    task["issues"].append("occurrence_dispatch_receipt_mismatch")
                turn = requested["turn"]
                parent_id = lineage.get("continuation_of_dispatch_id")
                authority_matches = not parent_id
                if parent_id and turn["kind"] == "continuation":
                    authority = turn["authority"]
                    if authority["kind"] == "prior_dispatch":
                        authority_matches = authority.get("continuation_dispatch_id") == parent_id
                    elif authority["kind"] == "coordination_action":
                        authority_matches = bool(lineage.get("coordination_action_id")) and authority.get("coordination_action_id") == lineage["coordination_action_id"]
                if (requested["target"] != occurrence["agent"] or
                        (parent_id and not authority_matches) or
                        (not parent_id and turn["kind"] != "initial")):
                    task["issues"].append("occurrence_dispatch_authority_mismatch")
            expected_binding = board["task"]["completionDecision"]["workflowBinding"]
            if (lineage["workflow_binding"] != expected_binding or
                    lineage.get("workflow_node_id") != occurrence["agent"]):
                task["issues"].append("occurrence_workflow_binding_mismatch")
            if expected_binding.get("kind") == "virtual_workflow":
                logical = [n for n in lineages if not n.get("continuation_of_dispatch_id")
                           and n["task_id"] == task["task_id"] and n["workflow_binding"] == expected_binding
                           and n["workflow_node_id"] == occurrence["agent"] and n["child_session_id"] == occurrence["sessionID"]]
                if len(logical) != 1 or lineage.get("workflow_occurrence_id") != logical[0]["dispatch_id"]:
                    task["issues"].append("continuation_logical_occurrence_mismatch")
            predecessor = lineage.get("continuation_of_dispatch_id")
            if predecessor:
                parents = [p for p in lineages if p["dispatch_id"] == predecessor]
                fields = ("task_id", "child_session_id", "target_agent_id", "workflow_binding", "workflow_node_id", "workflow_occurrence_id")
                if (len(parents) != 1 or any(parents[0].get(k) != lineage.get(k) for k in fields)
                        or parents[0]["time_created"] >= lineage["time_created"]):
                    task["issues"].append("continuation_predecessor_mismatch")
    for dispatch in task["initial_dispatches"]:
        recorded_inputs = {m["id"] for m in canonical_messages if m["session_id"] == dispatch["session_id"]
                           and m["role"] == "user" and m["agent"] == dispatch["target"]}
        observed_inputs = {o["inputMessageID"] for o in task["occurrences"] if o["sessionID"] == dispatch["session_id"]}
        if recorded_inputs != observed_inputs:
            task["issues"].append("canonical_occurrence_set_mismatch")
    completion = board["task"].get("completionDecision")
    for dispatch in task["initial_dispatches"]:
        if dispatch["receipt_kind"] == "terminal_success":
            candidates = []
            for candidate in artifacts:
                if candidate["kind"] != "dispatch_lineage" or candidate["task_id"] != task["task_id"]:
                    continue
                value = json.loads(candidate["payload"])
                if (value.get("orchestrator_session_id") == dispatch["producer_session_id"] and
                        value.get("orchestrator_message_id") == dispatch["producer_message_id"] and
                        value.get("tool_part_id") == dispatch["part_id"] and value.get("tool_call_id") == dispatch["call_id"]
                        and member_matches_lineage(dispatch, value)):
                    candidates.append(candidate)
            row = candidates[0] if len(candidates) == 1 else None
        else:
            row = by_id.get(dispatch["lineage_id"])
        if row is None or row["kind"] != "dispatch_lineage" or row["task_id"] != task["task_id"]:
            task["issues"].append("dispatch_lineage_missing_or_foreign")
            continue
        payload = row["payload"].encode()
        if hashlib.sha256(payload).hexdigest() != row["payload_sha256"] or len(payload) != row["payload_bytes"]:
            raise ValueError("lineage_payload_digest_mismatch")
        lineage = json.loads(payload)
        matches = {
            "task_id": task["task_id"], "child_session_id": dispatch["session_id"],
            "target_agent_id": dispatch["target"], "orchestrator_session_id": dispatch["producer_session_id"],
            "orchestrator_message_id": dispatch["producer_message_id"], "tool_part_id": dispatch["part_id"],
            "tool_call_id": dispatch["call_id"],
        }
        if any(lineage.get(k) != v for k, v in matches.items()) or not member_matches_lineage(dispatch, lineage):
            task["issues"].append("dispatch_lineage_identity_mismatch")
        binding = lineage["workflow_binding"]
        subject = dispatch["subject"]
        if (binding.get("kind") != subject["kind"] or
                (subject["kind"] == "virtual_workflow" and
                 (binding.get("workflow_id") != subject["workflow_id"] or lineage["workflow_node_id"] != subject["node_id"]))):
            task["issues"].append("dispatch_lineage_workflow_mismatch")
        if completion and binding != completion["workflowBinding"]:
            task["issues"].append("completion_lineage_binding_mismatch")
        if subject["kind"] == "virtual_workflow":
            expected = {"task_id": task["task_id"], "workflow_binding": binding,
                        "workflow_node_id": subject["node_id"], "dispatch_id": lineage["dispatch_id"],
                        "child_session_id": dispatch["session_id"]}
            nodes = [n for n in lineages if not n.get("continuation_of_dispatch_id")
                     and all(n.get(k) == v for k, v in expected.items())
                     and n.get("workflow_occurrence_id") == n["dispatch_id"]]
            if len(nodes) != 1:
                task["issues"].append("canonical_node_occurrence_mismatch")
        if dispatch["receipt_kind"] == "terminal_success":
            finals = [m for m in messages if m["info"].get("id") == dispatch["final_message_id"]
                      and m["info"].get("sessionID") == dispatch["session_id"]
                      and m["info"].get("role") == "assistant" and m["info"].get("time", {}).get("completed")
                      and not m["info"].get("error") and m["info"].get("finish") != "error"
                      and any(o["sessionID"] == dispatch["session_id"] and
                              o["inputMessageID"] == m["info"].get("parentID") for o in task["occurrences"])]
            canonical_finals = [s for s in settlements if s["dispatch_lineage_id"] == row["id"]
                                and s["outcome"].get("final_message_id") == dispatch["final_message_id"]
                                and s["outcome"]["kind"] == "terminal_success"]
            if len(finals) != 1 or len(canonical_finals) != 1:
                task["issues"].append("terminal_receipt_final_message_mismatch")
    task["satisfied"] = not task["issues"]


def audit_directory(directory, workflow, executor, verifier, runtime_commit, frozen_cases):
    manifest_bytes = (directory / "evidence-manifest.json").read_bytes()
    manifest = json.loads(manifest_bytes)
    sealed_names = {f["path"] for f in manifest["files"]}
    outcomes = sealed_names & {"result.json", "failure.json"}
    if len(outcomes) != 1:
        raise ValueError("one_sealed_outcome_required")
    outcome_name = next(iter(outcomes))
    board_name = "terminal-board.json" if outcome_name == "result.json" else "latest-board.json"
    names = [outcome_name, board_name, "task-transcripts.json", "run-start.json", "runtime-database-snapshot.json"]
    raw = measurement_inputs(directory, manifest, names)
    data = {name: json.loads(value) for name, value in raw.items()}
    outcome, start = data[outcome_name], data["run-start.json"]
    if outcome["run"]["id"] != manifest["run_id"] or start["run"]["id"] != manifest["run_id"]:
        raise ValueError("run_identity_mismatch")
    source_commit = outcome["opencorvus"]["commit"] if outcome_name == "result.json" else outcome["opencorvus"]["source"]["commit"]
    if source_commit != runtime_commit:
        raise ValueError("runtime_identity_mismatch")
    bench = outcome["benchmark"]
    frozen = frozen_cases.get(bench["case_index"])
    identity_keys = ("domain", "task", "example_id", "task_contract_sha256") if outcome_name == "result.json" else ("domain", "task", "task_contract_sha256")
    if not frozen or any(bench.get(k) != frozen[k] for k in identity_keys):
        raise ValueError("frozen_case_identity_mismatch")
    if any(bench.get(k) != start["benchmark"].get(k) for k in ("domain", "task", "batch_run_id", "batch_index")):
        raise ValueError("start_outcome_case_identity_mismatch")
    if any(outcome["opencorvus"].get(key) != start["opencorvus"].get(key) for key in ("profile", "model")):
        raise ValueError("model_profile_identity_mismatch")
    transcripts = data["task-transcripts.json"]
    boards = data[board_name]["tasks"]
    transcript_ids = [t["task_id"] for t in transcripts]
    board_ids = [t["task_id"] for t in boards]
    if (len(set(transcript_ids)) != len(transcript_ids) or len(set(board_ids)) != len(board_ids)
            or sorted(transcript_ids) != sorted(board_ids)
            or sorted(board_ids) != sorted(outcome["opencorvus"]["task_ids"])):
        raise ValueError("task_evidence_identity_mismatch")
    tasks = []
    for task in boards:
        if task["board"]["task"]["id"] != task["task_id"]:
            raise ValueError("board_task_identity_mismatch")
        if task["board"]["task"]["packageRevisionBinding"]["id"] != outcome["opencorvus"]["profile"]:
            raise ValueError("bound_profile_identity_mismatch")
        messages = next(t["transcript"] for t in transcripts if t["task_id"] == task["task_id"])
        audited = audit_task(task["board"], messages, workflow, executor, verifier)
        audit_lineages(audited, task["board"], messages, data["runtime-database-snapshot.json"])
        tasks.append(audited)
    return {"case_index": outcome["benchmark"]["case_index"], "run_id": manifest["run_id"],
            "source_status": outcome["run"]["status"], "runtime_commit": runtime_commit,
            "condition_satisfied": bool(tasks) and all(t["satisfied"] for t in tasks), "tasks": tasks,
            "recorded_metrics": outcome["benchmark"].get("metrics"),
            "manifest_sha256": hashlib.sha256(manifest_bytes).hexdigest(),
            "input_sha256": {name: hashlib.sha256(value).hexdigest() for name, value in raw.items()}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--cases", required=True)
    parser.add_argument("--runtime-commit", required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--workflow", required=True)
    parser.add_argument("--executor", required=True)
    parser.add_argument("--verifier", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    indices = [int(x) for x in args.cases.split(",")]
    if not indices or len(set(indices)) != len(indices) or args.executor == args.verifier:
        raise ValueError("invalid_condition_identity")
    root = args.root.resolve()
    frozen_bytes = args.manifest.read_bytes()
    frozen_rows = json.loads(frozen_bytes)["cases"]
    frozen_cases = {row["case_index"]: row for row in frozen_rows}
    if len(frozen_cases) != len(frozen_rows):
        raise ValueError("duplicate_frozen_case_identity")
    rows = []
    for manifest in root.glob("*/*/evidence-manifest.json"):
        directory = manifest.parent.resolve()
        if not directory.is_relative_to(root):
            raise ValueError("evidence_directory_outside_root")
        row = audit_directory(directory, args.workflow, args.executor, args.verifier, args.runtime_commit, frozen_cases)
        if row["case_index"] in indices:
            rows.append(row)
    if sorted(r["case_index"] for r in rows) != sorted(indices):
        raise ValueError("exact_requested_case_set_required")
    report = {"schema_version": 1, "condition": {"workflow": args.workflow, "executor": args.executor,
              "verifier": args.verifier}, "cases": sorted(rows, key=lambda r: r["case_index"]),
              "case_manifest_sha256": hashlib.sha256(frozen_bytes).hexdigest(),
              "sample_count": len(indices), "condition_satisfied_count": sum(r["condition_satisfied"] for r in rows),
              "scope": "Execution-condition audit only; recorded scores retained, no official score replay performed."}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(json.dumps({k: report[k] for k in ("sample_count", "condition_satisfied_count")}))


if __name__ == "__main__":
    main()
