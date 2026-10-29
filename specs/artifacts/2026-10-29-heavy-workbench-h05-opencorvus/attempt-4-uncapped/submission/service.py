"""Persistent composite-identity payment ledger for the isolated H05 exercise."""

import argparse
import csv
import json
import os
from pathlib import Path
import sqlite3
import time


def read_events(path):
    with open(path, encoding="utf-8", newline="") as stream:
        return list(csv.DictReader(stream))


def source_facts(events):
    expected, attempts = {}, {}
    for event in events:
        key = (event["tenant"], event["event_id"])
        amount = int(event["amount"])
        if key in expected and expected[key] != amount:
            raise ValueError(f"conflicting source amount: {key}")
        expected[key] = amount
        attempts[key] = attempts.get(key, 0) + 1
    return expected, attempts


class Service:
    def __init__(self, database):
        self.db = sqlite3.connect(database, timeout=60, isolation_level=None)
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA synchronous=FULL")
        self.db.execute("""CREATE TABLE IF NOT EXISTS ledger(
            tenant TEXT NOT NULL, event_id TEXT NOT NULL, amount INTEGER NOT NULL,
            PRIMARY KEY(tenant,event_id))""")
        self.db.execute("""CREATE TABLE IF NOT EXISTS totals(
            tenant TEXT PRIMARY KEY, amount INTEGER NOT NULL)""")

    def ingest(self, event, fault=None):
        tenant, event_id = event["tenant"], event["event_id"]
        if (
            not isinstance(tenant, str)
            or not tenant
            or not isinstance(event_id, str)
            or not event_id
        ):
            raise ValueError("identity must be nonempty canonical strings")
        value = event["amount"]
        if isinstance(value, bool) or not isinstance(value, (str, int)):
            raise ValueError("amount must be an integer in smallest currency units")
        amount = int(value)
        if isinstance(value, str) and value.strip() != str(amount):
            raise ValueError("amount must use integer decimal representation")
        self.db.execute("BEGIN IMMEDIATE")
        try:
            previous = self.db.execute(
                "SELECT amount FROM ledger WHERE tenant=? AND event_id=?",
                (tenant, event_id),
            ).fetchone()
            if previous:
                if previous[0] != amount:
                    raise ValueError(
                        f"conflicting persisted amount: {(tenant, event_id)}"
                    )
                self.db.execute("COMMIT")
                return False
            self.db.execute(
                "INSERT INTO ledger VALUES(?,?,?)", (tenant, event_id, amount)
            )
            if fault:
                fault("after-ledger")
            self.db.execute(
                """INSERT INTO totals VALUES(?,?) ON CONFLICT(tenant)
                DO UPDATE SET amount=amount+excluded.amount""",
                (tenant, amount),
            )
            if fault:
                fault("after-total")
                fault("before-commit")
            self.db.execute("COMMIT")
        except BaseException:
            if self.db.in_transaction:
                self.db.execute("ROLLBACK")
            raise
        if fault:
            fault("after-commit")
        return True

    def replay(self, path, start=0, stop=None, crash_at=None, crash_row=0):
        accepted = duplicates = 0
        for index, event in enumerate(read_events(path)[start:stop], start):

            def fault(stage):
                if index == crash_row and stage == crash_at:
                    # Deliberately bypass Python cleanup: exercise SQLite process-death recovery.
                    os._exit(86)

            if self.ingest(event, fault if crash_at else None):
                accepted += 1
            else:
                duplicates += 1
        return {"accepted": accepted, "duplicates": duplicates, **self.snapshot()}

    def snapshot(self):
        self.db.execute("BEGIN")
        try:
            ledger = list(
                self.db.execute(
                    "SELECT tenant,event_id,amount FROM ledger ORDER BY tenant,event_id"
                )
            )
            totals = dict(
                self.db.execute("SELECT tenant,amount FROM totals ORDER BY tenant")
            )
            self.db.execute("COMMIT")
        except BaseException:
            self.db.execute("ROLLBACK")
            raise
        return {
            "ledger": ledger,
            "totals": totals,
            "distinct": len(ledger),
            "total": sum(row[2] for row in ledger),
        }

    def monitor(self, events, duplicate_threshold=0.10):
        expected, attempts = source_facts(events)
        state = self.snapshot()
        actual = {(t, e): a for t, e, a in state["ledger"]}
        rows = []
        for tenant in sorted(
            {t for t, _ in expected} | {t for t, _ in actual} | set(state["totals"])
        ):
            source = {k: a for k, a in expected.items() if k[0] == tenant}
            posted = {k: a for k, a in actual.items() if k[0] == tenant}
            mismatch = sum(
                source.get(k) != posted.get(k) for k in source.keys() | posted.keys()
            )
            expected_total, ledger_total = sum(source.values()), sum(posted.values())
            stored = state["totals"].get(tenant, 0)
            rows.append(
                {
                    "tenant": tenant,
                    "source_total": expected_total,
                    "ledger_total": ledger_total,
                    "stored_total": stored,
                    "identity_mismatches": mismatch,
                    "source_ledger_delta": ledger_total - expected_total,
                    "ledger_totals_delta": stored - ledger_total,
                }
            )
        count = sum(attempts.values())
        rate = (count - len(attempts)) / count if count else 0.0
        alerts = []
        if rate > duplicate_threshold:
            alerts.append("duplicate_rate_high")
        if any(
            r["identity_mismatches"]
            or r["source_ledger_delta"]
            or r["ledger_totals_delta"]
            for r in rows
        ):
            alerts.append("ledger_reconciliation_failed")
        return {
            "transmissions": count,
            "extra_duplicates": count - len(attempts),
            "duplicate_rate": rate,
            "duplicate_threshold": duplicate_threshold,
            "reconciliation_threshold": 0,
            "tenants": rows,
            "alerts": alerts,
        }

    def close(self):
        self.db.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["ingest", "snapshot", "monitor"])
    destination = parser.add_mutually_exclusive_group(required=True)
    destination.add_argument("--database")
    destination.add_argument("--route")
    parser.add_argument("--events")
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--stop", type=int)
    parser.add_argument(
        "--crash-at",
        choices=["after-ledger", "after-total", "before-commit", "after-commit"],
    )
    parser.add_argument("--crash-row", type=int, default=0)
    parser.add_argument("--start-gate")
    parser.add_argument("--duplicate-threshold", type=float, default=0.10)
    args = parser.parse_args()
    route = (
        json.loads(Path(args.route).read_text(encoding="utf-8")) if args.route else None
    )
    if route and args.action == "ingest" and not route["write_enabled"]:
        print(
            json.dumps(
                {
                    "status": "writes_paused",
                    "release": route["release"],
                    "pid": os.getpid(),
                }
            )
        )
        return 3
    if args.start_gate:
        deadline = time.monotonic() + 60
        while not Path(args.start_gate).exists():
            if time.monotonic() > deadline:
                raise TimeoutError("concurrent start gate was not released")
            time.sleep(0.01)
    database = (
        Path(args.route).resolve().parent / route["database"]
        if route
        else args.database
    )
    service = Service(database)
    try:
        if args.action == "ingest":
            result = service.replay(
                args.events, args.start, args.stop, args.crash_at, args.crash_row
            )
        elif args.action == "monitor":
            result = service.monitor(read_events(args.events), args.duplicate_threshold)
        else:
            result = service.snapshot()
        print(
            json.dumps(
                {
                    "pid": os.getpid(),
                    "release": route["release"] if route else "fixed-v2",
                    **result,
                }
            )
        )
        return 2 if args.action == "monitor" and result["alerts"] else 0
    finally:
        service.close()


if __name__ == "__main__":
    raise SystemExit(main())
