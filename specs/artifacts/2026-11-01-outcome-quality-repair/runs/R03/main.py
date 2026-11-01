import argparse
import csv
import json
from dataclasses import dataclass
from datetime import date
from fractions import Fraction
from pathlib import Path


STRATEGIES = ("last", "open", "weekday")


@dataclass(frozen=True)
class Observation:
    date: date
    item: str
    is_open: int
    demand: int = 0


@dataclass(frozen=True)
class Model:
    weekday: tuple
    open: Fraction
    last: int

    def predict(self, strategy, row):
        if strategy == "weekday":
            return self.weekday[row.date.weekday()]
        if strategy == "open":
            return self.open if row.is_open else Fraction(0)
        if strategy == "last":
            return Fraction(self.last)
        raise ValueError("Unknown strategy: " + strategy)


def read_csv(path, required):
    with path.open(encoding="utf-8", newline="") as stream:
        reader = csv.DictReader(stream)
        missing = set(required) - set(reader.fieldnames or ())
        if missing:
            raise ValueError("{}: missing columns {}".format(path, sorted(missing)))
        return list(reader)


def nonnegative(value):
    number = int(value)
    if number < 0:
        raise ValueError("Expected a nonnegative integer, got " + value)
    return number


def observations(path, labeled):
    columns = ["date", "item", "is_open"] + (["demand"] if labeled else [])
    result = []
    seen = set()
    for row in read_csv(path, columns):
        if not row["item"] or row["is_open"] not in ("0", "1"):
            raise ValueError("{}: invalid item or is_open".format(path))
        observation = Observation(
            date.fromisoformat(row["date"]),
            row["item"],
            int(row["is_open"]),
            nonnegative(row["demand"]) if labeled else 0,
        )
        key = (observation.date, observation.item)
        if key in seen:
            raise ValueError("{}: duplicate date/item {}".format(path, key))
        seen.add(key)
        result.append(observation)
    return result


def fit(train):
    histories = {}
    for row in train:
        histories.setdefault(row.item, []).append(row)
    models = {}
    for item, rows in histories.items():
        totals, counts = [0] * 7, [0] * 7
        open_total = open_count = 0
        for row in rows:
            weekday = row.date.weekday()
            totals[weekday] += row.demand
            counts[weekday] += 1
            if row.is_open:
                open_total += row.demand
                open_count += 1
        if not all(counts) or not open_count:
            raise ValueError("Incomplete training coverage for " + repr(item))
        models[item] = Model(
            tuple(Fraction(total, count) for total, count in zip(totals, counts)),
            Fraction(open_total, open_count),
            max(rows, key=lambda row: row.date).demand,
        )
    return models


def json_number(value):
    return value.numerator if value.denominator == 1 else float(value)


def run(root):
    root = Path(root)
    models = fit(observations(root / "train.csv", labeled=True))
    validation = observations(root / "validation.csv", labeled=True)
    if not validation:
        raise ValueError("validation.csv must contain at least one observation")
    scores = {
        name: sum(
            (models[row.item].predict(name, row) - row.demand) ** 2
            for row in validation
        )
        / len(validation)
        for name in STRATEGIES
    }
    selected = min(STRATEGIES, key=lambda name: (scores[name], name))
    inventory = {}
    for row in read_csv(root / "inventory.csv", ("item", "stock", "buffer")):
        if not row["item"] or row["item"] in inventory:
            raise ValueError("inventory.csv: empty or duplicate item")
        inventory[row["item"]] = (nonnegative(row["stock"]), nonnegative(row["buffer"]))
    plan = []
    for row in sorted(
        observations(root / "future.csv", labeled=False),
        key=lambda row: (row.date, row.item),
    ):
        forecast = models[row.item].predict(selected, row)
        stock, buffer = inventory[row.item]
        order = max(Fraction(0), forecast + buffer - stock)
        plan.append(
            dict(
                date=row.date.isoformat(),
                item=row.item,
                forecast=json_number(forecast),
                order=json_number(order),
            )
        )
    return dict(
        selected=selected,
        validation_mse={name: json_number(scores[name]) for name in STRATEGIES},
        plan=plan,
    )


def main():
    parser = argparse.ArgumentParser(
        description="Select and release a training-only demand forecast."
    )
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = run(args.input)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
