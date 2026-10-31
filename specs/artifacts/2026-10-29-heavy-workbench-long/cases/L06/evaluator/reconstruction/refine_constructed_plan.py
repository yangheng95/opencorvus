"""Optimize the unchanged original economic model, initialized by this run's CP plan."""
import argparse
import datetime
import gzip
import json
import os
from pathlib import Path

from pyscipopt import Model, SCIP_EVENTTYPE
from verify_original_mps import verify


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def write(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--original-mps", type=Path, required=True)
    parser.add_argument("--constructed-values", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    write(args.out / "execution-started.json", {"at": now(), "actual_python_pid": os.getpid(),
          "original_mps": str(args.original_mps), "constructed_values": str(args.constructed_values),
          "scope": "unchanged original MILP, one constructed incumbent, no published start"})
    model = Model("constructed-plan-refinement")
    model.setLogfile(str(args.out / "solver-native.log"))
    model.readProblem(str(args.original_mps))
    model.setIntParam("parallel/maxnthreads", 1)
    model.setIntParam("randomization/randomseedshift", 0)
    model.setRealParam("limits/time", 30)
    model.setRealParam("numerics/feastol", 1e-8)
    variables = model.getVars(transformed=False)
    values = json.loads(args.constructed_values.read_text(encoding="utf-8"))
    if set(values) != {v.name for v in variables}:
        raise ValueError("constructed_plan_original_variable_identity")
    solution = model.createSol()
    for variable in variables:
        model.setSolVal(solution, variable, values[variable.name])
    initial_quote = model.getSolObjVal(solution)
    initial_check = verify(args.original_mps, values, initial_quote)
    write(args.out / "initial-original-model-check.json", initial_check)
    if not initial_check["feasible"] or not initial_check["objective_consistent"]:
        raise ValueError("constructed_plan_rejected_by_original_model")
    if not model.addSol(solution, free=True):
        raise ValueError("constructed_incumbent_not_stored")
    events = []

    def capture(current, event):
        best = current.getBestSol()
        if best is None:
            raise RuntimeError("best_solution_event_without_solution")
        event_values = {v.name: current.getSolVal(best, v) for v in variables}
        record = {"at": now(), "event": "BESTSOLFOUND", "solver_seconds": current.getSolvingTime(),
                  "objective": current.getSolObjVal(best), "values": f"incumbent-{len(events):04d}.json.gz"}
        with gzip.open(args.out / record["values"], "wt", encoding="utf-8") as output:
            json.dump(event_values, output, allow_nan=False)
        with (args.out / "actual-incumbents.jsonl").open("a", encoding="utf-8") as output:
            output.write(json.dumps(record, allow_nan=False) + "\n")
        events.append(record)

    model.attachEventHandlerCallback(capture, [SCIP_EVENTTYPE.BESTSOLFOUND])
    model.optimize()
    best = model.getBestSol()
    if best is None:
        raise RuntimeError("accepted_constructed_plan_missing_at_terminal")
    final_values = {v.name: model.getSolVal(best, v) for v in variables}
    check = verify(args.original_mps, final_values, model.getSolObjVal(best))
    write(args.out / "final-values.json", final_values)
    write(args.out / "independent-original-model-check.json", check)
    dual_bound = model.getDualbound()
    result = {"at": now(), "status": str(model.getStatus()), "solver_seconds": model.getSolvingTime(),
              "actual_python_pid": os.getpid(), "actual_best_solution_events": events,
              "initial_constructed_objective": initial_quote,
              "final_original_objective": check["independent_objective"],
              "original_milp_dual_bound": dual_bound if abs(dual_bound) < 1e19 else None,
              "independent_check": check,
              "solution_produced": check["feasible"] and check["objective_consistent"],
              "score": None, "scope": "original problem plan and actual economic quality; benchmark remains incomplete"}
    write(args.out / "execution-terminal.json", result)
    if not result["solution_produced"]:
        raise ValueError("refined_plan_fails_original_problem")


if __name__ == "__main__":
    main()
