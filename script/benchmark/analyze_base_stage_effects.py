#!/usr/bin/env python3
"""Measure immutable AutomationBench calls across real OpenCorvus role boundaries."""

from __future__ import annotations

import argparse
import collections
import json
from pathlib import Path
from typing import Any


def tool_intervals(transcripts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    intervals = []
    for task in transcripts:
        for message in task.get("transcript", []):
            agent = message.get("info", {}).get("agentID") or message.get("info", {}).get("agent")
            for part in message.get("parts", []):
                timing = part.get("state", {}).get("time", {})
                if (part.get("type") == "tool" and part.get("tool") == "bash" and isinstance(agent, str)
                        and isinstance(timing.get("start"), int) and isinstance(timing.get("end"), int)):
                    intervals.append({"agent": agent, "start": timing["start"], "end": timing["end"]})
    return sorted(intervals, key=lambda item: (item["start"], item["end"]))


def assign_event_agents(events: list[dict[str, Any]], intervals: list[dict[str, Any]],
                        tolerance_ms: int = 2_000) -> list[str | None]:
    assigned = []
    for event in events:
        if event.get("kind") not in {"tool", "tool_error"}:
            continue
        started = event.get("start")
        candidates = [] if not isinstance(started, int) else [
            item for item in intervals if item["start"] - tolerance_ms <= started <= item["end"] + tolerance_ms
        ]
        candidates.sort(key=lambda item: (0 if item["start"] <= started <= item["end"] else 1,
                                          abs(started - item["start"])))
        assigned.append(candidates[0]["agent"] if candidates else None)
    return assigned


def phase_boundaries(agents: list[str | None]) -> list[tuple[int, str | None]]:
    return [(index, agent) for index, agent in enumerate(agents)
            if index + 1 == len(agents) or agents[index + 1] != agent]


def operation_key(event: dict[str, Any]) -> str:
    return json.dumps([event.get(field) for field in
                       ["tool", "method", "url", "params", "body", "query", "top_k"]],
                      separators=(",", ":"))


def aggregate_model_calls(rows: list[dict[str, Any]]) -> dict[str, int]:
    calls = collections.Counter()
    for row in rows:
        calls[str(row.get("agent_id", "unattributed"))] += int(row.get("modelCalls", 0))
    return dict(calls)


def analyze_run(directory: Path) -> dict[str, Any]:
    result = json.loads((directory / "result.json").read_text(encoding="utf-8"))
    benchmark = result["benchmark"]
    transcripts = json.loads((directory / "task-transcripts.json").read_text(encoding="utf-8"))
    events = [json.loads(line) for line in
              (directory / "automationbench-events.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
    accepted = [event for event in events if event.get("kind") in {"tool", "tool_error"}]
    agents = assign_event_agents(accepted, tool_intervals(transcripts))
    boundaries = dict(phase_boundaries(agents))
    phases, phase_start = [], 0
    seen_operations, last_mutation_by_url = set(), {}
    duplicated_operations = cross_role_rewrites = mutations_after_tester = 0
    mutations_after_tester_by_agent = collections.Counter()
    first_tester = next((index for index, agent in enumerate(agents) if agent == "base-tester"), None)
    by_agent, mutations_by_agent = collections.Counter(), collections.Counter()
    for index, (event, agent) in enumerate(zip(accepted, agents, strict=True)):
        actor = agent or "unassigned"
        by_agent[actor] += 1
        key = operation_key(event)
        duplicated_operations += key in seen_operations
        seen_operations.add(key)
        mutating = event.get("tool") == "api_fetch" and event.get("method") in {"POST", "PUT", "PATCH", "DELETE"}
        if mutating:
            mutations_by_agent[actor] += 1
            mutations_after_tester += first_tester is not None and index >= first_tester
            if first_tester is not None and index >= first_tester:
                mutations_after_tester_by_agent[actor] += 1
            url = str(event.get("url"))
            previous = last_mutation_by_url.get(url)
            cross_role_rewrites += bool(previous and previous[0] != agent and previous[1] != key)
            last_mutation_by_url[url] = (agent, key)
        if index in boundaries:
            scoped = accepted[phase_start:index + 1]
            phases.append({"phase": len(phases) + 1, "agent": boundaries[index], "events": len(scoped),
                           "mutations": sum(item.get("tool") == "api_fetch" and
                                            item.get("method") in {"POST", "PUT", "PATCH", "DELETE"}
                                            for item in scoped)})
            phase_start = index + 1
    dispatches = sum(part.get("type") == "tool" and part.get("tool") == "dispatch_agent"
                     for task in transcripts for message in task.get("transcript", [])
                     for part in message.get("parts", []))
    model_calls = aggregate_model_calls(result.get("opencorvus", {}).get("tokens_by_agent", []))
    adherence = result.get("opencorvus", {}).get("skill", {}).get("dispatched_coverage", {})
    return {"case_index": benchmark["case_index"], "task": benchmark["task"], "run_id": result["run"]["id"],
            "duration_ms": result["run"]["duration_ms"], "strict": benchmark["metrics"]["task_completed_correctly"],
            "partial": benchmark["metrics"]["partial_credit"], "model_calls": model_calls,
            "api_events": len(accepted), "api_events_by_agent": dict(by_agent),
            "mutations_by_agent": dict(mutations_by_agent), "role_phases": phases,
            "dispatch_calls": dispatches, "duplicated_exact_operations": duplicated_operations,
            "cross_role_endpoint_rewrites": cross_role_rewrites,
            "mutations_after_first_tester": mutations_after_tester,
            "mutations_after_first_tester_by_agent": dict(mutations_after_tester_by_agent),
            "unassigned_events": sum(agent is None for agent in agents),
            "skill_runtime_adherence_passed": adherence.get("runtime_adherence_passed") is True,
            "missing_skill_load_agents": sorted({item.get("agent_id") for item in adherence.get("missing_skill_loads", [])
                                                  if item.get("agent_id")})}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--cases", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    selected = {int(value) for value in args.cases.split(",")}
    rows = []
    for result_path in sorted(args.root.glob("**/result.json")):
        result = json.loads(result_path.read_text(encoding="utf-8"))
        if (result.get("benchmark", {}).get("case_index") in selected
                and result.get("run", {}).get("status") == "scored"):
            rows.append(analyze_run(result_path.parent))
    rows.sort(key=lambda item: item["case_index"])
    model_calls, api_events, mutations = collections.Counter(), collections.Counter(), collections.Counter()
    post_tester_mutations = collections.Counter()
    for row in rows:
        model_calls.update(row["model_calls"]); api_events.update(row["api_events_by_agent"])
        mutations.update(row["mutations_by_agent"])
        post_tester_mutations.update(row["mutations_after_first_tester_by_agent"])
    summary = {"cases": len(rows), "model_calls": sum(model_calls.values()),
               "model_calls_by_agent": dict(model_calls), "api_events": sum(row["api_events"] for row in rows),
               "api_events_by_agent": dict(api_events), "mutations_by_agent": dict(mutations),
               "role_phases": sum(len(row["role_phases"]) for row in rows),
               "dispatch_calls": sum(row["dispatch_calls"] for row in rows),
               "duplicated_exact_operations": sum(row["duplicated_exact_operations"] for row in rows),
               "cross_role_endpoint_rewrites": sum(row["cross_role_endpoint_rewrites"] for row in rows),
               "mutations_after_first_tester": sum(row["mutations_after_first_tester"] for row in rows),
               "mutations_after_first_tester_by_agent": dict(post_tester_mutations),
               "unassigned_events": sum(row["unassigned_events"] for row in rows),
               "skill_runtime_adherence_cases": sum(row["skill_runtime_adherence_passed"] for row in rows)}
    payload = {"schema_version": 1, "analysis": "immutable_role_boundary_overhead", "summary": summary,
               "cases": rows}
    args.output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, separators=(",", ":")))


if __name__ == "__main__":
    main()
