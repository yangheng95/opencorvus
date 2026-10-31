"""Run the three pre-registered complete original MIRPLIB models once, with ordinary SCIP."""
import argparse
import datetime
import gzip
import importlib.metadata
import json
import math
import os
from pathlib import Path
import sys
import time
import traceback
import zipfile

from pyscipopt import Model, SCIP_EVENTTYPE
from fetch_originals import INSTANCE_NAMES, GROUP2_PROFILE
from verify_original_mps import verify


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def write(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def finite_bound(value):
    return float(value) if math.isfinite(value) and abs(value) < 1e19 else None


def run_instance(archive, instance, root, original_member):
    target = root / instance
    target.mkdir()
    mps = target / Path(original_member).name
    mps.write_bytes(archive.read(original_member))
    wall = time.perf_counter()
    model = Model(instance)
    model.setLogfile(str(target / "solver-native.log"))
    model.readProblem(str(mps))
    # A single CPU thread; retain the mature solver's default algorithms.
    model.setIntParam("parallel/maxnthreads", 1)
    model.setRealParam("limits/time", 60.0)
    model.setIntParam("randomization/randomseedshift", 0)
    model.setRealParam("numerics/feastol", 1e-8)
    parameters = {
        "parallel/maxnthreads": 1, "limits/time": 60.0,
        "randomization/randomseedshift": 0, "numerics/feastol": 1e-8,
    }
    variables = model.getVars(transformed=False)
    events = []

    def capture(current, event):
        solution = current.getBestSol()
        if solution is None:
            raise RuntimeError("best_solution_event_without_solution")
        record = {
            "event": "BESTSOLFOUND", "at": now(), "solver_seconds": current.getSolvingTime(),
            "wall_seconds": time.perf_counter() - wall,
            "objective": current.getSolObjVal(solution),
            "dual_bound": finite_bound(current.getDualbound()),
            "solution": f"incumbent-{len(events):04d}.json.gz",
        }
        values = {variable.name: current.getSolVal(solution, variable) for variable in variables}
        checked = verify(mps, values, record["objective"])
        record["independent_original_check"] = {k: checked[k] for k in [
            "feasible", "objective_consistent", "independent_objective", "max_row_violation",
            "max_integrality_violation", "objective_absolute_error",
        ]}
        if not checked["feasible"] or not checked["objective_consistent"]:
            write(target / "incumbent-original-model-error.json", checked)
            raise ValueError("actual_best_solution_fails_original_model")
        with gzip.open(target / record["solution"], "wt", encoding="utf-8", compresslevel=1) as output:
            json.dump(values, output, allow_nan=False)
        with (target / "incumbent-events.jsonl").open("a", encoding="utf-8") as output:
            output.write(json.dumps(record, allow_nan=False) + "\n")
        events.append(record)

    model.attachEventHandlerCallback(capture, [SCIP_EVENTTYPE.BESTSOLFOUND])
    write(target / "started.json", {
        "at": now(), "actual_python_pid": os.getpid(), "original_member": original_member,
        "parameters": parameters, "original_variables": len(variables),
        "original_constraints": model.getNConss(),
        "scope": "whole original problem observation; no task score or original-competition reproduction claim",
    })
    model.optimize()
    solver_wall = time.perf_counter() - wall
    final = model.getBestSol()
    result = {
        "instance": instance, "original_member": original_member, "finished_at": now(),
        "status": str(model.getStatus()), "solver_seconds": model.getSolvingTime(),
        "whole_read_and_solve_wall_seconds": solver_wall,
        "solutions_reported": model.getNSols(), "incumbent_events_saved": len(events),
        "primal_bound": finite_bound(model.getPrimalbound()),
        "dual_bound": finite_bound(model.getDualbound()),
        "relative_gap_reported": finite_bound(model.getGap()),
        "nodes": model.getNNodes(), "parameters": parameters,
        "independent_validation": None,
        "score": None, "benchmark_qualification": "not_established",
    }
    if final is not None:
        values = {variable.name: model.getSolVal(final, variable) for variable in variables}
        objective = model.getSolObjVal(final)
        write(target / "final-values.json", values)
        check = verify(mps, values, objective)
        write(target / "independent-original-model-check.json", check)
        result["independent_validation"] = {k: check[k] for k in [
            "feasible", "objective_consistent", "independent_objective", "constraints_recomputed",
            "variables_recomputed", "max_row_violation", "max_integrality_violation",
        ]}
    write(target / "result.json", result)
    model.freeProb()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--original-inputs", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--group", choices=["1", "2"], required=True)
    args = parser.parse_args()
    instances = INSTANCE_NAMES if args.group == "1" else GROUP2_PROFILE["instances"]
    periods = 45 if args.group == "1" else GROUP2_PROFILE["periods"]
    root = args.out.resolve()
    root.mkdir(parents=True, exist_ok=False)
    write(root / "execution-started.json", {
        "at": now(), "actual_python_pid": os.getpid(), "argv": sys.argv,
        "python": sys.version, "executable": sys.executable,
        "packages": {k: importlib.metadata.version(k) for k in ["PySCIPOpt", "numpy"]},
        "group": args.group, "instances": instances, "periods": periods, "per_problem_solver_seconds": 60,
        "candidate_runtime_budget": None,
        "scope": "first complete original problem baseline; no old L06 controls, candidate or qualification test",
    })
    wall = time.perf_counter()
    results = []
    try:
        with zipfile.ZipFile(args.original_inputs / f"Group{args.group}_MPS_files.zip") as archive:
            for instance in instances:
                member = f"Group{args.group}_MPS_files/{instance}_t{periods}.mps"
                result = run_instance(archive, instance, root, member)
                results.append(result)
                write(root / "results.partial.json", results)
                print(json.dumps(result, allow_nan=False), flush=True)
        write(root / "execution-terminal.json", {
            "finished_at": now(), "actual_python_pid": os.getpid(),
            "wall_seconds": time.perf_counter() - wall, "results": results,
            "complete_original_problem_runs": len(results), "native_code": 0,
            "scope": "execution complete; entire benchmark task/report/rubric/review/candidate study still incomplete",
        })
    except BaseException as error:
        write(root / "execution-error.json", {"at": now(), "type": type(error).__name__,
                                             "error": str(error), "traceback": traceback.format_exc(),
                                             "completed_instances": results})
        raise


if __name__ == "__main__":
    main()
