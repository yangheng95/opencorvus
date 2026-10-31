"""Research one pre-registered temporal relax-and-fix method on the original models.

Only the original MPS archive is read. Published starts and control vectors are not inputs.
"""
import argparse
import datetime
import gzip
import json
import os
from pathlib import Path
import re
import time
import traceback
import zipfile

from pyscipopt import Model
from fetch_originals import INSTANCE_NAMES
from verify_original_mps import read_original_model, verify


FRONTIERS = [(15, 10), (25, 20), (35, 30), (45, 45)]
ARC = re.compile(r"x_\((-?\d+),(\d+)\),\((-?\d+),(\d+)\),(\d+)\Z")
ATTEMPT = re.compile(r"z_\((\d+),(\d+)\),(\d+)\Z")


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def write(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def decision_time(variable, bounds):
    arc = ARC.fullmatch(variable)
    if arc:
        # Source/unused-vessel arcs are genuine initial decisions, at their original source time.
        return int(arc.group(2))
    attempt = ATTEMPT.fullmatch(variable)
    if attempt:
        return int(attempt.group(2))
    lower, upper = bounds[variable]
    if lower == upper:
        # The archive contains fixed dummy variables such as z_0,0.
        return 0
    raise ValueError(f"unmapped_original_integer_decision:{variable}")


def run_problem(archive, instance, root):
    target = root / instance
    target.mkdir()
    member = f"Group1_MPS_files/{instance}_t45.mps"
    mps = target / f"{instance}_t45.mps"
    mps.write_bytes(archive.read(member))
    _, _, _, bounds, integers, _ = read_original_model(mps)
    times = {v: decision_time(v, bounds) for v in integers}
    committed = {}
    history = []
    result = {"instance": instance, "original_member": member, "method": "temporal-relax-and-fix-first",
              "solution_produced": False, "original_problem_objective": None,
              "stage_results": history, "score": None, "benchmark_qualification": "not_established"}
    for index, (frontier, commit_before) in enumerate(FRONTIERS):
        stage = target / f"stage-{index:02d}"
        stage.mkdir()
        model = Model(instance)
        model.setLogfile(str(stage / "solver-native.log"))
        model.readProblem(str(mps))
        model.setIntParam("parallel/maxnthreads", 1)
        model.setIntParam("randomization/randomseedshift", 0)
        model.setRealParam("limits/time", 15)
        model.setRealParam("numerics/feastol", 1e-8)
        variables = model.getVars(transformed=False)
        relaxed_count = 0
        for variable in variables:
            name = variable.name
            if name in committed:
                model.chgVarLb(variable, committed[name])
                model.chgVarUb(variable, committed[name])
            elif name in times and times[name] >= frontier:
                model.chgVarType(variable, "C")
                relaxed_count += 1
        record = {"index": index, "at": now(), "integer_frontier": frontier,
                  "commit_before": commit_before, "prior_committed_variables": len(committed),
                  "temporarily_relaxed_variables": relaxed_count,
                  "solver_limit_seconds": 15, "original_horizon_periods": 45,
                  "objective_scope": "conditional and possibly fractional; not an original-MILP feasible objective",
                  "global_original_milp_bound": None}
        write(stage / "started.json", record)
        model.optimize()
        solution = model.getBestSol()
        record.update(finished_at=now(), status=str(model.getStatus()),
                      solver_seconds=model.getSolvingTime(), nodes=model.getNNodes())
        if solution is None:
            record["outcome"] = "no_solution_for_this_conditional_stage"
            write(stage / "result.json", record)
            history.append(record)
            result["stopped_reason"] = record["outcome"]
            model.freeProb()
            break
        values = {v.name: model.getSolVal(solution, v) for v in variables}
        record["conditional_objective"] = model.getSolObjVal(solution)
        with gzip.open(stage / "conditional-values.json.gz", "wt", encoding="utf-8") as output:
            json.dump(values, output, allow_nan=False)
        newly_committed = {v: round(values[v]) for v in integers if times[v] < commit_before}
        if any(abs(values[v] - value) > 1e-6 for v, value in newly_committed.items()):
            raise ValueError("conditional_stage_cannot_commit_fractional_decision")
        committed = newly_committed
        record["total_committed_after"] = len(committed)
        record["outcome"] = "conditional_solution_found"
        if frontier == 45:
            check = verify(mps, values, model.getSolObjVal(solution))
            write(target / "independent-original-model-check.json", check)
            write(target / "final-values.json", values)
            result["solution_produced"] = check["feasible"] and check["objective_consistent"]
            result["original_problem_objective"] = check["independent_objective"] if result["solution_produced"] else None
            result["independent_validation"] = check
            record["objective_scope"] = "last full-integer conditional model; original feasibility checked separately"
        write(stage / "result.json", record)
        history.append(record)
        model.freeProb()
    write(target / "result.json", result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--original-inputs", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    start = time.perf_counter()
    write(args.out / "execution-started.json", {"at": now(), "actual_python_pid": os.getpid(),
          "method": "temporal-relax-and-fix-first", "frontiers": FRONTIERS,
          "original_inputs_read": "Group1_MPS_files.zip only", "published_route_input": None,
          "scope": "first autonomous method study, no candidate or benchmark grade"})
    results = []
    try:
        with zipfile.ZipFile(args.original_inputs / "Group1_MPS_files.zip") as archive:
            for instance in INSTANCE_NAMES:
                result = run_problem(archive, instance, args.out)
                results.append(result)
                write(args.out / "results.partial.json", results)
                print(json.dumps({k: result[k] for k in ["instance", "solution_produced", "original_problem_objective"]}), flush=True)
        write(args.out / "execution-terminal.json", {"at": now(), "native_code": 0,
              "wall_seconds": time.perf_counter() - start, "results": results,
              "study_finished": True, "all_problems_have_verified_plan": all(x["solution_produced"] for x in results),
              "scope": "method experiment finished; not a complete benchmark or global optimality claim"})
    except BaseException as error:
        write(args.out / "execution-error.json", {"at": now(), "type": type(error).__name__,
              "error": str(error), "traceback": traceback.format_exc(), "completed_instances": results})
        raise


if __name__ == "__main__":
    main()
