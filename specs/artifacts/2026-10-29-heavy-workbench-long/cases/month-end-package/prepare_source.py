"""Read only the supplied April/March originals for the complete package producer."""
import argparse
from collections import Counter
from decimal import Decimal
import json
from pathlib import Path
import re
import openpyxl

ACCOUNT = re.compile(r"^(\d{4})-(\d{4})\s+(.+?)\s+([\d,.]+-?)\s+([\d,.]+-?)\s+([A-Za-z])\s*$")


def amount(text):
    return Decimal(text.rstrip("-").replace(",", "")) * (-1 if text.endswith("-") else 1)


def prepare(root):
    public = root / "public"
    records = []
    for line in (public / "Aurisic_Final_TB_4-25-1.txt").read_text().splitlines():
        match = ACCOUNT.match(line)
        if match:
            records.append([int(match[1]), int(match[2]), match[3], float(amount(match[4])), float(amount(match[5])), match[6]])
    if len(records) != 105 or len({tuple(x[:2]) for x in records}) != 105:
        raise ValueError("ORIGINAL_TB_POPULATION_MISMATCH")
    march = openpyxl.load_workbook(public / "Aurisic_Financials_3-25-1.xlsx", data_only=True)
    tb = march.worksheets[1]
    old = [[tb.cell(row, col).value for col in range(1, 7)] for row in range(2, tb.max_row + 1)
           if isinstance(tb.cell(row, 2).value, (int, float))]
    current = {tuple(row[:2]): row for row in records}
    old_keys = {tuple(row[:2]) for row in old}
    ordered = [current[tuple(row[:2])] for row in old] + [row for row in records if tuple(row[:2]) not in old_keys]
    gaps = []
    for row in old:
        now = current[tuple(row[:2])]
        gap = Decimal(str(now[4])) - Decimal(str(row[4])) - Decimal(str(now[3]))
        if abs(gap) > Decimal("0.011"):
            gaps.append([row[0], row[1], now[2], float(gap)])
    metadata = {}
    for file in public.glob("*.xlsx"):
        book = openpyxl.load_workbook(file, data_only=False)
        metadata[file.name] = [{"name": sheet.title, "rows": sheet.max_row, "columns": sheet.max_column,
            "column_dimensions": [{"min": dim.min, "max": dim.max, "width": dim.width, "hidden": bool(dim.hidden),
                                   "outline": dim.outlineLevel, "collapsed": bool(dim.collapsed)} for dim in sheet.column_dimensions.values()],
            "row_dimensions": [{"row": i, "height": dim.height, "hidden": bool(dim.hidden), "outline": dim.outlineLevel,
                                 "collapsed": bool(dim.collapsed)} for i, dim in sheet.row_dimensions.items()],
            "merges": [str(x) for x in sheet.merged_cells.ranges], "freeze": sheet.freeze_panes} for sheet in book]
    combined = openpyxl.load_workbook(public / "Aurisic_Prepaid_Expenses_4-25-1.xlsx", data_only=True)
    data = {"records": ordered, "source_order_records": records, "march_records": old, "cross_period_gaps": gaps,
            "metadata": metadata, "combined_prepaid_original_cache": {
                "expenses_BX53": combined.worksheets[0]["BX53"].value,
                "insurance_AT32": combined.worksheets[1]["AT32"].value,
                "status": "Original cached observations, not verified recalculation or authoritative ledger controls"},
            "source_counts": {"april_accounts": len(records), "march_accounts": len(old), "groups": dict(Counter(x[5] for x in records))}}
    (root / "source-normalization.json").write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
    return data


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(prepare(args.root)["source_counts"]))
