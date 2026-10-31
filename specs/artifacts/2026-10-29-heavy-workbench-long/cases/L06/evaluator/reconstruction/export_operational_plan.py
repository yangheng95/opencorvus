"""Export one closed original Group2 plan as operational ledgers; perform no optimization."""
import argparse
from collections import Counter, defaultdict
import csv
import datetime
import json
import math
import os
from pathlib import Path
import re
import sys
import traceback
import zipfile

from verify_original_mps import read_original_model, verify, numerical_tolerance


ARC = re.compile(r"x_\((-?\d+),(-?\d+)\),\((-?\d+),(-?\d+)\),(\d+),Term")
INV = re.compile(r"invBalanceRegion_\((\d+),(\d+)\)")


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def write(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def close(actual, expected, contract, *, reference_scale=None):
    if abs(actual - expected) > numerical_tolerance(expected if reference_scale is None else reference_scale):
        raise ValueError(f"{contract}:actual={actual!r},expected={expected!r}")


def fields(text):
    result = {}
    for line in text.splitlines():
        pieces = line.split()
        if pieces:
            result[pieces[0]] = pieces[1:]
    return result


def records(text):
    current, result = [], []
    for line in text.splitlines():
        if line.split()[:1] == ["name"] and current:
            result.append(fields("\n".join(current)))
            current = []
        current.append(line)
    if current:
        result.append(fields("\n".join(current)))
    return result


def number(record, name):
    values = record[name]
    if len(values) != 1:
        raise ValueError(f"raw_scalar_field:{name}")
    return float(values[0])


def raw_data(archive, instance):
    prefix = f"Group2_data_format_only_files/{instance}/"
    def text(name):
        return archive.read(prefix + name).decode("utf-8")
    metadata = fields(text("metadata.txt"))
    ports = records(text("loading_port_data.txt")) + records(text("discharge_port_data.txt"))
    classes = records(text("vessel_class_data.txt"))
    vessels = records(text("vessel_data.txt"))
    ports = {int(number(p, "index")): p for p in ports}
    classes = {int(number(p, "index")): p for p in classes}
    travel = {}
    lines = [x.strip() for x in text("travelTimes.txt").splitlines() if x.strip()]
    if lines[0] != "----- FullTravelTimeMatrixForClass -----":
        raise ValueError("raw_travel_matrix_header")
    cursor = 1
    for _ in range(len(classes)):
        class_name = lines[cursor]
        class_ids = [i for i, c in classes.items() if c["name"] == [class_name]]
        if len(class_ids) != 1:
            raise ValueError("raw_travel_class_identity")
        header = [int(x) for x in lines[cursor + 1].split()]
        if set(header) != set(ports):
            raise ValueError("raw_travel_port_identity")
        for line in lines[cursor + 2:cursor + 2 + len(ports)]:
            row = [int(x) for x in line.split()]
            if len(row) != len(header) + 1:
                raise ValueError("raw_travel_matrix_width")
            for j, value in zip(header, row[1:]):
                travel[class_ids[0], row[0], j] = value
        cursor += 2 + len(ports)
    expected_travel = {(c, i, j) for c in classes for i in ports for j in ports}
    if set(travel) != expected_travel:
        raise ValueError("raw_travel_matrix_coverage")
    return metadata, ports, classes, vessels, travel


def save_csv(path, rows):
    if not rows:
        raise ValueError(f"operational_export_empty:{path.name}")
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def evaluate(args):
    mps = args.original_mps.resolve()
    values = json.loads(args.values.read_text(encoding="utf-8"))
    check = verify(mps, values, args.reported_objective)
    if not check["feasible"] or check["objective_consistent"] is False:
        raise ValueError("closed_plan_fails_original_mathematical_model")
    row_types, coefficients, rhs, bounds, integers, objective = read_original_model(mps)
    objective_coefficients = dict(coefficients[objective])
    with zipfile.ZipFile(args.raw_archive) as archive:
        metadata, ports, classes, vessels, travel = raw_data(archive, args.instance)
    signs = {i: 1 if p["type"] == ["Loading"] else -1 for i, p in ports.items()}
    if any(p["type"] not in [["Loading"], ["Discharge"]] for p in ports.values()):
        raise ValueError("raw_port_role")
    inventory_rows = {}
    for name in row_types:
        match = INV.fullmatch(name)
        if match:
            inventory_rows[tuple(map(int, match.groups()))] = name
    periods = 1 + max(t for j, t in inventory_rows)
    if set(inventory_rows) != {(j, t) for j in ports for t in range(periods)}:
        raise ValueError("original_port_period_coverage")
    if int(number(metadata, "numPeriods")) < periods:
        raise ValueError("raw_prefix_shorter_than_original_model")
    port_names = {p["name"][0]: i for i, p in ports.items()}
    initial_fleet = Counter((int(number(v, "vesselClass")), port_names[v["initialPort"][0]],
                             int(number(v, "firstTimeAvailable"))) for v in vessels)
    arc_rows, arcs = [], {}
    costs = defaultdict(list)
    source_flow = Counter()
    for variable in bounds:
        if not variable.startswith("x_"):
            continue
        match = ARC.fullmatch(variable)
        if match is None:
            raise ValueError(f"unmapped_original_group2_arc:{variable}")
        i, t, j, u, c = map(int, match.groups())
        if variable not in integers or c not in classes:
            raise ValueError("original_arc_class_or_integer_type")
        capacity = number(classes[c], "capacity")
        if i < 0:
            kind = "initial_source"
            close(objective_coefficients.get(variable, 0), number(ports[j], "fixedPortFee"),
                  "raw_original_initial_port_fee")
            if values[variable] > 1e-6:
                source_flow[c, j, u] += round(values[variable])
        elif j < 0:
            kind = "terminal_exit"
            close(objective_coefficients.get(variable, 0),
                  -(periods - 1 - t) * number(metadata, "perPeriodRewardForFinishingEarly"),
                  "terminal_exit_reward")
        elif i == j:
            kind = "waiting"
            if u != t + 1:
                raise ValueError("original_wait_time_step")
            close(objective_coefficients.get(variable, 0), 0, "waiting_cost")
        else:
            kind = "loaded_voyage" if signs[i] == 1 else "empty_return"
            if signs[i] == signs[j] or u - t != travel[c, i, j]:
                raise ValueError("raw_original_voyage_role_or_time")
            distance = math.hypot(number(ports[i], "x_coordinate") - number(ports[j], "x_coordinate"),
                                  number(ports[i], "y_coordinate") - number(ports[j], "y_coordinate"))
            multiplier = 1 if signs[i] == 1 else 1 - number(classes[c], "discountTravelingEmpty")
            derived_cost = (distance * number(classes[c], "travelCostAsTermPerKm") * multiplier
                            + number(ports[j], "fixedPortFee"))
            close(objective_coefficients.get(variable, 0), derived_cost, "raw_original_travel_cost")
        unit_cost = objective_coefficients.get(variable, 0)
        arcs[variable] = (i, t, j, u, c, kind, capacity)
        if values[variable] > 1e-6:
            close(values[variable], round(values[variable]), "integer_arc_flow")
            count = round(values[variable])
            arc_rows.append({"original_variable": variable, "vessel_class": c, "kind": kind,
                             "from_port": i, "from_time_index": t, "to_port": j,
                             "to_time_index": u, "vessel_count": count, "class_capacity": capacity,
                             "original_cost_per_vessel": unit_cost, "cost_contribution": unit_cost * count})
            costs[kind].append(unit_cost * count)
    if source_flow != initial_fleet:
        raise ValueError("raw_original_initial_fleet_multiset")
    ledger, cargo_by_arc = [], defaultdict(list)
    for j, port in sorted(ports.items()):
        sign = signs[j]
        rates = list(map(float, port["production" if sign == 1 else "consumption"]))
        close(values[f"supplyAtNode_({j},0)"], number(port, "initialInventory"), "raw_initial_inventory")
        for t in range(periods):
            before = f"supplyAtNode_({j},{t})"
            after = f"supplyAtNode_({j},{t + 1})" if t + 1 < periods else f"endingSupplyInRegion_{j}"
            alpha = f"alphaSlack_({j},{t})"
            row = inventory_rows[j, t]
            terms = dict(coefficients[row])
            required = {before: -1.0, after: 1.0, alpha: float(sign)}
            for variable, coefficient in required.items():
                close(terms.pop(variable), coefficient, "original_inventory_named_term")
            close(rhs.get(row, 0), sign * rates[t], "raw_original_production_consumption_prefix")
            close(bounds[after][0], 0, "original_inventory_lower_bound")
            close(bounds[after][1], number(port, "capacity"), "raw_original_inventory_capacity")
            berth_name = f"berthLimit_({j},{t})"
            berth_terms = dict(coefficients[berth_name])
            if set(berth_terms) != set(terms):
                raise ValueError("inventory_and_berth_service_arc_identity")
            close(rhs[berth_name], number(port, "numBerths"), "raw_original_berth_limit")
            for variable, coefficient in terms.items():
                i, t0, to, t1, c, kind, capacity = arcs[variable]
                if (i, t0) != (j, t) or kind not in {"loaded_voyage", "empty_return", "terminal_exit"}:
                    raise ValueError("original_inventory_service_arc_semantics")
                close(coefficient, sign * capacity, "raw_original_service_capacity")
                close(berth_terms[variable], 1, "original_one_berth_per_service")
                cargo_by_arc[variable].append({"port": j, "time_index": t,
                                                "signed_inventory_effect_per_vessel": -coefficient})
            cargo = -math.fsum(a * values[v] for v, a in terms.items())
            alpha_cost = objective_coefficients.get(alpha, 0)
            close(alpha_cost, number(metadata, "spotMarketPricePerUnit")
                  * number(metadata, "spotMarketDiscountFactor") ** t, "raw_original_alpha_penalty")
            residual = values[after] - (values[before] + sign * rates[t] + cargo - sign * values[alpha])
            close(residual, 0, "operational_inventory_closure", reference_scale=rhs.get(row, 0))
            service = math.fsum(values[v] for v in berth_terms)
            if service > number(port, "numBerths") + 1e-6:
                raise ValueError("operational_berth_capacity")
            costs["lost_production" if sign == 1 else "stockout"].append(alpha_cost * values[alpha])
            ledger.append({"port": j, "port_name": port["name"][0], "role": port["type"][0],
                           "time_index": t, "stock_before": values[before],
                           "signed_production_consumption": sign * rates[t],
                           "signed_vessel_service_inventory_effect": cargo,
                           "alpha_loss_or_shortfall": values[alpha], "signed_alpha_effect": -sign * values[alpha],
                           "stock_after": values[after], "inventory_residual": residual,
                           "berths_used": service, "berths_available": number(port, "numBerths"),
                           "original_alpha_unit_penalty": alpha_cost, "alpha_cost": alpha_cost * values[alpha]})
    for row in arc_rows:
        effect = cargo_by_arc[row["original_variable"]]
        if len(effect) > 1:
            raise ValueError("arc_multiple_inventory_service_nodes")
        row["inventory_service_port"] = effect[0]["port"] if effect else ""
        row["inventory_service_time_index"] = effect[0]["time_index"] if effect else ""
        row["signed_inventory_effect"] = (effect[0]["signed_inventory_effect_per_vessel"]
                                             * row["vessel_count"]) if effect else 0
    remaining = {row["original_variable"]: row["vessel_count"] for row in arc_rows}
    outgoing = defaultdict(list)
    for variable in remaining:
        i, t, j, u, c, kind, capacity = arcs[variable]
        outgoing[c, i, t].append(variable)
    paths, path_count = [], 0
    for source in sorted(v for v in remaining if arcs[v][5] == "initial_source"):
        for _ in range(remaining[source]):
            path_count += 1
            current, step = source, 0
            while True:
                i, t, j, u, c, kind, capacity = arcs[current]
                if remaining[current] <= 0:
                    raise ValueError("decomposition_consumed_original_flow")
                remaining[current] -= 1
                paths.append({"anonymous_path_id": f"class{c}-path{path_count}", "step": step,
                              "original_variable": current, "vessel_class": c, "kind": kind,
                              "from_port": i, "from_time_index": t, "to_port": j, "to_time_index": u})
                if j < 0:
                    break
                choices = [v for v in outgoing[c, j, u] if remaining[v] > 0]
                if not choices:
                    raise ValueError("decomposition_regular_node_has_no_continuation")
                current = min(choices, key=lambda v: (arcs[v][3], arcs[v][2], v))
                step += 1
                if step > len(arcs):
                    raise ValueError("decomposition_cycle")
    if any(remaining.values()) or path_count != len(vessels):
        raise ValueError("decomposition_original_arc_multiset_closure")
    costs["original_objective_constant"].append(-rhs.get(objective, 0))
    components = [{"component": name, "original_objective_contribution": math.fsum(parts)}
                  for name, parts in sorted(costs.items())]
    economic_total = math.fsum(row["original_objective_contribution"] for row in components)
    close(economic_total, check["independent_objective"], "operational_original_economic_closure")
    result = {"at": now(), "instance": args.instance, "original_model_periods": periods,
              "raw_metadata_periods": int(number(metadata, "numPeriods")),
              "raw_prefix_scope": f"Only original MPS time indices 0..{periods - 1}; raw extra periods are not evaluated",
              "ports": len(ports), "classes": len(classes), "anonymous_paths": path_count,
              "positive_original_arc_rows": len(arc_rows), "path_arc_units": len(paths),
              "port_period_rows": len(ledger), "max_inventory_residual": max(abs(x["inventory_residual"]) for x in ledger),
              "original_cost": check["independent_objective"], "economic_components": components,
              "raw_original_semantics": "All original arcs: vessel identity/time/geometry cost; every port-period: raw rate prefix, class-capacity cargo, berth, inventory and alpha penalty; source multiset: original raw fleet",
              "terminal_exit_scope": "Original sink arcs consume a berth and load/unload a full class cargo at their origin. Their negative objective is a terminal adjustment. No physical destination or delivered future demand is inferred.",
              "path_identity": "Deterministic decomposition of aggregate class flow, not unique original named-vessel assignments",
              "computation_status": args.computation_status, "computation_scope": args.computation_scope,
              "original_model_bound": args.original_model_bound,
              "solver_reports_original_optimal": args.computation_scope == "original_model" and args.computation_status == "optimal",
              "benchmark_score": None,
              "whole_benchmark_qualified": False, "original_check": check}
    return result, {"arcs": arc_rows, "paths": paths, "ledger": ledger, "costs": components}


def export(args):
    result, tables = evaluate(args)
    write(args.out / "independent-original-model-check.json", result["original_check"])
    for key, name in [("arcs", "class-arc-plan.csv"), ("paths", "anonymous-vessel-paths.csv"),
                      ("ledger", "port-period-ledger.csv"), ("costs", "economic-components.csv")]:
        save_csv(args.out / name, tables[key])
    write(args.out / "operational-closure.json", result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--original-mps", type=Path, required=True)
    parser.add_argument("--values", type=Path, required=True)
    parser.add_argument("--reported-objective", type=float)
    parser.add_argument("--computation-status", required=True)
    parser.add_argument("--computation-scope", choices=["original_model", "conditional_pass"], required=True)
    parser.add_argument("--original-model-bound", type=float)
    parser.add_argument("--raw-archive", type=Path, required=True)
    parser.add_argument("--instance", required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if args.computation_scope == "conditional_pass" and args.original_model_bound is not None:
        raise ValueError("conditional_bound_is_not_original_model_bound")
    args.out.mkdir(parents=True, exist_ok=False)
    write(args.out / "execution-started.json", {"at": now(), "actual_python_pid": os.getpid(),
          "argv": sys.argv, "source": "closed original solver plan and unmodified original raw/MPS", "optimization": False})
    try:
        result = export(args)
        write(args.out / "execution-terminal.json", {"at": now(), "native_code": 0,
              "instance": args.instance, "original_cost": result["original_cost"], "scope": "operational export only, not solver execution or benchmark qualification"})
        print(json.dumps({k: result[k] for k in ["instance", "anonymous_paths", "port_period_rows", "original_cost"]}))
    except BaseException as error:
        write(args.out / "execution-error.json", {"at": now(), "type": type(error).__name__,
              "error": str(error), "traceback": traceback.format_exc()})
        raise


if __name__ == "__main__":
    main()
