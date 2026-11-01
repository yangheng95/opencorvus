import csv
import json
import os
import random
import shutil
import subprocess
import sys
import tempfile
import unittest
from datetime import date, timedelta
from fractions import Fraction
from pathlib import Path


ROOT = Path(__file__).resolve().parent
ARCHIVE = ROOT / "deliverable.pyz"


def oracle(train, validation, future, inventory):
    def forecast(strategy, target):
        history = [row for row in train if row[1] == target[1]]
        if strategy == "last":
            return Fraction(sorted(history)[-1][3])
        if strategy == "open" and not target[2]:
            return Fraction(0)
        values = [
            row[3]
            for row in history
            if (
                row[2] == 1
                if strategy == "open"
                else date.fromisoformat(row[0]).weekday()
                == date.fromisoformat(target[0]).weekday()
            )
        ]
        return sum(map(Fraction, values)) / len(values)

    losses = {}
    for strategy in ("weekday", "open", "last"):
        errors = [forecast(strategy, row) - row[3] for row in validation]
        losses[strategy] = sum(error * error for error in errors) / len(errors)
    winner = sorted(losses, key=lambda name: (losses[name], name))[0]
    balances = {item: (stock, buffer) for item, stock, buffer in inventory}
    plan = []
    for row in sorted(future):
        value = forecast(winner, row)
        stock, buffer = balances[row[1]]
        plan.append(
            dict(
                date=row[0],
                item=row[1],
                forecast=value,
                order=max(0, value + buffer - stock),
            )
        )
    return dict(selected=winner, validation_mse=losses, plan=plan)


