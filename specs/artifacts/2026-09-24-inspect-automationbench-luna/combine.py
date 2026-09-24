"""Combine explicitly cancelled pilot slots with their single recorded recovery attempt."""

from __future__ import annotations

import collections
import json
import statistics
from pathlib import Path

root = Path(__file__).resolve().parent
first = json.loads((root / "pilot-first-summary.json").read_text(encoding="utf-8"))
recovery = json.loads((root / "recovery-summary.json").read_text(encoding="utf-8"))
manifest = json.loads((root / "pilot-manifest.json").read_text(encoding="utf-8"))
for field in ("model", "squad_version", "benchmark", "timeout_policy"):
    if first[field] != recovery[field]:
        raise ValueError(f"Measurement configuration differs: {field}")
by_first = {row["task"]: row for row in first["cases"]}
by_recovery = {row["task"]: row for row in recovery["cases"]}
cancelled = {
    row["task"]
    for row in first["cases"]
    if row["lifecycle"] == "cancelled" and row["strict"] is None
}
if set(by_recovery) != cancelled:
    raise ValueError(
        "Recovery must cover exactly the explicitly cancelled/unscored slots"
    )
if set(by_first) != {row["task"] for row in manifest["cases"]}:
    raise ValueError("Original cohort membership changed")
rows = []
for case in manifest["cases"]:
    original = by_first[case["task"]]
    selected = by_recovery[case["task"]] if case["task"] in cancelled else original
    if selected["example_id"] != case["example_id"] or selected["strict"] is None:
        raise ValueError(
            "Every completed measurement must match the frozen case and have an official score"
        )
    attempts = [original, selected] if case["task"] in cancelled else [original]
    rows.append(
        {
            **selected,
            "measurement_attempt": "recovery" if case["task"] in cancelled else "first",
            "all_attempt_seconds": sum(row["sample_seconds"] for row in attempts),
            "all_attempt_official_calls": sum(
                row["official_tool_calls"] for row in attempts
            ),
            "attempts": [
                {
                    key: row[key]
                    for key in (
                        "task_id",
                        "lifecycle",
                        "strict",
                        "partial",
                        "sample_seconds",
                        "official_tool_calls",
                        "runtime_counts",
                        "reported_usage",
                    )
                }
                for row in attempts
            ],
        }
    )
audits = [
    json.loads((root / name).read_text(encoding="utf-8"))
    for name in ("provider-first.json", "provider-recovery.json")
]
requests = [request for audit in audits for request in audit["requests"]]
if any(
    request["model"] != "gpt-5.6-luna" or request["streaming"] is not True
    for request in requests
):
    raise ValueError(
        "Actual Provider model/streaming evidence differs from the authorized setup"
    )
result = {
    "measurement_design": "operator-interrupted pilot with transparent recovery; not an uninterrupted first-pass estimate",
    "model": first["model"],
    "squad_version": first["squad_version"],
    "benchmark": first["benchmark"],
    "original_first_attempt": {
        key: value for key, value in first.items() if key not in ("cases", "notes")
    },
    "completed_measurement": {
        "cases": len(rows),
        "officially_scored": len(rows),
        "strict_successes": sum(row["strict"] == 1 for row in rows),
        "strict_success_rate": statistics.mean(row["strict"] for row in rows),
        "mean_partial": statistics.mean(row["partial"] for row in rows),
        "completed_tasks": sum(row["lifecycle"] == "completed" for row in rows),
        "mean_seconds_measured_attempt": statistics.mean(
            row["sample_seconds"] for row in rows
        ),
        "median_seconds_measured_attempt": statistics.median(
            row["sample_seconds"] for row in rows
        ),
        "max_seconds_measured_attempt": max(row["sample_seconds"] for row in rows),
        "mean_seconds_all_attempts_per_case": statistics.mean(
            row["all_attempt_seconds"] for row in rows
        ),
        "official_calls_measured_attempts": sum(
            row["official_tool_calls"] for row in rows
        ),
        "official_calls_all_attempts": sum(
            row["all_attempt_official_calls"] for row in rows
        ),
    },
    "total_experiment_provider_requests_including_preflight_calibration_background_and_cancelled_attempts": len(
        requests
    ),
    "provider_response_statuses": dict(
        collections.Counter(
            str(request.get("status", "unobserved")) for request in requests
        )
    ),
    "limitations": [
        "Six domain-stratified exploratory cases are not a population capability estimate or leaderboard result.",
        "Three first-attempt slots were operator-cancelled due to insufficient host budget; their scores remain unscored.",
        "Recovery selects only those slots; all original scored outcomes are retained, without choosing better scores.",
        "Calibration and pilot use different cases, so their score difference is not a paired improvement estimate.",
        "Timing reflects a shared development host; interrupted work is included separately.",
        "Reported token usage can omit in-flight usage from interrupted streams; zero subscription cost fields are not verified pricing.",
    ],
    "cases": rows,
}
(root / "pilot-summary.json").write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps(result["completed_measurement"], ensure_ascii=True))
