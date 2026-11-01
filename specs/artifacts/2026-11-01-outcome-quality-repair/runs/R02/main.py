"""Training-only demand selection and independent replenishment scenarios."""

import argparse
import csv
import json
from collections import defaultdict
from datetime import date
from fractions import Fraction
from pathlib import Path

STRATEGIES = ("last", "open", "weekday")


def read_rows(path, columns):
    """Read named fields without normalizing item text or quoted newlines."""
    with path.open(encoding="utf-8", newline="") as stream:
        reader = csv.DictReader(stream)
        if not set(columns).issubset(reader.fieldnames or ()):
            raise ValueError(f"{path}: missing required columns")
        rows = []
        for row in reader:
            record = {key: row[key] for key in columns}
            if not record["item"]:
                raise ValueError(f"{path}: empty item")
            if "date" in record:
                record["date"] = date.fromisoformat(record["date"])
            for key in ("demand", "stock", "buffer", "is_open"):
                if key in record:
                    record[key] = int(record[key])
                    if record[key] < 0 or (key == "is_open" and record[key] > 1):
                        raise ValueError(f"{path}: invalid {key}")
            rows.append(record)
        return rows


def fit(train):
    """Build exact per-item statistics from training rows only."""
    grouped = defaultdict(list)
    for row in train:
        grouped[row["item"]].append(row)
    models = {}
    for item, rows in grouped.items():
        weekdays = defaultdict(list)
        opened = []
        for row in rows:
            weekdays[row["date"].weekday()].append(row["demand"])
            if row["is_open"]:
                opened.append(row["demand"])
        if len(weekdays) != 7 or not opened:
            raise ValueError(f"Incomplete training coverage for {item!r}")
        models[item] = {
            "last": Fraction(max(rows, key=lambda row: row["date"])["demand"]),
            "open": Fraction(sum(opened), len(opened)),
            "weekday": {
                day: Fraction(sum(values), len(values))
                for day, values in weekdays.items()
            },
        }
    return models


def predict(models, strategy, row):
    model = models[row["item"]]
    if strategy == "weekday":
        return model["weekday"][row["date"].weekday()]
    if strategy == "open" and not row["is_open"]:
        return Fraction(0)
    return model[strategy]


def number(value):
    """Round rational results only at the JSON boundary."""
    return value.numerator if value.denominator == 1 else float(value)


def run(root):
    root = Path(root)
    models = fit(read_rows(root / "train.csv", ("date", "item", "is_open", "demand")))
    validation = read_rows(
        root / "validation.csv", ("date", "item", "is_open", "demand")
    )
    if not validation:
        raise ValueError("Validation must contain at least one row to define MSE")
    losses = {
        name: sum(
            ((predict(models, name, row) - row["demand"]) ** 2 for row in validation),
            Fraction(0),
        )
        / len(validation)
        for name in STRATEGIES
    }
    selected = min(STRATEGIES, key=lambda name: (losses[name], name))
    inventory = {
        row["item"]: row
        for row in read_rows(root / "inventory.csv", ("item", "stock", "buffer"))
    }
    plan = []
    for row in read_rows(root / "future.csv", ("date", "item", "is_open")):
        forecast = predict(models, selected, row)
        stock = inventory[row["item"]]
        order = max(Fraction(0), forecast + stock["buffer"] - stock["stock"])
        plan.append(
            dict(
                date=row["date"].isoformat(),
                item=row["item"],
                forecast=number(forecast),
                order=number(order),
            )
        )
    return dict(
        selected=selected,
        validation_mse={name: number(losses[name]) for name in STRATEGIES},
        plan=sorted(plan, key=lambda row: (row["date"], row["item"])),
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = run(args.input)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, allow_nan=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
