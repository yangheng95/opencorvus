"""Assess complete numeric Group2 deliveries and their economic quality; scientific review remains separate."""
import argparse
from collections import Counter, defaultdict
import csv
import datetime
from fractions import Fraction
import json
import math
from pathlib import Path

from export_operational_plan import evaluate, close
from verify_original_mps import read_original_model, verify_linear_model, numerical_tolerance
from verify_economic_bounds import lower_bound, exact_plan, economic_measurement


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def file_in(root, relative):
    if not isinstance(relative, str) or Path(relative).is_absolute():
        raise ValueError("delivery_relative_layout_path")
    p = (root / relative).resolve()
    if not p.is_relative_to(root.resolve()):
        raise ValueError("delivery_layout_scope")
    return p


def integer(text):
    value = Fraction(text)
    if value.denominator != 1:
        raise ValueError("delivery_integer_index")
    return int(value)


INTEGER_COLUMNS = {"vessel_class", "from_port", "from_time_index", "to_port", "to_time_index",
                   "vessel_count", "inventory_service_port", "inventory_service_time_index", "port", "time_index"}
COST_COMPONENTS = {"initial_source", "waiting", "loaded_voyage", "empty_return", "terminal_exit",
                   "lost_production", "stockout", "original_objective_constant"}


def cell(actual, expected, contract, *, integral=False, reference_scale=None):
    if integral and expected != "":
        if integer(actual) != expected:
            raise ValueError("delivery_integer_cell:" + contract)
        return
    if type(expected) in {int, float}:
        value = float(actual)
        if not math.isfinite(value):
            raise ValueError("delivery_finite_numeric_cell:" + contract)
        close(value, expected, "delivery_numeric_cell:" + contract, reference_scale=reference_scale)
    elif actual != str(expected):
        raise ValueError("delivery_semantic_cell:" + contract)


def rows(path):
    with path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames is None or len(reader.fieldnames) != len(set(reader.fieldnames)):
            raise ValueError("delivery_unique_csv_columns")
        result = list(reader)
    if any(None in row or any(value is None for value in row.values()) for row in result):
        raise ValueError("delivery_csv_record_width")
    return result


def table(actual, expected, fields, numerical_keys=False):
    def key(row):
        return tuple(integer(str(row[f])) if numerical_keys else str(row[f]) for f in fields)
    indexed = {}
    for row in actual:
        k = key(row)
        if k in indexed:
            raise ValueError("delivery_unique_row_key:" + repr(k))
        indexed[k] = row
    wanted = {key(row): row for row in expected}
    if set(indexed) != set(wanted):
        raise ValueError("delivery_complete_row_coverage:" + repr(fields))
    for k, target in wanted.items():
        source = indexed[k]
        if not set(target).issubset(source):
            raise ValueError("delivery_required_semantic_columns:" + repr(fields))
        for column, expected_value in target.items():
            scale = target["signed_production_consumption"] if column == "inventory_residual" else None
            cell(source[column], expected_value, str(k) + ":" + column,
                 integral=column in INTEGER_COLUMNS, reference_scale=scale)
    return len(actual)


def cost_table(actual, expected):
    wanted = {row["component"]: row["original_objective_contribution"] for row in expected}
    seen = set()
    for row in actual:
        if not {"component", "original_objective_contribution"}.issubset(row):
            raise ValueError("delivery_economic_columns")
        key = row["component"]
        if key not in COST_COMPONENTS or key in seen:
            raise ValueError("delivery_unique_economic_component")
        seen.add(key)
        cell(row["original_objective_contribution"], wanted.get(key, 0.0), "cost:" + key)
    if any(key not in seen and abs(value) > numerical_tolerance(value) for key, value in wanted.items()):
        raise ValueError("delivery_complete_nonzero_economic_components")
    return len(actual)


def paths(actual, arc_rows, fleet):
    arcs = {row["original_variable"]: row for row in arc_rows}
    groups, used = defaultdict(list), Counter()
    fields = ["vessel_class", "kind", "from_port", "from_time_index", "to_port", "to_time_index"]
    for row in actual:
        if not {"anonymous_path_id", "step", "original_variable", *fields}.issubset(row):
            raise ValueError("delivery_path_semantic_columns")
        arc = arcs.get(row["original_variable"])
        if arc is None:
            raise ValueError("delivery_path_positive_declared_arc")
        for name in fields:
            cell(row[name], arc[name], "path:" + name, integral=name != "kind")
        groups[row["anonymous_path_id"]].append(row)
        used[row["original_variable"]] += 1
    if len(groups) != fleet or "" in groups:
        raise ValueError("delivery_path_fleet_coverage")
    for name, group in groups.items():
        group.sort(key=lambda row: integer(row["step"]))
        steps = [integer(row["step"]) for row in group]
        if steps != list(range(steps[0], steps[0] + len(group))):
            raise ValueError("delivery_path_contiguous_steps:" + name)
        if group[0]["kind"] != "initial_source" or group[-1]["kind"] != "terminal_exit":
            raise ValueError("delivery_path_source_to_exit:" + name)
        for previous, following in zip(group, group[1:]):
            if (integer(previous["vessel_class"]), integer(previous["to_port"]), integer(previous["to_time_index"])) != (
                integer(following["vessel_class"]), integer(following["from_port"]), integer(following["from_time_index"])):
                raise ValueError("delivery_path_flow_continuity:" + name)
    if used != Counter({v: row["vessel_count"] for v, row in arcs.items()}):
        raise ValueError("delivery_path_complete_arc_multiset")
    return {"paths": len(groups), "arc_units": sum(used.values())}


