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
    last: int
    open_mean: Fraction
    weekday_means: dict

    def predict(self, strategy, row):
        if strategy == "last":
            return Fraction(self.last)
        if strategy == "open":
            return self.open_mean if row.is_open else Fraction(0)
        if strategy == "weekday":
            return self.weekday_means[row.date.weekday()]
        raise ValueError(f"Unknown strategy: {strategy}")


def read_csv(path, required):
    with path.open(encoding="utf-8", newline="") as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames is None or not set(required) <= set(reader.fieldnames):
            raise ValueError(f"{path}: required columns are {', '.join(required)}")
        rows = []
        for row in reader:
            if any(row[column] is None for column in required):
                raise ValueError(f"{path}:{reader.line_num}: incomplete record")
            if not row["item"]:
                raise ValueError(f"{path}:{reader.line_num}: empty item")
            rows.append(row)
        return rows


def nonnegative_integer(value):
    number = int(value)
    if number < 0:
        raise ValueError(f"Expected nonnegative integer, got {value!r}")
    return number


def read_observations(path, labeled):
    columns = ["date", "item", "is_open"] + (["demand"] if labeled else [])
    observations = []
    seen = set()
    for row in read_csv(path, columns):
        if row["is_open"] not in ("0", "1"):
            raise ValueError(f"{path}: is_open must be 0 or 1")
        observation = Observation(
            date.fromisoformat(row["date"]),
            row["item"],
            int(row["is_open"]),
            nonnegative_integer(row["demand"]) if labeled else 0,
        )
        key = (observation.date, observation.item)
        if key in seen:
            raise ValueError(f"{path}: duplicate date/item {key!r}")
        seen.add(key)
        observations.append(observation)
    return observations


def fit(train):
    histories = {}
    for row in train:
        histories.setdefault(row.item, []).append(row)
    models = {}
    for item, history in histories.items():
        weekdays = {day: [] for day in range(7)}
        opened = []
        for row in history:
            weekdays[row.date.weekday()].append(row.demand)
            if row.is_open:
                opened.append(row.demand)
        if not opened or any(not values for values in weekdays.values()):
            raise ValueError(f"{item!r}: training needs seven weekdays and an open row")
        models[item] = Model(
            max(history, key=lambda row: row.date).demand,
            Fraction(sum(opened), len(opened)),
            {
                day: Fraction(sum(values), len(values))
                for day, values in weekdays.items()
            },
        )
    return models


def json_number(value):
    return value.numerator if value.denominator == 1 else float(value)


def run(root):
    root = Path(root)
    models = fit(read_observations(root / "train.csv", labeled=True))
    validation = read_observations(root / "validation.csv", labeled=True)
    future = read_observations(root / "future.csv", labeled=False)
    inventory = {}
    for row in read_csv(root / "inventory.csv", ["item", "stock", "buffer"]):
        if row["item"] in inventory:
            raise ValueError(f"Duplicate inventory item: {row['item']!r}")
        inventory[row["item"]] = (
            nonnegative_integer(row["stock"]),
            nonnegative_integer(row["buffer"]),
        )
    if not validation:
        raise ValueError("validation.csv needs at least one row to define MSE")
    for row in validation + future:
        if row.item not in models or row.item not in inventory:
            raise ValueError(f"{row.item!r}: training and inventory are required")
    scores = {
        name: sum(
            (models[row.item].predict(name, row) - row.demand) ** 2
            for row in validation
        )
        / len(validation)
        for name in STRATEGIES
    }
    selected = min(STRATEGIES, key=lambda name: (scores[name], name))
    plan = []
    for row in sorted(future, key=lambda row: (row.date, row.item)):
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
        validation_mse={name: json_number(score) for name, score in scores.items()},
        plan=plan,
    )


def main():
    parser = argparse.ArgumentParser(
        description="Select a forecast and plan replenishment"
    )
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    result = run(args.input)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, allow_nan=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
