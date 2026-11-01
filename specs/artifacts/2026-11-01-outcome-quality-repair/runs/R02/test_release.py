"""Black-box release tests; expectations never import production code."""

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
APP = ROOT / "deliverable.pyz"


def oracle(train, validation, future, inventory):
    # Deliberately use direct row filtering, not the production statistics model.
    def forecast(name, row):
        history = [r for r in train if r["item"] == row["item"]]
        if name == "last":
            return Fraction(sorted(history, key=lambda r: r["date"])[-1]["demand"])
        if name == "open":
            if not row["is_open"]:
                return Fraction(0)
            values = [r["demand"] for r in history if r["is_open"]]
        else:
            weekday = date.fromisoformat(row["date"]).weekday()
            values = [
                r["demand"]
                for r in history
                if date.fromisoformat(r["date"]).weekday() == weekday
            ]
        return Fraction(sum(values), len(values))

    losses = {
        n: sum((forecast(n, r) - r["demand"]) ** 2 for r in validation)
        / len(validation)
        for n in ("last", "open", "weekday")
    }
    winner = min(losses, key=lambda n: (losses[n], n))
    stocks = {r["item"]: r for r in inventory}
    plan = []
    for row in sorted(future, key=lambda r: (r["date"], r["item"])):
        value = forecast(winner, row)
        stock = stocks[row["item"]]
        plan.append(
            dict(
                date=row["date"],
                item=row["item"],
                forecast=float(value),
                order=float(max(0, value + stock["buffer"] - stock["stock"])),
            )
        )
    return dict(
        selected=winner,
        validation_mse={n: float(v) for n, v in losses.items()},
        plan=plan,
    )


class ReleaseTests(unittest.TestCase):
    def invoke(self, directory, cwd):
        output = Path(cwd) / "result with spaces.json"
        result = subprocess.run(
            [sys.executable, str(APP), str(directory), "--output", str(output)],
            cwd=cwd,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(output.read_text(encoding="utf-8"))

    def compare(self, actual, expected):
        self.assertEqual(set(actual), set(expected))
        self.assertEqual(actual["selected"], expected["selected"])
        self.assertEqual(set(actual["validation_mse"]), set(expected["validation_mse"]))
        for name, value in expected["validation_mse"].items():
            self.assertAlmostEqual(actual["validation_mse"][name], value, delta=1e-8)
        self.assertEqual(len(actual["plan"]), len(expected["plan"]))
        for a, e in zip(actual["plan"], expected["plan"]):
            self.assertEqual(set(a), set(e))
            self.assertEqual((a["date"], a["item"]), (e["date"], e["item"]))
            for field in ("forecast", "order"):
                self.assertAlmostEqual(a[field], e[field], delta=1e-8)

    def case(self, train, validation, future, inventory, newline="\r\n"):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp) / "input with spaces"
            directory.mkdir()
            for filename, rows, fields in (
                ("train", train, ["demand", "item", "date", "is_open"]),
                ("validation", validation, ["is_open", "date", "demand", "item"]),
                ("future", future, ["item", "is_open", "date", "demand"]),
                ("inventory", inventory, ["buffer", "item", "stock"]),
            ):
                with (directory / (filename + ".csv")).open(
                    "w", encoding="utf-8", newline=""
                ) as stream:
                    writer = csv.DictWriter(
                        stream, fieldnames=["metadata"] + fields, lineterminator=newline
                    )
                    writer.writeheader()
                    writer.writerows(
                        dict(r, metadata='ignored,"text"\nnext') for r in rows
                    )
            # No release.json exists: the selected model must be executable itself.
            actual = self.invoke(directory, tmp)
            self.compare(actual, oracle(train, validation, future, inventory))
            return actual

    def test_supplied_sample(self):
        with tempfile.TemporaryDirectory() as tmp:
            actual = self.invoke(ROOT / "sample", tmp)
        expected = dict(
            selected="open",
            validation_mse=dict(last=1500 / 7, open=0, weekday=500 / 7),
            plan=[],
        )
        for day in (26, 27, 28):
            for item, forecast, order in (("Alpha", 10, 9), ("Beta", 20, 16)):
                expected["plan"].append(
                    dict(
                        date=f"2026-01-{day}",
                        item=item,
                        forecast=0 if day == 27 else forecast,
                        order=0 if day == 27 else order,
                    )
                )
        self.compare(actual, expected)

    def test_each_winner_and_exact_ties(self):
        for winner in ("last", "open", "weekday", "tie"):
            with self.subTest(winner=winner):
                train = [
                    dict(
                        date=f"2026-01-{5 + i:02}",
                        item=' X,"雪"\n ',
                        is_open=int(i != 6),
                        demand=4 if winner == "tie" else i + 1,
                    )
                    for i in range(7)
                ]
                validation = [
                    dict(
                        date="2026-01-12",
                        item=train[0]["item"],
                        is_open=0,
                        demand={"last": 7, "open": 0, "weekday": 1, "tie": 4}[winner],
                    )
                ]
                future = [
                    dict(date=f"2026-01-{d}", item=train[0]["item"], is_open=o)
                    for d, o in ((20, 0), (19, 1), (21, 1))
                ]
                actual = self.case(
                    train[::-1],
                    validation,
                    future,
                    [dict(item=train[0]["item"], stock=2, buffer=1)],
                )
                self.assertEqual(
                    actual["selected"], "last" if winner == "tie" else winner
                )

    def test_generated_contract_cases(self):
        rng = random.Random(713)
        winners = set()
        for trial in range(40):
            with self.subTest(trial=trial):
                train, validation, future, inventory = [], [], [], []
                for item in (" padded ", '雪, "quoted"\r\nitem', "😀", "e\u0301", "é"):
                    for i in range(21):
                        train.append(
                            dict(
                                date=(
                                    date(2024, 2, 19) + timedelta(days=i)
                                ).isoformat(),
                                item=item,
                                is_open=1 if i == 0 else rng.randrange(2),
                                demand=rng.randrange(50),
                            )
                        )
                    for i in range(rng.randrange(1, 10)):
                        validation.append(
                            dict(
                                date=(date(2024, 4, 1) + timedelta(days=i)).isoformat(),
                                item=item,
                                is_open=rng.randrange(2),
                                demand=rng.randrange(60),
                            )
                        )
                    for i in range(rng.randrange(1, 9)):
                        future.append(
                            dict(
                                date=(date(2024, 5, 1) + timedelta(days=i)).isoformat(),
                                item=item,
                                is_open=rng.randrange(2),
                                demand=999999,
                            )
                        )
                    inventory.append(
                        dict(
                            item=item, stock=rng.randrange(70), buffer=rng.randrange(20)
                        )
                    )
                rng.shuffle(train)
                rng.shuffle(future)
                actual = self.case(
                    train, validation, future, inventory, "\n" if trial % 2 else "\r\n"
                )
                winners.add(actual["selected"])
        self.assertTrue(winners)

    def test_empty_future(self):
        train = [
            dict(date=f"2026-01-{5 + i:02}", item="A", is_open=1, demand=2)
            for i in range(7)
        ]
        actual = self.case(
            train, [dict(train[0])], [], [dict(item="A", stock=0, buffer=0)]
        )
        self.assertEqual(actual["plan"], [])


if __name__ == "__main__":
    unittest.main()
