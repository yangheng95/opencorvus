"""Black-box contract tests against the delivered archive, using only stdlib."""

import json
from contextlib import closing
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest


APP = Path(__file__).resolve().with_name("deliverable.pyz")


class ExportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="query export ")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.inputs = self.root / "input # Unicode 雪"
        self.inputs.mkdir()
        self.cwd = self.root / "unrelated cwd"
        self.cwd.mkdir()
        self.app = self.cwd / "standalone.pyz"
        shutil.copyfile(APP, self.app)
        self.db = self.inputs / "source.db"

    def run_export(self, requests, expected):
        (self.inputs / "export.json").write_text(
            json.dumps({"exports": requests}, ensure_ascii=False), encoding="utf-8"
        )
        before = self.db.read_bytes()
        with closing(sqlite3.connect(self.db)) as connection, connection:
            logical_before = list(connection.iterdump())
            version_before = connection.execute("PRAGMA user_version").fetchone()
        output = self.root / "result 雪.json"
        process = subprocess.run(
            [sys.executable, str(self.app), str(self.inputs), "--output", str(output)],
            cwd=self.cwd,
            capture_output=True,
            text=True,
        )
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertEqual(json.loads(output.read_text(encoding="utf-8")), expected)
        self.assertEqual(self.db.read_bytes(), before)
        with closing(sqlite3.connect(self.db)) as connection, connection:
            self.assertEqual(list(connection.iterdump()), logical_before)
            self.assertEqual(
                connection.execute("PRAGMA user_version").fetchone(), version_before
            )

    def test_identifier_value_and_order_boundaries(self):
        # Fixed DDL and literal expected rows do not reuse exporter quoting.
        with closing(sqlite3.connect(self.db)) as connection, connection:
            connection.executescript("""
                CREATE TABLE "select 雪;--" (
                    "a""b" TEXT COLLATE NOCASE, "order" INTEGER,
                    "x.y" TEXT, "NULL" INTEGER, "rank desc" INTEGER);
                CREATE INDEX "index odd" ON "select 雪;--" ("order");
                PRAGMA user_version=73;
            """)
            connection.executemany(
                'INSERT INTO "select 雪;--" VALUES (?,?,?,?,?)',
                [
                    ("O'Reilly", 2, "second", None, 1),
                    ("O'Reilly", 1, "later", 8, 2),
                    ("O'Reilly", 1, "first 雪", 0, 1),
                    ("o'reilly", 0, "wrong case", 9, 0),
                    ("' OR 1=1 --", 3, "literal", -7, 0),
                    ("001", 4, "zeroes", None, 0),
                    ("", 5, "empty", 1, 0),
                    ("a\x00b", 6, "nul text", 2, 0),
                ],
            )
        requests = []
        expected = []
        for name, value, rows in [
            (
                ' name " 雪 ',
                "O'Reilly",
                [["first 雪", 0, 1], ["later", 8, 1], ["second", None, 2]],
            ),
            ("sql", "' OR 1=1 --", [["literal", -7, 3]]),
            ("numeric", "001", [["zeroes", None, 4]]),
            ("empty", "", [["empty", 1, 5]]),
            ("nul", "a\x00b", [["nul text", 2, 6]]),
            ("missing", "absent", []),
        ]:
            columns = ["x.y", "NULL", "order"]
            requests.append(
                {
                    "name": name,
                    "table": "select 雪;--",
                    "columns": columns,
                    "match": {"column": 'a"b', "value": value},
                    "order_by": ["order", "rank desc"],
                }
            )
            expected.append({"name": name, "columns": columns, "rows": rows})
        self.run_export(requests, {"exports": expected})

    def test_text_equality_types_and_sqlite_sorting(self):
        with closing(sqlite3.connect(self.db)) as connection, connection:
            connection.executescript("""
                CREATE TABLE data (value, sortkey, payload);
                CREATE TABLE numeric_data (value NUMERIC);
                INSERT INTO numeric_data VALUES (1), ('1x'), (NULL);
                PRAGMA user_version=73;
            """)
            connection.executemany(
                "INSERT INTO data VALUES (?,?,?)",
                [
                    ("1", "10", "text10"),
                    ("1", 10, "int10"),
                    ("1", None, "null"),
                    ("1", -2, "negative"),
                    ("1", "2", "text2"),
                    (1, 0, "integer must not match"),
                    ("01", 0, "leading zero"),
                    (None, 0, "null must not match"),
                ],
            )
        requests = [
            {
                "name": "types",
                "table": "data",
                "columns": ["payload", "sortkey", "value"],
                "match": {"column": "value", "value": "1"},
                "order_by": ["sortkey"],
            },
            {
                "name": "affinity",
                "table": "numeric_data",
                "columns": ["value"],
                "match": {"column": "value", "value": "01"},
                "order_by": ["value"],
            },
        ]
        self.run_export(
            requests,
            {
                "exports": [
                    {
                        "name": "types",
                        "columns": ["payload", "sortkey", "value"],
                        "rows": [
                            ["null", None, "1"],
                            ["negative", -2, "1"],
                            ["int10", 10, "1"],
                            ["text10", "10", "1"],
                            ["text2", "2", "1"],
                        ],
                    },
                    {"name": "affinity", "columns": ["value"], "rows": []},
                ]
            },
        )

    def test_empty_exports(self):
        with closing(sqlite3.connect(self.db)) as connection, connection:
            connection.execute("PRAGMA user_version=73")
        self.run_export([], {"exports": []})

    def test_supplied_sample(self):
        sample = APP.parent / "sample"
        shutil.copyfile(sample / "source.db", self.db)
        requests = json.loads((sample / "export.json").read_text(encoding="utf-8"))
        self.run_export(
            requests["exports"],
            {
                "exports": [
                    {
                        "name": "red rows",
                        "columns": ["seq", "amount"],
                        "rows": [["001", 7], ["003", 11]],
                    },
                ]
            },
        )

    def test_quoted_table_and_sql_looking_identifiers(self):
        with closing(sqlite3.connect(self.db)) as connection, connection:
            connection.executescript("""
                CREATE TABLE "a""b.dot" (
                    "x); DROP TABLE t;--" TEXT, "a+b" INTEGER, "*" TEXT);
                CREATE TABLE "empty" ("value" TEXT);
                PRAGMA user_version=73;
            """)
            connection.executemany(
                'INSERT INTO "a""b.dot" VALUES (?,?,?)',
                [
                    ("雪", 9223372036854775807, "large"),
                    ("雪", -9223372036854775808, "small"),
                    ("雪", None, "null"),
                    ("雪", 0, None),
                ],
            )
        self.run_export(
            [
                {
                    "name": "X",
                    "table": 'a"b.dot',
                    "columns": ["*", "a+b"],
                    "match": {"column": "x); DROP TABLE t;--", "value": "雪"},
                    "order_by": ["a+b"],
                },
                {
                    "name": "x",
                    "table": "empty",
                    "columns": ["value"],
                    "match": {"column": "value", "value": "雪"},
                    "order_by": ["value"],
                },
            ],
            {
                "exports": [
                    {
                        "name": "X",
                        "columns": ["*", "a+b"],
                        "rows": [
                            ["null", None],
                            ["small", -9223372036854775808],
                            [None, 0],
                            ["large", 9223372036854775807],
                        ],
                    },
                    {"name": "x", "columns": ["value"], "rows": []},
                ]
            },
        )

    def test_output_cannot_replace_database(self):
        with closing(sqlite3.connect(self.db)) as connection, connection:
            connection.execute("CREATE TABLE data (value TEXT)")
        before = self.db.read_bytes()
        process = subprocess.run(
            [sys.executable, str(self.app), str(self.inputs), "--output", str(self.db)],
            cwd=self.cwd,
            capture_output=True,
        )
        self.assertNotEqual(process.returncode, 0)
        self.assertEqual(self.db.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
