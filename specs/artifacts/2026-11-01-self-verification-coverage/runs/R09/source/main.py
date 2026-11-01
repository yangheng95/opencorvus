"""Export explicitly named SQLite columns without interpreting input as SQL."""

import argparse
import json
import sqlite3
from contextlib import closing
from pathlib import Path


def quote_identifier(name):
    """Quote one identifier, never a dotted path or SQL expression."""
    return '"' + name.replace('"', '""') + '"'


def export_database(root):
    requests = json.loads((root / "export.json").read_text(encoding="utf-8"))
    uri = (root / "source.db").resolve().as_uri() + "?mode=ro"
    results = []
    with closing(sqlite3.connect(uri, uri=True)) as connection:
        connection.execute("BEGIN")  # One consistent read snapshot for all exports.
        for request in requests["exports"]:
            columns = ", ".join(map(quote_identifier, request["columns"]))
            table = quote_identifier(request["table"])
            match = quote_identifier(request["match"]["column"])
            order = ", ".join(
                quote_identifier(column) + " ASC" for column in request["order_by"]
            )
            # Unary + removes affinity without changing value/type. Integer 1
            # must not equal text '1'; explicit BINARY overrides column NOCASE.
            sql = (
                f"SELECT {columns} FROM {table} "
                f"WHERE +{match} COLLATE BINARY = ? ORDER BY {order}"
            )
            rows = connection.execute(sql, (request["match"]["value"],)).fetchall()
            results.append(
                {
                    "name": request["name"],
                    "columns": request["columns"],
                    "rows": [list(row) for row in rows],
                }
            )
    return {"exports": results}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    database = args.input / "source.db"
    if args.output.resolve() == database.resolve() or (
        args.output.exists() and database.exists() and args.output.samefile(database)
    ):
        parser.error("output must not overwrite source.db")
    result = export_database(args.input)
    args.output.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
