"""Operator-only arithmetic from the frozen source; never copied into the Task."""
import json
from collections import defaultdict
from fractions import Fraction
from pathlib import Path

root = Path(__file__).resolve().parent
rows = json.loads((root / "source-response.json").read_text())
public = json.loads((root / "input/metrics.json").read_text())
assert rows == public["rows"], "Public input must preserve the original grouped values"
totals = defaultdict(lambda: {"requests": 0, "same_month_closed": 0})
for row in rows:
    value = totals[(row["cohort_month"][:7], row.get("borough", "(missing)"))]
    count = int(row["requests"])
    value["requests"] += count
    if row.get("closed_month") == row["cohort_month"]:
        value["same_month_closed"] += count

by_borough = []
for (month, borough), value in sorted(totals.items()):
    by_borough.append({"month": month, "borough": borough, **value,
        "remaining": value["requests"] - value["same_month_closed"],
        "same_month_share": str(Fraction(value["same_month_closed"], value["requests"]))})
months = {}
for month in sorted({key[0] for key in totals}):
    months[month] = {name: sum(value[name] for key, value in totals.items() if key[0] == month)
                     for name in ["requests", "same_month_closed"]}
changes = []
for borough in sorted({key[1] for key in totals}):
    july = totals[("2025-07", borough)]["requests"]
    august = totals[("2025-08", borough)]["requests"]
    changes.append({"borough": borough, "july": july, "august": august,
                    "absolute_change": august - july,
                    "relative_change": str(Fraction(august - july, july)) if july else None})
print(json.dumps({"authority": "frozen original grouped source, operator arithmetic only",
                  "by_borough": by_borough, "months": months, "changes": changes}, indent=2))
