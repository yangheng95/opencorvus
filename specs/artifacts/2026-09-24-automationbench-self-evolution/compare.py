"""Pair independently re-scored ten-case summaries; retain every unavailable result."""

from __future__ import annotations

import argparse
import json
import math
import statistics
from pathlib import Path


def paired_report(manifest: dict, baseline: dict, candidate: dict) -> dict:
    expected = manifest["cases"]
    if len(expected) != 10 or len({case["task"] for case in expected}) != 10:
        raise ValueError("The frozen probe must contain exactly ten distinct cases")
    for field in ("benchmark", "model", "timeout_policy", "execution_settings"):
        if baseline[field] != candidate[field]:
            raise ValueError(f"Paired arms disagree on {field}")
    if baseline["benchmark"] != manifest["benchmark"]:
        raise ValueError("Arms disagree with the frozen benchmark")
    if baseline["model"] != "openai/gpt-5.6-luna":
        raise ValueError("Arms must use the authorized Luna model")

    def index(summary: dict) -> dict:
        rows = summary["cases"]
        by_id = {row["task"]: row for row in rows}
        if len(rows) != 10 or set(by_id) != {case["task"] for case in expected}:
            raise ValueError("Arm membership must equal the complete frozen probe")
        for case in expected:
            row = by_id[case["task"]]
            if any(row[key] != case[key] for key in ("domain", "task", "example_id")):
                raise ValueError("Arm case identity differs from the frozen probe")
            if row["strict"] is None and row["partial"] is None:
                continue
            if row["strict"] not in (0, 1) or not isinstance(
                row["partial"], (int, float)
            ):
                raise ValueError("Scored cases require strict and partial values")
            if not math.isfinite(row["partial"]) or not 0 <= row["partial"] <= 1:
                raise ValueError("Partial score must be finite and in [0, 1]")
            if (
                row["execution"]["status"] != "scored"
                or row["inspect_error"] is not None
            ):
                raise ValueError(
                    "Official scores require a successful scoring disposition"
                )
        return by_id

    before, after = index(baseline), index(candidate)
    pairs = []
    for case in expected:
        left, right = before[case["task"]], after[case["task"]]
        measured = left["strict"] is not None and right["strict"] is not None
        pairs.append(
            {
                **case,
                "baseline_task": left["task_id"],
                "candidate_task": right["task_id"],
                "baseline_strict": left["strict"],
                "candidate_strict": right["strict"],
                "baseline_partial": left["partial"],
                "candidate_partial": right["partial"],
                "strict_delta": right["strict"] - left["strict"] if measured else None,
                "partial_delta": right["partial"] - left["partial"]
                if measured
                else None,
                "baseline_execution": left["execution"],
                "candidate_execution": right["execution"],
                "baseline_error": left["inspect_error"],
                "candidate_error": right["inspect_error"],
            }
        )

    def arm(summary: dict, rows: dict) -> dict:
        measured = [row for row in rows.values() if row["strict"] is not None]
        return {
            "squad_version": summary["squad_version"],
            "scored": len(measured),
            "unavailable": 10 - len(measured),
            "strict_successes": sum(row["strict"] == 1 for row in measured),
            "strict_rate": sum(row["strict"] == 1 for row in measured) / 10
            if len(measured) == 10
            else None,
            "partial_mean": statistics.mean(row["partial"] for row in measured)
            if len(measured) == 10
            else None,
            "completed_tasks": sum(
                row["lifecycle"] == "completed" for row in rows.values()
            ),
            "mean_sample_seconds": summary["mean_sample_seconds"],
            "official_tool_calls": summary["official_tool_calls"],
            "reported_usage": summary["reported_usage"],
        }

    base, cand = arm(baseline, before), arm(candidate, after)
    available = [pair for pair in pairs if pair["strict_delta"] is not None]
    complete = len(available) == 10
    strict_delta = cand["strict_rate"] - base["strict_rate"] if complete else None
    partial_delta = cand["partial_mean"] - base["partial_mean"] if complete else None
    return {
        "benchmark": manifest["benchmark"],
        "model": baseline["model"],
        "fixed_denominator": 10,
        "paired_measured": len(available),
        "baseline": base,
        "candidate": cand,
        "strict_rate_delta": strict_delta,
        "partial_mean_delta": partial_delta,
        "strict_win_tie_loss": {
            "win": sum(pair["strict_delta"] > 0 for pair in available),
            "tie": sum(pair["strict_delta"] == 0 for pair in available),
            "loss": sum(pair["strict_delta"] < 0 for pair in available),
        },
        "verdict": "inconclusive"
        if not complete
        else (
            "improved"
            if strict_delta > 0 and partial_delta >= 0
            else "criterion_not_met"
        ),
        "limitations": [
            "Ten development cases; feedback is visible to the candidate author.",
            "This measures probe improvement, not held-out generalization or statistical significance.",
            "Reported runtime usage is not a verified monetary price.",
            "Metric comparison grants no installation or promotion authority.",
        ],
        "cases": pairs,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    for name in ("manifest", "baseline", "candidate", "output"):
        parser.add_argument(f"--{name}", type=Path, required=True)
    args = parser.parse_args()
    read = lambda path: json.loads(path.read_text(encoding="utf-8"))
    result = paired_report(
        read(args.manifest), read(args.baseline), read(args.candidate)
    )
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in result.items() if key != "cases"}))


if __name__ == "__main__":
    main()
