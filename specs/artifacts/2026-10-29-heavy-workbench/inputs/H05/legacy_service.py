"""Intentionally defective fictional service with durable totals and volatile dedup."""

import csv
import sqlite3


class Service:
    def __init__(self, database):
        self.db = sqlite3.connect(database)
        self.db.execute(
            "CREATE TABLE IF NOT EXISTS totals(tenant TEXT PRIMARY KEY, amount INTEGER NOT NULL)"
        )
        self.db.commit()
        self.seen = set()

    def ingest(self, event):
        if event["event_id"] in self.seen:
            return
        self.seen.add(event["event_id"])
        with self.db:
            self.db.execute(
                "INSERT INTO totals VALUES(?,?) ON CONFLICT(tenant) DO UPDATE SET amount=amount+excluded.amount",
                (event["tenant"], int(event["amount"])),
            )

    def replay(self, path):
        with open(path, encoding="utf-8", newline="") as f:
            for row in csv.DictReader(f):
                self.ingest(row)
        return dict(
            self.db.execute("SELECT tenant, amount FROM totals ORDER BY tenant")
        )

    def close(self):
        self.db.close()
