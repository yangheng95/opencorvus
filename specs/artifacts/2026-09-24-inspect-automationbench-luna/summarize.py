"""Summarize one frozen Inspect cohort without replacing failures or selecting retries."""

from __future__ import annotations

import argparse
import collections
import json
import statistics
from pathlib import Path

from inspect_ai.log import read_eval_log
from opencorvus_inspect.automationbench.world import official_case, rescore

parser = argparse.ArgumentParser()
parser.add_argument("--log", type=Path, required=True)
parser.add_argument("--observation", type=Path, required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
log = read_eval_log(args.log)
if log.status != "success":
    raise ValueError(f"Cohort has not finished: {log.status}")
metadata = log.eval.metadata
assert metadata is not None
cases = metadata["cases"]
samples = {str(sample.id): sample for sample in log.samples or []}
if set(samples) != {case["task"] for case in cases}:
    raise ValueError("Frozen cohort membership differs from recorded samples")
observations = json.loads(args.observation.read_text(encoding="utf-8"))
by_task = {task["task_id"]: task for task in observations["tasks"]}
rows = []
for case in cases:
    sample = samples[case["task"]]
    data = sample.metadata or {}
    result = data.get("opencorvus_result", {})
    receipt = (
        result or data.get("opencorvus_observation", {}).get("accepted_task") or {}
    )
    task_id = receipt.get("task_id")
    task = by_task.get(task_id)
    score = data.get("automationbench_score")
    if score is not None:
        restored = rescore(
            official_case(case["task"], case["example_id"]),
            data["automationbench_snapshot"],
            len(data["automationbench_events"]),
        )
        if restored != score:
            raise ValueError(f"Official re-score mismatch: {case['task']}")
    sessions = []
    if task:
        for session in task["sessions"]:
            role_counts: collections.Counter[str] = collections.Counter()
            models: set[str] = set()
            agents: set[str] = set()
            final = []
            for message in session["messages"]:
                info = message["info"]
                if info["role"] == "assistant":
                    models.add(f"{info['providerID']}/{info['modelID']}")
                    if info.get("agent"):
                        agents.add(info["agent"])
                for part in message["parts"]:
                    if part["type"] == "tool":
                        role_counts[part["tool"]] += 1
                    elif part["type"] == "text":
                        final.append({"message_id": info["id"], "text": part["text"]})
            if models and models != {metadata["system"]["model"]}:
                raise ValueError(f"Unexpected model in Task {task_id}: {models}")
            sessions.append(
                {
                    "session_id": session["id"],
                    "kind": session["kind"],
                    "agents": sorted(agents),
                    "models": sorted(models),
                    "tools": dict(role_counts),
                    "last_text": final[-1] if final else None,
                }
            )
    rows.append(
        {
            **case,
            "task_id": task_id,
            "epoch": sample.epoch,
            "lifecycle": result.get("lifecycle_status"),
            "inspect_error": sample.error.message if sample.error else None,
            "execution": data.get("automationbench_execution"),
            "strict": score["strict"] if score else None,
            "partial": score["partial"] if score else None,
            "official_assertions": score["assertion_results"] if score else None,
            "official_tool_calls": len(data.get("automationbench_events", [])),
            "sample_seconds": sample.total_time,
            "task_seconds": task["elapsed_seconds"] if task else None,
            "reported_usage": task["tokens"] if task else None,
            "runtime_counts": task["counts"] if task else None,
            "package_binding": task["task"].get("packageRevisionBinding")
            if task
            else None,
            "terminal_reason": task["task"].get("error") if task else None,
            "sessions": sessions,
        }
    )
scored = [row for row in rows if row["strict"] is not None]
successes = sum(row["strict"] == 1 for row in rows)
n = len(rows)
summary = {
    "scope": "preliminary co-located API benchmark; not leaderboard-comparable",
    "model": metadata["system"]["model"],
    "squad_version": metadata["squad_version"],
    "benchmark": metadata["benchmark"],
    "timeout_policy": metadata["system"]["timeout_policy"],
    "fixed_denominator": n,
    "scored": len(scored),
    "unscored": n - len(scored),
    "cancelled": sum(row["lifecycle"] == "cancelled" for row in rows),
    "strict_successes": successes,
    "strict_success_rate_fixed_denominator": successes / n,
    "mean_partial_scored": statistics.mean(row["partial"] for row in scored)
    if scored
    else None,
    "completed_tasks": sum(row["lifecycle"] == "completed" for row in rows),
    "inspect_errors": sum(row["inspect_error"] is not None for row in rows),
    "mean_sample_seconds": statistics.mean(row["sample_seconds"] for row in rows),
    "median_sample_seconds": statistics.median(row["sample_seconds"] for row in rows),
    "max_sample_seconds": max(row["sample_seconds"] for row in rows),
    "official_tool_calls": sum(row["official_tool_calls"] for row in rows),
    "reported_usage": dict(
        sum(
            (collections.Counter(row["reported_usage"] or {}) for row in rows),
            collections.Counter(),
        )
    ),
    "notes": [
        "Original strict and partial rubric recomputed from every scored sample snapshot.",
        "Task completion is separate from official business success.",
        "With unscored samples, the fixed-denominator rate is known-success coverage, not fully measured success.",
        "Provider request audit includes preflight and background work; per-Task usage is canonical reported usage.",
        "No monetary price inferred from subscription-backed zero cost fields.",
        "Different calibration and pilot cases cannot establish a paired improvement estimate.",
    ],
    "cases": rows,
}
args.output.write_text(
    json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(
    json.dumps(
        {key: value for key, value in summary.items() if key not in {"cases", "notes"}},
        ensure_ascii=True,
    )
)
