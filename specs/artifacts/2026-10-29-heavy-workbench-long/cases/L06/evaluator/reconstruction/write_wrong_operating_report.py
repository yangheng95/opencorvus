"""Execute two deliberately wrong economic/operating report programmes on an actual closed plan."""
import argparse
import csv
import json
import math
from pathlib import Path
import shutil


def load_csv(p):
    with p.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def save_csv(p, rows):
    with p.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--values", type=Path, required=True)
    p.add_argument("--operating", type=Path, required=True)
    p.add_argument("--mode", choices=["omit-alpha-cost", "omit-exit-service"], required=True)
    p.add_argument("--out", type=Path, required=True)
    a = p.parse_args(); a.out.mkdir(parents=True, exist_ok=False)
    shutil.copyfile(a.values, a.out/"values.json")
    for name in ["class-arc-plan.csv", "anonymous-vessel-paths.csv", "port-period-ledger.csv", "economic-components.csv"]:
        shutil.copyfile(a.operating/name, a.out/name)
    costs = load_csv(a.out/"economic-components.csv")
    claimed = math.fsum(float(x["original_objective_contribution"]) for x in costs)
    if a.mode == "omit-alpha-cost":
        # Wrong economic implementation: physical losses get booked at zero expense.
        for row in costs:
            if row["component"] in {"lost_production", "stockout"}:
                row["original_objective_contribution"] = 0
        claimed = math.fsum(float(x["original_objective_contribution"]) for x in costs)
        save_csv(a.out/"economic-components.csv", costs)
    else:
        # Wrong operator translation: treats every artificial exit as no physical service.
        exits = {}
        for row in load_csv(a.out/"class-arc-plan.csv"):
            if row["kind"] == "terminal_exit":
                key = (int(row["inventory_service_port"]), int(row["inventory_service_time_index"]))
                exits[key] = exits.get(key, 0) + float(row["signed_inventory_effect"])
        ledger = load_csv(a.out/"port-period-ledger.csv")
        for row in ledger:
            effect = exits.get((int(row["port"]), int(row["time_index"])), 0)
            row["signed_vessel_service_inventory_effect"] = float(row["signed_vessel_service_inventory_effect"])-effect
            row["stock_after"] = (float(row["stock_before"])+float(row["signed_production_consumption"])
                                  +float(row["signed_vessel_service_inventory_effect"])+float(row["signed_alpha_effect"]))
            row["inventory_residual"] = 0
        save_csv(a.out/"port-period-ledger.csv", ledger)
    (a.out/"objective.json").write_text(json.dumps(claimed)+'\n', encoding="utf-8")
    (a.out/"REPORT.md").write_text(f"# Operating report\n\nTotal operating cost: {claimed}.\nAll artificial exits were handled by the implemented operating conventions.\n", encoding="utf-8")
    print(json.dumps({"programme_mode": a.mode, "reported_cost": claimed, "complete_numeric_delivery_written": True}), flush=True)


if __name__ == "__main__":
    main()
