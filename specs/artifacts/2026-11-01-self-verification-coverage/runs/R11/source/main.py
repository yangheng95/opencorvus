"""Export selected SQLite rows without treating data or names as SQL syntax."""

import argparse
import json
import sqlite3
from pathlib import Path


def quote_identifier(name):
    """Quote a single complete SQLite identifier, including embedded quotes."""
    return '"' + name.replace('"', '""') + '"'


def export_rows(root):
    """Read all exports in one read-only database snapshot."""
    requests = json.loads((root / "export.json").read_text(encoding="utf-8"))
    uri = (root / "source.db").resolve().as_uri() + "?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    try:
        connection.execute("BEGIN")
        results = []
        for request in requests["exports"]:
            columns = ", ".join(map(quote_identifier, request["columns"]))
            order = ", ".join(map(quote_identifier, request["order_by"]))
            match_column = quote_identifier(request["match"]["column"])
            # Unary + removes column affinity: INTEGER 1 must not match TEXT '1'.
            # Explicit BINARY overrides declared NOCASE/RTRIM collations.
            sql = (
                f"SELECT {columns} FROM {quote_identifier(request['table'])} "
                f"WHERE +{match_column} COLLATE BINARY = ? ORDER BY {order}"
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
    finally:
        connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    # Do not allow an output path (including hard links) to overwrite an input.
    for source in (args.input / "source.db", args.input / "export.json"):
        if args.output.resolve() == source.resolve() or (
            args.output.exists() and source.exists() and args.output.samefile(source)
        ):
            parser.error("output must not overwrite an input file")
    result = export_rows(args.input)
    args.output.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
