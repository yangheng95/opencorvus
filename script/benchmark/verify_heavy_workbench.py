"""Run the real export/reference/checker boundary, without any model invocation.

This is a diagnostic checker replay, NOT ten solved end-to-end benchmark tasks.
Only author-owned code is executed. No candidate submission is executed here.
"""

import argparse
import importlib.util
import json
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import heavy_workbench as bench


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    started = datetime.now(timezone.utc).isoformat()
    spec = importlib.util.spec_from_file_location(
        "reference", bench.PACKAGE / "reference_calculations.py"
    )
    reference = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(reference)
    results, plan_results = [], []
    with tempfile.TemporaryDirectory(prefix="heavy-workbench-checker-") as tmp:
        root = Path(tmp)
        for case in bench.load(bench.PACKAGE / "suite.json")["cases"]:
            cid = case["id"]
            exported = root / cid / "public"
            bench.prepare(cid, exported)
            public_rows = bench.table(exported / "inputs/records.csv")
            replay = root / cid / "replayed"
            for name, rows in reference.outputs(cid, public_rows).items():
                reference.write_table(replay / "diagnostics" / f"{name}.csv", rows)
            output = root / cid / "objective.json"
            command = [
                sys.executable,
                str(bench.ROOT / "script/benchmark/heavy_workbench.py"),
                "objective",
                cid,
                str(replay),
                "--out",
                str(output),
            ]
            proc = subprocess.run(command, text=True, capture_output=True, check=False)
            if proc.returncode != 0:
                raise RuntimeError(proc.stderr)
            report = bench.load(output)
            if report["points"] != 20:
                raise RuntimeError(json.dumps(report))
            results.append(
                {
                    "case": cid,
                    "source_rows": len(public_rows),
                    "exit_code": proc.returncode,
                    "points": report["points"],
                    "maximum": 20,
                    "checks": [
                        {k: x[k] for k in ("leaf", "reason", "checked_records")}
                        for x in report["leaves"]
                    ],
                }
            )

        # Execute the provided defective service, rather than accepting its description.
        module_spec = importlib.util.spec_from_file_location(
            "legacy", bench.PACKAGE / "inputs/H05/legacy_service.py"
        )
        legacy = importlib.util.module_from_spec(module_spec)
        module_spec.loader.exec_module(legacy)
        db = root / "incident.sqlite"
        source = bench.PACKAGE / "inputs/H05/records.csv"
        first = legacy.Service(db)
        first_totals = first.replay(source)
        same_totals = first.replay(source)
        first.close()
        second = legacy.Service(db)
        restart_totals = second.replay(source)
        second.close()
        incident = {
            "first": first_totals,
            "same_instance": same_totals,
            "after_restart": restart_totals,
            "expected_restart_relation": "each incorrect tenant total doubles",
            "observed_relation": all(
                restart_totals[k] == v * 2 for k, v in first_totals.items()
            ),
        }
        if not incident["observed_relation"]:
            raise RuntimeError("incident reproduction failed")

        # Independently construct and check a resource-feasible scheduling witness.
        tasks = bench.table(bench.PACKAGE / "inputs/H08/records.csv")
        finish, available, schedule = {}, {}, []
        for task in tasks:
            start = max(
                [finish[p] for p in task["deps"].split("|") if p]
                + [available.get(task["role"], 0)]
            )
            end = start + int(task["duration"])
            schedule.append(
                {
                    "task": task["task"],
                    "role": task["role"],
                    "start": start,
                    "finish": end,
                }
            )
            finish[task["task"]] = end
            available[task["role"]] = end
        violations = []
        indexed = {r["task"]: r for r in schedule}
        for task in tasks:
            for predecessor in task["deps"].split("|"):
                if (
                    predecessor
                    and indexed[predecessor]["finish"] > indexed[task["task"]]["start"]
                ):
                    violations.append(task["task"])
        for role in {r["role"] for r in schedule}:
            intervals = sorted(
                (r["start"], r["finish"]) for r in schedule if r["role"] == role
            )
            for before, after in zip(intervals, intervals[1:]):
                if before[1] > after[0]:
                    violations.append(role)
        witness = {
            "schedule": schedule,
            "makespan": max(finish.values()),
            "constraint_violations": violations,
            "cost_cny": sum(int(r["duration"]) * int(r["daily_cost"]) for r in tasks),
            "dependency_only_lower_bound": 26,
            "engineer_person_day_lower_bound": 38,
        }
        if violations or witness["makespan"] != 38:
            raise RuntimeError("schedule witness violates its contract")
        for cid, scenarios in (
            ("H06", ("base", "stress")),
            ("H08", ("base", "stress")),
            ("H10", ("base", "price", "efficiency")),
        ):
            source = bench.PACKAGE / "inputs" / cid
            for scenario in scenarios:
                path = root / f"{cid}-{scenario}.csv"
                reference.write_table(
                    path,
                    reference.feasible_witness(
                        cid, bench.table(source / "records.csv"), scenario
                    ),
                )
                report = bench.verify_plan(cid, source, path, scenario)
                if not report["passed"]:
                    raise RuntimeError(json.dumps(report))
                plan_results.append(report)

    receipt = {
        "assessment": "diagnostic_reference_checker_replay_only",
        "version": "0.1.0-dev",
        "started_at": started,
        "ended_at": datetime.now(timezone.utc).isoformat(),
        "python": sys.version.split()[0],
        "cases": results,
        "incident_input_reproduction": incident,
        "schedule_feasibility_witness": witness,
        "plan_feasibility_checks": plan_results,
        "model_calls": 0,
        "comparable": False,
        "limits": [
            "No model or expert full task submissions",
            "Reference generator shares author with oracle",
            "Independent small-vector calculations are unit tests, not judge calibration",
            "Isolation and professional validity remain unverified",
        ],
    }
    bench.save(args.out, receipt)
    print(
        json.dumps(
            {
                "receipt": str(args.out),
                "cases": len(results),
                "diagnostic_checks": 40,
                "incident_reproduced": incident["observed_relation"],
                "feasible_schedule_days": witness["makespan"],
                "plan_checks": len(plan_results),
                "assessment": receipt["assessment"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
