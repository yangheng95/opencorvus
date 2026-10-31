"""Compare original-model warm global search with one ordered full-horizon class-pair pass."""
import argparse
from collections import defaultdict
import datetime
import gzip
import importlib.metadata
from itertools import combinations
import json
import math
import os
from pathlib import Path
import re
import sys
import time
import traceback

from pyscipopt import Model, SCIP_EVENTTYPE
from verify_original_mps import read_original_model, verify


ARC = re.compile(r"x_\((-?\d+),(-?\d+)\),\((-?\d+),(-?\d+)\),(\d+),Term")
INV = re.compile(r"invBalanceRegion_\((\d+),(\d+)\)")


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def write(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def finite(value):
    return float(value) if math.isfinite(value) and abs(value) < 1e19 else None


def class_structure(mps, initial):
    row_types, coefficients, rhs, bounds, integers, objective = read_original_model(mps)
    arcs, capacities = {}, defaultdict(set)
    for variable in integers:
        match = ARC.fullmatch(variable)
        if match is None:
            raise ValueError(f"original_integer_arc_class_unmapped:{variable}")
        arcs[variable] = tuple(map(int, match.groups()))
    periods = 1 + max(int(INV.fullmatch(r).group(2)) for r in row_types if INV.fullmatch(r))
    for row in row_types:
        if INV.fullmatch(row):
            for variable, coefficient in coefficients[row]:
                if variable in arcs:
                    capacities[arcs[variable][4]].add(abs(coefficient))
    if any(len(values) != 1 or min(values) <= 0 for values in capacities.values()):
        raise ValueError("original_class_capacity_identity")
    capacities = {c: next(iter(values)) for c, values in capacities.items()}
    available, unused = defaultdict(float), defaultdict(float)
    for variable, (i, t, j, u, c) in arcs.items():
        if i < 0:
            available[c] += initial[variable] * capacities[c] * (periods - 1 - u)
        elif j < 0:
            unused[c] += initial[variable] * capacities[c] * (periods - 1 - t)
    if set(available) != set(capacities) or any(x <= 0 for x in available.values()):
        raise ValueError("original_available_capacity_time")
    ranking = {c: unused[c] / available[c] for c in capacities}
    pairs = sorted(combinations(sorted(capacities), 2),
                   key=lambda pair: (-sum(ranking[c] for c in pair), pair))
    return {"periods": periods, "integer_arc_classes": {v: x[4] for v, x in arcs.items()},
            "capacities": capacities, "unused_capacity_time_ratio": ranking,
            "class_pairs": [list(pair) for pair in pairs],
            "ranking_scope": "Initial-flow terminal unused capacity-time proxy, not a proven causal economic loss"}


def checked(mps, values, objective, fixed):
    result = verify(mps, values, objective)
    if not result["feasible"] or not result["objective_consistent"]:
        raise ValueError("native_incumbent_fails_original_model")
    mismatch = max((abs(values[v] - x) for v, x in fixed.items()), default=0)
    if mismatch > 1e-6:
        raise ValueError("conditional_fixed_arc_mismatch")
    return result


def solve_stage(mps, values, free_classes, structure, out, arm_start, milestone):
    out.mkdir()
    stage_start = time.perf_counter()
    model = Model("original-full-horizon-class-study")
    model.setLogfile(str(out / "solver-native.log"))
    model.readProblem(str(mps))
    model.setIntParam("parallel/maxnthreads", 1)
    model.setIntParam("randomization/randomseedshift", 0)
    model.setRealParam("numerics/feastol", 1e-8)
    variables = model.getVars(transformed=False)
    fixed = {v: round(values[v]) for v, c in structure["integer_arc_classes"].items()
             if c not in free_classes}
    for variable in variables:
        if variable.name in fixed:
            model.chgVarLb(variable, fixed[variable.name])
            model.chgVarUb(variable, fixed[variable.name])
    write(out / "fixed-original-integer-values.json", fixed)
    supplied = model.createSol()
    for variable in variables:
        model.setSolVal(supplied, variable, values[variable.name])
    initial_objective = model.getSolObjVal(supplied)
    initial_check = checked(mps, values, initial_objective, fixed)
    stored = model.addSol(supplied, free=True)
    if not stored:
        raise ValueError("original_valid_initial_incumbent_not_stored")
    events, callback_errors = [], []

    def capture(current, event):
        try:
            best = current.getBestSol()
            if best is None:
                raise ValueError("actual_best_solution_event_without_solution")
            actual_values = {v.name: current.getSolVal(best, v) for v in variables}
            quote = current.getSolObjVal(best)
            result = checked(mps, actual_values, quote, fixed)
            record = {"event": "BESTSOLFOUND", "at": now(),
                      "arm_wall_seconds": time.perf_counter() - arm_start,
                      "solver_seconds": current.getSolvingTime(), "native_objective": quote,
                      "original_objective": result["independent_objective"],
                      "original_feasible": result["feasible"],
                      "objective_consistent": result["objective_consistent"],
                      "max_row_violation": result["max_row_violation"],
                      "max_integrality_violation": result["max_integrality_violation"],
                      "conditional_fixed_arcs_checked": len(fixed),
                      "values": f"incumbent-{len(events):04d}.json.gz"}
            with gzip.open(out / record["values"], "wt", encoding="utf-8", compresslevel=1) as stream:
                json.dump(actual_values, stream, allow_nan=False)
            with (out / "actual-best-events.jsonl").open("a", encoding="utf-8") as stream:
                stream.write(json.dumps(record, allow_nan=False) + "\n")
            events.append(record)
        except BaseException as error:
            failure = {"at": now(), "type": type(error).__name__, "error": str(error),
                       "traceback": traceback.format_exc()}
            callback_errors.append(failure)
            write(out / "callback-error.json", failure)
            current.interruptSolve()

    model.attachEventHandlerCallback(capture, [SCIP_EVENTTYPE.BESTSOLFOUND])
    remaining = milestone - time.perf_counter()
    started = {"at": now(), "actual_python_pid": os.getpid(), "free_classes": list(free_classes),
               "fixed_integer_arc_count": len(fixed),
               "free_integer_arc_count": len(structure["integer_arc_classes"]) - len(fixed),
               "supplied_incumbent_stored": bool(stored), "supplied_original_objective": initial_objective,
               "original_initial_check": initial_check,
               "wall_allowance_remaining_after_setup": max(0, remaining),
               "arm_wall_at_native_start": time.perf_counter() - arm_start,
               "scope": "Unchanged original rows/objective; only declared other-class integer bounds fixed"}
    write(out / "started.json", started)
    if remaining <= 0:
        model.freeProb()
        result = {"at": now(), "status": "method_wall_consumed_by_setup", "optimization_executed": False,
                  "initial_original_objective": initial_objective, "final_original_objective": initial_objective,
                  "actual_wall_seconds": time.perf_counter() - stage_start}
        write(out / "result.json", result)
        return values, initial_objective, result
    model.setRealParam("limits/time", remaining)
    model.optimize()
    if callback_errors:
        raise RuntimeError("native_callback_original_verification_failed")
    best = model.getBestSol()
    if best is None:
        raise ValueError("accepted_original_incumbent_missing_at_terminal")
    final_values = {v.name: model.getSolVal(best, v) for v in variables}
    quote = model.getSolObjVal(best)
    final_check = checked(mps, final_values, quote, fixed)
    if quote > initial_objective + 1e-6:
        raise ValueError("stored_incumbent_worsened_at_terminal")
    write(out / "final-values.json", final_values)
    write(out / "independent-original-model-check.json", final_check)
    result = {"at": now(), "status": str(model.getStatus()), "optimization_executed": True,
              "free_classes": list(free_classes), "fixed_integer_arc_count": len(fixed),
              "initial_original_objective": initial_objective,
              "final_original_objective": final_check["independent_objective"],
              "solver_seconds": model.getSolvingTime(), "actual_wall_seconds": time.perf_counter() - stage_start,
              "arm_wall_at_terminal": time.perf_counter() - arm_start,
              "actual_best_events": len(events), "native_bound": finite(model.getDualbound()),
              "bound_scope": "conditional class-pair subproblem only" if fixed else "original full model, solver-reported",
              "optimal_status_scope": "conditional only" if fixed else "original full model, not independent exact certificate",
              "original_check": final_check}
    write(out / "result.json", result)
    model.freeProb()
    return final_values, quote, result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--closed-plan", type=Path, required=True)
    parser.add_argument("--strategy", choices=["global", "class-pairs"], required=True)
    parser.add_argument("--method-wall-seconds", type=float, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    arm_start = time.perf_counter()
    write(args.out / "execution-started.json", {"at": now(), "actual_python_pid": os.getpid(),
          "argv": sys.argv, "executable": sys.executable, "python": sys.version,
          "packages": {p: importlib.metadata.version(p) for p in ["pyscipopt", "numpy"]},
          "method_wall_seconds": args.method_wall_seconds,
          "scope": "One pre-registered warm-start research arm, not a cold run, resume of solver state or model score"})
    stages = []
    try:
        mps_files = list(args.closed_plan.glob("*.mps"))
        if len(mps_files) != 1:
            raise ValueError("closed_original_model_identity")
        mps = mps_files[0]
        initial = json.loads((args.closed_plan / "final-values.json").read_text(encoding="utf-8"))
        native = json.loads((args.closed_plan / "result.json").read_text(encoding="utf-8"))
        initial_check = checked(mps, initial, native["primal_bound"], {})
        write(args.out / "initial-original-model-check.json", initial_check)
        structure = class_structure(mps, initial)
        write(args.out / "original-class-structure.json", structure)
        classes = sorted(structure["capacities"])
        schedule = [classes] if args.strategy == "global" else structure["class_pairs"]
        if not schedule:
            raise ValueError("class_pair_strategy_requires_two_classes")
        values, objective = initial, initial_check["independent_objective"]
        for index, pair in enumerate(schedule):
            if time.perf_counter() >= arm_start + args.method_wall_seconds:
                break
            milestone = arm_start + args.method_wall_seconds * (index + 1) / len(schedule)
            values, objective, result = solve_stage(mps, values, pair, structure,
                                                    args.out / f"stage-{index:02d}", arm_start, milestone)
            stages.append(result)
            write(args.out / "stages.partial.json", stages)
        final_check = checked(mps, values, objective, {})
        write(args.out / "final-values.json", values)
        write(args.out / "independent-original-model-check.json", final_check)
        elapsed = time.perf_counter() - arm_start
        terminal = {"at": now(), "native_code": 0, "strategy": args.strategy,
                    "instance": native["instance"], "actual_python_pid": os.getpid(),
                    "initial_original_cost": initial_check["independent_objective"],
                    "final_original_cost": final_check["independent_objective"],
                    "actual_method_wall_seconds": elapsed, "nominal_wall_seconds": args.method_wall_seconds,
                    "wall_overrun_seconds": max(0, elapsed - args.method_wall_seconds),
                    "stages_registered": len(schedule), "stages_finished": len(stages),
                    "complete_single_pass": len(stages) == len(schedule), "stages": stages,
                    "original_model_feasible": final_check["feasible"],
                    "original_model_objective_consistent": final_check["objective_consistent"],
                    "original_model_bound": stages[-1].get("native_bound") if args.strategy == "global" and stages else None,
                    "restricted_bound_scope": "Every fixed-class bound is conditional, not a full-model lower bound",
                    "benchmark_score": None, "whole_benchmark_qualified": False}
        write(args.out / "execution-terminal.json", terminal)
        print(json.dumps({k: terminal[k] for k in ["instance", "strategy", "initial_original_cost", "final_original_cost",
                                                  "actual_method_wall_seconds", "stages_finished"]}), flush=True)
    except BaseException as error:
        write(args.out / "execution-error.json", {"at": now(), "type": type(error).__name__,
              "error": str(error), "traceback": traceback.format_exc(), "completed_stages": stages})
        raise


if __name__ == "__main__":
    main()