def assess(a):
    result = {"at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "model": str(a.model),
              "raw_archive": str(a.raw_archive), "instance": a.instance, "delivery": str(a.delivery),
              "layout": None, "mathematical_check": None, "engineering_status": "pending",
              "operating_check": None, "economic_measurement": None,
              "scientific_review": "unreviewed", "total_score": None,
              "heavy_benchmark_qualified": False, "subject_role": a.role}
    try:
        parsed = read_original_model(a.model)
        if not a.raw_archive.is_file():
            raise ValueError("assigned_raw_archive_unavailable")
        lo = lower_bound(a.model, read(a.lower_certificate))
        hi = exact_plan(a.model, read(a.upper_values))
    except (ValueError, KeyError, TypeError, OSError) as error:
        result.update(engineering_status="facility_invalid", error="assigned_model_or_reference:"+str(error))
        return result
    try:
        layout = read(a.layout)
        if set(layout) != {"values", "reported_objective", "arcs", "paths", "ledger", "costs"}:
            raise ValueError("delivery_layout_semantic_slots")
        result["layout"] = layout
        values_path = file_in(a.delivery, layout["values"])
        declaration = layout["reported_objective"]
        if not isinstance(declaration, dict) or set(declaration) != {"file", "key"}:
            raise ValueError("objective_declaration_file_and_explicit_key")
        objective = read(file_in(a.delivery, declaration["file"]))
        if declaration["key"] is not None:
            if not isinstance(declaration["key"], str):
                raise ValueError("objective_declaration_json_key")
            objective = objective[declaration["key"]]
        check = verify_linear_model(parsed, read(values_path), objective)
        result["mathematical_check"] = check
    except (ValueError, KeyError, TypeError, OSError) as error:
        result.update(engineering_status="invalid_delivery", error="numeric_delivery_declaration:"+str(error))
        return result
    if not check["feasible"] or check["objective_consistent"] is not True:
        result.update(engineering_status="invalid_delivery", error="submitted_model_or_objective_contract")
        return result
    # Reuse the single current raw/operating calculation; no duplicate model or export run.
    a.original_mps, a.values, a.reported_objective = a.model, values_path, objective
    a.computation_status, a.computation_scope, a.original_model_bound = "declared_closed_delivery", "original_model", None
    try:
        closure, expected = evaluate(a)
    except (ValueError, KeyError, TypeError, OSError) as error:
        result.update(engineering_status="facility_invalid", error="assigned_raw_model_interpretation:"+str(error))
        return result
    try:
        counts = {"arcs": table(rows(file_in(a.delivery, layout["arcs"])), expected["arcs"], ["original_variable"]),
                  "ledger": table(rows(file_in(a.delivery, layout["ledger"])), expected["ledger"], ["port", "time_index"], True),
                  "costs": cost_table(rows(file_in(a.delivery, layout["costs"])), expected["costs"])}
        counts["path_coverage"] = paths(rows(file_in(a.delivery, layout["paths"])), expected["arcs"], closure["anonymous_paths"])
        result["operating_check"] = {"status": "valid", "counts": counts,
                                     "max_inventory_residual": closure["max_inventory_residual"]}
    except (ValueError, KeyError, OSError) as error:
        result.update(engineering_status="invalid_delivery", error="operating_delivery:" + str(error))
        return result
    result.update(engineering_status="numeric_delivery_valid_science_unreviewed",
                  bound_checks={"lower": lo, "upper": hi},
                  economic_measurement=economic_measurement(check["independent_objective"], lo, hi))
    return result


def main():
    p = argparse.ArgumentParser(description=__doc__)
    for name in ["model", "raw-archive", "delivery", "layout", "lower-certificate", "upper-values", "out"]:
        p.add_argument("--" + name, type=Path, required=True)
    p.add_argument("--instance", required=True)
    p.add_argument("--role", choices=["author_reference", "error_control", "candidate"], required=True)
    a = p.parse_args()
    result = assess(a)
    a.out.write_text(json.dumps(result, indent=2, allow_nan=False)+'\n', encoding="utf-8")
    print(json.dumps({k: result[k] for k in ["engineering_status", "total_score", "error"] if k in result}), flush=True)
    raise SystemExit(0 if result["engineering_status"] == "numeric_delivery_valid_science_unreviewed" else 3 if result["engineering_status"] == "facility_invalid" else 4)


if __name__ == "__main__":
    main()
