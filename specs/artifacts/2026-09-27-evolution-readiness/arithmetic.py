"""Operator arithmetic from the single frozen input; never an Agent/Host gate."""
import json
from fractions import Fraction
from pathlib import Path

rows = json.loads((Path(__file__).parent / "input/metrics.json").read_text(encoding="utf-8"))["rows"]
periods = sorted({row["period"] for row in rows})
if len(periods) != 2:
    raise ValueError("This registered diagnostic requires exactly two periods")
by_period = {period: [row for row in rows if row["period"] == period] for period in periods}
totals = {}
rates = {}
for period, entries in by_period.items():
    if len({row["segment"] for row in entries}) != len(entries):
        raise ValueError("A segment must have one aggregate per period")
    if any(not isinstance(row[key], int) for row in entries for key in ("eligible", "successful")):
        raise ValueError("Counts must be integers")
    if any(row["eligible"] <= 0 or not 0 <= row["successful"] <= row["eligible"] for row in entries):
        raise ValueError("Counts must define a bounded success rate")
    eligible = sum(row["eligible"] for row in entries)
    successful = sum(row["successful"] for row in entries)
    totals[period] = {"eligible": eligible, "successful": successful, "rate": Fraction(successful, eligible)}
    rates[period] = {row["segment"]: Fraction(row["successful"], row["eligible"]) for row in entries}

before, after = periods
if rates[before].keys() != rates[after].keys():
    raise ValueError("Both periods must cover the same registered strata")
standardized_after = sum(
    Fraction(row["eligible"], totals[before]["eligible"]) * rates[after][row["segment"]]
    for row in by_period[before]
)
within = standardized_after - totals[before]["rate"]
mix = totals[after]["rate"] - standardized_after
observed = totals[after]["rate"] - totals[before]["rate"]
if within + mix != observed:
    raise ArithmeticError("The exact decomposition did not reconcile")
print(json.dumps({
    "period_totals": totals,
    "segment_rates": rates,
    "standardized_after_at_before_weights": standardized_after,
    "within_rate_change": within,
    "mix_change_at_after_rates": mix,
    "observed_change": observed,
    "all_segment_rate_changes": {segment: rates[after][segment] - rates[before][segment] for segment in rates[before]},
}, default=str, indent=2))
