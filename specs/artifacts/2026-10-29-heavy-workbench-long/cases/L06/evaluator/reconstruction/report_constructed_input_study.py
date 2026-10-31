"""Render the actual new-input construction pipeline, without rerunning construction or optimization."""
import argparse
import datetime
import importlib.metadata
import json
import os
from pathlib import Path
import sys
import zipfile

from export_operational_plan import raw_data


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--run", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    a = p.parse_args()
    a.out.mkdir(parents=True, exist_ok=False)
    os.environ["MPLCONFIGDIR"] = str(a.out / "mpl-config")
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.ticker import FuncFormatter

    terminal = load(a.run / "owner-terminal.json")
    fig, axes = plt.subplots(2, len(terminal["results"]), figsize=(12, 8), layout="constrained")
    table, data = [], []
    for column, result in enumerate(terminal["results"]):
        root = a.run / result["label"]
        recipe = load(root / "input/recipe.json")
        upper, lower = axes[0, column], axes[1, column]
        profiles = recipe["rate_profiles"]
        with zipfile.ZipFile(result["raw_archive"]) as archive:
            metadata, ports, classes, vessels, travel = raw_data(archive, result["label"])
        production_ports = [j for j, port in ports.items() if port["type"] == ["Loading"]]
        if len(production_ports) != 1:
            raise ValueError("registered_recipe_production_port_identity")
        production_port = production_ports[0]
        for key, values in sorted(profiles.items(), key=lambda item: int(item[0])):
            is_production = int(key) == production_port
            upper.plot(range(len(values)), values, lw=1.8 if is_production else 1,
                       color="#69737f" if is_production else None,
                       label="Production (balanced total)" if is_production else "Demand port " + key)
        upper.set_title(result["label"].replace("_validation_", "\nvalidation_") + f" · seed {result['seed']}", fontsize=10)
        upper.set_xlabel("Model period index (not work time)")
        upper.set_ylabel("Physical quantity per period")
        upper.legend(fontsize=7)
        cold = result["cold"]
        cold_root = root / "cold" / result["label"]
        event_file = cold_root / "incumbent-events.jsonl"
        cold_events = [json.loads(x) for x in event_file.read_text(encoding="utf-8").splitlines()] if event_file.exists() else []
        ct = [x["wall_seconds"] for x in cold_events]
        cc = [x["independent_original_check"]["independent_objective"] for x in cold_events]
        cold_end = cold["whole_read_and_solve_wall_seconds"]
        if cc:
            lower.step(ct + [cold_end], cc + [cold["independent_validation"]["independent_objective"]],
                       where="post", label="New-input cold SCIP", color="#2864a7", lw=1.7)
        method = result["class_pair"]
        method_events = []
        if method is not None:
            for stage in sorted((root / "class-pair").glob("stage-*")):
                ep = stage / "actual-best-events.jsonl"
                if ep.exists():
                    method_events.extend(json.loads(x) for x in ep.read_text(encoding="utf-8").splitlines())
            mt = [cold_end] + [cold_end + x["arm_wall_seconds"] for x in method_events]
            mc = [method["initial_original_cost"]] + [x["original_objective"] for x in method_events]
            lower.step(mt + [cold_end + method["actual_method_wall_seconds"]], mc + [method["final_original_cost"]],
                       where="post", label="Class-pair continuation", color="#c36b22", lw=1.7)
        lower.axvline(cold_end, color="#69737f", ls=":", lw=.9)
        lower.set_yscale("log")
        lower.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:,.0f}"))
        lower.set_ylabel("Declared generated-model cost (log)")
        lower.set_xlabel("Sum of measured optimization-stage walls (seconds)")
        lower.legend(fontsize=7)
        for axis in [upper, lower]:
            axis.grid(axis="y", alpha=.18)
            axis.spines[["top", "right"]].set_visible(False)
        cold_cost = cold["independent_validation"]["independent_objective"] if cold["independent_validation"] else None
        method_cost = method["final_original_cost"] if method else None
        table.append(f"| {result['label']} | {result['seed']} | {cold_cost} | {method_cost} | {result['method_dependency']} |")
        ledgers = [load(Path(x["directory"]) / "operational-closure.json") for x in result["operational_exports"]]
        data.append({"label": result["label"], "recipe": recipe, "result": result,
                     "cold_event_count": len(cold_events), "method_event_count": len(method_events),
                     "actual_operational_closures": ledgers})
    fig.suptitle("New raw data → constructed models → actual native plans and operating ledgers\n"
                 "Synthetic construction validation · not official MIRPLIB test instances or a private benchmark set", fontsize=11)
    fig.savefig(a.out / "actual-constructed-inputs.png", dpi=160)
    plt.close(fig)
    report = """# Raw-to-model construction and new-input execution

These are synthetic construction-validation inputs, not official MIRPLIB
instances, company records, a future private heldout, model grades or heavy-task
qualification. Their recipes and seeds were registered before generation.

The independently implemented operating-data constructor was compared with all
three original published models. Full variable domains/integrality, constraint
functions and objective functions matched after substituting fixed variables.
Only redundant zero source arcs/dummy variables were omitted; actual initial
fleet injections and their port fees were retained. This was algebraic model
verification, not a source checksum and not a rerun of the original optimizers.

## Actual new-input execution

| Generated validation input | Seed | Cold plan cost | Continued class-pair plan cost | Actual dependency |
| --- | --- | --- | --- | --- |
""" + "\n".join(table) + """

![Actual generated rates and optimization outcomes](actual-constructed-inputs.png)

Demand uses the fixed cyclic recipe; total production equals aggregate demand
each period. Fleet size, geometry, capacities, berth limits, prices and travel
times retain the original operating values. The variation removes reliance on
the exact published plan but is not claimed to make a task intrinsically harder.
No seed was reselected after seeing a solve. These disclosed validation inputs
must not later be mislabeled as fresh private tests.

Every newly accepted vector and final plan was recomputed against its complete
declared generated MPS. For produced plans, actual operating ledgers checked
the raw rate arrays, fleet, capacity, berth, travel and cost semantics; missing
initial plans leave downstream dependencies explicitly unexecuted. The full original
inputs, generated MPS, vectors and operating CSVs remain in the external run root.
No published optimum or parent-instance cost was substituted as a target for
the generated problems.

The first source capsule failed on an unused top-level CLI profile import before
owner startup or any input/solve. That failure and its exact source were retained;
the source-closure revision moved the CLI-only dependency into main and sealed
the full dependencies. Both registered inputs then used that revised source.
No completed original solver, paired study, candidate or component qualification
was repeated.

## Interpreting quality and time

The cold optimizer received its registered 60-second research allowance; the
subsequent class-pair pass received a nominal 120-second method-wall allowance.
The latter starts from an actual cold plan, so an improvement is not evidence
of superiority over a contemporaneous equal-time global continuation. That
different comparison was performed in the prior original-model paired study.
Here the purpose is complete new-data execution and operational correctness.

The cost chart concatenates measured optimization-stage walls and excludes
generation, process-start, export and plotting work; model periods in the top
chart are not worker time. Native logs and real wrapper timestamps are retained.
Conditional subproblem bounds/optimal statuses are not full-model optimum
proofs. L01 remained active; there is no hardware speed, model cost or effective
candidate-hours claim.

## Reproduction and unfinished benchmark work

The current source uses one raw parser, one constructor, the current mature
original-model optimizer primitive, the unchanged class-pair method and one
numerical MPS checker. It does not select expected values from known solutions.
The pre-execution source archives, the dependency-closure revision and all real
commands identify exactly what ran. A new full independent cold rebuild/review
of this complete reconstructed task has not been performed.

Formal prospective scientific quality calibration, complete task wrong-programme
evidence, one concentrated whole-case independent review, later legitimate
fresh studies and effective-hours evidence remain pending. The old engineering
contracts/scores remain immutable; there is no new 100-point line or version loop.
"""
    (a.out / "README.md").write_text(report, encoding="utf-8")
    record = {"at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "argv": sys.argv,
              "python": sys.version, "executable": sys.executable,
              "packages": {k: importlib.metadata.version(k) for k in ["matplotlib", "numpy"]},
              "data": data, "model_score": None, "benchmark_qualification": "not established"}
    (a.out / "report-data.json").write_text(json.dumps(record, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"validation_inputs": len(data), "all_new_plans_executed": terminal["all_new_plans_executed"],
                      "model_score": None}), flush=True)


if __name__ == "__main__":
    main()
