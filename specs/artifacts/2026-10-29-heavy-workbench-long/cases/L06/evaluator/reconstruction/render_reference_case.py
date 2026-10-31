"""Produce the required operating figure and handoff from one actual complete reference run."""
import argparse
import csv
import json
import os
from pathlib import Path


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument("--run",type=Path,required=True);p.add_argument("--out",type=Path,required=True);a=p.parse_args()
    a.out.mkdir(parents=True,exist_ok=False);os.environ["MPLCONFIGDIR"]=str(a.out/"mpl-config")
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Patch
    facts=json.loads((a.run/"case-facts.json").read_text(encoding="utf-8"));closure=facts["operating"]
    with (a.run/"operating/anonymous-vessel-paths.csv").open(encoding="utf-8",newline="") as stream:paths=list(csv.DictReader(stream))
    ids=list(dict.fromkeys(x["anonymous_path_id"] for x in paths));positions={x:i for i,x in enumerate(ids)}
    fig,axes=plt.subplots(2,1,figsize=(11,8),layout="constrained",height_ratios=[2,1])
    colors={"loaded_voyage":"#2864a7","empty_return":"#c36b22","waiting":"#d9dfe7"}
    for row in paths:
        y=positions[row["anonymous_path_id"]];t=int(row["from_time_index"]);u=int(row["to_time_index"]);kind=row["kind"]
        if kind in colors:axes[0].broken_barh([(t,u-t)],(y-.3,.6),facecolors=colors[kind])
        else:axes[0].scatter([u if kind=="initial_source" else t],[y],marker="o" if kind=="initial_source" else "D",s=12,color="#222b38")
    axes[0].set_yticks(range(len(ids)),ids,fontsize=7);axes[0].set_ylim(len(ids)-.4,-.8);axes[0].set_xlim(0,closure["original_model_periods"])
    axes[0].set_xlabel("Model period, not worker time");axes[0].set_title("Actual anonymous class-flow paths · exits are services, not future delivery")
    axes[0].legend(handles=[Patch(facecolor=v,label=k) for k,v in colors.items()],loc="upper right",fontsize=8)
    components=closure["economic_components"];axes[1].barh([x["component"] for x in components],[x["original_objective_contribution"] for x in components],color="#2864a7")
    axes[1].set_xlabel("Actual declared-model cost contribution");axes[1].tick_params(axis="y",labelsize=8)
    for axis in axes:axis.spines[["top","right"]].set_visible(False);axis.grid(axis="x",alpha=.15)
    fig.suptitle(f"{facts['instance']} · complete reference delivery · cost {closure['original_cost']:,.6f}\nNumerical validity is not global optimality or a model comparison",fontsize=11)
    fig.savefig(a.out/"actual-reference-operations.png",dpi=160);plt.close(fig)
    lo=facts["bounds"]["lower"]["lower_bound_float"];hi=facts["bounds"]["upper"]["upper_bound_float"]
    body=f"""# Complete assigned-input reference delivery

Input: `{facts['instance']}`. The source-only run consumed its assigned raw and
full MPS, using the existing cold method followed by the unchanged single
class-pair pass. No development result vectors or known objectives were loaded.

Actual cold cost: {facts['cold']['independent_validation']['independent_objective']}.
Actual final cost: {closure['original_cost']}.
Exact-witness optimum-containing interval (decimal display): [{lo}, {hi}].
The interval is not a measured error, and conditional optimal statuses are not
full-model optimality. The submitted numerical cost remains separate from the
exact rational feasible upper witness.

The delivered operator tables cover {closure['anonymous_paths']} anonymous paths
and {closure['port_period_rows']} port-period rows. Every positive class-flow arc,
initial fee, terminal service, inventory balance and economic term was reconciled
to the assigned raw and MPS. Alpha is allowed priced slack, not necessarily an
unavoidable physical loss. Paths do not identify unique original named vessels.

![Actual delivered operating plan and costs](actual-reference-operations.png)

The full original vector, native logs/accepted events, method stages, four actual
CSV tables, numeric assessment, exact witnesses and source map remain beside
this report. `delivery-layout.json` locates the actual numeric files; the checker
accepts any semantically equivalent layout and valid path decomposition.

This is the integration reference required before an actual candidate comparison.
It does not replace that comparison. Scientific research evidence also includes
the earlier explicitly dated, closed original-model paired study and failure
reports; those experiments were not repeated by this run. One concentrated
whole-case scientific review and later fresh results are still pending.
"""
    (a.out/"README.md").write_text(body,encoding="utf-8")
    handoff="""# Native handoff

The declared source map includes run_reference_case.py, run_original_baseline.py,
run_class_pair_study.py, export_operational_plan.py, verify_original_mps.py,
construct_economic_bounds.py, verify_economic_bounds.py,
assess_operating_delivery.py and render_reference_case.py.
Requirements for the compute interpreter are requirements.txt; the report
interpreter uses plot-requirements.txt. Third-party runtimes are declared inputs,
not old solution caches. Use a new owned output directory; preserve this run.

```powershell
python -B run_reference_case.py --model <assigned.mps> --raw-archive <assigned-raw.zip> --instance <assigned-name> --report-python <declared-plot-python.exe> --out <new-owned-output>
```

The numeric profile is the existing 60-second cold solve plus nominal 120-second
method wall, one solver thread and seed0. Actual setup, checks and indivisible
step overruns stay in the recorded facts; they are not candidate effective hours.
The report process is only rendering and does not run an optimizer.
"""
    (a.out/"HANDOFF.md").write_text(handoff,encoding="utf-8")


if __name__=="__main__":main()
