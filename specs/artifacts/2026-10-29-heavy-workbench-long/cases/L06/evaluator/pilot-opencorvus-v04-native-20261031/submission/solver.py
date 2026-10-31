"""Offline exhaustive rational Bellman recursion; never imported by the actor."""

from pathlib import Path
from fractions import Fraction as F
from functools import lru_cache
import argparse, gzip, json, sys, time


class Solver:
    def __init__(self, data, known=None, inspect=True):
        self.data = data
        self.known = known
        self.inspect = inspect
        self.actions = {}
        self.values = {}
        self.comparisons = 0
        self.rejected = 0
        self.demand = [data["calendar"][t]["demand"] for t in range(8)]
        self.price = [data["calendar"][t]["certified_unit_cost"] for t in range(8)]
        self.income = [
            sum(r["amount"] for r in data["opening"] if r["due_week"] == t)
            + (self.demand[t - 2] * data["revenue"] if t >= 2 else 0)
            for t in range(8)
        ]
        pa = sum(r["prior"] for r in data["modes"].values() if r["A"] > r["B"])
        self.probs = {}
        for k in range(-8, 9):
            odds = pa / (1 - pa) * F(17, 3) ** k
            p = odds / (1 + odds)
            self.probs[k] = F(3, 20) + F(14, 20) * p
        self.lab = lru_cache(None)(self._lab)
        self.ops = lru_cache(None)(self._ops)

    def pg(self, k, vendor):
        if self.known is not None:
            return self.data["modes"][self.known][vendor]
        return self.probs[k] if vendor == "A" else 1 - self.probs[k]

    def update(self, k, vendor, good):
        if self.known is not None:
            return k
        return k + (1 if (vendor == "A") == good else -1)

    def _lab(self, t, g, q, c, k):
        best = self.ops(t, g, q, c, k)
        action = {"test": None}
        self.comparisons += 1
        if self.inspect and g + 2 <= 4 and c - 1 >= -15:
            for bit, v in [(1, "A"), (2, "B")]:
                if not q & bit:
                    continue
                self.comparisons += 1
                good = self.ops(t, g + 2, q - bit, c - 1, self.update(k, v, True))
                reject = self.ops(t, g, q - bit, c - 1, self.update(k, v, False))
                if good is None or reject is None:
                    self.rejected += 1
                    continue
                p = self.pg(k, v)
                val = 1 + p * good + (1 - p) * reject
                if best is None or val < best:
                    best, action = val, {"test": v}
        if best is not None:
            self.actions[("laboratory", t, g, q, c, k)] = action
        self.values[("laboratory", t, g, q, c, k)] = best
        return best

    def _ops(self, t, g, q, c, k):
        best = None
        action = None
        for e in range(max(0, self.demand[t] - g), 5 - g):
            remaining = g + e - self.demand[t]
            for bit, v in [(0, None), (1, "A"), (2, "B")]:
                if bit and (t == 7 or q & bit):
                    continue
                self.comparisons += 1
                cost = e * self.price[t] + self.demand[t] * self.data["production_cost"]
                if v:
                    cost += self.data["suppliers"][v]["pack_cost"]
                cost += (
                    remaining * self.data["terminal_good_disposal"]
                    + (q.bit_count()) * self.data["terminal_pack_disposal"]
                    if t == 7
                    else remaining * self.data["holding"]
                )
                if c - cost < (0 if t == 7 else -15):
                    self.rejected += 1
                    continue
                nxt = (
                    F(0)
                    if t == 7
                    else self.lab(
                        t + 1, remaining, q | bit, c - cost + self.income[t + 1], k
                    )
                )
                if nxt is None:
                    self.rejected += 1
                    continue
                val = cost + nxt
                if best is None or val < best:
                    best, action = val, {"certified_units": e, "order": v}
        if best is not None:
            self.actions[("operations", t, g, q, c, k)] = action
        self.values[("operations", t, g, q, c, k)] = best
        return best

    def solve(self):
        return self.lab(0, 0, 0, self.data["initial_cash"] + self.income[0], 0)

    def export(self, destination):
        with gzip.open(destination, "wt", encoding="utf-8") as f:
            json.dump(
                {
                    "known": self.known,
                    "inspect": self.inspect,
                    "nodes": [
                        [
                            list(key),
                            None if val is None else str(val),
                            self.actions.get(key),
                        ]
                        for key, val in sorted(self.values.items())
                    ],
                },
                f,
            )


