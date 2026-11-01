"""Recompute supplied spreadsheet precedents with the independent formulas engine.

This never writes a source workbook. It requests individual vendor closing cells
instead of accepting supplied summary caches as an oracle. It is bounded to this
task's adopted schedules and records other source versions without selecting a
winner or converting an error into zero.
"""
import argparse
import json
import numbers
from pathlib import Path
import sys


def recompute(root, only_file=None):
    sys.path.insert(0, str(root / "calc-deps"))
    import formulas
    requests = [
        ("PPD1250-1.xlsx", 0, [f"BX{r}" for r in range(8, 46)]),
        ("PPD1251-1.xlsx", 0, [f"AT{r}" for r in range(6, 32)]),
        ("Good Insurance Co - Loan.xlsx", 0, ["G74", "F74", "E74"]),
        ("Good Insurance Co - Loan II.xlsx", 0, ["G24", "F24", "E24"]),
        ("Payroll-1.xlsx", 0, ["C21", "D21", "E29"]),
        ("Aurisic_Prepaid_Expenses_4-25-1.xlsx", 0, [f"BX{r}" for r in range(8, 52)]),
        ("Aurisic_Prepaid_Expenses_4-25-1.xlsx", 1, [f"AT{r}" for r in range(6, 32)]),
        ("AccrMisc-1.xlsx", 0, ["B5", "C10"]),
    ]
    import openpyxl
    destination=root / "independent-source-recalculation.json"
    results = json.loads(destination.read_text(encoding="utf-8"))["results"] if only_file and destination.exists() else []
    for filename, sheet_index, cells in requests:
        if only_file and filename != only_file:
            continue
        path = root / "public" / filename
        sheet = openpyxl.load_workbook(path, read_only=True).worksheets[sheet_index].title
        model = formulas.ExcelModel().loads(str(path)).finish(circular=True)
        definitions = model.to_dict()
        outputs = []
        for cell in cells:
            ending = sheet.upper() + "'!" + cell
            keys = [key for key in definitions if key.upper().endswith(ending)]
            if len(keys) == 1:
                outputs.append((cell, keys[0]))
            elif not keys:
                # A genuinely empty source precedent is empty, not a claimed
                # calculated zero. The later detail sum follows SUM's semantics.
                outputs.append((cell, None))
            else:
                raise ValueError("AMBIGUOUS_SOURCE_CELL:" + cell)
        solution = model.calculate(outputs=[node for _, node in outputs if node])
        values = {}
        for cell, node in outputs:
            if node is None:
                values[cell] = None
            else:
                array = solution[node].value
                value = array.ravel()[0]
                values[cell] = float(value) if isinstance(value, numbers.Real) else str(value)
        numeric = [v for v in values.values() if isinstance(v, (int, float))]
        errors = {k: v for k, v in values.items() if v is not None and not isinstance(v, (int, float))}
        result = {"file": filename, "sheet": sheet, "values": values,
                  "numeric_sum": sum(numeric), "source_errors": errors}
        results = [r for r in results if (r["file"],r["sheet"]) != (filename,sheet)] + [result]
        print(json.dumps({"file": filename, "sheet": sheet, "cells": len(values), "source_errors": errors}), flush=True)
        (root / "independent-source-recalculation.json").write_text(json.dumps({"engine": "formulas " + formulas.__version__, "results": results}, indent=2), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--file", help="Calculate only one new/changed source; retain other recorded source results")
    args=parser.parse_args()
    recompute(args.root,args.file)
