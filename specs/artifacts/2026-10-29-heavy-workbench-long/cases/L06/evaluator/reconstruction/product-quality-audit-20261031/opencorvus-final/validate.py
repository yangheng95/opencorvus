"""Read-only checks of saved numeric files, original MPS, raw ZIP and wire tables."""

import argparse
import csv
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from modelio import read_mps, read_raw, check_vector, ARC, dump


def close(x, y, scale=None):
    x, y = float(x), float(y)
    assert math.isfinite(x) and math.isfinite(y)
    assert abs(x - y) <= 1e-6 + 1e-9 * abs(y if scale is None else scale), (x, y)


def integer(x):
    y = float(x)
    assert math.isfinite(y) and y == round(y), x
    return int(y)


def validate(model, raw, instance, out):
    out = Path(out)
    m = read_mps(model)
    ports, caps, _ = read_raw(raw, instance)
    layout = json.loads((out / "layout.json").read_text())

    def file(slot):
        rel = layout[slot]
        assert not Path(rel).is_absolute() and ".." not in Path(rel).parts
        return out / rel

    vals = json.loads(file("values").read_text())
    checked = check_vector(m, vals)
    assert checked["valid"], checked
    reported = layout["reported_objective"]
    assert (
        not Path(reported["file"]).is_absolute()
        and ".." not in Path(reported["file"]).parts
    )
    native = json.loads((out / reported["file"]).read_text())
    objective = native[reported["key"]] if reported["key"] is not None else native
    close(objective, checked["objective"])
    tables = {
        k: list(csv.DictReader(file(k).open(encoding="utf-8", newline="")))
        for k in ("arcs", "paths", "ledger", "costs")
    }
    T = 1 + max(
        int(r.split(",")[-1].rstrip(")"))
        for r in m["rows"]
        if r.startswith("invBalanceRegion_")
    )
    expected_arcs = {n for n, v in vals.items() if n.startswith("x_") and v > 1e-6}
    assert len(tables["arcs"]) == len(expected_arcs)
    assert {r["original_variable"] for r in tables["arcs"]} == expected_arcs
    service = defaultdict(float)
    berths = defaultdict(int)
    cost = defaultdict(float)
    amap = {}
    for r in tables["arcs"]:
        n = r["original_variable"]
        p, t, q, u, c = map(int, ARC.fullmatch(n).groups())
        for key, x in zip(
            (
                "from_port",
                "from_time_index",
                "to_port",
                "to_time_index",
                "vessel_class",
            ),
            (p, t, q, u, c),
        ):
            assert integer(r[key]) == x
        count = integer(r["vessel_count"])
        close(count, vals[n])
        kind = (
            "initial_source"
            if t == -1
            else "terminal_exit"
            if u == T
            else "waiting"
            if p == q
            else "loaded_voyage"
            if ports[p]["type"][0] == "Loading"
            else "empty_return"
        )
        assert r["kind"] == kind
        close(r["class_capacity"], caps[c])
        unit = m["cols"][n].get(m["obj"], 0)
        close(r["original_cost_per_vessel"], unit)
        close(r["cost_contribution"], unit * vals[n])
        cost[kind] += unit * vals[n]
        if kind in ("initial_source", "waiting"):
            assert (
                r["inventory_service_port"] == r["inventory_service_time_index"] == ""
            )
            close(r["signed_inventory_effect"], 0)
        else:
            assert (
                integer(r["inventory_service_port"]) == p
                and integer(r["inventory_service_time_index"]) == t
            )
            effect = (-1 if ports[p]["type"][0] == "Loading" else 1) * caps[c] * count
            close(r["signed_inventory_effect"], effect)
            service[p, t] += effect
            berths[p, t] += count
        amap[n] = r
    paths = defaultdict(list)
    for r in tables["paths"]:
        paths[r["anonymous_path_id"]].append(r)
    counts = Counter()
    for pid, steps in paths.items():
        steps.sort(key=lambda r: integer(r["step"]))
        assert [integer(r["step"]) for r in steps] == list(
            range(integer(steps[0]["step"]), integer(steps[0]["step"]) + len(steps))
        )
        assert (
            steps[0]["kind"] == "initial_source"
            and steps[-1]["kind"] == "terminal_exit"
        )
        for i, r in enumerate(steps):
            n = r["original_variable"]
            a = amap[n]
            counts[n] += 1
            for key in (
                "kind",
                "vessel_class",
                "from_port",
                "from_time_index",
                "to_port",
                "to_time_index",
            ):
                assert r[key] == a[key]
            if i:
                prev = steps[i - 1]
                assert (
                    prev["vessel_class"],
                    prev["to_port"],
                    prev["to_time_index"],
                ) == (r["vessel_class"], r["from_port"], r["from_time_index"])
    assert counts == Counter({n: integer(r["vessel_count"]) for n, r in amap.items()})
    keyed = {
        (integer(r["port"]), integer(r["time_index"])): r for r in tables["ledger"]
    }
    assert len(keyed) == len(tables["ledger"]) == len(ports) * T
    alpha_units = {}
    for p, port in ports.items():
        sign = 1 if port["type"][0] == "Loading" else -1
        for t in range(T):
            r = keyed[p, t]
            row = f"invBalanceRegion_({p},{t})"
            rhs = m["rhs"].get(row, 0)
            assert r["port_name"] == port["name"][0] and r["role"] == port["type"][0]
            before = vals[f"supplyAtNode_({p},{t})"]
            after = (
                vals[f"supplyAtNode_({p},{t + 1})"]
                if t < T - 1
                else vals[f"endingSupplyInRegion_{p}"]
            )
            alpha = vals[f"alphaSlack_({p},{t})"]
            unit = m["cols"][f"alphaSlack_({p},{t})"].get(m["obj"], 0)
            rate = sign * float(port["production" if sign == 1 else "consumption"][t])
            close(rate, rhs)
            for k, x in dict(
                stock_before=before,
                stock_after=after,
                signed_production_consumption=rate,
                signed_vessel_service_inventory_effect=service[p, t],
                alpha_loss_or_shortfall=alpha,
                signed_alpha_effect=-sign * alpha,
                berths_used=berths[p, t],
                berths_available=float(port["numBerths"][0]),
                original_alpha_unit_penalty=unit,
                alpha_cost=unit * alpha,
            ).items():
                close(r[k], x)
            residual = after - before - rate - service[p, t] + sign * alpha
            close(residual, 0, rhs)
            close(r["inventory_residual"], residual, rhs)
            assert berths[p, t] <= float(port["numBerths"][0]) + 1e-6
            cost["lost_production" if sign == 1 else "stockout"] += unit * alpha
        alpha_units[p] = math.fsum(vals[f"alphaSlack_({p},{t})"] for t in range(T))
    cost["original_objective_constant"] = m["constant"]
    assert len({r["component"] for r in tables["costs"]}) == len(tables["costs"])
    saved = {
        r["component"]: float(r["original_objective_contribution"])
        for r in tables["costs"]
    }
    for k in saved:
        assert k in cost
    for k, x in cost.items():
        close(saved.get(k, 0), x)
    close(math.fsum(saved.values()), objective)
    return dict(
        valid=True,
        vector_check=checked,
        objective=objective,
        paths=len(paths),
        positive_arcs=len(amap),
        ledger_rows=len(keyed),
        alpha_units_by_port=alpha_units,
        economic_components=dict(cost),
        checks=[
            "complete original MPS rows/domains",
            "native objective",
            "positive arc coverage and costs",
            "class capacities and service",
            "all path arc multiplicities and continuity",
            "all port-period fields and raw demand",
            "berths",
            "complete economic reconciliation",
        ],
    )


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    for k in ("model", "raw", "instance", "out"):
        p.add_argument("--" + k, required=True)
    p.add_argument("--record")
    a = p.parse_args()
    result = validate(a.model, a.raw, a.instance, a.out)
    if a.record:
        dump(a.record, result)
    print(json.dumps(result, indent=2))
