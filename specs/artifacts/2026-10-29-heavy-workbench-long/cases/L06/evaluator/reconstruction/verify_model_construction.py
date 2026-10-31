"""Compare complete published and independently raw-constructed linear models after fixed-variable substitution."""
import argparse
from collections import defaultdict
import datetime
import json
import math
from pathlib import Path

from verify_original_mps import read_original_model


def normalized(path):
    rows, co, rhs, bounds, integers, objective = read_original_model(path)
    fixed = {v: low for v, (low, high) in bounds.items() if low == high}
    free = {v: (lo, hi, v in integers) for v, (lo, hi) in bounds.items() if v not in fixed}
    result = {}
    for row, kind in rows.items():
        if kind == "N":
            continue
        terms = defaultdict(float)
        constant = []
        for v, a in co.get(row, []):
            if v in fixed:
                constant.append(a * fixed[v])
            else:
                terms[v] += a
        result[row] = (kind, rhs.get(row, 0) - math.fsum(constant), {v: a for v, a in terms.items() if a != 0})
    costs = defaultdict(float)
    constant = [-rhs.get(objective, 0)]
    for v, a in co.get(objective, []):
        if v in fixed:
            constant.append(a * fixed[v])
        else:
            costs[v] += a
    return free, result, {v: a for v, a in costs.items() if a != 0}, math.fsum(constant), len(fixed)


def compare(published, constructed):
    a, b = normalized(published), normalized(constructed)
    errors, numeric_checks, max_difference = [], 0, 0.0
    def same_number(x, y, label):
        nonlocal numeric_checks, max_difference
        numeric_checks += 1
        if math.isfinite(x) and math.isfinite(y):
            max_difference = max(max_difference, abs(x - y))
        if not math.isclose(x, y, rel_tol=1e-10, abs_tol=1e-8):
            errors.append({"object": label, "published": x, "constructed": y})
    for name, x, y in [("free_variables", set(a[0]), set(b[0])), ("constraint_rows", set(a[1]), set(b[1])),
                        ("objective_variables", set(a[2]), set(b[2]))]:
        if x != y:
            errors.append({"object": name, "published_only": sorted(x-y), "constructed_only": sorted(y-x)})
    for v in set(a[0]) & set(b[0]):
        x, y = a[0][v], b[0][v]
        same_number(x[0], y[0], v + ":lower")
        same_number(x[1], y[1], v + ":upper")
        if x[2] != y[2]:
            errors.append({"object": v + ":integrality", "published": x[2], "constructed": y[2]})
    for r in set(a[1]) & set(b[1]):
        x, y = a[1][r], b[1][r]
        if x[0] != y[0]:
            errors.append({"object": r + ":sense", "published": x[0], "constructed": y[0]})
        same_number(x[1], y[1], r + ":rhs")
        for v in set(x[2]) | set(y[2]):
            same_number(x[2].get(v, 0), y[2].get(v, 0), r + ":" + v)
    for v in set(a[2]) | set(b[2]):
        same_number(a[2].get(v, 0), b[2].get(v, 0), "objective:" + v)
    same_number(a[3], b[3], "objective_constant_after_fixed_substitution")
    return {"at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "published_model": str(published), "constructed_model": str(constructed),
            "mathematically_equivalent": not errors, "free_variables": len(a[0]), "constraints": len(a[1]),
            "numeric_values_compared": numeric_checks, "max_absolute_numeric_difference": max_difference,
            "published_fixed_variables_substituted": a[4], "constructed_fixed_variables_substituted": b[4],
            "errors": errors, "scope": "Full linear-function/domain comparison against an independent published model, not source hashes or a re-computed synthetic expected answer",
            "benchmark_qualification": "not established", "optimization_executed": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--published", type=Path, required=True)
    parser.add_argument("--constructed", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    result = compare(args.published, args.constructed)
    args.out.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({k: result[k] for k in ["mathematically_equivalent", "free_variables", "constraints", "numeric_values_compared", "max_absolute_numeric_difference"]}))
    raise SystemExit(0 if result["mathematically_equivalent"] else 4)


if __name__ == "__main__":
    main()
