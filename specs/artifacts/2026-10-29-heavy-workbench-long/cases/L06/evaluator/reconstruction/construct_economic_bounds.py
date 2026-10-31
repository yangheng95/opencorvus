"""Create one independently verifiable lower/upper witness for each declared Group2 input."""
import argparse
from collections import defaultdict
from fractions import Fraction
import json
import math
from pathlib import Path
import re
import time

from verify_economic_bounds import model, lower_bound, exact_plan


def construct(mps, route_values, out):
    from ortools.linear_solver import pywraplp
    out.mkdir(parents=True, exist_ok=False)
    rows, co, rhs, bounds, integers, objective, costs = model(mps)
    start = time.perf_counter()
    solver = pywraplp.Solver.CreateSolver("GLOP")
    if solver is None:
        raise RuntimeError("declared_glop_solver_unavailable")
    solver.EnableOutput()
    solver.SetTimeLimit(60000)
    xs = {v: solver.NumVar(float(low), float(high), v) for v, (low, high) in bounds.items()}
    cons = {}
    for row, kind in rows.items():
        if kind == "N":
            continue
        b = float(rhs.get(row, 0))
        cons[row] = solver.Constraint(b if kind in {"E", "G"} else -solver.infinity(),
                                      b if kind in {"E", "L"} else solver.infinity(), row)
        terms = defaultdict(Fraction)
        for v, a in co.get(row, []):
            terms[v] += a
        for v, a in terms.items():
            cons[row].SetCoefficient(xs[v], float(a))
    obj = solver.Objective()
    obj.SetOffset(float(-rhs.get(objective, 0)))
    for v, a in costs.items():
        obj.SetCoefficient(xs[v], float(a))
    obj.SetMinimization()
    status = solver.Solve()
    if status != pywraplp.Solver.OPTIMAL:
        raise RuntimeError("relaxation_native_status:" + str(status))
    original_duals = {r: Fraction(str(c.dual_value())) for r, c in cons.items()}
    duals, changes = dict(original_duals), []
    for row, y in list(duals.items()):
        if rows[row] == "L":
            duals[row] = min(y, 0)
        elif rows[row] == "G":
            duals[row] = max(y, 0)
    columns = defaultdict(list)
    for row in cons:
        for v, a in co.get(row, []):
            if a:
                columns[v].append((row, a))
    for v, (low, high) in bounds.items():
        if not math.isinf(high):
            continue
        terms = columns[v]
        if not v.startswith("alphaSlack_(") or len(terms) != 1 or rows[terms[0][0]] != "E":
            raise ValueError("declared_group2_unbounded_alpha_structure:" + v)
        row, a = terms[0]
        if costs[v] - a * duals[row] < 0:
            duals[row] = costs[v] / a
    for row in duals:
        if duals[row] != original_duals[row]:
            changes.append({"row": row, "native": str(original_duals[row]), "certificate": str(duals[row])})
    certificate = {"schema": "group2-economic-bounds/1", "model": str(mps),
                   "row_multipliers": {r: str(y) for r, y in duals.items()},
                   "native_relaxation_objective": obj.Value(), "native_status": int(status),
                   "native_relaxation_scope": "Continuous relaxation only; original integer domains retained by certificate verifier",
                   "explicit_dual_projections": changes}
    lo = lower_bound(mps, certificate)
    original = json.loads(route_values.read_text(encoding="utf-8"))
    x = {v: Fraction(str(original[v])) for v in bounds}
    for v in integers:
        if abs(original[v] - round(original[v])) > 1e-6:
            raise ValueError("existing_route_not_numerically_integral:" + v)
        x[v] = Fraction(round(original[v]))
    # Complete each unchanged route with exact domain-specific inventory bookkeeping.
    groups = defaultdict(dict)
    for row in rows:
        match = re.fullmatch(r"invBalanceRegion_\((\d+),(\d+)\)", row)
        if match:
            j, t = map(int, match.groups())
            groups[j][t] = row
    for j, periods in groups.items():
        if sorted(periods) != list(range(len(periods))):
            raise ValueError("exact_completion_contiguous_inventory_periods")
        x[f"supplyAtNode_({j},0)"] = bounds[f"supplyAtNode_({j},0)"][0]
        for t, row in sorted(periods.items()):
            before = f"supplyAtNode_({j},{t})"
            after = f"supplyAtNode_({j},{t+1})" if t+1 < len(periods) else f"endingSupplyInRegion_{j}"
            alpha = f"alphaSlack_({j},{t})"
            terms = dict(co[row]); sign = terms[alpha]
            if terms.pop(before) != -1 or terms.pop(after) != 1 or terms.pop(alpha) not in {-1, 1}:
                raise ValueError("exact_completion_original_inventory_equation")
            balance = x[before] + rhs.get(row, Fraction(0)) - sum((a*x[v] for v, a in terms.items()), Fraction(0))
            target = min(bounds[after][1], balance) if sign == 1 else max(bounds[after][0], balance)
            x[after], x[alpha] = target, (balance-target)/sign
    upper_values = {v: str(value) for v, value in x.items()}
    hi = exact_plan(mps, upper_values)
    result = {"native_relaxation_objective": obj.Value(), "native_lp_iterations": solver.iterations(),
              "wall_seconds_including_exact_checks": time.perf_counter()-start,
              "lower": lo, "upper": hi, "dual_projection_count": len(changes),
              "route_source": str(route_values), "route_integer_values_unchanged_after_declared_tolerance_rounding": True,
              "upper_completion_scope": "New explicit rational inventory/alpha completion of the same route; does not replace historical submitted values/objective",
              "model_score": None}
    for name, data in [("lower-certificate.json", certificate), ("upper-values.json", upper_values), ("result.json", result)]:
        (out/name).write_text(json.dumps(data, indent=2, allow_nan=False)+'\n', encoding="utf-8")
    return result


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--model", type=Path, required=True)
    p.add_argument("--route-values", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    a = p.parse_args()
    print(json.dumps(construct(a.model, a.route_values, a.out)), flush=True)


if __name__ == "__main__":
    main()
