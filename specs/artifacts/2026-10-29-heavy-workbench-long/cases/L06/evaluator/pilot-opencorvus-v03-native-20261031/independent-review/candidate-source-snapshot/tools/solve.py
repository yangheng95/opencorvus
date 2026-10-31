"""Mixed-integer linear program (MILP), with shared complete-history actions."""

import argparse
import json
import time
import numpy as np
from scipy.optimize import milp, Bounds, LinearConstraint
from scipy.sparse import coo_matrix
from common import ROOT, PUBLIC, load_data, event, canonical, audit_policy, save


def solve(perfect_information=False, seconds=120):
    data, _ = load_data(PUBLIC)
    paths = data["scenarios"]
    nodes, route = {}, {}
    for s, path in enumerate(paths):
        for t in range(16):
            prefix = canonical([event(path, k) for k in range(t + 1)])
            key = (s, t) if perfect_information else prefix
            if key not in nodes:
                nodes[key] = {"index": len(nodes), "t": t, "s": s, "prob": 0}
            node = nodes[key]
            node["prob"] += (
                path["probability_numerator"] / data["probability_denominator"]
            )
            route[s, t] = node["index"]
    variables, costs, upper, integral = {}, [], [], []

    def var(key, cost=0, cap=np.inf, integer=1):
        variables[key] = len(costs)
        costs.append(cost)
        upper.append(cap)
        integral.append(integer)
        return variables[key]

    def v(n, kind, *indices):
        return variables[(n, kind, *indices)]

    for node in nodes.values():
        n, t, s, prob = (node[k] for k in ("index", "t", "s", "prob"))
        for a, supplier in enumerate(data["suppliers"]):
            var((n, "truck", a), prob * supplier["freight_minor"], 1)
            for m in range(4):
                cap = 0 if t + supplier["lead_weeks"] >= 16 else np.inf
                var(
                    (n, "order", a, m),
                    prob * supplier["pack_units"][m] * supplier["price_minor"][m],
                    cap,
                )
        for p in range(2):
            for j in range(4):
                var(
                    (n, "make", p, j),
                    prob * data["production_cost_minor"][p][j],
                    np.inf if data["allowed"][p][j] else 0,
                )
        for m in range(4):
            var((n, "raw", m), prob * data["raw_holding_minor"][m])
        for j in range(4):
            var(
                (n, "finished", j),
                prob * data["product_holding_minor"][j],
                0 if t == 15 else np.inf,
            )
        # Cash is offset by the credit limit so all model variables are nonnegative.
        var((n, "cash"), cap=np.inf, integer=0)
    row_indices, columns, values, lows, highs = [], [], [], [], []

    def constraint(terms, low=-np.inf, high=np.inf):
        r = len(lows)
        for col, value in terms:
            if value:
                row_indices.append(r)
                columns.append(col)
                values.append(value)
        lows.append(low)
        highs.append(high)

    for node in nodes.values():
        n, t, s = (node[k] for k in ("index", "t", "s"))
        e = event(paths[s], t)
        prev = route[s, t - 1] if t else None
        for a, supplier in enumerate(data["suppliers"]):
            volume = [
                (v(n, "order", a, m), supplier["pack_units"][m] * data["raw_volume"][m])
                for m in range(4)
            ]
            constraint(
                volume + [(v(n, "truck", a), -e["supplier_capacity_volume"][a])], high=0
            )
            constraint(
                volume + [(v(n, "truck", a), -supplier["minimum_volume"])], low=0
            )
        for p in range(2):
            constraint(
                [(v(n, "make", p, j), data["production_hours"][j]) for j in range(4)],
                high=e["plant_capacity_hours"][p],
            )
        for m in range(4):
            terms = [(v(n, "raw", m), 1)]
            terms += [
                (v(n, "make", p, j), data["bom"][j][m])
                for p in range(2)
                for j in range(4)
            ]
            if t:
                terms.append((v(prev, "raw", m), -1))
            for a, supplier in enumerate(data["suppliers"]):
                placed = t - supplier["lead_weeks"]
                if placed >= 0:
                    terms.append(
                        (v(route[s, placed], "order", a, m), -supplier["pack_units"][m])
                    )
            rhs = data["initial_raw"][m] if t == 0 else 0
            constraint(terms, rhs, rhs)
        for j in range(4):
            terms = [(v(n, "finished", j), 1)] + [
                (v(n, "make", p, j), -1) for p in range(2)
            ]
            if t:
                terms.append((v(prev, "finished", j), -1))
            rhs = (data["initial_products"][j] if t == 0 else 0) - e["demand"][j]
            constraint(terms, rhs, rhs)
        # End stock plus this week's consumption/delivery is the stage peak.
        constraint(
            [(v(n, "raw", m), data["raw_volume"][m]) for m in range(4)]
            + [
                (
                    v(n, "make", p, j),
                    sum(data["bom"][j][m] * data["raw_volume"][m] for m in range(4)),
                )
                for p in range(2)
                for j in range(4)
            ],
            high=data["raw_storage_volume"],
        )
        constraint(
            [(v(n, "finished", j), data["product_volume"][j]) for j in range(4)],
            high=data["product_storage_volume"]
            - sum(e["demand"][j] * data["product_volume"][j] for j in range(4)),
        )
        terms = [(v(n, "cash"), 1)]
        if t:
            terms.append((v(prev, "cash"), -1))
        for key, index in variables.items():
            if key[0] == n and key[1] != "cash":
                terms.append((index, costs[index] / node["prob"]))
        receipts = (
            sum(
                paths[s]["demand"][t - 4][j] * data["sales_price_minor"][j]
                for j in range(4)
            )
            if t >= 4
            else 0
        )
        rhs = receipts + (
            data["initial_cash_minor"] + data["credit_limit_minor"] if t == 0 else 0
        )
        constraint(terms, rhs, rhs)
        if t == 15:
            constraint([(v(n, "cash"), 1)], low=data["credit_limit_minor"])
    matrix = coo_matrix(
        (values, (row_indices, columns)), shape=(len(lows), len(costs))
    ).tocsc()
    started = time.perf_counter()
    result = milp(
        np.array(costs),
        integrality=np.zeros(len(costs)) if perfect_information else np.array(integral),
        bounds=Bounds(np.zeros(len(costs)), np.array(upper)),
        constraints=LinearConstraint(matrix, lows, highs),
        options={"time_limit": seconds, "mip_rel_gap": 0.01, "disp": True},
    )
    provenance = {
        "method": "perfect-information continuous linear relaxation"
        if perfect_information
        else "causal integer shared-prefix model",
        "status": int(result.status),
        "message": result.message,
        "seconds": time.perf_counter() - started,
        "objective_float": None if result.fun is None else float(result.fun),
        "native_dual_bound_float": getattr(result, "mip_dual_bound", None),
        "native_gap_float": getattr(result, "mip_gap", None),
        "variables": len(costs),
        "constraints": len(lows),
        "nodes": len(nodes),
        "limits": "Floating-point solver diagnostics; not an exact rational optimality certificate.",
    }
    destination = (
        ROOT
        / "results"
        / (
            "information-relaxation.json"
            if perfect_information
            else "optimization.json"
        )
    )
    save(destination, provenance)
    if perfect_information:
        assert result.success
        return
    if result.x is None:
        raise RuntimeError("No integer incumbent; diagnostics preserved")

    def integer(n, kind, *idx):
        value = result.x[v(n, kind, *idx)]
        assert abs(value - round(value)) < 1e-5
        return int(round(value))

    decisions = {}
    for s, path in enumerate(paths):
        decisions[path["id"]] = {
            "order_lots": [
                [
                    [integer(route[s, t], "order", a, m) for m in range(4)]
                    for a in range(3)
                ]
                for t in range(16)
            ],
            "truck_on": [
                [integer(route[s, t], "truck", a) for a in range(3)] for t in range(16)
            ],
            "production": [
                [
                    [integer(route[s, t], "make", p, j) for j in range(4)]
                    for p in range(2)
                ]
                for t in range(16)
            ],
        }
    policy = {"format": "l06-tree-policy/1", "decisions": decisions}
    audit = audit_policy(data, policy)
    save(ROOT / "results/policy-audit.json", audit)
    assert audit["policy_valid"], audit["physical_violations"]
    exact = audit["expected_cost_exact"]
    assert exact["numerator"] <= 60044 * exact["denominator"]
    save(ROOT / "policy.json", policy)
    save(ROOT / "actor/policy.json", policy)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--perfect-information", action="store_true")
    parser.add_argument("--seconds", type=int, default=120)
    args = parser.parse_args()
    solve(args.perfect_information, args.seconds)
