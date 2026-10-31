"""Check every Bellman node/action using the public physical primitive, not Solver."""

from pathlib import Path
from fractions import Fraction as F
import argparse, gzip, json, sys, time


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--public", type=Path, required=True)
    p.add_argument("--certificates", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    a = p.parse_args()
    sys.path.insert(0, str(a.public.resolve()))
    from model import load, initial, advance, ContractError, posterior, predictive

    results = []
    for file in sorted(a.certificates.glob("*.json.gz")):
        started = time.perf_counter()
        with gzip.open(file, "rt", encoding="utf-8") as f:
            cert = json.load(f)
        ident = next(
            name
            for name in ["base", "cash-tight", "shifted-prior"]
            if file.name.startswith(name + "-")
        )
        data = load(a.public / "instances" / ident)
        nodes = {
            tuple(k): (None if value is None else F(value), action)
            for k, value, action in cert["nodes"]
        }
        assert len(nodes) == len(cert["nodes"])
        actions_checked = 0
        physically_invalid = 0
        future_infeasible = 0
        for key, (value, selected) in nodes.items():
            phase, t, g, q, c, k = key
            s = initial(data)
            s.update(
                phase=phase,
                week=t,
                good=g,
                quarantine={"A": q & 1, "B": (q >> 1) & 1},
                cash=c,
            )
            s["receivables"] = [dict(r) for r in data["opening"] if r["due_week"] > t]
            s["receivables"] += [
                {
                    "receipt_id": f"sale-week-{w}",
                    "amount": data["calendar"][w]["demand"] * data["revenue"],
                    "due_week": w + data["sales_receipt_lag"],
                }
                for w in range(t)
                if w + data["sales_receipt_lag"] > t
            ]
            s["minimum_cash"] = min(c, data["initial_cash"])
            if cert["known"]:
                weights = {m: F(int(m == cert["known"])) for m in data["modes"]}
            else:
                synthetic = [
                    {
                        "phase": "laboratory",
                        "action": {"test": "A"},
                        "observation": "good" if k >= 0 else "reject",
                    }
                ] * abs(k)
                weights = posterior(data, synthetic)
            candidates = (
                [{"test": v} for v in ([None, "A", "B"] if cert["inspect"] else [None])]
                if phase == "laboratory"
                else [
                    {"certified_units": e, "order": v}
                    for e in range(5)
                    for v in [None, "A", "B"]
                ]
            )
            feasible = []
            for action in candidates:
                actions_checked += 1
                v = action.get("test")
                outcomes = (
                    [(None, F(1))]
                    if v is None
                    else [
                        ("good", predictive(data, weights, v)),
                        ("reject", 1 - predictive(data, weights, v)),
                    ]
                )
                total = F(0)
                valid = True
                for outcome, prob in outcomes:
                    try:
                        after = advance(data, s, action, outcome)
                    except ContractError:
                        physically_invalid += 1
                        valid = False
                        break
                    nk = (
                        k
                        if cert["known"] or not v
                        else k + (1 if (v == "A") == (outcome == "good") else -1)
                    )
                    if after["terminal"]:
                        tail = F(0)
                    else:
                        successor = (
                            after["phase"],
                            after["week"],
                            after["good"],
                            after["quarantine"]["A"] + 2 * after["quarantine"]["B"],
                            after["cash"],
                            nk,
                        )
                        assert successor in nodes, (file.name, key, action, successor)
                        tail = nodes[successor][0]
                    if tail is None:
                        future_infeasible += 1
                        valid = False
                        break
                    total += prob * (
                        after["cumulative_cost"] - s["cumulative_cost"] + tail
                    )
                if valid:
                    feasible.append((total, action))
            expected = min((x[0] for x in feasible), default=None)
            assert expected == value, (file.name, key, expected, value)
            assert (selected is None and value is None) or (
                value,
                selected,
            ) in feasible, (file.name, key, selected)
        root = (
            "laboratory",
            0,
            0,
            0,
            data["initial_cash"]
            + sum(r["amount"] for r in data["opening"] if r["due_week"] == 0),
            0,
        )
        row = {
            "certificate": file.name,
            "nodes": len(nodes),
            "candidate_actions_checked": actions_checked,
            "physically_invalid": physically_invalid,
            "future_infeasible": future_infeasible,
            "root_exact": str(nodes[root][0]),
            "all_equalities_and_minima_verified": True,
            "seconds": time.perf_counter() - started,
        }
        results.append(row)
        print(json.dumps(row), flush=True)
    assert len(results) == 12
    a.out.write_text(json.dumps(results, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
