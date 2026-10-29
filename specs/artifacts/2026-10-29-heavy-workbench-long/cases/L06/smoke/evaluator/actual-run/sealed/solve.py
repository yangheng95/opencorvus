"""Exact finite enumeration for the public l06 procurement contract (stdlib only)."""

import argparse
import itertools
import json
from fractions import Fraction
from functools import lru_cache
from pathlib import Path


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


class Solver:
    def __init__(self, data):
        self.d = data
        self.T = data["weeks"]
        self.C = data["common_weeks"]
        self.R = len(data["raw_materials"])
        self.P = len(data["products"])
        self.L = len(data["plants"])
        self.S = len(data["suppliers"])
        self.sc = data["scenarios"]
        self.prob = [
            Fraction(s["probability_numerator"], data["probability_denominator"])
            for s in self.sc
        ]
        if sum(self.prob) != 1 or not 0 <= self.C <= self.T:
            raise ValueError("Invalid probabilities or common_weeks")
        if any(v <= 0 for v in data["raw_volume"] + data["production_hours"]):
            raise ValueError("Finite enumeration requires positive volumes and hours")
        self.initial = (
            tuple(data["initial_raw"]),
            tuple(data["initial_products"]),
            tuple((0,) * self.R for _ in range(self.T)),
            data["initial_cash_minor"],
        )
        self.states = 0

    @lru_cache(None)
    def orders(self, w, indices):
        """Enumerate each supplier's complete lot vector and binary truck decision."""
        per_supplier = []
        for s, supplier in enumerate(self.d["suppliers"]):
            cap = min(self.sc[i]["supplier_capacity_volume"][w][s] for i in indices)
            pack = supplier["pack_units"]
            if any(p <= 0 for p in pack):
                raise ValueError("pack_units must be positive")
            bounds = [
                cap // (pack[r] * self.d["raw_volume"][r])
                if w + supplier["lead_weeks"] < self.T
                else 0
                for r in range(self.R)
            ]
            opts = []
            for lots in itertools.product(*(range(b + 1) for b in bounds)):
                volume = sum(
                    lots[r] * pack[r] * self.d["raw_volume"][r] for r in range(self.R)
                )
                if not any(lots):
                    opts.append((lots, 0))
                if supplier["minimum_volume"] <= volume <= cap:
                    opts.append((lots, 1))
            per_supplier.append(opts)
        return tuple(itertools.product(*per_supplier))

    def productions(self, w, indices, states):
        # Never produce more than remaining deliveries minus current finished stock.
        limits = [
            min(
                sum(self.sc[i]["demand"][t][p] for t in range(w, self.T))
                - states[j][1][p]
                for j, i in enumerate(indices)
            )
            for p in range(self.P)
        ]
        if min(limits, default=0) < 0:
            return
        lines = []
        for l in range(self.L):
            cap = min(self.sc[i]["plant_capacity_hours"][w][l] for i in indices)
            bounds = [
                min(limits[p], cap // self.d["production_hours"][p])
                if self.d["allowed"][l][p]
                else 0
                for p in range(self.P)
            ]
            lines.append(
                [
                    v
                    for v in itertools.product(*(range(b + 1) for b in bounds))
                    if dot(v, self.d["production_hours"]) <= cap
                ]
            )
        for production in itertools.product(*lines):
            if all(
                sum(row[p] for row in production) <= limits[p] for p in range(self.P)
            ):
                yield production

    def step(self, i, w, state, action):
        raw, finished, pipeline, cash = state
        orders, production = action
        arrivals = [list(row) for row in pipeline]
        cost = 0
        for s, (lots, truck) in enumerate(orders):
            sup = self.d["suppliers"][s]
            cost += truck * sup["freight_minor"]
            for r in range(self.R):
                units = lots[r] * sup["pack_units"][r]
                cost += units * sup["price_minor"][r]
                if units:
                    arrivals[w + sup["lead_weeks"]][r] += units
        available = [raw[r] + arrivals[w][r] for r in range(self.R)]
        if dot(available, self.d["raw_volume"]) > self.d["raw_storage_volume"]:
            return None
        made = [sum(row[p] for row in production) for p in range(self.P)]
        raw_end = tuple(
            available[r] - sum(made[p] * self.d["bom"][p][r] for p in range(self.P))
            for r in range(self.R)
        )
        peak = [finished[p] + made[p] for p in range(self.P)]
        end = tuple(peak[p] - self.sc[i]["demand"][w][p] for p in range(self.P))
        if min(raw_end + end, default=0) < 0:
            return None
        if dot(peak, self.d["product_volume"]) > self.d["product_storage_volume"]:
            return None
        if w == self.T - 1 and any(end):
            return None
        cost += sum(
            production[l][p] * self.d["production_cost_minor"][l][p]
            for l in range(self.L)
            for p in range(self.P)
        )
        cost += dot(raw_end, self.d["raw_holding_minor"])
        cost += dot(end, self.d["product_holding_minor"])
        delivery_week = w - self.d["receipt_lag_weeks"]
        receipt = (
            dot(self.sc[i]["demand"][delivery_week], self.d["sales_price_minor"])
            if delivery_week >= 0
            else 0
        )
        cash += receipt - cost
        if cash < -self.d["credit_limit_minor"] or (w == self.T - 1 and cash < 0):
            return None
        arrivals[w] = [0] * self.R
        return cost, (raw_end, end, tuple(map(tuple, arrivals)), cash)

    def actions(self, w, indices, states):
        productions = tuple(self.productions(w, indices, states))
        for orders in self.orders(w, indices):
            for production in productions:
                yield orders, production

    @lru_cache(None)
    def suffix(self, i, w, state):
        self.states += 1
        if w == self.T:
            return 0, ()
        best = None
        for action in self.actions(w, (i,), (state,)):
            step = self.step(i, w, state, action)
            if step is None:
                continue
            cost, nxt = step
            tail = self.suffix(i, w + 1, nxt)
            if tail is not None and (best is None or cost + tail[0] < best[0]):
                best = cost + tail[0], (action,) + tail[1]
        return best

    @lru_cache(None)
    def common(self, w, states):
        self.states += 1
        indices = tuple(range(len(self.sc)))
        if w == self.C:
            tails = [self.suffix(i, w, states[i]) for i in indices]
            if any(t is None for t in tails):
                return None
            return sum(self.prob[i] * tails[i][0] for i in indices), tuple(
                t[1] for t in tails
            )
        best = None
        for action in self.actions(w, indices, states):
            steps = [self.step(i, w, states[i], action) for i in indices]
            if any(s is None for s in steps):
                continue
            tail = self.common(w + 1, tuple(s[1] for s in steps))
            if tail is None:
                continue
            cost = sum(self.prob[i] * steps[i][0] for i in indices) + tail[0]
            if best is None or cost < best[0]:
                best = cost, tuple((action,) + path for path in tail[1])
        return best

    def solve(self):
        result = self.common(0, tuple(self.initial for _ in self.sc))
        if result is None:
            raise ValueError("No policy is feasible in every scenario")
        optimum, paths = result
        decisions, totals = {}, {}
        recomputed = Fraction(0)
        for i, path in enumerate(paths):
            record = {
                k: []
                for k in (
                    "order_lots",
                    "truck_on",
                    "production",
                    "raw_inventory",
                    "finished_inventory",
                )
            }
            state = self.initial
            total = 0
            balances = []
            for w, action in enumerate(path):
                cost, state = self.step(i, w, state, action)
                total += cost
                balances.append(state[3])
                record["order_lots"].append([list(x[0]) for x in action[0]])
                record["truck_on"].append([x[1] for x in action[0]])
                record["production"].append([list(x) for x in action[1]])
                record["raw_inventory"].append(list(state[0]))
                record["finished_inventory"].append(list(state[1]))
            sid = self.sc[i]["id"]
            decisions[sid] = record
            lag = self.d["receipt_lag_weeks"]
            receivable = sum(
                dot(self.sc[i]["demand"][w], self.d["sales_price_minor"])
                for w in range(self.T)
                if w + lag >= self.T
            )
            totals[sid] = {
                "total_cost_minor": total,
                "minimum_cash_minor": min([self.initial[3]] + balances),
                "weekly_cash_minor": balances,
                "final_cash_minor": state[3],
                "final_receivables_minor": receivable,
            }
            recomputed += self.prob[i] * total
        assert recomputed == optimum
        return {"format": "l06-plan/1", "decisions": decisions}, {
            "expected_cost_minor": {
                "numerator": optimum.numerator,
                "denominator": optimum.denominator,
            },
            "scenarios": totals,
            "method": "exhaustive integer search with memoization",
            "states_evaluated": self.states,
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    output = Path(args.output)
    if output.exists():
        parser.error("--output must be a new, nonexistent directory")
    with open(args.input, encoding="utf-8") as handle:
        data = json.load(handle)
    plan, summary = Solver(data).solve()
    output.mkdir(parents=True, exist_ok=False)
    for name, obj in [("plan.json", plan), ("summary.json", summary)]:
        (output / name).write_text(
            json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
