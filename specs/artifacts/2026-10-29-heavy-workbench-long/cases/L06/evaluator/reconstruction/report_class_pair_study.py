"""Report the completed paired original-model method study and its actual operating ledgers."""
import argparse
import datetime
import importlib.metadata
import json
import os
from pathlib import Path
import sys


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--study", type=Path, required=True)
    parser.add_argument("--operations-index", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    os.environ["MPLCONFIGDIR"] = str(args.out / "mpl-config")
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.ticker import FuncFormatter

    terminal = load(args.study / "owner-terminal.json")
    operations = load(args.operations_index)
    ops = {(x["instance"], x["strategy"]): load(Path(x["directory"]) / "operational-closure.json")
           for x in operations["exports"]}
    cases = list(dict.fromkeys(x["instance"] for x in terminal["results"]))
    fig, axes = plt.subplots(1, len(cases), figsize=(12, 4.8), layout="constrained")
    colors = {"global": "#2864a7", "class-pairs": "#c36b22"}
    names = {"global": "Global SCIP, warm input", "class-pairs": "Serial class-pair pass"}
    data, comparison, table, economic = [], [], [], []
    for axis, case in zip(axes, cases):
        arms = {x["strategy"]: x for x in terminal["results"] if x["instance"] == case}
        if set(arms) != set(names):
            raise ValueError("paired_original_study_arm_identity")
        for strategy, result in arms.items():
            if not result["original_model_feasible"] or not result["original_model_objective_consistent"]:
                raise ValueError("paired_original_study_requires_verified_plans")
            root = args.study / (case + "--" + strategy)
            times, costs = [0.0], [result["initial_original_cost"]]
            raw_events = []
            for stage in sorted(p for p in root.iterdir() if p.is_dir() and p.name.startswith("stage-")):
                event_file = stage / "actual-best-events.jsonl"
                if event_file.exists():
                    for line in event_file.read_text(encoding="utf-8").splitlines():
                        record = json.loads(line)
                        if not record["original_feasible"] or not record["objective_consistent"]:
                            raise ValueError("actual_event_original_verification")
                        raw_events.append(record)
                        times.append(record["arm_wall_seconds"])
                        costs.append(record["original_objective"])
            times.append(result["actual_method_wall_seconds"])
            costs.append(result["final_original_cost"])
            axis.step(times, costs, where="post", color=colors[strategy], label=names[strategy], lw=1.8)
            axis.scatter([times[-1]], [costs[-1]], color=colors[strategy], s=25, zorder=4)
            closure = ops[case, strategy]
            if abs(closure["original_cost"] - result["final_original_cost"]) > 1e-6:
                raise ValueError("paired_operating_plan_original_result_binding")
            parts = {x["component"]: x["original_objective_contribution"] for x in closure["economic_components"]}
            penalty = parts["lost_production"] + parts["stockout"]
            economic.append(f"| {case} | {strategy} | {parts['loaded_voyage']:.2f} | {parts['empty_return']:.2f} | {penalty:.2f} | {parts['initial_source'] + parts['terminal_exit']:.2f} |")
            table.append(f"| {case} | {strategy} | {result['final_original_cost']:.8f} | {result['actual_method_wall_seconds']:.4f} | {result['wall_overrun_seconds']:.4f} | {result['stages_finished']}/{result['stages_registered']} |")
            data.append({"instance": case, "strategy": strategy, "result": result,
                         "plot_wall_seconds": times, "plot_original_costs": costs,
                         "initial_point_scope": "Supplied already verified input, not a newly discovered solver incumbent",
                         "raw_actual_event_count": len(raw_events), "operational_closure": closure})
        initial = arms["global"]["initial_original_cost"]
        if abs(initial - arms["class-pairs"]["initial_original_cost"]) > 1e-6:
            raise ValueError("paired_actual_initial_cost_identity")
        axis.scatter([0], [initial], color="#596371", marker="o", s=30, zorder=5, label="Supplied valid start")
        axis.set_title(case.replace("_VC", "\nVC"), fontsize=10)
        axis.set_yscale("log")
        axis.yaxis.set_major_formatter(FuncFormatter(lambda x, _: f"{x:,.0f}"))
        axis.set_ylabel("Original MPS cost · lower is better (log)")
        axis.set_xlabel("Actual method wall seconds, including setup and records")
        axis.grid(axis="y", alpha=.18)
        axis.spines[["top", "right"]].set_visible(False)
        axis.legend(fontsize=7)
        comparison.append({"instance": case, "initial_original_cost": initial,
                           "global_final_cost": arms["global"]["final_original_cost"],
                           "class_pair_final_cost": arms["class-pairs"]["final_original_cost"],
                           "class_pair_minus_global": arms["class-pairs"]["final_original_cost"] - arms["global"]["final_original_cost"]})
    fig.suptitle("One pre-registered paired method study on the unchanged original models\n"
                 "Same supplied starts · nominal 120 s per arm · conditional bounds are not global bounds", fontsize=11)
    fig.savefig(args.out / "actual-method-comparison.png", dpi=160)
    plt.close(fig)
    better = sum(x["class_pair_minus_global"] < -1e-6 for x in comparison)
    report = """# Full-horizon class-pair method study

This is original-problem author research, not a model score or qualified heavy benchmark.
The counterbalanced study was registered before execution. Both arms used the same
actual prior feasible vector for each instance; no published route solution was supplied.
The original mature SCIP algorithms were retained in both arms.

| Instance | Strategy | Original feasible cost | Actual method wall s | Nominal overrun s | Stages |
| --- | --- | --- | --- | --- | --- |
""" + "\n".join(table) + f"""

The class-pair arm had lower final cost than the warm global arm on {better}/{len(cases)}
registered instances. Every retained plan and actual native best-solution event
was independently checked against the original rows, bounds, integrality and
objective; fixed other-class integer arcs were also checked for each neighborhood.
The initial point in the chart is the supplied valid input, not a new discovery.

![Actual method comparison](actual-method-comparison.png)

## Operating interpretation

All four new resulting plans were actually exported with the explicit original
MPS, full vector and genuine native objective claim recorded in the mathematical
check. The original raw fleet/rates/capacities/travel/cost/berth semantics and
inventory and economic ledgers were reconciled. No new optimization occurred in
that export. Full CSVs and vectors remain in the external scientific root.

| Instance | Strategy | Loaded travel | Empty return | Lost production + stockout | Source fees + terminal adjustment |
| --- | --- | --- | --- | --- | --- |
""" + "\n".join(economic) + """

## Method and evidence limits

The method is inspired by the two-ship neighborhood and serial improvement pass
in the [authors' manuscript, sections 5.2.1 and 5.4](https://optimization-online.org/wp-content/uploads/2014/04/4319.pdf).
Here the variables describe aggregate vessel classes. Every unordered class pair
is released over the entire original horizon once; other-class integer arcs stay
at the current feasible plan, while all original continuous variables remain free.
Pairs are ordered by the predeclared initial unused capacity-time proxy. This is
an adaptation, not a reproduction of that paper's different individual-ship model.

Nominal method wall allocations include setup/check/record costs. Actual measured
wall overruns are shown above; platform solver limit granularity is not disguised
as exact equal resource use. Fast completed neighborhoods carry spare time onward;
the single pass can finish naturally before the allowance. All arms were serial,
with a counterbalanced order, seed zero and one CPU thread; L01 training remained
active. This is not a population-level, exact-hardware, speed or effective-hours claim.

Neighborhood bounds and optimal statuses apply only after fixing other classes.
They are not original-MILP global bounds. The global arm's bounds are solver
reports, not independent exact certificates. A lower objective on these public
instances does not establish unseen-input generalization, absence of contamination,
benchmark discrimination or a new 100-point quality line.

The single-class original instance was not rerun: releasing its full class flow
would duplicate the complete-model neighborhood rather than test the mechanism.
No window/budget tuning, previous cold baseline, old candidate, solver control or
independent whole-case review was repeated. The full task's stronger quality
anchors, prospective calibration, genuine wrong-programme chain and concentrated
whole-case review/future fresh evidence remain unfinished.
"""
    (args.out / "README.md").write_text(report, encoding="utf-8")
    result = {"at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "argv": sys.argv,
              "python": sys.version, "executable": sys.executable,
              "packages": {x: importlib.metadata.version(x) for x in ["matplotlib", "numpy"]},
              "comparisons": comparison, "data": data, "model_score": None,
              "scope": "Actual paired warm-start method research and operational exports; benchmark qualification not established"}
    (args.out / "report-data.json").write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"instances": len(cases), "class_pair_lower_cost": better, "scope": result["scope"]}))


if __name__ == "__main__":
    main()
