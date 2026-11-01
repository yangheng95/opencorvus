"""Atomic CSV stock importer; Python standard library only."""

import argparse
import csv
import json
import re
import sqlite3
import sys
from pathlib import Path


class InsufficientStock(Exception):
    """The first data record whose delta would make stock negative."""

    def __init__(self, record, item):
        super().__init__(item)
        self.record = record
        self.item = item


def integer(text, field, record):
    if text is None or re.fullmatch(r"[+-]?[0-9]+", text) is None:
        raise ValueError(f"Record {record}: {field} must be an integer")
    return int(text)


def import_batch(input_path, db_path):
    """Apply records in order, committing once or rolling back every change.

    Explicit INSERT and UPDATE preserve existing schema and trigger semantics.
    BEGIN IMMEDIATE keeps the quantity read and subsequent write serialized
    against other writers. Connection close also releases locks on failure.
    """
    # Avoid csv's small default field cap for otherwise legal large item names.
    limit = sys.maxsize
    while True:
        try:
            csv.field_size_limit(limit)
            break
        except OverflowError:
            limit //= 10
    connection = sqlite3.connect(db_path, isolation_level=None)
    try:
        connection.execute("BEGIN IMMEDIATE")
        processed = 0
        # newline='' lets csv handle CRLF/LF and preserve embedded newlines.
        with open(input_path, encoding="utf-8", newline="") as source:
            reader = csv.DictReader(source)
            required = {"item", "delta", "unit_cost_cents"}
            if reader.fieldnames is None or not required.issubset(reader.fieldnames):
                raise ValueError("CSV must have item, delta, unit_cost_cents columns")
            if any(reader.fieldnames.count(name) != 1 for name in required):
                raise ValueError("Required CSV column names must be unique")
            for record, row in enumerate(reader, 1):
                item = row["item"]
                if item is None or item == "":
                    raise ValueError(f"Record {record}: item must be nonempty")
                delta = integer(row["delta"], "delta", record)
                cost = integer(row["unit_cost_cents"], "unit_cost_cents", record)
                if cost < 0:
                    raise ValueError(
                        f"Record {record}: unit_cost_cents must be nonnegative"
                    )
                old = connection.execute(
                    "SELECT quantity FROM stock WHERE item = ?", (item,)
                ).fetchone()
                quantity = (old[0] if old is not None else 0) + delta
                if quantity < 0:
                    raise InsufficientStock(record, item)
                if old is None:
                    connection.execute(
                        "INSERT INTO stock (item, quantity, unit_cost_cents) VALUES (?, ?, ?)",
                        (item, quantity, cost),
                    )
                else:
                    connection.execute(
                        "UPDATE stock SET quantity = ?, unit_cost_cents = ? WHERE item = ?",
                        (quantity, cost, item),
                    )
                processed += 1
        connection.commit()
        return processed
    except BaseException:
        if connection.in_transaction:
            connection.rollback()
        raise
    finally:
        connection.close()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="UTF-8 CSV file")
    parser.add_argument("--db", required=True, help="SQLite database path")
    parser.add_argument("--output", required=True, help="JSON report path")
    args = parser.parse_args(argv)
    try:
        processed = import_batch(args.input, args.db)
        report = {"success": True, "processed": processed}
        status = 0
    except InsufficientStock as error:
        report = {
            "success": False,
            "error": {
                "code": "INSUFFICIENT_STOCK",
                "record": error.record,
                "item": error.item,
            },
        }
        status = 2
    except (OSError, sqlite3.Error, ValueError, csv.Error, OverflowError) as error:
        # Invalid input / infrastructure errors are distinct from stock failure.
        print(str(error), file=sys.stderr)
        return 1
    Path(args.output).write_text(
        json.dumps(report, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return status


if __name__ == "__main__":
    raise SystemExit(main())
