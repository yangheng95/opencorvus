import csv
import json
import random
import subprocess
import sys
import tempfile
import unittest
from datetime import date, timedelta
from fractions import Fraction
from pathlib import Path


ROOT = Path(__file__).resolve().parent
ARCHIVE = ROOT / "deliverable.pyz"
FIELDS = {
    "train": ["date", "item", "is_open", "demand"],
    "validation": ["date", "item", "is_open", "demand"],
    "future": ["date", "item", "is_open"],
    "inventory": ["item", "stock", "buffer"],
}


def oracle(data):
    def predict(strategy, target):
        history = [row for row in data["train"] if row["item"] == target["item"]]
        if strategy == "last":
            return Fraction(max(history, key=lambda row: row["date"])["demand"])
        if strategy == "open":
            if not target["is_open"]:
                return Fraction(0)
            values = [row["demand"] for row in history if row["is_open"]]
        else:
            day = date.fromisoformat(target["date"]).weekday()
            values = [
                row["demand"]
                for row in history
                if date.fromisoformat(row["date"]).weekday() == day
            ]
        return Fraction(sum(values), len(values))

    losses = {}
    for strategy in ("last", "open", "weekday"):
        errors = [
            (predict(strategy, row) - row["demand"]) ** 2 for row in data["validation"]
        ]
        losses[strategy] = sum(errors) / len(errors)
    selected = min(losses, key=lambda name: (losses[name], name))
    inventory = {row["item"]: row for row in data["inventory"]}
    plan = []
    for row in sorted(data["future"], key=lambda row: (row["date"], row["item"])):
        forecast = predict(selected, row)
        stock = inventory[row["item"]]
        plan.append(
            dict(
                date=row["date"],
                item=row["item"],
                forecast=float(forecast),
                order=float(max(0, forecast + stock["buffer"] - stock["stock"])),
            )
        )
    return dict(
        selected=selected,
        validation_mse={k: float(v) for k, v in losses.items()},
        plan=plan,
    )


def fixture(strategy):
    train = [
        dict(
            date=(date(2026, 1, 5) + timedelta(days=i)).isoformat(),
            item="Widget",
            is_open=int(i != 6),
            demand=2 * (i + 1),
        )
        for i in range(7)
    ]
    targets = {"weekday": [2, 4, 6], "open": [7, 0, 7], "last": [14, 14, 14]}
    validation = [
        dict(
            date="2026-01-{:02d}".format(12 + i),
            item="Widget",
            is_open=int(i != 1),
            demand=value,
        )
        for i, value in enumerate(targets[strategy])
    ]
    future = [
        dict(date="2026-01-{:02d}".format(19 + i), item="Widget", is_open=opened)
        for i, opened in enumerate([1, 0, 1, 0])
    ]
    return dict(
        train=train,
        validation=validation,
        future=list(reversed(future)),
        inventory=[dict(item="Widget", stock=3, buffer=1)],
    )


