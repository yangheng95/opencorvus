"""Render actual original-problem quality and inventory; perform no optimization."""
import argparse
import datetime
import importlib.metadata
import json
import os
from pathlib import Path
import re
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    os.environ["MPLCONFIGDIR"] = str(args.out / "mpl-config")
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.ticker import FuncFormatter

    terminal = json.loads((args.run / "execution-terminal.json").read_text(encoding="utf-8"))
    results = terminal["results"]
    plt.rcParams.update({"font.size": 9, "axes.spines.top": False, "axes.spines.right": False,
                        "figure.facecolor": "white", "axes.facecolor": "#fbfcfe"})
    fig, axes = plt.subplots(1, len(results), figsize=(13.8, 4.8), layout="constrained")
    inventory_fig, inventory_axes = plt.subplots(1, len(results), figsize=(13.8, 4.8), layout="constrained")
    summaries = []
    for index, result in enumerate(results):
        root = args.run / result["instance"]
        events = [json.loads(x) for x in (root / "incumbent-events.jsonl").read_text().splitlines()]
        checks = [x["independent_original_check"] for x in events]
        if any(not x["feasible"] or not x["objective_consistent"] for x in checks):
            raise ValueError("quality_plot_requires_verified_original_plans")
        times = [x["wall_seconds"] for x in events]
        costs = [x["independent_objective"] for x in checks]
        if not costs:
            raise ValueError("quality_plot_has_no_actual_incumbents")
        final_cost = result["independent_validation"]["independent_objective"]
        end = result["whole_read_and_solve_wall_seconds"]
        axis = axes[index]
        axis.axvspan(0, times[0], color="#d9dee7", alpha=.5)
        axis.step(times + [end], costs + [final_cost], where="post", color="#245fa6", lw=1.8,
                  label="Verified incumbent")
        axis.scatter([times[0]], [costs[0]], color="#b86513", s=22, zorder=3, label="First feasible")
        if result["dual_bound"] is not None:
            axis.scatter([end], [result["dual_bound"]], marker="^", color="#a63e46", s=35,
                         zorder=4, label="Terminal bound")
        if min(costs + [final_cost]) > 0:
            axis.set_yscale("log")
        axis.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:,.0f}"))
        axis.set_xlim(0, max(61, end + 1))
        axis.set_title(result["instance"].replace("_VC", "\nVC"), fontsize=10)
        axis.set_xlabel("Observed problem wall seconds")
        axis.grid(axis="y", alpha=.18)
        axis.text(.98, .95, f"{costs[0]:,.0f} → {final_cost:,.0f}", transform=axis.transAxes,
                  ha="right", va="top", fontsize=9)
        if index == 0:
            axis.set_ylabel("Original MPS cost · lower is better (log)")
            axis.legend(loc="upper right", bbox_to_anchor=(1, .83), fontsize=7)

        values = json.loads((root / "final-values.json").read_text(encoding="utf-8"))
        stocks, slack = {}, {}
        for name, value in values.items():
            match = re.fullmatch(r"supplyAtNode_\((\d+),(\d+)\)", name)
            if match:
                stocks.setdefault(int(match.group(1)), {})[int(match.group(2))] = value
            match = re.fullmatch(r"endingSupplyInRegion_(\d+)", name)
            if match:
                stocks.setdefault(int(match.group(1)), {})[120] = value
            match = re.fullmatch(r"alphaSlack_\((\d+),(\d+)\)", name)
            if match:
                t = int(match.group(2))
                slack[t] = slack.get(t, 0) + value
        if not stocks or not slack:
            raise ValueError("original_group2_inventory_fields_unmapped")
        inventory_axis = inventory_axes[index]
        for port, points in sorted(stocks.items()):
            ts = sorted(points)
            inventory_axis.step(ts, [points[t] for t in ts], where="post", lw=1.1, label=f"Port {port}")
        slack_axis = inventory_axis.twinx()
        ts = sorted(slack)
        slack_axis.bar([t + .5 for t in ts], [slack[t] for t in ts], color="#747e8a", alpha=.20, width=.8)
        slack_axis.set_ylabel("Alpha: loss / shortfall units", fontsize=8, color="#5d6672")
        inventory_axis.set_title(result["instance"].replace("_VC", "\nVC"), fontsize=10)
        inventory_axis.set_xlim(0, 120)
        inventory_axis.set_xlabel("Original model time index")
        inventory_axis.set_ylabel("Inventory units")
        inventory_axis.grid(axis="y", alpha=.15)
        inventory_axis.legend(loc="upper right", fontsize=7)
        summaries.append({"instance": result["instance"], "event_wall_seconds": times,
                          "independently_recomputed_costs": costs, "final_original_cost": final_cost,
                          "terminal_original_bound": result["dual_bound"], "stocks": stocks,
                          "alpha_loss_shortfall": slack,
                          "scope": "author research actual plans; not a grade or proven optimum"})
    fig.suptitle("Correct plans can have very different economic quality\n"
                 "Author study · original MIRPLIB models · every shown incumbent independently checked", fontsize=12)
    inventory_fig.suptitle("Final original-model inventories and actual loss / shortfall\n"
                           "Feasibility does not imply zero penalties · time-limited plans, not proven optima", fontsize=12)
    fig.savefig(args.out / "actual-quality-trajectories.png", dpi=160)
    inventory_fig.savefig(args.out / "actual-inventories-and-shortfall.png", dpi=160)
    plt.close(fig)
    plt.close(inventory_fig)
    metadata = {"at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "run": str(args.run),
                "python": sys.version, "executable": sys.executable,
                "packages": {k: importlib.metadata.version(k) for k in ["matplotlib", "numpy"]},
                "scope": "actual terminal research data; no new solver, model score or benchmark qualification",
                "data": summaries}
    (args.out / "plot-data.json").write_text(json.dumps(metadata, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"figures": ["actual-quality-trajectories.png", "actual-inventories-and-shortfall.png"],
                      "scope": metadata["scope"], "packages": metadata["packages"]}))


if __name__ == "__main__":
    main()
