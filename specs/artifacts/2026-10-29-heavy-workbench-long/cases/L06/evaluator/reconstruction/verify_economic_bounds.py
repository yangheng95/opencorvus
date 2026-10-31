"""Verify exact bounds for the declared Group2 model, without a numerical optimizer."""
from collections import defaultdict
from fractions import Fraction
import math

from verify_original_mps import read_original_model


def model(path):
    rows, co, rhs, bounds, integers, objective = read_original_model(path, numeric_type=Fraction)
    costs = defaultdict(Fraction)
    for variable, value in co.get(objective, []):
        costs[variable] += value
    return rows, co, rhs, bounds, integers, objective, costs


def lower_bound(path, certificate):
    rows, co, rhs, bounds, integers, objective, costs = model(path)
    if certificate["schema"] != "group2-economic-bounds/1":
        raise ValueError("economic_certificate_schema")
    duals = {row: Fraction(value) for row, value in certificate["row_multipliers"].items()}
    if set(duals) != {r for r, kind in rows.items() if kind != "N"}:
        raise ValueError("economic_certificate_original_row_coverage")
    reduced = defaultdict(Fraction, costs)
    total = -rhs.get(objective, Fraction(0))
    for row, y in duals.items():
        kind = rows[row]
        if (kind == "L" and y > 0) or (kind == "G" and y < 0):
            raise ValueError("economic_certificate_dual_row_sign:" + row)
        total += y * rhs.get(row, Fraction(0))
        for variable, value in co.get(row, []):
            reduced[variable] -= y * value
    for variable, (low, high) in bounds.items():
        r = reduced[variable]
        if r < 0 and math.isinf(high):
            raise ValueError("economic_certificate_unbounded_negative_residual:" + variable)
        if not math.isfinite(low):
            raise ValueError("economic_certificate_finite_lower_bound_required")
        total += r * (high if r < 0 else low)
    return {"verified": True, "exact_lower_bound": str(total), "lower_bound_float": float(total),
            "rows_verified": len(duals), "variables_verified": len(bounds),
            "scope": "Weak-duality bound for full declared model, including all variable bounds; not an integer optimality claim"}


def exact_plan(path, values):
    rows, co, rhs, bounds, integers, objective, costs = model(path)
    x = {v: Fraction(value) for v, value in values.items()}
    if set(x) != set(bounds):
        raise ValueError("exact_upper_bound_variable_coverage")
    for v, (low, high) in bounds.items():
        if x[v] < low or (math.isfinite(high) and x[v] > high):
            raise ValueError("exact_upper_bound_domain:" + v)
        if v in integers and x[v].denominator != 1:
            raise ValueError("exact_upper_bound_integrality:" + v)
    for row, kind in rows.items():
        if kind == "N":
            continue
        a = sum((value * x[v] for v, value in co.get(row, [])), Fraction(0))
        b = rhs.get(row, Fraction(0))
        if (kind == "E" and a != b) or (kind == "L" and a > b) or (kind == "G" and a < b):
            raise ValueError("exact_upper_bound_constraint:" + row)
    cost = sum((a * x[v] for v, a in costs.items()), -rhs.get(objective, Fraction(0)))
    return {"verified": True, "exact_upper_bound": str(cost), "upper_bound_float": float(cost),
            "variables_verified": len(x), "constraints_verified": len(rows) - 1,
            "scope": "Full rational feasible integer plan; upper bound, not global optimum"}


def bounded_gap(p, reference):
    p, reference = Fraction(str(p)), Fraction(str(reference))
    if p == reference == 0:
        return 0.0
    if p * reference < 0:
        return 1.0
    return float(abs(p - reference) / max(abs(p), abs(reference)))


def economic_measurement(p, verified_lower, verified_upper):
    lo = Fraction(verified_lower["exact_lower_bound"])
    hi = Fraction(verified_upper["exact_upper_bound"])
    if lo > hi:
        raise ValueError("economic_certificate_lower_above_feasible_upper")
    # The standard bounded gap is not a candidate-hours measure or a 100-point grade.
    return {"submitted_numerical_cost": p,
            "verified_integer_optimum_interval": [str(lo), str(hi)],
            "certified_bound_gap": bounded_gap(hi, lo),
            "submitted_gap_to_lower_bound": bounded_gap(p, lo),
            "submitted_cost_minus_verified_reference": float(Fraction(str(p)) - hi),
            "submitted_ratio_to_verified_reference": float(Fraction(str(p)) / hi) if hi > 0 else None,
            "reference_policy": "Exact feasible reference upper bound; a better submission keeps its raw lower cost/ratio, with no saturation at an author score",
            "scope": "Submitted values use declared numerical feasibility tolerances; only the separate bound witnesses establish the exact optimum interval",
            "total_score": None, "heavy_benchmark_qualified": False}
