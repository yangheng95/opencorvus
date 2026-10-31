"""Complete published integer routes under the unchanged original linear constraints.

This is a public-reference control, not a solver that independently discovers routes.
"""
import argparse
import datetime
import json
import os
from pathlib import Path
import time
import zipfile

from pyscipopt import Model
from fetch_originals import INSTANCE_NAMES
from verify_original_mps import read_original_model, verify


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def write(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--original-inputs", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    start = time.perf_counter()
    write(args.out / "execution-started.json", {
        "at": now(), "actual_python_pid": os.getpid(),
        "scope": "published integer route LP completion; not an independent route-finding algorithm",
        "instances": INSTANCE_NAMES, "per_problem_solver_limit_seconds": 30,
    })
    results = []
    with zipfile.ZipFile(args.original_inputs / "Group1_MPS_files.zip") as models, zipfile.ZipFile(
        args.original_inputs / "Group1_Incumbents.zip"
    ) as starts:
        for instance in INSTANCE_NAMES:
            target = args.out / instance
            target.mkdir()
            member = f"Group1_MPS_files/{instance}_t45.mps"
            start_member = f"T45/T45_{instance}.mst"
            mps = target / f"{instance}_t45.mps"
            mps.write_bytes(models.read(member))
            published_raw = starts.read(start_member)
            (target / "published-original.mst").write_bytes(published_raw)
            published = {}
            for line in published_raw.decode("utf-8").splitlines():
                if not line or line.startswith("#"):
                    continue
                name, value = line.split()
                if name in published:
                    raise ValueError("duplicate_published_variable")
                published[name] = float(value)
            _, _, _, _, integers, _ = read_original_model(mps)
            if set(published) != integers:
                raise ValueError("published_start_is_not_exact_original_integer_set")
            model = Model(instance)
            model.setLogfile(str(target / "native-lp-completion.log"))
            model.readProblem(str(mps))
            model.setIntParam("parallel/maxnthreads", 1)
            model.setRealParam("limits/time", 30)
            model.setRealParam("numerics/feastol", 1e-8)
            variables = model.getVars(transformed=False)
            for variable in variables:
                if variable.name in published:
                    value = published[variable.name]
                    model.chgVarLb(variable, value)
                    model.chgVarUb(variable, value)
            model.optimize()
            solution = model.getBestSol()
            result = {"instance": instance, "original_mps_member": member,
                      "published_start_member": start_member, "fixed_published_integers": len(published),
                      "status": str(model.getStatus()), "solver_seconds": model.getSolvingTime(),
                      "claim": "continuous completion conditional on published routes only",
                      "global_milp_bound": None, "score": None}
            if solution is not None:
                values = {v.name: model.getSolVal(solution, v) for v in variables}
                write(target / "complete-original-model-values.json", values)
                check = verify(mps, values, model.getSolObjVal(solution))
                write(target / "independent-original-model-check.json", check)
                result["independent_check"] = check
                if not check["feasible"] or not check["objective_consistent"]:
                    write(target / "result.json", result)
                    raise ValueError("published_route_completion_fails_original_model")
            else:
                result["independent_check"] = None
            write(target / "result.json", result)
            results.append(result)
            print(json.dumps(result, allow_nan=False), flush=True)
            model.freeProb()
    write(args.out / "execution-terminal.json", {"at": now(), "wall_seconds": time.perf_counter() - start,
          "results": results, "native_code": 0, "scope": "public-reference control; benchmark and independent algorithm incomplete"})


if __name__ == "__main__":
    main()
