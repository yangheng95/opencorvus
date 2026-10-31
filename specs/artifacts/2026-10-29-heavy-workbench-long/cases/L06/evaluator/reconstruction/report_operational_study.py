"""Render and describe the actually exported original plans; do not solve or grade them."""
import argparse
import csv
import datetime
import importlib.metadata
import json
import os
from pathlib import Path
import sys


def rows(path):
    with path.open(encoding="utf-8", newline="") as stream:
        return list(csv.DictReader(stream))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--index", type=Path, required=True)
    parser.add_argument("--published-context", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    os.environ["MPLCONFIGDIR"] = str(args.out / "mpl-config")
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.lines import Line2D
    from matplotlib.patches import Patch

    index = json.loads(args.index.read_text(encoding="utf-8"))
    published = json.loads(args.published_context.read_text(encoding="utf-8"))
    context = {r[1]: {"published_cost": float(r[3]), "published_bound": float(r[4])}
               for r in published["selected_raw_rows"]}
    colors = {"loaded_voyage": "#2864a7", "empty_return": "#ce7927", "waiting": "#d9dfe7"}
    fig, axes = plt.subplots(len(index["exports"]), 1, figsize=(12.5, 10.5), layout="constrained")
    summaries = []
    for axis, item in zip(axes, index["exports"]):
        directory = Path(item["directory"])
        closure = json.loads((directory / "operational-closure.json").read_text(encoding="utf-8"))
        if not closure["original_check"]["feasible"] or closure["original_check"]["objective_consistent"] is False:
            raise ValueError("operational_report_requires_actual_original_plan_check")
        paths = rows(directory / "anonymous-vessel-paths.csv")
        ids = list(dict.fromkeys(x["anonymous_path_id"] for x in paths))
        positions = {name: n for n, name in enumerate(ids)}
        for row in paths:
            y = positions[row["anonymous_path_id"]]
            t, u = int(row["from_time_index"]), int(row["to_time_index"])
            if row["kind"] in colors:
                axis.broken_barh([(t, u - t)], (y - .32, .64), facecolors=colors[row["kind"]])
            elif row["kind"] == "initial_source":
                axis.scatter([u], [y], marker="o", s=11, color="#222b38", zorder=3)
            elif row["kind"] == "terminal_exit":
                axis.scatter([t], [y], marker="D", s=13, color="#222b38", zorder=3)
            else:
                raise ValueError("unmapped_original_operational_action")
        axis.set_yticks(range(len(ids)), [x.replace("class", "C").replace("-path", "/P") for x in ids], fontsize=7)
        axis.set_ylim(len(ids) - .4, -.8)
        axis.set_xlim(0, closure["original_model_periods"])
        axis.set_title(f"{item['instance']} · {len(ids)} anonymous paths · cost {closure['original_cost']:,.2f}", fontsize=10)
        axis.set_xlabel("Original model time index")
        axis.grid(axis="x", alpha=.15)
        axis.spines[["right", "top"]].set_visible(False)
        native_context = context[item["instance"]]
        summaries.append({"instance": item["instance"], "closure": closure,
                          "actual_export_directory": item["directory"],
                          "execution_source": item["execution_source"],
                          "published_context": native_context,
                          "excess_over_published_feasible_cost_ratio":
                          closure["original_cost"] / native_context["published_cost"] - 1,
                          "published_comparison_scope": "Rounded webpage context only, not an exact optimum, new quality threshold or benchmark score"})
    handles = [Patch(facecolor=colors[k], label=label) for k, label in [
        ("loaded_voyage", "Loaded voyage"), ("empty_return", "Empty return"), ("waiting", "Wait")]]
    handles += [Line2D([0], [0], marker="o", color="none", markerfacecolor="#222b38", markersize=4, label="Initial availability"),
                Line2D([0], [0], marker="D", color="none", markerfacecolor="#222b38", markersize=4, label="Terminal exit / service")]
    fig.legend(handles=handles, loc="outside lower center", ncol=5, fontsize=8)
    fig.suptitle("Actual aggregate fleet flows, decomposed into anonymous paths\n"
                 "No new optimization · paths do not identify original named vessels · sink exits do not imply a future destination", fontsize=11)
    fig.savefig(args.out / "actual-operational-paths.png", dpi=160)
    plt.close(fig)
    table = ["| Original instance | Paths | Port-period rows | Original cost | Published rounded feasible cost |",
             "| --- | --- | --- | --- | --- |"]
    for s in summaries:
        c = s["closure"]
        table.append(f"| {s['instance']} | {c['anonymous_paths']} | {c['port_period_rows']} | {c['original_cost']:.8f} | {s['published_context']['published_cost']:.0f} |")
    body = "\n".join(table)
    report = f"""# Original maritime planning: operational study

This is an actual author research delivery, not a frozen benchmark or model score.
The three already closed original plans were exported without a new solve.

{body}

The original rows, bounds, integrality and economic objective are recomputed by
the standard-library original-MPS reader. Operational ledgers then match the raw
initial fleet and inventory, class capacities, production/consumption prefix,
berths, travel-time tables, coordinate-based travel and port costs, and penalties.
The raw files describe 360 periods; the exact selected MPS models describe 120.
Only that original 120-period prefix is interpreted.

## Economic findings

Every plan is valid, while material penalties remain. The first plan pays
approximately 23,138 in lost-production/stockout costs; the other two pay
approximately 129,108 and 134,215. Those are original economic penalties, not
violations of a newly invented zero-loss condition. Their route choices therefore
still leave substantive room for better decisions.

The [published MIRPLIB table](https://mirplib.scl.gatech.edu/index.php/instances?order=field_inst_period&sort=asc)
provides the scalar context shown above. These are rounded website observations,
not independently checked solution vectors or exact optimality certificates.
The costs are not turned into a new pass threshold or a 100-point aggregate.
The local plans remain time-limited and are substantially more expensive than
the published feasible-cost context. Completion of this report does not make
their optimization quality excellent.

## Operational findings and limits

Initial source arcs pay the original destination port fee. Terminal sink arcs
also load/unload a full class cargo and use a berth at their origin; their
objective includes the original terminal adjustment. The artificial sink is not
a real next port, and its cargo is not claimed as demand delivered in the future.
Removing those arcs from the operating ledger would silently break the model.

The path plot decomposes all original positive integer class flow. Each arc is
consumed exactly its original number of times. Anonymous paths are one possible
assignment of aggregate flows, not an identified schedule for uniquely named
real vessels. Hard constraints and costs remain the original MPS facts.

![Actual original fleet paths](actual-operational-paths.png)

The full CSVs and original vectors remain in the external research root. The
index records their actual directories and the two successful export-source
versions; it does not pretend all three ran under the later parser revision.
The initial source-fee and multi-class parsing errors are retained as facility
failures, followed only by the affected export reruns. No solver was repeated.

## Unfinished work

A stronger researched method, prospective quality calibration, complete new
task wrong-programme evidence, one concentrated whole-case independent review
and later legitimate fresh studies remain pending. Neither heavy-task
qualification, candidate discrimination nor effective hours is established.
"""
    (args.out / "operational-study.md").write_text(report, encoding="utf-8")
    handoff = """# Native operational handoff

The exporter uses only Python standard-library modules and the current
verify_original_mps.py. It reads explicitly located original MPS and complete
values, an optional genuine objective claim and the declared computation scope,
plus the original Group2 data-only ZIP. It does not require an author's result
filename or fabricate a native result record. Use a fresh output directory,
retaining all previous failures.

```powershell
python -B export_operational_plan.py --original-mps <original-matrix.mps> --values <actual-complete-values.json> --reported-objective <actual-native-claim> --computation-status <actual-status> --computation-scope original_model --raw-archive <Group2_data_format_only_files.zip> --instance <original-instance-name> --out <new-operational-directory>
```

The successful output contains class-arc-plan.csv, anonymous-vessel-paths.csv,
port-period-ledger.csv, economic-components.csv, operational-closure.json,
the original mathematical check and execution-started/terminal.json. A facility
failure instead preserves execution-error.json and the completed prior facts.
The exporter does not run an optimizer or silently switch to another model.
Omit the objective claim when genuinely unavailable; consistency then remains
null, not a self-comparison. Use conditional_pass for a neighborhood method;
its conditional bound is not accepted as an original-model lower bound.

The report renderer additionally uses the declared plot-requirements.txt. Its
index names actual successful exports; published-context JSON is a recorded
scalar observation of the original MIRPLIB table, not a current web query.

```powershell
python -B report_operational_study.py --index <operational-study-index.json> --published-context <group2-published-scalar-context-rows.json> --out <new-report-directory>
```

The data-fetch, actual original solver and first quality-plot commands are in
the reconstruction README. Current studies are closed and must not be repeated
for qualification. A new end-to-end cold rebuild has not been performed for this
operational report. The source versions and real execution receipts are the
authority for what actually ran, not this command example.
"""
    (args.out / "handoff.md").write_text(handoff, encoding="utf-8")
    result = {"at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "argv": sys.argv,
              "python": sys.version, "executable": sys.executable,
              "packages": {k: importlib.metadata.version(k) for k in ["matplotlib", "numpy"]},
              "data": summaries, "scope": "Actual closed operational export report, not solver execution, grade or benchmark qualification"}
    (args.out / "report-data.json").write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"cases": len(summaries), "figure": "actual-operational-paths.png", "scope": result["scope"]}))


if __name__ == "__main__":
    main()
