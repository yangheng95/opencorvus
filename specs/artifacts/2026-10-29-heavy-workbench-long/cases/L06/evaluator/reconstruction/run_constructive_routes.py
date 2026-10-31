"""Construct original-model plans with integer CP feasibility, then original MILP refinement."""
import argparse
import datetime
import importlib.metadata
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import time
import traceback
import zipfile

from ortools.sat.python import cp_model
from fetch_originals import INSTANCE_NAMES
from verify_original_mps import read_original_model, verify


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def write(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def exact_int(value):
    if not math.isfinite(value) or not float(value).is_integer():
        raise ValueError("original_constraint_value_not_exact_finite_integer")
    return int(value)


def run_problem(archive, instance, root):
    target = root / instance
    target.mkdir()
    mps = target / f"{instance}_t45.mps"
    mps.write_bytes(archive.read(f"Group1_MPS_files/{instance}_t45.mps"))
    row_types, coefficients, rhs, bounds, original_integers, objective = read_original_model(mps)
    model = cp_model.CpModel()
    variables = {v: model.new_int_var(exact_int(lower), exact_int(upper), v)
                 for v, (lower, upper) in bounds.items()}
    row_count = 0
    for row, kind in row_types.items():
        if kind == "N":
            continue
        terms = coefficients.get(row, [])
        expression = cp_model.LinearExpr.weighted_sum([variables[v] for v, a in terms],
                                                      [exact_int(a) for v, a in terms])
        bound = exact_int(rhs.get(row, 0))
        if kind == "E":
            model.add(expression == bound)
        elif kind == "L":
            model.add(expression <= bound)
        elif kind == "G":
            model.add(expression >= bound)
        else:
            raise ValueError("unsupported_original_row_type")
        row_count += 1
    validation = model.validate()
    if validation:
        raise ValueError(f"cp_model_invalid:{validation}")
    started = {"at": now(), "actual_python_pid": os.getpid(), "original_variables": len(variables),
               "original_integer_variables": len(original_integers), "original_constraints": row_count,
               "cp_quantities": "all original variables restricted to integer units; no constraint coefficient rounding",
               "objective": None, "cp_solver_seconds_limit": 30, "num_search_workers": 1,
               "scope": "feasibility construction only; CP OPTIMAL does not mean economic or original-MILP optimality"}
    write(target / "cp-started.json", started)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30
    solver.parameters.num_search_workers = 1
    solver.parameters.random_seed = 0
    solver.parameters.log_search_progress = True
    solver.parameters.log_to_stdout = False
    with (target / "cp-native.log").open("w", encoding="utf-8") as log:
        solver.log_callback = lambda message: log.write(message)
        status = solver.solve(model)
    (target / "cp-native-response.txt").write_text(solver.response_stats(), encoding="utf-8")
    result = {"instance": instance, "cp_status": solver.status_name(status),
              "cp_seconds": solver.wall_time, "solution_produced": False,
              "original_problem_objective": None, "score": None,
              "scope": "integer-restricted construction, not a global optimum proof for original continuous MILP"}
    if status not in {cp_model.OPTIMAL, cp_model.FEASIBLE}:
        result["outcome"] = "no_original_feasible_plan_produced_by_integer_restriction"
        result["refinement_executed"] = False
        write(target / "result.json", result)
        return result
    values = {v: solver.value(variable) for v, variable in variables.items()}
    values_path = target / "constructed-values.json"
    write(values_path, values)
    check = verify(mps, values, None)
    write(target / "cp-original-model-check.json", check)
    if not check["feasible"]:
        raise ValueError("constructed_plan_violates_original_model")
    result["cp_independent_original_check"] = check
    argv = [sys.executable, "-u", "-X", "utf8", "-B", str(Path(__file__).with_name("refine_constructed_plan.py")),
            "--original-mps", str(mps), "--constructed-values", str(values_path), "--out", str(target / "refinement")]
    with (target / "refinement.stdout.txt").open("w", encoding="utf-8") as out, (
        target / "refinement.stderr.txt"
    ).open("w", encoding="utf-8") as err:
        process = subprocess.Popen(argv, stdout=out, stderr=err, creationflags=subprocess.CREATE_NO_WINDOW)
        write(target / "refinement-command-started.json", {"at": now(), "launcher_pid": process.pid, "argv": argv})
        code = process.wait()
    write(target / "refinement-command-terminal.json", {"at": now(), "argv": argv, "native_exit": code})
    if code:
        raise RuntimeError(f"original_refinement_process_exit:{code}")
    refined = json.loads((target / "refinement/execution-terminal.json").read_text(encoding="utf-8"))
    result.update(refinement_executed=True, solution_produced=refined["solution_produced"],
                  original_problem_objective=refined["final_original_objective"],
                  constructed_objective=check["independent_objective"],
                  original_milp_dual_bound=refined["original_milp_dual_bound"],
                  refinement_solver_seconds=refined["solver_seconds"])
    write(target / "result.json", result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--original-inputs", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    write(args.out / "execution-started.json", {"at": now(), "actual_python_pid": os.getpid(),
          "packages": {k: importlib.metadata.version(k) for k in ["ortools", "numpy", "pyscipopt"]},
          "original_inputs_read": "Group1_MPS_files.zip only; no MST or published controls",
          "method": "CP integer construction followed by original MILP quality refinement", "candidate_score": None})
    start = time.perf_counter()
    results = []
    try:
        with zipfile.ZipFile(args.original_inputs / "Group1_MPS_files.zip") as archive:
            for instance in INSTANCE_NAMES:
                result = run_problem(archive, instance, args.out)
                results.append(result)
                write(args.out / "results.partial.json", results)
                print(json.dumps({k: result[k] for k in ["instance", "cp_status", "solution_produced", "original_problem_objective"]}), flush=True)
        write(args.out / "execution-terminal.json", {"at": now(), "native_code": 0,
              "wall_seconds": time.perf_counter() - start, "results": results, "study_finished": True,
              "all_problems_have_verified_plan": all(x["solution_produced"] for x in results),
              "scope": "first constructive method study; original-MILP optimality and complete benchmark unestablished"})
    except BaseException as error:
        write(args.out / "execution-error.json", {"at": now(), "type": type(error).__name__,
              "error": str(error), "traceback": traceback.format_exc(), "completed_instances": results})
        raise


if __name__ == "__main__":
    main()
