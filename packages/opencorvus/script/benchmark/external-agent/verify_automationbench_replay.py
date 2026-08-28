#!/usr/bin/env python3
"""Replay a sealed AutomationBench event ledger and independently recompute its score."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

from automationbench.rubric import partial_credit, task_completed_correctly
from automationbench.runner import strip_none_values
from automationbench.schema.world import WorldState
from automationbench.tools.api import api_search

from automationbench_bridge import _load_task


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _events(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def _canonical_world_bytes(world: WorldState) -> bytes:
    return json.dumps(
        world.model_dump(mode="json"), ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def _assert_scorer_world_stable(before: bytes, world: WorldState) -> None:
    if _canonical_world_bytes(world) != before:
        raise RuntimeError("replay scorer mutated the parsed final world")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--domain", required=True)
    parser.add_argument("--task", required=True)
    parser.add_argument("--events", type=Path, required=True)
    parser.add_argument("--initial-world", type=Path, required=True)
    parser.add_argument("--final-world", type=Path, required=True)
    args = parser.parse_args()
    expected = json.load(sys.stdin)
    row, info = _load_task(args.domain, args.task)
    initial = strip_none_values(copy.deepcopy(info.get("initial_state", {})))
    info["assertions"] = [strip_none_values(item) for item in info.get("assertions", [])]
    initial_world_bytes = args.initial_world.read_bytes()
    if hashlib.sha256(initial_world_bytes).hexdigest() != expected.get("initial_world_sha256"):
        raise RuntimeError("initial world snapshot hash did not match the sealed bridge identity")
    WorldState.model_validate_json(initial_world_bytes)
    final_world_bytes = args.final_world.read_bytes()
    final_world_sha256 = hashlib.sha256(final_world_bytes).hexdigest()
    if final_world_sha256 != expected.get("final_world_sha256"):
        raise RuntimeError("final world snapshot hash did not match the sealed bridge score")
    world = WorldState.model_validate_json(final_world_bytes)

    events = _events(args.events)
    score_indexes = [index for index, event in enumerate(events) if event.get("kind") == "score"]
    if len(score_indexes) != 1:
        raise RuntimeError("event ledger must contain exactly one score event")
    score_index = score_indexes[0]
    score_event = events[score_index]
    scorer_state_schema = expected.get("scorer_state_schema", 1)
    if scorer_state_schema != score_event.get("scorer_state_schema", 1):
        raise RuntimeError("event ledger scorer-state schema did not match the sealed bridge score")
    if scorer_state_schema == 2:
        transient_assertion_state = expected.get("transient_assertion_state")
        if not isinstance(transient_assertion_state, dict):
            raise RuntimeError("sealed bridge score omitted transient assertion state")
        if score_event.get("transient_assertion_state") != transient_assertion_state:
            raise RuntimeError("event ledger transient assertion state did not match the sealed bridge score")
        updated_row_keys = transient_assertion_state.get("google_sheets_updated_row_keys")
        if not isinstance(updated_row_keys, list) or not all(isinstance(item, str) for item in updated_row_keys):
            raise RuntimeError("sealed bridge score contained invalid Google Sheets row-write state")
        object.__setattr__(world.google_sheets, "_updated_row_keys", set(updated_row_keys))
    elif scorer_state_schema != 1:
        raise RuntimeError(f"unsupported scorer-state schema: {scorer_state_schema}")
    parsed_world_before_scorer = _canonical_world_bytes(world)
    accepted = [event for event in events[:score_index] if event.get("kind") in {"tool", "tool_error"}]
    replayed_stateful = 0
    replayed_non_stateful = 0
    skipped_non_stateful = 0

    chained_world_sha256 = expected.get("initial_world_sha256")
    for event in accepted:
        tool = event.get("tool")
        succeeded = event.get("kind") == "tool"
        try:
            if tool == "api_fetch":
                if event.get("world_before_sha256") != chained_world_sha256:
                    raise RuntimeError(f"world transition chain mismatch at sequence {event.get('sequence')}")
                chained_world_sha256 = event.get("world_after_sha256")
                replayed_stateful += 1
                continue
            elif tool == "api_search" and succeeded and isinstance(event.get("query"), str) and isinstance(event.get("top_k"), int):
                output = api_search(query=event["query"], top_k=event["top_k"])
                replayed_non_stateful += 1
            else:
                skipped_non_stateful += 1
                continue
        except Exception:
            if succeeded:
                raise RuntimeError(f"successful event failed during replay at sequence {event.get('sequence')}")
            continue
        if not succeeded:
            raise RuntimeError(f"failed event succeeded during replay at sequence {event.get('sequence')}")
        if len(output.encode("utf-8")) != event.get("output_bytes") or _sha256(output) != event.get("output_sha256"):
            raise RuntimeError(f"tool output mismatch at sequence {event.get('sequence')}")

    scoring_state: dict[str, Any] = {"info": info, "world": world, "initial_state": copy.deepcopy(initial)}
    partial = partial_credit(scoring_state)
    strict = task_completed_correctly(scoring_state)
    _assert_scorer_world_stable(parsed_world_before_scorer, world)
    assertions = scoring_state.get("_assertion_results", [])
    attempts = len(accepted)
    succeeded_count = sum(1 for event in accepted if event.get("kind") == "tool")
    failed_count = attempts - succeeded_count
    checks = {
        "partial_credit": partial == expected.get("partial_credit"),
        "task_completed_correctly": strict == expected.get("task_completed_correctly"),
        "assertion_results": assertions == expected.get("assertion_results"),
        "end_state_sha256": final_world_sha256 == expected.get("end_state_sha256"),
        "scorer_world_stable": True,
        "tool_attempts": attempts == expected.get("tool_attempts"),
        "tool_succeeded": succeeded_count == expected.get("tool_succeeded"),
        "tool_failed": failed_count == expected.get("tool_failed"),
        "world_transition_chain": chained_world_sha256 == final_world_sha256,
    }
    if not all(checks.values()):
        failed = [name for name, passed in checks.items() if not passed]
        raise RuntimeError(f"replayed scorer output did not match the sealed bridge score: {','.join(failed)}")
    print(
        json.dumps(
            {
                "schema_version": 1,
                "passed": True,
                "example_id": row.get("example_id"),
                "checks": checks,
                "stateful_calls_verified_by_hash_chain": replayed_stateful,
                "replayed_non_stateful_calls": replayed_non_stateful,
                "skipped_non_stateful_calls": skipped_non_stateful,
            },
            separators=(",", ":"),
        )
    )


if __name__ == "__main__":
    main()