class DeliveryTests(unittest.TestCase):
    def assert_result(self, actual, expected):
        self.assertEqual(set(actual), {"selected", "validation_mse", "plan"})
        self.assertEqual(actual["selected"], expected["selected"])
        self.assertEqual(set(actual["validation_mse"]), {"last", "open", "weekday"})
        for name, value in expected["validation_mse"].items():
            self.assertAlmostEqual(actual["validation_mse"][name], value, delta=1e-8)
        self.assertEqual(len(actual["plan"]), len(expected["plan"]))
        for got, want in zip(actual["plan"], expected["plan"]):
            self.assertEqual(set(got), {"date", "item", "forecast", "order"})
            self.assertEqual((got["date"], got["item"]), (want["date"], want["item"]))
            for field in ("forecast", "order"):
                self.assertAlmostEqual(got[field], want[field], delta=1e-8)

    def execute(self, data, varied=False, stale=False):
        with tempfile.TemporaryDirectory(prefix="forecast delivery ") as temporary:
            cwd = Path(temporary)
            inputs = cwd / "input Unicode 数据"
            inputs.mkdir()
            for split, fields in FIELDS.items():
                fields = (
                    list(reversed(fields)) + ["note", "demand"]
                    if varied and split == "future"
                    else (list(reversed(fields)) + ["note"] if varied else fields)
                )
                with (inputs / (split + ".csv")).open(
                    "w", encoding="utf-8", newline=""
                ) as stream:
                    writer = csv.DictWriter(
                        stream,
                        fieldnames=fields,
                        lineterminator="\r\n" if varied else "\n",
                    )
                    writer.writeheader()
                    for row in data[split]:
                        record = dict(row)
                        if varied:
                            record["note"] = 'metadata, "quoted"\r\nsecond line'
                            if split == "future":
                                record["demand"] = "not a label"
                        writer.writerow(record)
            if stale:
                (inputs / "release.json").write_text(
                    '{"strategy":"obsolete"}', encoding="utf-8"
                )
            completed = subprocess.run(
                [
                    sys.executable,
                    str(ARCHIVE),
                    inputs.name,
                    "--output",
                    "actual output.json",
                ],
                cwd=cwd,
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=30,
            )
            self.assertEqual(completed.returncode, 0, completed.stderr)
            return json.loads((cwd / "actual output.json").read_text(encoding="utf-8"))

    def test_each_strategy_is_actually_released(self):
        expected_forecasts = {
            "weekday": [2, 4, 6, 8],
            "open": [7, 0, 7, 0],
            "last": [14, 14, 14, 14],
        }
        for strategy, forecasts in expected_forecasts.items():
            with self.subTest(strategy=strategy):
                data = fixture(strategy)
                actual = self.execute(data, stale=True)
                self.assert_result(actual, oracle(data))
                self.assertEqual(actual["selected"], strategy)
                self.assertEqual(actual["validation_mse"][strategy], 0)
                self.assertEqual([r["forecast"] for r in actual["plan"]], forecasts)
                self.assertEqual(
                    [r["order"] for r in actual["plan"]],
                    [max(0, value - 2) for value in forecasts],
                )

    def test_sample_hand_calculated(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "sample.json"
            completed = subprocess.run(
                [
                    sys.executable,
                    str(ARCHIVE),
                    str(ROOT / "sample"),
                    "--output",
                    str(output),
                ],
                cwd=temporary,
                capture_output=True,
                text=True,
                timeout=30,
            )
            self.assertEqual(completed.returncode, 0, completed.stderr)
            actual = json.loads(output.read_text(encoding="utf-8"))
        plan = [
            dict(
                date="2026-01-{:02d}".format(day),
                item=item,
                forecast=forecast,
                order=order,
            )
            for day, a, b in [
                (26, (10, 9), (20, 16)),
                (27, (0, 0), (0, 0)),
                (28, (10, 9), (20, 16)),
            ]
            for item, (forecast, order) in [("Alpha", a), ("Beta", b)]
        ]
        self.assert_result(
            actual,
            dict(
                selected="open",
                validation_mse={"last": 1500 / 7, "open": 0, "weekday": 500 / 7},
                plan=plan,
            ),
        )

    def test_exact_ties_are_lexicographic(self):
        data = fixture("last")
        for row in data["train"]:
            row.update(demand=5, is_open=1)
        for row in data["validation"]:
            row.update(demand=5, is_open=1)
        actual = self.execute(data)
        self.assert_result(actual, oracle(data))
        self.assertEqual(actual["validation_mse"], dict(last=0, open=0, weekday=0))
        self.assertEqual(actual["selected"], "last")
        for row in data["validation"]:
            row["is_open"] = 0
        actual = self.execute(data)
        self.assertEqual(actual["selected"], "last")
        self.assertEqual(actual["validation_mse"], dict(last=0, open=25, weekday=0))

    def test_global_row_weighting_not_item_weighting(self):
        data = fixture("last")
        data["train"] = [
            dict(row, item=item) for item in ("A", "B") for row in data["train"]
        ]
        data["validation"] = [
            dict(date="2026-01-12", item="A", is_open=1, demand=14)
        ] + [
            dict(
                date=(date(2026, 1, 12) + timedelta(days=i)).isoformat(),
                item="B",
                is_open=1,
                demand=7,
            )
            for i in range(10)
        ]
        data["inventory"] = [dict(item=item, stock=0, buffer=0) for item in ("A", "B")]
        data["future"] = [
            dict(row, item=item) for item in ("B", "A") for row in data["future"]
        ]
        actual = self.execute(data)
        self.assert_result(actual, oracle(data))
        self.assertEqual(actual["selected"], "open")
        self.assertEqual(actual["validation_mse"]["open"], 49 / 11)
        self.assertEqual(actual["validation_mse"]["last"], 490 / 11)

    def test_csv_unicode_quoting_and_exact_item_text(self):
        data = fixture("weekday")
        names = [' 咖啡,"大杯"\r\n第二行 ', "e\u0301", "é", " plain "]
        for split in FIELDS:
            data[split] = [
                dict(row, item=name) for name in names for row in data[split]
            ]
        self.assert_result(self.execute(data, varied=True), oracle(data))

    def test_fractional_means_and_unordered_training(self):
        data = fixture("open")
        extra = [
            dict(
                row,
                date=(date.fromisoformat(row["date"]) + timedelta(days=7)).isoformat(),
                demand=row["demand"] + 1,
            )
            for row in data["train"]
        ]
        data["train"] = list(reversed(data["train"] + extra))
        actual = self.execute(data, varied=True)
        self.assert_result(actual, oracle(data))
        self.assertEqual(actual["selected"], "open")
        self.assertEqual([r["forecast"] for r in actual["plan"]], [7.5, 0, 7.5, 0])

    def test_empty_future(self):
        data = fixture("last")
        data["future"] = []
        self.assert_result(self.execute(data, varied=True), oracle(data))

    def test_seeded_supported_inputs(self):
        for seed in range(12):
            with self.subTest(seed=seed):
                rng = random.Random(seed)
                data = {split: [] for split in FIELDS}
                for item in ("A,quoted", 'B"quoted', "数据"):
                    for i in range(21):
                        data["train"].append(
                            dict(
                                date=(
                                    date(2024, 2, 19) + timedelta(days=i)
                                ).isoformat(),
                                item=item,
                                is_open=1 if i == 0 else rng.randrange(2),
                                demand=rng.randrange(50),
                            )
                        )
                    for split, start, count in [
                        ("validation", date(2024, 3, 11), rng.randrange(1, 10)),
                        ("future", date(2024, 3, 25), 9),
                    ]:
                        for i in range(count):
                            row = dict(
                                date=(start + timedelta(days=i)).isoformat(),
                                item=item,
                                is_open=rng.randrange(2),
                            )
                            if split == "validation":
                                row["demand"] = rng.randrange(50)
                            data[split].append(row)
                    data["inventory"].append(
                        dict(
                            item=item, stock=rng.randrange(60), buffer=rng.randrange(20)
                        )
                    )
                for rows in data.values():
                    rng.shuffle(rows)
                self.assert_result(
                    self.execute(data, varied=bool(seed % 2)), oracle(data)
                )


if __name__ == "__main__":
    unittest.main()
