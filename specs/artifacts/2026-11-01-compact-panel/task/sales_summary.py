import csv
import json
import sys
from decimal import Decimal


def summarize(filename):
    totals = {}
    with open(filename, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            if row["status"].strip() not in {"paid", "refunded"}:
                continue
            key = (row["team"], row["currency"])
            totals[key] = totals.get(key, Decimal("0.00")) + Decimal(row["amount"])
    return {
        f"{team}/{currency}": format(amount, ".2f")
        for (team, currency), amount in sorted(totals.items())
    }


if __name__ == "__main__":
    summary = summarize(sys.argv[1])
    with open("summary.csv", "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["team", "currency", "net_amount"])
        for key, amount in summary.items():
            team, currency = key.rsplit("/", 1)
            writer.writerow([team, currency, amount])
    print(json.dumps(summary, ensure_ascii=False))