def normalize(x):
    if isinstance(x, F):
        return str(x)
    if isinstance(x, dict):
        return {k: normalize(v) for k, v in x.items()}
    if isinstance(x, list):
        return [normalize(v) for v in x]
    return x


def state_key(s, k):
    return (
        s["phase"],
        s["week"],
        s["good"],
        s["quarantine"]["A"] + 2 * s["quarantine"]["B"],
        s["cash"],
        k,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--public", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--certificates", type=Path, required=True)
    a = parser.parse_args()
    sys.path.insert(0, str(a.public.resolve()))
    from model import load, initial, begin_week, advance, canonical

    a.out.mkdir(parents=True, exist_ok=True)
    a.certificates.mkdir(parents=True, exist_ok=True)
    certificate = {}
    for folder in sorted((a.public / "instances").iterdir()):
        data = load(folder)
        start = time.perf_counter()
        solver = Solver(data)
        optimum = solver.solve()
        solver.export(a.certificates / (data["id"] + "-same.json.gz"))
        print(
            data["id"],
            str(optimum),
            solver.lab.cache_info(),
            solver.ops.cache_info(),
            flush=True,
        )
        table = {}
        leaves = []

        def visit(s, k, observations, prob):
            if s["terminal"]:
                leaves.append(
                    {
                        "observations": observations,
                        "probability": str(prob),
                        "cost": s["cumulative_cost"],
                    }
                )
                return
            key = state_key(s, k)
            action = solver.actions[key]
            table[canonical(key)] = action
            v = action.get("test")
            outcomes = (
                [(None, F(1))]
                if not v
                else [("good", solver.pg(k, v)), ("reject", 1 - solver.pg(k, v))]
            )
            for outcome, p in outcomes:
                visit(
                    advance(data, s, action, outcome),
                    solver.update(k, v, outcome == "good") if v else k,
                    observations + ([f"w{s['week']}:{v}:{outcome}"] if v else []),
                    prob * p,
                )

        visit(begin_week(data, initial(data)), 0, [], F(1))
        assert sum(F(x["probability"]) for x in leaves) == 1
        assert sum(F(x["probability"]) * x["cost"] for x in leaves) == optimum
        entry = {
            "law": normalize(data),
            "actions": table,
            "optimum": str(optimum),
            "leaves": leaves,
        }
        (a.out / (data["id"] + ".json")).write_text(
            json.dumps(entry, sort_keys=True), encoding="utf-8"
        )
        cert = {
            "optimum_exact": str(optimum),
            "policy_exact": str(optimum),
            "regret_exact": "0",
            "laboratory_states": solver.lab.cache_info().currsize,
            "operations_states": solver.ops.cache_info().currsize,
            "action_comparisons": solver.comparisons,
            "infeasible_comparisons": solver.rejected,
            "terminal_histories": len(leaves),
            "reachable_table_states": len(table),
        }
        solver.lab.cache_clear()
        solver.ops.cache_clear()
        solver.actions.clear()
        known_values = {}
        for mode in ["A1", "B1"]:
            other = Solver(data, known=mode)
            known_values[mode] = str(other.solve())
            other.export(a.certificates / (data["id"] + "-" + mode + ".json.gz"))
            other.lab.cache_clear()
            other.ops.cache_clear()
            other.actions.clear()
        pa = sum(r["prior"] for r in data["modes"].values() if r["A"] > r["B"])
        cert["class_optima_exact"] = known_values
        cert["advance_class_bound_exact"] = str(
            pa * F(known_values["A1"]) + (1 - pa) * F(known_values["B1"])
        )
        no = Solver(data, inspect=False)
        cert["no_inspection_physical_exact"] = str(no.solve())
        no.export(a.certificates / (data["id"] + "-no-inspection.json.gz"))
        no.lab.cache_clear()
        no.ops.cache_clear()
        no.actions.clear()
        cert["seconds"] = time.perf_counter() - start
        certificate[data["id"]] = cert
        (a.out / "certificate.json").write_text(
            json.dumps(certificate, indent=2), encoding="utf-8"
        )
        print(data["id"], cert, flush=True)


if __name__ == "__main__":
    main()
