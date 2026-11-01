import csv
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


ARCHIVE = Path(__file__).resolve().with_name("deliverable.pyz")


class LedgerTests(unittest.TestCase):
    def run_ledger(self, rows, columns=None, line_ending="\n", relative=False):
        columns = columns or ["session", "started_at", "ended_at"]
        with tempfile.TemporaryDirectory() as directory:
            cwd = Path(directory)
            inputs = cwd / "input data"
            inputs.mkdir()
            with (inputs / "sessions.csv").open(
                "w", encoding="utf-8", newline=""
            ) as source:
                writer = csv.DictWriter(
                    source, fieldnames=columns, lineterminator=line_ending
                )
                writer.writeheader()
                writer.writerows(rows)
            output = cwd / "result report.json"
            output.write_text("stale output", encoding="utf-8")
            executable = cwd / "standalone.pyz"
            shutil.copyfile(ARCHIVE, executable)
            result = subprocess.run(
                [
                    sys.executable,
                    str(executable),
                    inputs.name if relative else str(inputs),
                    "--output",
                    output.name if relative else str(output),
                ],
                cwd=cwd,
                capture_output=True,
                text=True,
            )
            self.assertIn(result.returncode, (0, 2), result.stderr)
            return result.returncode, json.loads(output.read_text(encoding="utf-8"))

    def test_utc_semantics_and_csv_variations(self):
        rows = [
            {
                "session": ' 001, "雪"\nline\r\n ',
                "started_at": "2024-01-02T00:30:00.123456+02:00",
                "ended_at": "2024-01-01T23:00:00.123457+00:00",
                "metadata": "ignored, text",
            },
            {
                "session": "   ",
                "started_at": "2024-01-01T23:30:00-02:00",
                "ended_at": "2024-01-02T01:30:00Z",
                "metadata": "",
            },
            {
                "session": "00001",
                "started_at": "2024-01-01T23:59:59.9Z",
                "ended_at": "2024-01-02T00:00:00.000001+00:00",
                "metadata": "x",
            },
            {
                "session": "a/b:!?",
                "started_at": "2024-01-01T00:00:00.1-00:00",
                "ended_at": "2024-01-01T00:00:00.100000Z",
                "metadata": "x",
            },
        ]
        expected_sessions = [
            {
                "session": rows[0]["session"],
                "start_utc": "2024-01-01T22:30:00.123456Z",
                "end_utc": "2024-01-01T23:00:00.123457Z",
                "seconds": 1800.000001,
                "start_utc_date": "2024-01-01",
            },
            {
                "session": "   ",
                "start_utc": "2024-01-02T01:30:00.000000Z",
                "end_utc": "2024-01-02T01:30:00.000000Z",
                "seconds": 0,
                "start_utc_date": "2024-01-02",
            },
            {
                "session": "00001",
                "start_utc": "2024-01-01T23:59:59.900000Z",
                "end_utc": "2024-01-02T00:00:00.000001Z",
                "seconds": 0.100001,
                "start_utc_date": "2024-01-01",
            },
            {
                "session": "a/b:!?",
                "start_utc": "2024-01-01T00:00:00.100000Z",
                "end_utc": "2024-01-01T00:00:00.100000Z",
                "seconds": 0,
                "start_utc_date": "2024-01-01",
            },
        ]
        for ending in ("\n", "\r\n"):
            with self.subTest(ending=ending):
                status, report = self.run_ledger(
                    rows,
                    ["metadata", "ended_at", "session", "started_at"],
                    ending,
                    True,
                )
                self.assertEqual(status, 0)
                self.assertEqual(
                    report,
                    {
                        "sessions": expected_sessions,
                        "daily": [
                            {
                                "date": "2024-01-01",
                                "sessions": 3,
                                "seconds": 1800.100002,
                            },
                            {"date": "2024-01-02", "sessions": 1, "seconds": 0},
                        ],
                        "total_seconds": 1800.100002,
                    },
                )

    def test_first_negative_uses_instants_and_exact_id(self):
        rows = [
            {
                "session": "valid",
                "started_at": "2024-01-01T01:00:00+02:00",
                "ended_at": "2024-01-01T00:00:00Z",
            },
            {
                "session": ' 002, "负" ',
                "started_at": "2024-01-01T00:00:00Z",
                "ended_at": "2024-01-01T01:00:00+02:00",
            },
            {
                "session": "later",
                "started_at": "2024-01-01T00:00:00.000001Z",
                "ended_at": "2024-01-01T00:00:00Z",
            },
        ]
        status, report = self.run_ledger(rows)
        self.assertEqual(status, 2)
        self.assertEqual(
            report,
            {"error": {"code": "NEGATIVE_INTERVAL", "session": rows[1]["session"]}},
        )

    def test_microsecond_negative(self):
        status, report = self.run_ledger(
            [
                {
                    "session": "1",
                    "started_at": "2024-01-01T00:00:00.000001Z",
                    "ended_at": "2024-01-01T00:00:00Z",
                }
            ]
        )
        self.assertEqual(status, 2)
        self.assertEqual(
            report, {"error": {"code": "NEGATIVE_INTERVAL", "session": "1"}}
        )

    def test_year_boundary_and_sorted_days(self):
        status, report = self.run_ledger(
            [
                {
                    "session": "later",
                    "started_at": "2025-01-01T12:00:00-12:00",
                    "ended_at": "2025-01-02T14:00:00+14:00",
                },
                {
                    "session": "earlier",
                    "started_at": "2025-01-01T00:00:00+14:00",
                    "ended_at": "2025-01-02T10:00:00Z",
                },
            ]
        )
        self.assertEqual(status, 0)
        self.assertEqual(
            report,
            {
                "sessions": [
                    {
                        "session": "later",
                        "start_utc": "2025-01-02T00:00:00.000000Z",
                        "end_utc": "2025-01-02T00:00:00.000000Z",
                        "seconds": 0,
                        "start_utc_date": "2025-01-02",
                    },
                    {
                        "session": "earlier",
                        "start_utc": "2024-12-31T10:00:00.000000Z",
                        "end_utc": "2025-01-02T10:00:00.000000Z",
                        "seconds": 172800,
                        "start_utc_date": "2024-12-31",
                    },
                ],
                "daily": [
                    {"date": "2024-12-31", "sessions": 1, "seconds": 172800},
                    {"date": "2025-01-02", "sessions": 1, "seconds": 0},
                ],
                "total_seconds": 172800,
            },
        )

    def test_supplied_sample(self):
        with (ARCHIVE.parent / "sample" / "sessions.csv").open(
            encoding="utf-8", newline=""
        ) as source:
            rows = list(csv.DictReader(source))
        status, report = self.run_ledger(rows)
        self.assertEqual(status, 0)
        self.assertEqual(
            report,
            {
                "sessions": [
                    {
                        "session": "A",
                        "start_utc": "2026-04-01T10:00:00.000000Z",
                        "end_utc": "2026-04-01T10:01:30.000000Z",
                        "seconds": 90,
                        "start_utc_date": "2026-04-01",
                    },
                    {
                        "session": "B",
                        "start_utc": "2026-04-01T11:00:00.000000Z",
                        "end_utc": "2026-04-01T11:00:30.000000Z",
                        "seconds": 30,
                        "start_utc_date": "2026-04-01",
                    },
                ],
                "daily": [{"date": "2026-04-01", "sessions": 2, "seconds": 120}],
                "total_seconds": 120,
            },
        )

    def test_empty_ledger(self):
        self.assertEqual(
            self.run_ledger([]), (0, {"sessions": [], "daily": [], "total_seconds": 0})
        )

    def test_fraction_lengths_and_nonhour_offsets(self):
        rows = [
            {
                "session": str(digits),
                "started_at": "2000-03-01T00:00:00." + "1" * digits + "+05:45",
                "ended_at": "2000-02-29T18:15:01." + "1" * digits + "Z",
            }
            for digits in range(1, 7)
        ]
        status, report = self.run_ledger(rows)
        self.assertEqual(status, 0)
        for digits, session in enumerate(report["sessions"], 1):
            fraction = ("1" * digits).ljust(6, "0")
            self.assertEqual(
                session,
                {
                    "session": str(digits),
                    "start_utc": "2000-02-29T18:15:00." + fraction + "Z",
                    "end_utc": "2000-02-29T18:15:01." + fraction + "Z",
                    "seconds": 1,
                    "start_utc_date": "2000-02-29",
                },
            )
        self.assertEqual(
            report["daily"], [{"date": "2000-02-29", "sessions": 6, "seconds": 6}]
        )
        self.assertEqual(report["total_seconds"], 6)


if __name__ == "__main__":
    unittest.main()