class ReleaseTests(unittest.TestCase):
    def invoke(self, root, cwd, output="result.json", relative=False):
        input_path = os.path.relpath(root, cwd) if relative else str(root)
        command = [sys.executable, str(ARCHIVE), input_path, "--output", output]
        result = subprocess.run(
            command,
            cwd=cwd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads((Path(cwd) / output).read_text(encoding="utf-8"))

    def assert_result(self, actual, expected):
        self.assertEqual(set(actual), {"selected", "validation_mse", "plan"})
        self.assertEqual(actual["selected"], expected["selected"])
        self.assertEqual(set(actual["validation_mse"]), {"last", "open", "weekday"})
        for name, loss in expected["validation_mse"].items():
            self.assertLessEqual(
                abs(Fraction(actual["validation_mse"][name]) - loss),
                Fraction(1, 100_000_000),
            )
        self.assertEqual(len(actual["plan"]), len(expected["plan"]))
        for got, want in zip(actual["plan"], expected["plan"]):
            self.assertEqual(set(got), {"date", "item", "forecast", "order"})
            self.assertEqual((got["date"], got["item"]), (want["date"], want["item"]))
            for field in ("forecast", "order"):
                self.assertLessEqual(
                    abs(Fraction(got[field]) - want[field]), Fraction(1, 100_000_000)
                )

    def exercise(self, train, validation, future, inventory, varied=False, stale=False):
        expected = oracle(train, validation, future, inventory)
        with tempfile.TemporaryDirectory(prefix="forecast contract ") as directory:
            cwd = Path(directory)
            root = cwd / "input data"
            root.mkdir()
            tables = [
                ("train", ["date", "item", "is_open", "demand"], train),
                ("validation", ["date", "item", "is_open", "demand"], validation),
                ("future", ["date", "item", "is_open"], future),
                ("inventory", ["item", "stock", "buffer"], inventory),
            ]
            for index, (name, columns, rows) in enumerate(tables):
                fields = (
                    list(reversed(columns)) + ["metadata", "demand_hint"]
                    if varied
                    else columns
                )
                with (root / (name + ".csv")).open(
                    "w", encoding="utf-8", newline=""
                ) as stream:
                    writer = csv.DictWriter(
                        stream,
                        fieldnames=fields,
                        lineterminator="\r\n" if index % 2 else "\n",
                    )
                    writer.writeheader()
                    for row in rows:
                        record = dict(zip(columns, row))
                        if varied:
                            record.update(
                                metadata='ignored, "quoted"\nmetadata',
                                demand_hint=999999,
                            )
                        writer.writerow(record)
            if stale:
                (root / "release.json").write_text(
                    '{"strategy":"obsolete"}', encoding="utf-8"
                )
            actual = self.invoke(root, cwd, "output with spaces.json", relative=True)
            self.assert_result(actual, expected)
            return actual

    def test_sample_hand_calculated(self):
        expected = {
            "selected": "open",
            "validation_mse": {
                "last": Fraction(1500, 7),
                "open": 0,
                "weekday": Fraction(500, 7),
            },
            "plan": [
                dict(date=day, item=item, forecast=value, order=max(0, value - offset))
                for day, opened in [
                    ("2026-01-26", True),
                    ("2026-01-27", False),
                    ("2026-01-28", True),
                ]
                for item, demand, offset in [("Alpha", 10, 1), ("Beta", 20, 4)]
                for value in [demand if opened else 0]
            ],
        }
        with tempfile.TemporaryDirectory() as cwd:
            self.assert_result(self.invoke(ROOT / "sample", cwd), expected)

    def test_each_strategy_wins(self):
        train = [
            (f"2026-01-{5 + i:02}", "A", int(i != 6), value)
            for i, value in enumerate([2, 4, 6, 8, 10, 12, 14])
        ]
        future = [
            ("2026-02-02", "A", 0),
            ("2026-02-03", "A", 1),
            ("2026-02-09", "A", 0),
        ]
        for winner, demand in [("weekday", 2), ("open", 7), ("last", 14)]:
            with self.subTest(winner=winner):
                actual = self.exercise(
                    list(reversed(train)),
                    [("2026-01-19", "A", 1, demand)],
                    future,
                    [("A", 3, 1)],
                    stale=True,
                )
                self.assertEqual(actual["selected"], winner)

    def test_exact_tie(self):
        train = [(f"2026-01-{5 + i:02}", "A", 1, 3) for i in range(7)]
        actual = self.exercise(
            train, [("2026-01-19", "A", 1, 3)], [("2026-02-02", "A", 0)], [("A", 0, 0)]
        )
        self.assertEqual(actual["selected"], "last")
        self.assertEqual(actual["plan"][0]["forecast"], 3)

    def test_fractional_open_mean_and_quoting(self):
        names = [' 咖啡,"特选"\nline\r\nend ', "é", "e\u0301", " "]
        train = [
            (f"2026-01-{5 + i:02}", item, int(i < 3), value)
            for item in names
            for i, value in enumerate([1, 2, 2, 40, 50, 60, 70])
        ]
        validation = [("2026-01-19", item, 1, 2) for item in names]
        future = [
            (day, item, opened)
            for day, opened in [("2026-02-03", 1), ("2026-02-02", 0), ("2026-02-10", 1)]
            for item in reversed(names)
        ]
        actual = self.exercise(
            train, validation, future, [(item, 1, 2) for item in names], varied=True
        )
        self.assertEqual(actual["selected"], "open")
        self.assertAlmostEqual(actual["validation_mse"]["open"], 1 / 9)

    def test_global_row_weighting(self):
        train = [
            (f"2026-01-{5 + i:02}", item, int(i < 6), value)
            for item in ["A", "B"]
            for i, value in enumerate([0, 12, 12, 12, 12, 12, 30])
        ]
        validation = [("2026-01-19", "A", 1, 30)] + [
            ((date(2026, 1, 19) + timedelta(days=7 * i)).isoformat(), "B", 1, 10)
            for i in range(9)
        ]
        actual = self.exercise(
            train, validation, [("2026-06-01", "A", 1)], [("A", 0, 0), ("B", 0, 0)]
        )
        self.assertEqual(actual["selected"], "open")
        self.assertEqual(actual["validation_mse"]["open"], 40)

    def test_fractional_weekday_includes_closed(self):
        train = [
            (f"2026-01-{5 + i:02}", "A", int(i != 7), value)
            for i, value in enumerate([1, 20, 30, 40, 50, 60, 70, 4])
        ]
        actual = self.exercise(
            train,
            [("2026-01-19", "A", 0, 3)],
            [("2026-02-02", "A", 0), ("2026-02-09", "A", 1)],
            [("A", 4, 2)],
        )
        self.assertEqual(actual["selected"], "weekday")
        self.assertEqual([row["forecast"] for row in actual["plan"]], [2.5, 2.5])
        self.assertEqual([row["order"] for row in actual["plan"]], [0.5, 0.5])

    def test_empty_future(self):
        train = [(f"2026-01-{5 + i:02}", "A", 1, 0) for i in range(7)]
        self.exercise(train, [("2026-01-19", "A", 0, 0)], [], [("A", 0, 0)])

    def test_relocated_standalone_archive(self):
        with tempfile.TemporaryDirectory(prefix="standalone release ") as directory:
            root = Path(directory)
            shutil.copyfile(ARCHIVE, root / "deliverable.pyz")
            shutil.copytree(ROOT / "sample", root / "input data")
            result = subprocess.run(
                [
                    sys.executable,
                    "-I",
                    "deliverable.pyz",
                    "input data",
                    "--output",
                    "result.json",
                ],
                cwd=root,
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=30,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            actual = json.loads((root / "result.json").read_text(encoding="utf-8"))
            self.assertEqual(actual["selected"], "open")
            self.assertEqual(actual["validation_mse"]["open"], 0)
            self.assertEqual(
                [row["forecast"] for row in actual["plan"]], [10, 20, 0, 0, 10, 20]
            )
            self.assertEqual(
                [row["order"] for row in actual["plan"]], [9, 16, 0, 0, 9, 16]
            )

    def test_generated_cases_against_independent_oracle(self):
        rng = random.Random(147)
        for case in range(30):
            with self.subTest(case=case):
                train, validation, future, inventory = [], [], [], []
                for item in ["A", "零,售"]:
                    for i in range(14):
                        train.append(
                            (
                                (date(2026, 1, 5) + timedelta(days=i)).isoformat(),
                                item,
                                1 if i == 0 else rng.randrange(2),
                                rng.randrange(100),
                            )
                        )
                    for i in range(rng.randrange(1, 12)):
                        validation.append(
                            (
                                (date(2026, 2, 1) + timedelta(days=i)).isoformat(),
                                item,
                                rng.randrange(2),
                                rng.randrange(100),
                            )
                        )
                    for i in range(7):
                        future.append(
                            (
                                (date(2026, 3, 1) + timedelta(days=i)).isoformat(),
                                item,
                                rng.randrange(2),
                            )
                        )
                    inventory.append((item, rng.randrange(100), rng.randrange(20)))
                rng.shuffle(train)
                rng.shuffle(validation)
                rng.shuffle(future)
                self.exercise(train, validation, future, inventory, varied=True)


if __name__ == "__main__":
    unittest.main()
