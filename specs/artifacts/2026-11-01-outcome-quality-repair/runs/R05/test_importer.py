"""Black-box contract tests against the real delivered zipapp."""

import csv
from contextlib import closing
import json
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


APP = Path(__file__).resolve().with_name("deliverable.pyz")
SPECIAL = ' 雪, "quoted"\r\nsecond\nline '


class PackagedImporterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.db = self.root / "actual stock.sqlite"
        self.csv = self.root / "input data.csv"
        self.report = self.root / "report.json"
        with closing(sqlite3.connect(self.db)) as db:
            db.executescript("""
                CREATE TABLE stock(item TEXT PRIMARY KEY,
                    quantity INTEGER NOT NULL CHECK(quantity>=0),
                    unit_cost_cents INTEGER NOT NULL);
                CREATE INDEX cost_index ON stock(unit_cost_cents);
                CREATE TABLE unrelated(value TEXT);
                INSERT INTO unrelated VALUES ('keep me');
                CREATE TABLE audit(action TEXT, item TEXT, old_quantity INTEGER,
                    new_quantity INTEGER, old_cost INTEGER, new_cost INTEGER);
                CREATE TRIGGER stock_insert AFTER INSERT ON stock BEGIN
                    INSERT INTO audit VALUES ('insert',new.item,NULL,new.quantity,
                        NULL,new.unit_cost_cents);
                END;
                CREATE TRIGGER stock_update AFTER UPDATE ON stock BEGIN
                    INSERT INTO audit VALUES ('update',new.item,old.quantity,
                        new.quantity,old.unit_cost_cents,new.unit_cost_cents);
                END;
                CREATE TRIGGER stock_delete AFTER DELETE ON stock BEGIN
                    INSERT INTO audit VALUES ('delete',old.item,old.quantity,
                        NULL,old.unit_cost_cents,NULL);
                END;
            """)
            db.executemany(
                "INSERT INTO stock VALUES (?,?,?)",
                [(SPECIAL, 5, 100), ("untouched", 9, 80), ("ordinary", 2, 10)],
            )
            db.commit()
        self.before = self.snapshot()

    def snapshot(self):
        # Every observation opens a new physical database connection.
        with closing(sqlite3.connect(self.db)) as db:
            return {
                "schema": db.execute(
                    "SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY name"
                ).fetchall(),
                "stock": db.execute("SELECT * FROM stock ORDER BY item").fetchall(),
                "audit": db.execute("SELECT * FROM audit ORDER BY rowid").fetchall(),
                "unrelated": db.execute("SELECT * FROM unrelated").fetchall(),
            }

    def write_csv(self, rows, ending="\r\n"):
        with self.csv.open("w", encoding="utf-8", newline="") as file:
            writer = csv.writer(file, lineterminator=ending)
            writer.writerow(["metadata", "unit_cost_cents", "item", "delta"])
            for item, delta, cost in rows:
                writer.writerow(['ignored,"\nmetadata', cost, item, delta])

    def run_cli(self, expected_status):
        result = subprocess.run(
            [
                sys.executable,
                str(APP),
                str(self.csv),
                "--db",
                str(self.db),
                "--output",
                str(self.report),
            ],
            cwd=self.root,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, expected_status, result.stderr)
        return json.loads(self.report.read_text(encoding="utf-8"))

    def test_success_persistence_order_and_trigger_semantics(self):
        for ending in ("\r\n", "\n"):
            with self.subTest(ending=repr(ending)):
                before = self.snapshot()
                quantity = dict((r[0], r[1]) for r in before["stock"])[SPECIAL]
                self.write_csv(
                    [
                        (SPECIAL, "+2", 250),
                        (SPECIAL, "-3", 0),
                        ("new," + ending + '"é"', "+4", 30),
                        ("new," + ending + '"é"', "-4", 40),
                        (" ", "0", 0),
                    ],
                    ending,
                )
                self.assertEqual(self.run_cli(0), {"success": True, "processed": 5})
                after = self.snapshot()
                self.assertEqual(after["schema"], before["schema"])
                self.assertEqual(after["unrelated"], before["unrelated"])
                expected = {row[0]: row[1:] for row in before["stock"]}
                expected.update(
                    {
                        SPECIAL: (quantity - 1, 0),
                        "new," + ending + '"é"': (0, 40),
                        " ": (0, 0),
                    }
                )
                self.assertEqual({row[0]: row[1:] for row in after["stock"]}, expected)
                prior_cost = dict((r[0], r[2]) for r in before["stock"])[SPECIAL]
                final_action = (
                    "update" if " " in {r[0] for r in before["stock"]} else "insert"
                )
                self.assertEqual(
                    after["audit"],
                    before["audit"]
                    + [
                        ("update", SPECIAL, quantity, quantity + 2, prior_cost, 250),
                        ("update", SPECIAL, quantity + 2, quantity - 1, 250, 0),
                        ("insert", "new," + ending + '"é"', None, 4, None, 30),
                        ("update", "new," + ending + '"é"', 4, 0, 30, 40),
                        (
                            final_action,
                            " ",
                            0 if final_action == "update" else None,
                            0,
                            0 if final_action == "update" else None,
                            0,
                        ),
                    ],
                )

    def test_first_insufficient_record_rolls_back_stock_and_audit(self):
        self.write_csv(
            [
                (SPECIAL, 2, 900),
                ("new", 3, 20),
                (SPECIAL, -8, 30),
                ("ordinary", -99, 40),
            ]
        )
        self.assertEqual(
            self.run_cli(2),
            {
                "success": False,
                "error": {
                    "code": "INSUFFICIENT_STOCK",
                    "record": 3,
                    "item": SPECIAL,
                },
            },
        )
        self.assertEqual(self.snapshot(), self.before)

    def test_new_item_cannot_start_negative(self):
        self.write_csv([("missing", -1, 0), (SPECIAL, 2, 10)])
        self.assertEqual(
            self.run_cli(2),
            {
                "success": False,
                "error": {"code": "INSUFFICIENT_STOCK", "record": 1, "item": "missing"},
            },
        )
        self.assertEqual(self.snapshot(), self.before)

    def test_large_unicode_item_and_sql_integer_boundary(self):
        item = "é" * 200000 + '\n,"end"'
        self.write_csv(
            [
                (item, 9223372036854775807, 9223372036854775807),
                (item, -9223372036854775807, 0),
            ]
        )
        self.assertEqual(self.run_cli(0), {"success": True, "processed": 2})
        self.assertIn((item, 0, 0), self.snapshot()["stock"])

    def test_header_only_is_empty_success(self):
        self.write_csv([])
        self.assertEqual(self.run_cli(0), {"success": True, "processed": 0})
        self.assertEqual(self.snapshot(), self.before)

    def test_standard_header_and_legal_quoted_fields(self):
        self.csv.write_bytes(
            b'item,delta,unit_cost_cents\r\n"a,""b""\r\nc",+2,12\r\nordinary,-2,0\r\n'
        )
        self.assertEqual(self.run_cli(0), {"success": True, "processed": 2})
        after = self.snapshot()
        self.assertIn(('a,"b"\r\nc', 2, 12), after["stock"])
        self.assertIn(("ordinary", 0, 0), after["stock"])

    def test_late_invalid_input_rolls_back(self):
        self.write_csv([("ordinary", 1, 99), ("bad", 1, -1)])
        result = subprocess.run(
            [
                sys.executable,
                str(APP),
                str(self.csv),
                "--db",
                str(self.db),
                "--output",
                str(self.report),
            ],
            cwd=self.root,
            capture_output=True,
        )
        self.assertEqual(result.returncode, 1)
        self.assertEqual(self.snapshot(), self.before)


if __name__ == "__main__":
    unittest.main()
