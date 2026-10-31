"""Render actual full numeric delivery assessments and independently verified economic bounds."""
import argparse
import json
import os
from pathlib import Path


def read(p):
    return json.loads(p.read_text(encoding="utf-8"))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--run", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    a = p.parse_args(); a.out.mkdir(parents=True, exist_ok=False)
    os.environ["MPLCONFIGDIR"] = str(a.out/"mpl-config")
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.ticker import FuncFormatter
    fig, axes = plt.subplots(1, 2, figsize=(11, 5.2), layout="constrained")
    data, lines = [], []
    for axis, label in zip(axes, ["native_rate_validation_vc05", "native_rate_validation_vc03"]):
        cold = read(a.run/(label+"-cold.assessment.json"))
        method = read(a.run/(label+"-class-pair.assessment.json"))
        lo = method["bound_checks"]["lower"]["lower_bound_float"]
        hi = method["bound_checks"]["upper"]["upper_bound_float"]
        costs = [x["mathematical_check"]["independent_objective"] for x in [cold, method]]
        axis.axhspan(lo, hi, color="#518762", alpha=.13, label="Verified interval containing integer optimum")
        axis.bar([0, 1], costs, width=.48, color=["#2864a7", "#c36b22"], zorder=3)
        axis.axhline(lo, color="#33724c", ls="--", lw=1.2, label="Exact weak-duality lower bound")
        axis.axhline(hi, color="#518762", ls=":", lw=1.2, label="Exact feasible route completion")
        axis.set_xticks([0, 1], ["Cold plan", "Class-pair plan"])
        axis.set_ylim(0, max(costs)*1.18)
        axis.yaxis.set_major_formatter(FuncFormatter(lambda x, _: f"{x:,.0f}"))
        axis.set_ylabel("Declared-model operating cost (lower is better)")
        axis.set_title(label.replace("_validation_", "\nvalidation_") + "\nBoth numeric deliveries valid; science unreviewed", fontsize=10)
        for i, cost in enumerate(costs):
            axis.text(i, cost+max(costs)*.02, f"{cost:,.1f}", ha="center", fontsize=9)
        axis.spines[["top", "right"]].set_visible(False)
        axis.grid(axis="y", alpha=.2)
        axis.legend(fontsize=7, loc="upper right")
        record={"input": label, "cold": cold, "class_pair": method}
        data.append(record)
        for name, item in [("cold", cold), ("class-pair", method)]:
            q=item["economic_measurement"]
            lines.append(f"| {label} / {name} | {q['submitted_numerical_cost']:.9f} | {lo:.9f} | {hi:.9f} | {q['submitted_ratio_to_verified_reference']:.9f} | {q['submitted_gap_to_lower_bound']:.6%} |")
    fig.suptitle("Correct operating plans have different economic quality\nBound witnesses do not establish an optimum or heavy-benchmark qualification", fontsize=12)
    fig.savefig(a.out/"actual-economic-quality.png", dpi=170);plt.close(fig)
    errors=[read(a.run/('assess-wrong-'+mode+'.assessment.json')) for mode in ['omit-alpha-cost','omit-exit-service']]
    report='''# Economic measurement and complete numeric deliveries

This work evaluates disclosed construction-validation inputs. It is not a new
frozen benchmark, model grade, independent scientific review or candidate-hours
qualification. Earlier engineering scores remain unchanged.

Four actual closed deliveries were read without rerunning their optimizers or
exports. The same checker recomputed the whole declared model, raw operational
semantics, all positive arcs, port-period ledgers, economic tables and path-flow
coverage. Both valid outputs per input retain their different economic costs.

| Input / plan | Numerical cost P | Verified lower L | Verified feasible upper U | P / U | Gap to L (remaining uncertainty included) |
| --- | --- | --- | --- | --- | --- |
'''+"\n".join(lines)+'''

![Actual numeric quality and bound uncertainty](actual-economic-quality.png)

L is independently verified from rational Lagrangian multipliers and all
original variable bounds. A floating LP solve only proposes the multipliers;
its reported objective is not accepted as proof. U is a separate exact rational
inventory/alpha completion of the already obtained integer route. Every row,
bound and integer domain was checked exactly. The original submitted P and
stored vectors were retained; this new completion does not rewrite history.

The interval [L,U] contains the integer optimum of the finite decimal MPS.
Its width is unresolved: it is not a measured error of the class-pair plan.
Numerically feasible submitted plans use the declared tolerances and do not
automatically inherit the exact rational upper witness. No conditional-neighborhood
bound, rounded website value or parent-instance optimum was substituted.

The raw objective remains primary. P/U is a descriptive ratio to an explicitly
feasible reference, with values below 1 permitted for better submissions. A
reference ratio of 1 is not 100 points, an optimality certificate or a quality
threshold. The bounded relative-gap convention follows the optimization
literature; no timing integral or worker-hours conclusion is computed here.

## Real error programmes through the same checker

Two native operating-report programmes consumed the same actual closed plan
and wrote complete new numeric deliveries. One booked alpha loss/shortfall at
zero expense; one treated artificial terminal exits as no inventory service.
The former misreported the economic objective, while the latter retained the
right mathematical plan/objective but supplied a wrong operating ledger.
'''+"\n".join(f"\n- {x['engineering_status']}: `{x['error']}`." for x in errors)+'''

Both producer processes exited 0; the same delivery checker returned 4 with
those concrete contract errors. Unreviewed scientific material and final scores
remain null. These error controls validate the specified domain errors, not
heavy-task difficulty or the complete scientific task.

## Remaining task work

A fair future unknown-input task, full scientific quality anchors, complete
reference research/handoff and one concentrated independent whole-case review
still need completion. Later fresh studies must establish actual discrimination
and useful work; the two disclosed inputs cannot be relabeled private heldout.
No new candidate, repeated paired study, old solver run or component qualification
was started. Full rational witnesses, raw/MPS/variables/CSV and original logs
remain external with an explicit repository projection manifest.
'''
    (a.out/"README.md").write_text(report, encoding="utf-8")
    (a.out/"report-data.json").write_text(json.dumps({"valid_deliveries":data,"actual_errors":errors,"total_score":None},indent=2,allow_nan=False)+'\n',encoding="utf-8")
    print(json.dumps({"numeric_deliveries":len(data)*2,"actual_error_programmes":len(errors),"total_score":None}),flush=True)


if __name__ == "__main__":
    main()
