"""HeavyWorkBench data export and offline grading. Never executes candidate code.

Inspect/Harbor own agent execution; this tool only reads sealed artifacts.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import shutil
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "specs/artifacts/2026-10-29-heavy-workbench"


class ContractError(ValueError):
    def __init__(self, code, detail):
        self.code = code
        super().__init__(f"{code}: {detail}")


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def save(path, value):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def contained(root, relative):
    root = Path(root).resolve()
    target = (root / relative).resolve()
    if not target.is_relative_to(root) or target == root:
        raise ContractError("path_scope", relative)
    return target


def table(path):
    with Path(path).open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def finite_number(value):
    if isinstance(value, bool):
        raise ValueError("boolean is not numeric evidence")
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("numeric evidence must be finite")
    return number


def validate(package=PACKAGE):
    suite = load(package / "suite.json")
    cases = suite["cases"]
    if suite["version"] != "0.1.0-dev" or len(cases) != 10:
        raise ContractError("suite_identity", "expected ten development cases")
    ids = [case["id"] for case in cases]
    if len(set(ids)) != 10:
        raise ContractError("case_identity", "case IDs must be unique")
    for case in cases:
        leaves = case["rubric"]
        if len(leaves) != 20 or sum(x["weight"] for x in leaves) != 100:
            raise ContractError("rubric_weight", case["id"])
        if len({x["id"] for x in leaves}) != len(leaves):
            raise ContractError("leaf_identity", case["id"])
        if len([x for x in leaves if x["mode"] == "objective"]) != 4:
            raise ContractError("objective_count", case["id"])
        for leaf in leaves:
            for key in ("requirement", "evidence", "full", "half", "zero"):
                if not leaf[key].strip():
                    raise ContractError(
                        "rubric_anchor", f"{case['id']}:{leaf['id']}:{key}"
                    )
        for relative in case["inputs"]:
            target = contained(package, relative)
            if not target.is_file() or target.stat().st_size == 0:
                raise ContractError("input_unreadable", relative)
        for leaf in leaves[:4]:
            check = leaf["check"]
            expected = contained(package, check["expected"])
            if not expected.is_file():
                raise ContractError("oracle_unreadable", str(expected))
            rows = table(expected)
            if len(rows) == 0:
                raise ContractError("oracle_empty", str(expected))
            for row in rows:
                for column in check["keys"] + check["columns"]:
                    if column not in row:
                        raise ContractError("oracle_column", column)
    return {
        "version": suite["version"],
        "cases": len(cases),
        "leaves": sum(len(c["rubric"]) for c in cases),
        "status": "definition_valid",
    }


def select(case_id, package=PACKAGE):
    for case in load(package / "suite.json")["cases"]:
        if case["id"] == case_id:
            return case
    raise ContractError("unknown_case", case_id)


def prepare(case_id, destination, package=PACKAGE):
    case = select(case_id, package)
    destination = Path(destination)
    # Export is deliberately explicit and into a fresh directory.
    destination.mkdir(parents=True, exist_ok=False)
    (destination / "TASK.md").write_text(case["prompt"], encoding="utf-8")
    public = {
        key: case[key]
        for key in ("id", "title", "outputs", "budget", "result_contract")
    }
    save(destination / "task.json", public)
    for relative in case["inputs"]:
        source = contained(package, relative)
        target = destination / "inputs" / source.name
        target.parent.mkdir(exist_ok=True)
        shutil.copyfile(source, target)
    return {
        "case": case_id,
        "destination": str(destination.resolve()),
        "input_files": len(case["inputs"]),
        "isolation": "export_only_not_a_sandbox",
    }


def render(package=PACKAGE):
    """Regenerate readable cards from the one versioned definition."""
    for case in load(package / "suite.json")["cases"]:
        body = case["prompt"] + "\n\n## 评分细则（仅评估端；不导出给受测agent）\n\n"
        for leaf in case["rubric"]:
            body += (
                f"### {leaf['id']} · {leaf['weight']}分 · {leaf['mode']} · critical={leaf['critical']}\n\n"
                f"{leaf['requirement']}\n\n- 证据：{leaf['evidence']}\n- 满分：{leaf['full']}\n"
                f"- 半分：{leaf['half']}\n- 零分：{leaf['zero']}\n\n"
            )
        (package / "cases" / f"{case['id']}.md").write_text(body.rstrip() + "\n", encoding="utf-8")
    return {"status": "cards_rendered", "cases": 10}


def compare_table(actual, expected, check):
    """Compare scientific/business records, accepting order and numeric formatting changes."""
    keys, columns = check["keys"], check["columns"]

    def index(rows):
        indexed = {}
        for row in rows:
            key = tuple(row[k] for k in keys)
            if key in indexed:
                raise ValueError("duplicate record identity")
            indexed[key] = row
        return indexed

    got, want = index(actual), index(expected)
    if set(got) != set(want):
        return {
            "passed": False,
            "reason": "record_identity_mismatch",
            "expected_records": len(want),
            "actual_records": len(got),
        }
    mismatches = []
    for key, row in want.items():
        for column in columns:
            a, b = got[key][column], row[column]
            if column in check.get("numeric", []):
                equal = math.isclose(
                    finite_number(a),
                    finite_number(b),
                    rel_tol=check.get("rtol", 1e-7),
                    abs_tol=check.get("atol", 1e-6),
                )
            else:
                equal = a == b
            if not equal:
                mismatches.append({"key": list(key), "column": column})
    return {
        "passed": len(mismatches) == 0,
        "reason": "records_match" if len(mismatches) == 0 else "value_mismatch",
        "checked_records": len(want),
        "mismatches": mismatches[:8],
    }


def verify_plan(case_id, input_dir, artifact, scenario="base"):
    """Independent feasibility arithmetic; accepts any plan meeting the public contract."""
    # This is an input integrity check on fixed business records and public policy,
    # not a source digest or a substitute for candidate behavior verification.
    case = select(case_id)
    try:
        context = load(Path(input_dir) / "context.json")
        contract = case["result_contract"]["plan_contract"]
        if context.get("case") != case_id or context.get("plan_contract") != contract:
            raise ValueError("case identity or public plan contract changed")
        expected = table(PACKAGE / "inputs" / case_id / "records.csv")
        inputs = table(Path(input_dir) / "records.csv")
        if not expected or not inputs:
            raise ValueError("frozen business records must be nonempty")
        fields = set(expected[0])
        if any(set(row) != fields for row in inputs):
            raise ValueError("input business fields changed")
        comparison = compare_table(
            inputs,
            expected,
            {
                "keys": contract["keys"],
                "columns": sorted(fields - set(contract["keys"])),
                "numeric": [],
            },
        )
        if not comparison["passed"]:
            raise ValueError(f"fixed business records changed: {comparison['reason']}")
    except (OSError, KeyError, TypeError, ValueError) as error:
        raise ContractError("input_integrity", f"{case_id}: {error}") from error
    issues, metrics = [], {}

    def number(row, field, integer=False):
        value = finite_number(row[field])
        if integer and value != int(value):
            raise ValueError(f"{field} must be an integer")
        return value

    def indexed(records, keys):
        result = {}
        for row in records:
            key = tuple(row[k] for k in keys)
            if key in result:
                raise ValueError("duplicate plan business identity")
            result[key] = row
        return result

    try:
        rows = table(artifact)
        original, plans = (
            indexed(inputs, contract["keys"]),
            indexed(rows, contract["keys"]),
        )
        if set(original) != set(plans):
            raise ValueError(
                "plan must cover every input business identity exactly once"
            )
        for row in rows:
            for column in contract["columns"]:
                if column not in row:
                    raise ValueError(f"missing plan column {column}")
        if scenario not in contract["scenarios"]:
            raise ValueError("unknown public scenario")
        if case_id == "H06":
            inventories, cost = {}, 0
            for key, raw in sorted(
                original.items(), key=lambda x: (x[0][0], int(x[0][1]))
            ):
                row = plans[key]
                sku, week = key[0], int(key[1])
                regular, expedite, closing = [
                    number(row, c, True)
                    for c in ("regular", "expedite", "closing_inventory")
                ]
                capacity = int(raw["capacity"])
                if (
                    scenario == "stress"
                    and contract["stress_weeks"][0]
                    <= week
                    <= contract["stress_weeks"][1]
                ):
                    capacity = math.floor(capacity * contract["stress_capacity_factor"])
                if min(regular, expedite, closing) < 0 or regular > capacity:
                    issues.append({"key": list(key), "code": "procurement_bounds"})
                expected = (
                    inventories.get(sku, 0) + regular + expedite - int(raw["demand"])
                )
                if closing != expected:
                    issues.append({"key": list(key), "code": "material_balance"})
                inventories[sku] = closing
                cost += (
                    regular * (int(raw["unit_cost"]) + contract["regular_freight"])
                    + expedite * (int(raw["unit_cost"]) + contract["expedite_freight"])
                    + closing * contract["holding_cost"]
                )
            if any(value != 0 for value in inventories.values()):
                issues.append({"code": "terminal_inventory"})
            metrics = {"cost_cny": cost, "terminal_inventory": inventories}
        elif case_id == "H08":
            intervals, cost, finish = {}, 0, 0
            for key, raw in original.items():
                row = plans[key]
                start = number(row, "start", True)
                end = number(row, "finish", True)
                duration = int(raw["duration"]) + (
                    contract["stress_extra_days"]
                    if scenario == "stress" and raw["task"] == contract["stress_task"]
                    else 0
                )
                if start < 0 or end - start != duration:
                    issues.append({"key": list(key), "code": "duration"})
                for predecessor in raw["deps"].split("|"):
                    if (
                        predecessor
                        and number(plans[(predecessor,)], "finish", True) > start
                    ):
                        issues.append({"key": list(key), "code": "precedence"})
                intervals.setdefault(raw["role"], []).append((start, end, key))
                cost += duration * int(raw["daily_cost"])
                finish = max(finish, end)
            for role, slots in intervals.items():
                slots.sort()
                for before, after in zip(slots, slots[1:]):
                    if before[1] > after[0]:
                        issues.append({"role": role, "code": "resource_overlap"})
            if finish > contract["deadline"]:
                issues.append({"code": "deadline"})
            if cost > contract["budget_cny"]:
                issues.append({"code": "budget"})
            metrics = {"cost_cny": cost, "makespan_days": finish}
        elif case_id == "H10":
            soc, capacities, cost = {}, {}, {}
            efficiency = (
                contract["stress_efficiency"]
                if scenario == "efficiency"
                else contract["efficiency"]
            )
            for key, raw in sorted(
                original.items(), key=lambda x: (x[0][0], int(x[0][1]), int(x[0][2]))
            ):
                row = plans[key]
                site = key[0]
                capacity, charge, discharge, closing, grid = [
                    number(row, c)
                    for c in (
                        "capacity_kwh",
                        "charge_kwh",
                        "discharge_kwh",
                        "soc_kwh",
                        "grid_kwh",
                    )
                ]
                if (
                    capacity not in contract["capacities_kwh"]
                    or capacities.get(site, capacity) != capacity
                ):
                    issues.append({"key": list(key), "code": "capacity_identity"})
                capacities[site] = capacity
                if (
                    min(charge, discharge, closing, grid) < -1e-6
                    or closing > capacity + 1e-6
                    or max(charge, discharge) > contract["power_kw"] + 1e-6
                    or min(charge, discharge) > 1e-6
                ):
                    issues.append({"key": list(key), "code": "physical_bounds"})
                if (
                    abs(
                        closing
                        - (
                            soc.get(site, 0)
                            + charge * efficiency
                            - discharge / efficiency
                        )
                    )
                    > 1e-6
                ):
                    issues.append({"key": list(key), "code": "soc_balance"})
                if abs(grid - (float(raw["kwh"]) + charge - discharge)) > 1e-6:
                    issues.append({"key": list(key), "code": "grid_balance"})
                soc[site] = closing
                tariff = float(raw["tariff"]) * (
                    contract["stress_price_factor"] if scenario == "price" else 1
                )
                cost[site] = cost.get(site, 0) + grid * tariff
            if any(abs(value) > 1e-6 for value in soc.values()):
                issues.append({"code": "terminal_soc"})
            metrics = {"grid_cost_cny": cost, "capacities_kwh": capacities}
        else:
            raise ValueError("case has no public plan contract")
    except (OSError, KeyError, TypeError, ValueError) as error:
        issues.append({"code": "plan_contract_error", "detail": str(error)})
    return {
        "case": case_id,
        "scenario": scenario,
        "assessment": "plan_feasibility_only",
        "passed": len(issues) == 0,
        "violations": issues,
        "metrics": metrics,
        "comparable": False,
    }


def objective(case_id, artifact_dir, package=PACKAGE):
    case = select(case_id, package)
    results = []
    for leaf in case["rubric"]:
        if leaf["mode"] != "objective":
            continue
        check = leaf["check"]
        # A damaged evaluator is infrastructure failure, never a candidate business zero.
        try:
            expected = table(contained(package, check["expected"]))
            if not expected:
                raise ValueError("oracle has no business records")
            compare_table(expected, expected, check)
        except (OSError, KeyError, ValueError) as error:
            raise ContractError("oracle_integrity", f"{leaf['id']}: {error}") from error
        try:
            actual = table(contained(artifact_dir, check["artifact"]))
            result = compare_table(actual, expected, check)
        except (OSError, KeyError, ValueError) as error:
            result = {
                "passed": False,
                "reason": "artifact_contract_error",
                "detail": str(error),
            }
        results.append(
            {
                "leaf": leaf["id"],
                "weight": leaf["weight"],
                "earned": leaf["weight"] if result["passed"] else 0,
                "critical": leaf["critical"],
                "artifact": check["artifact"],
                **result,
            }
        )
    return {
        "case": case_id,
        "version": "0.1.0-dev",
        "assessment": "objective_only",
        "points": sum(x["earned"] for x in results),
        "maximum": 20,
        "leaves": results,
        "replay_verified": False,
        "comparable": False,
    }


def evidence(root, item):
    """Validate the cited artifact region, never infer truth from mere presence."""
    path = contained(root, item["path"])
    if not path.is_file():
        raise ContractError("evidence_unreadable", item["path"])
    if path.stat().st_size == 0 or not str(item.get("observation", "")).strip():
        raise ContractError("evidence_observation", item["path"])
    locator = item.get("locator", "")
    if not isinstance(locator, str) or not locator.strip():
        raise ContractError("evidence_locator", item["path"])


def grade(case_id, artifact_dir, reviews, run, package=PACKAGE):
    case = select(case_id, package)
    condition_fields = (
        "system",
        "model",
        "tool_profile",
        "environment",
        "input_revision",
        "budget",
    )
    required = (
        "run_id",
        "case",
        "version",
        *condition_fields,
        "started_at",
        "ended_at",
        "disposition",
    )
    for field in required:
        if field not in run or run[field] in (None, ""):
            raise ContractError("run_field", field)
    if run["case"] != case_id or run["version"] != "0.1.0-dev":
        raise ContractError("run_scope", case_id)
    for key, value in case["budget"].items():
        if (
            key not in {"expert_hours_estimate", "estimate_status"}
            and run["budget"].get(key) != value
        ):
            raise ContractError("run_budget", key)
    dispositions = {
        "completed",
        "agent_failed",
        "budget_exhausted",
        "infra_error",
        "cancelled",
        "integrity_error",
    }
    if run["disposition"] not in dispositions:
        raise ContractError("run_disposition", run["disposition"])
    condition = {k: run[k] for k in condition_fields}
    if run["disposition"] in {"infra_error", "cancelled", "integrity_error"}:
        return {
            "case": case_id,
            "run_id": run["run_id"],
            "version": run["version"],
            "condition": condition,
            "assessment": "unscored",
            "disposition": run["disposition"],
            "score": None,
            "comparable": False,
        }
    if len(reviews) != 2 or len({r["reviewer"] for r in reviews}) != 2:
        raise ContractError(
            "reviewer_identity", "two distinct blind reviewers required"
        )
    for r in reviews:
        if r.get("case") != case_id or r.get("version") != "0.1.0-dev":
            raise ContractError("review_scope", case_id)
        if r.get("run_id") != run.get("run_id"):
            raise ContractError("review_run", case_id)
        if r.get("blind") is not True or r.get("independent") is not True:
            raise ContractError("review_protocol", r["reviewer"])
    automatic = objective(case_id, artifact_dir, package)
    points = automatic["points"]
    disagreements, leaves = [], list(automatic["leaves"])
    for leaf in case["rubric"][4:]:
        marks = []
        for review in reviews:
            entries = review["marks"]
            expected_ids = {x["id"] for x in case["rubric"][4:]}
            if {x["leaf"] for x in entries} != expected_ids or len(entries) != 16:
                raise ContractError("review_coverage", review["reviewer"])
            mark = next(x for x in entries if x["leaf"] == leaf["id"])
            if type(mark["rating"]) is not int or mark["rating"] not in (0, 1, 2):
                raise ContractError("review_rating", leaf["id"])
            if not mark.get("rationale", "").strip() or not mark.get("evidence"):
                raise ContractError("review_reason", leaf["id"])
            for citation in mark["evidence"]:
                evidence(artifact_dir, citation)
            marks.append(mark["rating"])
        if marks[0] != marks[1]:
            disagreements.append(leaf["id"])
        rating = statistics.mean(marks)
        earned = leaf["weight"] * rating / 2
        points += earned
        leaves.append(
            {
                "leaf": leaf["id"],
                "ratings": marks,
                "earned": earned,
                "weight": leaf["weight"],
                "critical": leaf["critical"],
            }
        )
    critical = all(x["earned"] == x["weight"] for x in leaves if x["critical"])
    # Disagreement is visible and prevents declaring adjudicated final acceptance.
    replay = run.get("replay", {})
    replay_attested = replay.get("status") == "verified" and bool(
        replay.get("reviewer")
    )
    if replay_attested:
        for item in replay.get("evidence", []):
            evidence(artifact_dir, item)
        if not replay.get("evidence"):
            raise ContractError("replay_evidence", case_id)
    return {
        "case": case_id,
        "run_id": run["run_id"],
        "version": run["version"],
        "condition": condition,
        "disposition": run["disposition"],
        "assessment": "provisional",
        "score": points,
        "critical_complete": critical,
        "disagreements": disagreements,
        "replay_attested": replay_attested,
        "provisional_qualified": points >= 80
        and critical
        and len(disagreements) == 0
        and replay_attested,
        "comparable": False,
        "leaves": leaves,
        "notice": "Local evidence validation cannot authenticate reviewers or isolation.",
    }


def summarize(reports, package=PACKAGE):
    if not reports:
        raise ContractError("report_empty", "at least one case report required")
    identities = [(r["case"], r["run_id"]) for r in reports]
    if len(set(identities)) != len(identities):
        raise ContractError("duplicate_occurrence", "case/run identity repeated")
    by_case = {}
    unscored = []
    allowed_ids = {c["id"] for c in load(package / "suite.json")["cases"]}
    first_condition = reports[0].get("condition")
    if not isinstance(first_condition, dict) or not first_condition:
        raise ContractError("summary_condition", "run condition required")
    for r in reports:
        if r["case"] not in allowed_ids or r.get("version") != "0.1.0-dev":
            raise ContractError("summary_scope", r["case"])
        if r.get("condition") != first_condition:
            raise ContractError(
                "summary_condition", "mixed systems, models, environments or budgets"
            )
        if r.get("score") is None:
            unscored.append(r["run_id"])
        else:
            try:
                score = finite_number(r["score"])
            except (TypeError, ValueError) as error:
                raise ContractError("summary_score", str(r["score"])) from error
            if not 0 <= score <= 100:
                raise ContractError("summary_score", str(score))
            by_case.setdefault(r["case"], []).append(score)
    means = {key: statistics.mean(value) for key, value in by_case.items()}
    return {
        "version": "0.1.0-dev",
        "condition": first_condition,
        "case_means": means,
        "occurrence_counts": {k: len(v) for k, v in by_case.items()},
        "observed_cases": len(means),
        "required_cases": 10,
        "macro_mean": statistics.mean(means.values()) if len(means) == 10 else None,
        "unscored_occurrences": unscored,
        "comparable": False,
        "assessment": "development_summary",
        "population_claim": "unsupported",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("validate")
    sub.add_parser("render")
    p = sub.add_parser("prepare")
    p.add_argument("case")
    p.add_argument("destination", type=Path)
    p = sub.add_parser("objective")
    p.add_argument("case")
    p.add_argument("artifacts", type=Path)
    p.add_argument("--out", type=Path, required=True)
    p = sub.add_parser("verify-plan")
    p.add_argument("case", choices=("H06", "H08", "H10"))
    p.add_argument("inputs", type=Path)
    p.add_argument("artifact", type=Path)
    p.add_argument("--scenario", default="base")
    p.add_argument("--out", type=Path, required=True)
    p = sub.add_parser("grade")
    p.add_argument("case")
    p.add_argument("artifacts", type=Path)
    p.add_argument("--review", type=Path, action="append", required=True)
    p.add_argument("--run", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    p = sub.add_parser("summarize")
    p.add_argument("reports", type=Path, nargs="+")
    p.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command == "validate":
            result = validate()
        elif args.command == "render":
            result = render()
        elif args.command == "prepare":
            result = prepare(args.case, args.destination)
        elif args.command == "objective":
            result = objective(args.case, args.artifacts)
        elif args.command == "verify-plan":
            result = verify_plan(args.case, args.inputs, args.artifact, args.scenario)
        elif args.command == "grade":
            result = grade(
                args.case,
                args.artifacts,
                [load(p) for p in args.review],
                load(args.run),
            )
        else:
            result = summarize([load(p) for p in args.reports])
        if hasattr(args, "out"):
            save(args.out, result)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (ContractError, OSError, KeyError, ValueError) as error:
        parser.exit(2, f"{error}\n")


if __name__ == "__main__":
    main()
