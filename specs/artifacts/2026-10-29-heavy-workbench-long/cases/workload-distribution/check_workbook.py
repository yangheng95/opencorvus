"""Consume actual labelled XLSX result tables and report numerical differences."""
import argparse
import json
import math
from pathlib import Path
import openpyxl
from source_facts import calculate

TABLES = {
    "people": ["person", "department", "employment", "nominal_h", "project_capacity_h", "project_h", "admin_h", "total_h", "allocation", "status"],
    "departments": ["department", "nominal_h", "total_h", "utilization", "status"],
    "projects": ["project", "budget_h", "actual_h", "excess_h", "status"],
}


def assess(source, workbook):
    expected = calculate(source)
    book = openpyxl.load_workbook(workbook, data_only=True)
    outcomes = []
    for key, headers in TABLES.items():
        found = []
        for sheet in book:
            for row in sheet.iter_rows(min_row=1, max_row=min(50, sheet.max_row)):
                labels = {c.value: c.column for c in row if isinstance(c.value, str)}
                if set(headers).issubset(labels):
                    found.append((sheet, row[0].row, labels))
        if len(found) != 1:
            outcomes.append({"table": key, "contract": "TABLE_LOCATION_ERROR", "locations": len(found)})
            continue
        sheet, first, labels = found[0]
        actual, duplicates = {}, []
        for r in range(first + 1, sheet.max_row + 1):
            identifier = sheet.cell(r, labels[headers[0]]).value
            if not identifier:
                break
            if identifier in actual:
                duplicates.append(identifier)
            actual[identifier] = [sheet.cell(r, labels[h]).value for h in headers]
        diffs, numeric = [], []
        expected_ids = {r[0] for r in expected[key]}
        for row in expected[key]:
            observed = actual.get(row[0])
            if observed is None:
                diffs.append({"id": row[0], "contract": "ROW_MISSING"})
                continue
            for i, wanted in enumerate(row):
                value = observed[i]
                if wanted is None:
                    okay = value in [None, "", "unknown"]
                elif isinstance(wanted, (float, int)):
                    okay = isinstance(value, (int, float)) and math.isfinite(value)
                    error = abs(value - wanted) if okay else None
                    if error is not None:
                        numeric.append({"id": row[0], "field": headers[i], "absolute_error": error})
                    okay = okay and error <= 1e-9
                else:
                    okay = value == wanted
                if not okay:
                    diffs.append({"id": row[0], "field": headers[i], "expected": wanted, "actual": value, "contract": "VALUE_MISMATCH"})
        extra = sorted(set(actual) - expected_ids)
        outcomes.append({"table": key, "contract": "MATCH" if not diffs and not extra and not duplicates else "NUMERICAL_OR_POPULATION_MISMATCH",
                         "rows": len(actual), "differences": diffs, "extra_ids": extra, "duplicate_ids": duplicates,
                         "numeric_errors": numeric})
    return {"numerical_tables": outcomes, "numerically_matches": all(x["contract"] == "MATCH" for x in outcomes),
            "score": None, "scope": "Actual saved XLSX tables only. Does not certify report, refresh, visuals, professional judgment or hours."}


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", required=True, type=Path)
    p.add_argument("--workbook", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    a = p.parse_args()
    result = assess(a.source, a.workbook)
    a.output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({"numerically_matches": result["numerically_matches"], "tables": [{k:x[k] for k in ['table','contract']} for x in result['numerical_tables']]}))
    raise SystemExit(0 if result["numerically_matches"] else 4)
