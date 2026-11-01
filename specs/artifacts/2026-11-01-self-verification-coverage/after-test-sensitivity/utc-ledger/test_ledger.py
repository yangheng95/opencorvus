import csv
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ARCHIVE = Path(__file__).resolve().with_name("deliverable.pyz")


class LedgerTests(unittest.TestCase):
    def run_ledger(self, rows, *, reordered=False, newline="\n"):
        with tempfile.TemporaryDirectory() as temporary:
            cwd = Path(temporary)
            inputs = cwd / "input directory"
            inputs.mkdir()
            fields = (
                ["metadata", "ended_at", "session", "started_at"]
                if reordered
                else ["session", "started_at", "ended_at"]
            )
            with (inputs / "sessions.csv").open(
                "w", encoding="utf-8", newline=""
            ) as stream:
                writer = csv.DictWriter(
                    stream, fieldnames=fields, lineterminator=newline
                )
                writer.writeheader()
                for session, start, end in rows:
                    row = {"session": session, "started_at": start, "ended_at": end}
                    if reordered:
                        row["metadata"] = 'ignored, "metadata"\nUnicode: 雪'
                    writer.writerow(row)
            output = cwd / "result file.json"
            output.write_text('{"stale": true}', encoding="utf-8")
            result = subprocess.run(
                [
                    sys.executable,
                    str(ARCHIVE),
                    "input directory",
                    "--output",
                    output.name,
                ],
                cwd=cwd,
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.stderr, "")
            self.assertEqual(result.stdout, "")
            return result.returncode, json.loads(output.read_text(encoding="utf-8"))

    def assert_report(self, rows, expected, **options):
        status, report = self.run_ledger(rows, **options)
        self.assertEqual(status, 0)
        self.assertEqual(set(report), {"sessions", "daily", "total_seconds"})
        self.assertEqual(len(report["sessions"]), len(expected["sessions"]))
        for actual, wanted in zip(report["sessions"], expected["sessions"]):
            self.assertEqual(set(actual), set(wanted))
            for key in wanted:
                if key == "seconds":
                    self.assertAlmostEqual(actual[key], wanted[key], delta=1e-8)
                else:
                    self.assertEqual(actual[key], wanted[key])
        self.assertEqual(len(report["daily"]), len(expected["daily"]))
        for actual, wanted in zip(report["daily"], expected["daily"]):
            self.assertEqual(set(actual), {"date", "sessions", "seconds"})
            self.assertEqual(actual["date"], wanted["date"])
            self.assertIs(type(actual["sessions"]), int)
            self.assertEqual(actual["sessions"], wanted["sessions"])
            self.assertAlmostEqual(actual["seconds"], wanted["seconds"], delta=1e-8)
        self.assertAlmostEqual(
            report["total_seconds"], expected["total_seconds"], delta=1e-8
        )

    def test_offsets_rollovers_and_whole_session_grouping(self):
        rows = [
            ("backwards", "2024-01-02T01:30:00+02:00", "2024-01-02T01:00:00+01:00"),
            ("next UTC date", "2024-01-01T23:30:00-02:00", "2024-01-02T01:30:00Z"),
            (
                "fraction",
                "2024-01-01T23:59:59.999999Z",
                "2024-01-02T00:00:00.000001+00:00",
            ),
        ]
        expected = {
            "sessions": [
                {
                    "session": "backwards",
                    "start_utc": "2024-01-01T23:30:00.000000Z",
                    "end_utc": "2024-01-02T00:00:00.000000Z",
                    "seconds": 1800,
                    "start_utc_date": "2024-01-01",
                },
                {
                    "session": "next UTC date",
                    "start_utc": "2024-01-02T01:30:00.000000Z",
                    "end_utc": "2024-01-02T01:30:00.000000Z",
                    "seconds": 0,
                    "start_utc_date": "2024-01-02",
                },
                {
                    "session": "fraction",
                    "start_utc": "2024-01-01T23:59:59.999999Z",
                    "end_utc": "2024-01-02T00:00:00.000001Z",
                    "seconds": 0.000002,
                    "start_utc_date": "2024-01-01",
                },
            ],
            "daily": [
                {"date": "2024-01-01", "sessions": 2, "seconds": 1800.000002},
                {"date": "2024-01-02", "sessions": 1, "seconds": 0},
            ],
            "total_seconds": 1800.000002,
        }
        self.assert_report(rows, expected)

    def test_text_csv_variations_and_fraction_widths(self):
        ids = [
            "001",
            "  ",
            'punctuation, "quoted"\nline',
            "雪 café",
            "  trim neither  ",
            "-1.2e3",
        ]
        rows = []
        sessions = []
        for width, session in enumerate(ids, 1):
            fraction = "123456"[:width]
            rows.append(
                (
                    session,
                    f"0001-01-02T05:45:00.{fraction}+05:45",
                    f"0001-01-02T00:00:01.{fraction}-00:00",
                )
            )
            sessions.append(
                {
                    "session": session,
                    "start_utc": f"0001-01-02T00:00:00.{fraction.ljust(6, '0')}Z",
                    "end_utc": f"0001-01-02T00:00:01.{fraction.ljust(6, '0')}Z",
                    "seconds": 1,
                    "start_utc_date": "0001-01-02",
                }
            )
        expected = {
            "sessions": sessions,
            "daily": [{"date": "0001-01-02", "sessions": 6, "seconds": 6}],
            "total_seconds": 6,
        }
        for newline in ("\n", "\r\n"):
            with self.subTest(newline=newline):
                self.assert_report(rows, expected, reordered=True, newline=newline)

    def test_daily_sorted_not_input_sorted_and_multiday_duration(self):
        rows = [
            ("later", "2024-03-01T00:00:00Z", "2024-03-03T00:00:00Z"),
            ("earlier", "2024-02-28T00:00:00Z", "2024-02-29T00:00:00Z"),
        ]
        sessions = [
            {
                "session": session,
                "start_utc": start[:-1] + ".000000Z",
                "end_utc": end[:-1] + ".000000Z",
                "seconds": seconds,
                "start_utc_date": start[:10],
            }
            for (session, start, end), seconds in zip(rows, (172800, 86400))
        ]
        self.assert_report(
            rows,
            {
                "sessions": sessions,
                "daily": [
                    {"date": "2024-02-28", "sessions": 1, "seconds": 86400},
                    {"date": "2024-03-01", "sessions": 1, "seconds": 172800},
                ],
                "total_seconds": 259200,
            },
        )

    def test_first_negative_uses_utc_and_exact_session(self):
        rows = [
            ("valid", "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z"),
            (
                '  雪,"first"  ',
                "2024-01-01T01:00:00+00:00",
                "2024-01-01T02:00:00+02:00",
            ),
            ("second", "2024-01-02T00:00:00Z", "2024-01-01T00:00:00Z"),
        ]
        status, report = self.run_ledger(rows, reordered=True, newline="\r\n")
        self.assertEqual(status, 2)
        self.assertEqual(
            report, {"error": {"code": "NEGATIVE_INTERVAL", "session": rows[1][0]}}
        )

    def test_subsecond_negative(self):
        status, report = self.run_ledger(
            [("microsecond", "2024-01-01T00:00:00.000001Z", "2024-01-01T00:00:00Z")]
        )
        self.assertEqual(status, 2)
        self.assertEqual(
            report, {"error": {"code": "NEGATIVE_INTERVAL", "session": "microsecond"}}
        )

    def test_empty_ledger(self):
        self.assert_report([], {"sessions": [], "daily": [], "total_seconds": 0})


if __name__ == "__main__":
    unittest.main()
