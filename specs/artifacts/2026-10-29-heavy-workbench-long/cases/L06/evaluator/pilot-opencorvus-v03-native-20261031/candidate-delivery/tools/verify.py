"""Independent integer reconciliation of raw facts, actual journals and deliverables."""

import csv
from fractions import Fraction
import json
from pathlib import Path
import sqlite3
from common import ROOT, PUBLIC, load_data, event, save


def main():
    d, _ = load_data(PUBLIC)
    policy = json.loads((ROOT / "policy.json").read_text())
    assert policy == json.loads((ROOT / "actor/policy.json").read_text())
    journals = json.loads((ROOT / "exercise/run-001/journals.json").read_text())
    summary = json.loads((ROOT / "results/summary.json").read_text())
    receivables = json.loads((ROOT / "results/receivables.json").read_text())
    ledger = list(csv.DictReader((ROOT / "results/weekly-ledger.csv").open(newline="")))
    commitments = list(
        csv.DictReader((ROOT / "results/commitment-policy.csv").open(newline=""))
    )
    assert len(ledger) == 128 and len(commitments) == 2944
    assert len({(r["path"], r["week"]) for r in ledger}) == 128
    lookup = {(r["path"], int(r["week"])): r for r in ledger}
    action_grid = {
        (r["path"], int(r["week"]), r["kind"], r["entity"], r["item"]): int(
            r["quantity"]
        )
        for r in commitments
    }
    assert len(action_grid) == 2944
    expected, min_cash = Fraction(), d["initial_cash_minor"]
    component_totals = {
        k: Fraction()
        for k in ("purchase_cost", "freight_cost", "production_cost", "holding_cost")
    }
    information = {}
    for path in d["scenarios"]:
        pid = path["id"]
        committed = journals[pid]
        assert len(committed) == 16
        raw = d["initial_raw"].copy()
        finished = d["initial_products"].copy()
        cash = d["initial_cash_minor"]
        total = 0
        cash_values = []
        arrivals = [[0] * 4 for _ in range(16)]
        dues = [0] * 20
        prob = Fraction(path["probability_numerator"], d["probability_denominator"])
        history = []
        for t, item in enumerate(committed):
            assert item["week"] == t and item["event"] == event(path, t)
            e = item["event"]
            a = item["action"]
            history.append(e)
            key = json.dumps(history, sort_keys=True)
            if key in information:
                assert information[key] == a
            information[key] = a
            assert a == {
                k: policy["decisions"][pid][k][t]
                for k in ("order_lots", "truck_on", "production")
            }
            purchase = freight = production = 0
            arrived = arrivals[t].copy()
            for s, rule in enumerate(d["suppliers"]):
                on = a["truck_on"][s]
                assert type(on) is int and on in (0, 1)
                assert action_grid[pid, t, "truck", rule["id"], ""] == on
                units = []
                for m, raw_id in enumerate(d["raw_materials"]):
                    lots = a["order_lots"][s][m]
                    assert type(lots) is int and lots >= 0
                    assert action_grid[pid, t, "order_lots", rule["id"], raw_id] == lots
                    units.append(lots * rule["pack_units"][m])
                volume = sum(units[m] * d["raw_volume"][m] for m in range(4))
                assert (
                    rule["minimum_volume"] * on
                    <= volume
                    <= e["supplier_capacity_volume"][s] * on
                )
                due = t + rule["lead_weeks"]
                assert due < 16 or not any(units)
                if due < 16:
                    target = arrived if due == t else arrivals[due]
                    for m in range(4):
                        target[m] += units[m]
                purchase += sum(units[m] * rule["price_minor"][m] for m in range(4))
                freight += on * rule["freight_minor"]
            made = [0] * 4
            for p in range(2):
                hours = 0
                for j in range(4):
                    qty = a["production"][p][j]
                    assert type(qty) is int and qty >= 0
                    assert d["allowed"][p][j] or qty == 0
                    assert (
                        action_grid[
                            pid, t, "production", d["plants"][p], d["products"][j]
                        ]
                        == qty
                    )
                    made[j] += qty
                    hours += qty * d["production_hours"][j]
                    production += qty * d["production_cost_minor"][p][j]
                assert hours <= e["plant_capacity_hours"][p]
            raw_peak = sum((raw[m] + arrived[m]) * d["raw_volume"][m] for m in range(4))
            finished_peak = sum(
                (finished[j] + made[j]) * d["product_volume"][j] for j in range(4)
            )
            assert (
                raw_peak <= d["raw_storage_volume"]
                and finished_peak <= d["product_storage_volume"]
            )
            raw = [
                raw[m] + arrived[m] - sum(made[j] * d["bom"][j][m] for j in range(4))
                for m in range(4)
            ]
            finished = [finished[j] + made[j] - e["demand"][j] for j in range(4)]
            assert min(raw) >= 0 and min(finished) >= 0
            holding = sum(raw[m] * d["raw_holding_minor"][m] for m in range(4)) + sum(
                finished[j] * d["product_holding_minor"][j] for j in range(4)
            )
            cost = purchase + freight + production + holding
            cash += dues[t] - cost
            total += cost
            cash_values.append(cash)
            assert cash >= (0 if t == 15 else -d["credit_limit_minor"])
            row = dict(
                purchase=purchase,
                freight=freight,
                production=production,
                holding=holding,
                cost=cost,
                receipts=dues[t],
                cash=cash,
                raw_peak=raw_peak,
                finished_peak=finished_peak,
            )
            assert all(int(lookup[pid, t][k]) == value for k, value in row.items())
            assert item["receipt"] == {
                "request_id": item["request_id"],
                "committed_week": t,
                "next_week": t + 1,
                "cost_minor": cost,
                "cash_minor": cash,
            }
            dues[t + 4] += sum(
                e["demand"][j] * d["sales_price_minor"][j] for j in range(4)
            )
            for k, value in zip(
                component_totals, [purchase, freight, production, holding]
            ):
                component_totals[k] += prob * value
        assert finished == [0] * 4
        r = receivables[pid]
        assert r == {
            "final_cash": cash,
            "minimum_cash": min(cash_values),
            "final_receivable": sum(dues[16:]),
            "due_after_horizon": {str(w): dues[w] for w in range(16, 20) if dues[w]},
        }
        expected += prob * total
        min_cash = min(min_cash, *cash_values)
    assert Fraction(summary["expected_cost_exact"]) == expected <= 60044
    assert Fraction(summary["alternative_exact"]) == 70640
    assert Fraction(summary["saving_exact"]) == 70640 - expected
    assert (
        summary["minimum_cash"] == min_cash
        and summary["information_nodes"] == len(information) == 60
    )
    assert all(
        Fraction(summary["components_exact"][k]) == v
        for k, v in component_totals.items()
    )
    episodes = json.loads((ROOT / "exercise/run-001/episodes.json").read_text())
    for episode in episodes:
        folder = ROOT / "exercise/run-001" / episode["directory"]
        with sqlite3.connect(
            "file:" + (folder / "journal.sqlite3").as_posix() + "?mode=ro", uri=True
        ) as con:
            assert con.execute("PRAGMA user_version").fetchone()[0] == 2
            rows = [
                json.loads(row[0])
                for row in con.execute("SELECT item_json FROM commits ORDER BY week")
            ]
        assert rows == journals[episode["path"]]
        if episode["has_real_commit_loss"]:
            with sqlite3.connect(
                "file:"
                + (folder / "after-commit-original.sqlite3").as_posix()
                + "?mode=ro",
                uri=True,
            ) as con:
                cut = [
                    json.loads(row[0])
                    for row in con.execute(
                        "SELECT item_json FROM commits ORDER BY week"
                    )
                ]
            assert len(cut) == 8 and rows[:8] == cut
            receipt = json.loads((folder / "completed/resume-receipt.json").read_text())
            assert (
                receipt["receipt"] == cut[-1]["receipt"]
                and receipt["replayed"]
                and receipt["next_week"] == 8
            )
    for path in [
        "REPORT.pdf",
        "REPORT.md",
        "HANDOFF.md",
        "figures/cash-and-storage.png",
        "figures/cost-comparison.png",
    ]:
        assert (ROOT / path).stat().st_size > 100
    result = {
        "status": "passed",
        "scope": "independent integer arithmetic from public facts, policy/CSV/native journal/SQLite reconciliation; not independent Task acceptance",
        "path_week_rows": 128,
        "all_action_coordinates": 2944,
        "information_nodes": len(information),
        "expected_cost_exact": str(expected),
        "minimum_cash": min_cash,
        "checks": [
            "packs/MOQ/capacity/lead/terminal pipeline",
            "BOM/routes/shared hours",
            "both stage peaks",
            "fulfilment/end holdings",
            "original absolute dues/credit/terminal cash",
            "zero finished terminal",
            "complete-history causality",
            "all CSV coordinates",
            "all SQLite records and unchanged recovery prefix",
        ],
    }
    save(ROOT / "results/self-check.json", result)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
