"""Independently recompute the original MIRPLIB archive's linear model and objective."""
import json
import math
from pathlib import Path


def read_original_model(path: Path):
    section = ""
    row_types, coefficients, rhs, bounds, integers = {}, {}, {}, {}, set()
    integer_block = False
    objective = None
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("*"):
            continue
        fields = line.split()
        if not line[0].isspace():
            section = fields[0]
            if section not in {"NAME", "ROWS", "COLUMNS", "RHS", "BOUNDS", "ENDATA"}:
                raise ValueError(f"unsupported_original_mirplib_section:{section}")
            continue
        if section == "ROWS":
            kind, name = fields
            if kind not in {"N", "E", "L", "G"}:
                raise ValueError(f"unsupported_row_type:{kind}")
            row_types[name] = kind
            if kind == "N":
                if objective is not None:
                    raise ValueError("multiple_objective_rows")
                objective = name
        elif section == "COLUMNS":
            variable = fields[0]
            if fields[1] == "'MARKER'":
                if fields[2] not in {"'INTORG'", "'INTEND'"}:
                    raise ValueError("unknown_integrality_marker")
                integer_block = fields[2] == "'INTORG'"
                continue
            bounds.setdefault(variable, [0.0, math.inf])
            if integer_block:
                integers.add(variable)
            if len(fields) not in {3, 5}:
                raise ValueError("original_column_pair_count")
            for i in range(1, len(fields), 2):
                row, value = fields[i], float(fields[i + 1].replace("D", "E"))
                if row not in row_types or not math.isfinite(value):
                    raise ValueError("original_column_row_or_coefficient")
                coefficients.setdefault(row, []).append((variable, value))
        elif section == "RHS":
            if fields[0] != "RHS1" or len(fields) not in {3, 5}:
                raise ValueError("unsupported_original_rhs")
            for i in range(1, len(fields), 2):
                rhs[fields[i]] = float(fields[i + 1].replace("D", "E"))
        elif section == "BOUNDS":
            kind, bound_set, variable, value_text = fields
            if bound_set != "BND1" or variable not in bounds:
                raise ValueError("original_bound_set_or_variable")
            value = float(value_text)
            if kind == "UP":
                bounds[variable][1] = value
            elif kind == "FX":
                bounds[variable] = [value, value]
            else:
                raise ValueError(f"unsupported_original_bound:{kind}")
    if objective is None or integer_block:
        raise ValueError("incomplete_original_model")
    return row_types, coefficients, rhs, bounds, integers, objective


def verify(path: Path, values: dict, reported_objective: float | None):
    row_types, coefficients, rhs, bounds, integers, objective = read_original_model(path)
    if set(values) != set(bounds):
        raise ValueError("solution_original_variable_identity")
    if any(type(x) not in {int, float} or not math.isfinite(x) for x in values.values()):
        raise ValueError("solution_finite_real_values")
    if reported_objective is not None and (
        type(reported_objective) not in {int, float} or not math.isfinite(reported_objective)
    ):
        raise ValueError("claimed_objective_finite_real_or_null")
    violations = []
    max_row_violation = max_bound_violation = max_integer_violation = 0.0
    row_count = 0
    for variable, (lower, upper) in bounds.items():
        value = values[variable]
        violation = max(lower - value, value - upper, 0.0)
        max_bound_violation = max(max_bound_violation, violation)
        if violation > 1e-6:
            violations.append({"kind": "bound", "variable": variable, "value": value, "violation": violation})
        if variable in integers:
            violation = abs(value - round(value))
            max_integer_violation = max(max_integer_violation, violation)
            if violation > 1e-6:
                violations.append({"kind": "integer", "variable": variable, "value": value, "violation": violation})
    for row, kind in row_types.items():
        if kind == "N":
            continue
        row_count += 1
        activity = math.fsum(values[v] * a for v, a in coefficients.get(row, []))
        target = rhs.get(row, 0.0)
        violation = abs(activity - target) if kind == "E" else max(
            activity - target if kind == "L" else target - activity, 0.0
        )
        max_row_violation = max(max_row_violation, violation)
        tolerance = 1e-6 + 1e-9 * abs(target)
        if violation > tolerance:
            violations.append({"kind": "row", "row": row, "type": kind,
                               "activity": activity, "rhs": target, "violation": violation})
    independently_computed = math.fsum(values[v] * a for v, a in coefficients.get(objective, [])) - rhs.get(objective, 0.0)
    objective_error = None if reported_objective is None else abs(independently_computed - reported_objective)
    objective_pass = None if objective_error is None else objective_error <= 1e-6 + 1e-9 * abs(independently_computed)
    return {
        "object": "original linear model, not a re-created or relaxed planning model",
        "feasible": not violations,
        "objective_consistent": objective_pass,
        "variables_recomputed": len(bounds), "integer_variables_recomputed": len(integers),
        "constraints_recomputed": row_count,
        "max_row_violation": max_row_violation, "max_bound_violation": max_bound_violation,
        "max_integrality_violation": max_integer_violation,
        "reported_objective": reported_objective, "independent_objective": independently_computed,
        "objective_absolute_error": objective_error,
        "violations": violations,
        "scope": "original deterministic mathematical model only; operational translation and benchmark quality remain unvalidated",
    }
