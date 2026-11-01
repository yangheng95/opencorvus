"""End-to-end contract checks against the actual standalone deliverable."""

import json
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest


ARCHIVE = Path(__file__).resolve().with_name("deliverable.pyz")


class ExportContractTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="query export ")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.inputs = self.root / "input # 雪"
        self.inputs.mkdir()
        self.cwd = self.root / "unrelated cwd"
        self.cwd.mkdir()
        self.app = self.cwd / "standalone.pyz"
        shutil.copyfile(ARCHIVE, self.app)
        self.db = self.inputs / "source.db"

    def connect(self):
        connection = sqlite3.connect(self.db)
        self.addCleanup(connection.close)
        return connection

    def run_exports(self, requests, expected):
        config = self.inputs / "export.json"
        config.write_text(
            json.dumps({"exports": requests}, ensure_ascii=False), encoding="utf-8"
        )
        before = self.db.read_bytes()
        output = self.cwd / "result Unicode.json"
        completed = subprocess.run(
            [
                sys.executable,
                "standalone.pyz",
                str(self.inputs),
                "--output",
                output.name,
            ],
            cwd=self.cwd,
            capture_output=True,
            text=True,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        actual = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(actual, {"exports": expected})
        self.assertEqual(self.db.read_bytes(), before, "source database changed")

    def test_identifiers_values_order_and_types(self):
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE "select 雪;" (
                    "a""b" TEXT COLLATE NOCASE, "order" INTEGER,
                    "x,y" TEXT, "NULL" INTEGER, "rank" INTEGER);
                CREATE INDEX "index 雪" ON "select 雪;" ("order");
                PRAGMA user_version = 73;
            """)
            db.executemany(
                'INSERT INTO "select 雪;" VALUES (?, ?, ?, ?, ?)',
                [
                    ("O'Reilly'; DROP TABLE events;--", 2, "雪", None, 1),
                    ("O'Reilly'; DROP TABLE events;--", 1, "01", -7, 2),
                    ("O'Reilly'; DROP TABLE events;--", 1, None, 8, 1),
                    ("CASE", 0, "upper", 0, 0),
                    ("case", 0, "lower", 0, 0),
                    ("case ", 0, "trailing", 0, 0),
                    ("a\x00b", 0, "embedded NUL", 0, 0),
                    ("", 0, "empty", 0, 0),
                ],
            )
        requests, expected = [], []
        cases = [
            (
                "O'Reilly'; DROP TABLE events;--",
                [[None, 1, 8], ["01", 1, -7], ["雪", 2, None]],
            ),
            ("case", [["lower", 0, 0]]),
            ("CASE", [["upper", 0, 0]]),
            ("case ", [["trailing", 0, 0]]),
            ("missing", []),
            ("a\x00b", [["embedded NUL", 0, 0]]),
            ("", [["empty", 0, 0]]),
        ]
        for index, (value, rows) in enumerate(cases):
            name = f' Export {index} 雪 " '
            columns = ["x,y", "order", "NULL"]
            requests.append(
                {
                    "name": name,
                    "table": "select 雪;",
                    "columns": columns,
                    "match": {"column": 'a"b', "value": value},
                    "order_by": ["order", "rank"],
                }
            )
            expected.append({"name": name, "columns": columns, "rows": rows})
        self.run_exports(requests, expected)

    def test_text_equality_without_affinity_coercion(self):
        requests, expected = [], []
        with self.connect() as db:
            # These declared types exercise TEXT, numeric and absent affinities.
            for table, declaration, rows, matches in [
                (
                    "text",
                    "TEXT COLLATE RTRIM",
                    [("01",), ("1",), ("1 ",), (None,)],
                    {"01": [["01"]], "1": [["1"]], "1 ": [["1 "]]},
                ),
                (
                    "integer",
                    "INTEGER",
                    [("01",), (1,), ("text",), (None,)],
                    {"01": [], "1": [], "text": [["text"]]},
                ),
                (
                    "mixed",
                    "",
                    [(1,), ("1",), ("01",), (None,)],
                    {"1": [["1"]], "01": [["01"]]},
                ),
            ]:
                db.execute(f'CREATE TABLE "{table}" ("value" {declaration})')
                db.executemany(f'INSERT INTO "{table}" VALUES (?)', rows)
                for value, result in matches.items():
                    name = table + ":" + value
                    requests.append(
                        {
                            "name": name,
                            "table": table,
                            "columns": ["value"],
                            "match": {"column": "value", "value": value},
                            "order_by": ["value"],
                        }
                    )
                    expected.append(
                        {"name": name, "columns": ["value"], "rows": result}
                    )
        self.run_exports(requests, expected)

    def test_sqlite_order_and_empty_exports(self):
        with self.connect() as db:
            db.execute("CREATE TABLE t (k, m TEXT, secondary INTEGER)")
            db.executemany(
                "INSERT INTO t VALUES (?, ?, ?)",
                [
                    ("10", "yes", 0),
                    (2, "yes", 9),
                    (None, "yes", 0),
                    ("2", "yes", 0),
                    (-1, "yes", 0),
                    (2, "yes", 1),
                ],
            )
        request = {
            "name": "sort",
            "table": "t",
            "columns": ["k", "secondary"],
            "match": {"column": "m", "value": "yes"},
            "order_by": ["k", "secondary"],
        }
        self.run_exports(
            [request],
            [
                {
                    "name": "sort",
                    "columns": ["k", "secondary"],
                    "rows": [[None, 0], [-1, 0], [2, 1], [2, 9], ["10", 0], ["2", 0]],
                }
            ],
        )
        self.run_exports([], [])

    def test_expression_looking_identifiers_are_literal_names(self):
        with self.connect() as db:
            db.execute("""CREATE TABLE "a""b.c" (
                "*" TEXT, "a.b" INTEGER, "x + y" TEXT, "?" TEXT)""")
            db.execute(
                'INSERT INTO "a""b.c" VALUES (?, ?, ?, ?)',
                ("star", 42, "not an expression", "exact"),
            )
        columns = ["x + y", "*", "a.b", "?"]
        request = {
            "name": "Exact",
            "table": 'a"b.c',
            "columns": columns,
            "match": {"column": "?", "value": "exact"},
            "order_by": ["a.b", "*"],
        }
        other = dict(request, name="exact")
        self.run_exports(
            [request, other],
            [
                {
                    "name": name,
                    "columns": columns,
                    "rows": [["not an expression", "star", 42, "exact"]],
                }
                for name in ["Exact", "exact"]
            ],
        )

    def test_output_cannot_overwrite_database(self):
        with self.connect() as db:
            db.execute("CREATE TABLE t (value TEXT)")
        (self.inputs / "export.json").write_text('{"exports": []}', encoding="utf-8")
        before = self.db.read_bytes()
        result = subprocess.run(
            [sys.executable, str(self.app), str(self.inputs), "--output", str(self.db)],
            capture_output=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.db.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
