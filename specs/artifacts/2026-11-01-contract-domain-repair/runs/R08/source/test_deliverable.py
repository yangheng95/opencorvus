import csv
import json
import subprocess
import sys
import tempfile
import unittest
from decimal import Decimal
from fractions import Fraction
from pathlib import Path


APP = Path(__file__).resolve().with_name("deliverable.pyz")
SENSOR_COLUMNS = ["sensor", "gain", "offset_c", "low_c", "high_c"]
READING_COLUMNS = ["sequence", "sensor", "temperature", "unit"]


class DeliverableTests(unittest.TestCase):
    def run_report(self, sensors, readings, flexible_csv=False, relative_paths=False):
        with tempfile.TemporaryDirectory() as temporary:
            cwd = Path(temporary)
            inputs = cwd / "input data"
            inputs.mkdir()
            for name, columns, records in (
                ("sensors", SENSOR_COLUMNS, sensors),
                ("readings", READING_COLUMNS, readings),
            ):
                fields = ["metadata"] + columns[::-1] if flexible_csv else columns
                with (inputs / (name + ".csv")).open(
                    "w", encoding="utf-8", newline=""
                ) as output:
                    writer = csv.DictWriter(
                        output,
                        fieldnames=fields,
                        lineterminator="\r\n" if flexible_csv else "\n",
                    )
                    writer.writeheader()
                    for record in records:
                        row = dict(zip(columns, record))
                        if flexible_csv:
                            row["metadata"] = 'unused,"quoted"\nmetadata'
                        writer.writerow(row)
            report_path = cwd / "output report.json"
            result = subprocess.run(
                [
                    sys.executable,
                    str(APP),
                    "input data" if relative_paths else str(inputs),
                    "--output",
                    "output report.json" if relative_paths else str(report_path),
                ],
                cwd=cwd,
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.stderr, "", result.stderr)
            report = json.loads(
                report_path.read_text(encoding="utf-8"), parse_float=Decimal
            )
            return result.returncode, report

    def assert_readings(self, actual, expected):
        self.assertEqual(len(actual), len(expected))
        for row, (sequence, sensor, celsius, calibrated, status) in zip(
            actual, expected
        ):
            self.assertEqual(
                set(row), {"sequence", "sensor", "celsius", "calibrated_c", "status"}
            )
            self.assertEqual(
                (row["sequence"], row["sensor"], row["status"]),
                (sequence, sensor, status),
            )
            for name, target in (("celsius", celsius), ("calibrated_c", calibrated)):
                self.assertIsInstance(row[name], (int, Decimal))
                self.assertLessEqual(
                    abs(Fraction(row[name]) - Fraction(target)), Fraction("1e-8")
                )

    def test_conversion_calibration_thresholds_and_order(self):
        code, report = self.run_report(
            [("a", "2", "-10", "-30", "30")],
            [
                ("03", "a", "-10", "C"),
                ("01", "a", "68", "F"),
                ("02", "a", "273.15", "K"),
                ("04", "a", "-11", "C"),
                ("05", "a", "294.15", "K"),
            ],
        )
        self.assertEqual(code, 0)
        self.assertIs(report["success"], True)
        self.assert_readings(
            report["readings"],
            [
                ("03", "a", "-10", "-30", "OK"),
                ("01", "a", "20", "30", "OK"),
                ("02", "a", "0", "-10", "OK"),
                ("04", "a", "-11", "-32", "LOW"),
                ("05", "a", "21", "32", "HIGH"),
            ],
        )
        self.assertEqual(report["counts"], {"LOW": 1, "OK": 3, "HIGH": 1})

    def test_absolute_zero_is_inclusive_in_each_unit(self):
        code, report = self.run_report(
            [("cold", "2", "-1000", "-2000", "-1000")],
            [
                ("c", "cold", "-273.1500", "C"),
                ("f", "cold", "-459.67", "F"),
                ("k", "cold", "-0.000", "K"),
            ],
        )
        self.assertEqual(code, 0)
        self.assert_readings(
            report["readings"],
            [(unit, "cold", "-273.15", "-1546.3", "OK") for unit in ("c", "f", "k")],
        )

    def test_first_invalid_reading_in_original_units(self):
        for unit, invalid in (
            ("C", "-273.150000000000000001"),
            ("F", "-459.670000000000000001"),
            ("K", "-1e-30"),
        ):
            with self.subTest(unit=unit):
                identity = ' 001,雪"\r\n '
                code, report = self.run_report(
                    [(identity, "1", "10000", "-100", "100")],
                    [
                        ("valid", identity, "0", "C"),
                        (identity, identity, invalid, unit),
                        ("later", identity, "-9999", "C"),
                    ],
                    flexible_csv=True,
                )
                self.assertEqual(code, 2)
                self.assertEqual(
                    report,
                    {
                        "success": False,
                        "error": {
                            "code": "BELOW_ABSOLUTE_ZERO",
                            "sequence": identity,
                            "sensor": identity,
                        },
                    },
                )
                self.assertIs(report["success"], False)

    def test_exact_text_ids_csv_flexibility_and_relative_paths(self):
        ids = ["001", "1", '雪,"quoted"\nline', " ", " x "]
        code, report = self.run_report(
            [
                (sensor, "1", str(index), "-100", "100")
                for index, sensor in enumerate(ids)
            ],
            [(sensor, sensor, "32", "F") for sensor in ids],
            flexible_csv=True,
            relative_paths=True,
        )
        self.assertEqual(code, 0)
        self.assert_readings(
            report["readings"],
            [
                (sensor, sensor, "0", str(index), "OK")
                for index, sensor in enumerate(ids)
            ],
        )
        self.assertEqual(report["counts"], {"LOW": 0, "OK": 5, "HIGH": 0})

    def test_exact_decimal_comparison_and_repeating_conversion(self):
        code, report = self.run_report(
            [("a", "9", "-5", "0", "0"), ("b", "1", "0", "0.1", "0.1")],
            [
                ("equal", "a", "33", "F"),
                ("below", "b", "0.0999999999999999999999999999999", "C"),
                ("above", "b", "0.1000000000000000000000000000001", "C"),
            ],
        )
        self.assertEqual(code, 0)
        self.assert_readings(
            report["readings"],
            [
                ("equal", "a", Fraction(5, 9), "0", "OK"),
                ("below", "b", "0.1", "0.1", "LOW"),
                ("above", "b", "0.1", "0.1", "HIGH"),
            ],
        )

    def test_large_magnitude_absolute_precision(self):
        code, report = self.run_report(
            [("a", "1e50", "-1e51", "-1e100", "1e100")],
            [("huge", "a", "33", "F")],
        )
        self.assertEqual(code, 0)
        self.assert_readings(
            report["readings"],
            [
                ("huge", "a", Fraction(5, 9), Fraction(5 * 10**50, 9) - 10**51, "OK"),
            ],
        )

    def test_empty_readings(self):
        code, report = self.run_report([], [])
        self.assertEqual(code, 0)
        self.assertEqual(
            report,
            {"success": True, "readings": [], "counts": {"LOW": 0, "OK": 0, "HIGH": 0}},
        )


if __name__ == "__main__":
    unittest.main()
