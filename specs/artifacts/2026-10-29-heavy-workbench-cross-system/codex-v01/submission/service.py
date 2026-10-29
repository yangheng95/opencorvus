"""Offline payment ledger v1: one durable fact per (tenant, event_id).

Amounts are signed integer minor units. No currency conversion is performed.
All imports and replays call Service.ingest; totals is a view of the ledger.
"""

import argparse
import csv
import json
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

VERSION = "1.0.0"
SCHEMA_VERSION = 1
MAX_INTEGER = 2**63 - 1


class ServiceError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="microseconds")


def validate_event(event):
    try:
        tenant, event_id = event["tenant"], event["event_id"]
        if not isinstance(tenant, str) or not tenant or tenant != tenant.strip():
            raise ValueError("tenant must be a nonempty canonical string")
        if not isinstance(event_id, str) or not event_id or event_id != event_id.strip():
            raise ValueError("event_id must be a nonempty canonical string")
        raw = event["amount"]
        if isinstance(raw, bool) or not isinstance(raw, (int, str)):
            raise ValueError("amount must be an integer minor unit")
        if isinstance(raw, str) and not re.fullmatch(r"-?(0|[1-9][0-9]*)", raw):
            raise ValueError("amount must use decimal integer syntax")
        amount = int(raw)
        if not -MAX_INTEGER - 1 <= amount <= MAX_INTEGER:
            raise ValueError("amount exceeds signed 64-bit storage")
        received = datetime.fromisoformat(event["received_at"].replace("Z", "+00:00"))
        if received.tzinfo is None:
            raise ValueError("received_at must identify a timezone")
        received = received.astimezone(timezone.utc).isoformat(timespec="microseconds")
        return tenant, event_id, amount, received
    except (KeyError, ValueError, TypeError, AttributeError) as exc:
        raise ServiceError("INVALID_EVENT", str(exc)) from exc


def read_events(path):
    with Path(path).open(encoding="utf-8-sig", newline="") as stream:
        yield from csv.DictReader(stream)


def write_csv(path, fields, rows):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(fields)
        writer.writerows(rows)


def write_json(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


class Service:
    def __init__(self, database):
        self.database = str(Path(database).resolve())
        self.db = sqlite3.connect(self.database, timeout=30, isolation_level=None)
        try:
            self.db.execute("PRAGMA busy_timeout=30000")
            self.db.execute("PRAGMA journal_mode=DELETE")
            self.db.execute("PRAGMA synchronous=FULL")
            self.db.execute("BEGIN IMMEDIATE")
            version = self.db.execute("PRAGMA user_version").fetchone()[0]
            objects = self.db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
            if version == 0 and objects:
                raise ServiceError("MIGRATION_REQUIRED", "Legacy aggregates need migrate with the original event archive; source is preserved")
            if version not in (0, SCHEMA_VERSION):
                raise ServiceError("UNSUPPORTED_SCHEMA", f"schema version {version}")
            if version == 0:
                self.db.execute("""CREATE TABLE ledger(
                    tenant TEXT NOT NULL, event_id TEXT NOT NULL,
                    amount INTEGER NOT NULL CHECK(typeof(amount)='integer'),
                    attempts INTEGER NOT NULL CHECK(attempts >= 1 AND typeof(attempts)='integer'),
                    first_received_at TEXT NOT NULL, last_received_at TEXT NOT NULL,
                    first_processed_at TEXT NOT NULL,
                    PRIMARY KEY(tenant,event_id)
                ) WITHOUT ROWID""")
                self.db.execute("CREATE VIEW totals AS SELECT tenant, SUM(amount) AS amount FROM ledger GROUP BY tenant")
                self.db.execute(f"PRAGMA user_version={SCHEMA_VERSION}")
            self.db.execute("COMMIT")
        except BaseException:
            if self.db.in_transaction:
                self.db.execute("ROLLBACK")
            self.db.close()
            raise

    def ingest(self, event):
        tenant, event_id, amount, received = validate_event(event)
        self.db.execute("BEGIN IMMEDIATE")
        try:
            existing = self.db.execute(
                "SELECT amount, attempts FROM ledger WHERE tenant=? AND event_id=?", (tenant, event_id)
            ).fetchone()
            if existing and existing[0] != amount:
                raise ServiceError("AMOUNT_CONFLICT", f"identity {(tenant, event_id)!r} has a different amount")
            if existing:
                self.db.execute("""UPDATE ledger SET attempts=attempts+1,
                    first_received_at=MIN(first_received_at,?), last_received_at=MAX(last_received_at,?)
                    WHERE tenant=? AND event_id=?""", (received, received, tenant, event_id))
                result = {"status": "duplicate", "tenant": tenant, "event_id": event_id, "amount": amount, "attempts": existing[1] + 1}
            else:
                self.db.execute("INSERT INTO ledger VALUES(?,?,?,?,?,?,?)", (tenant, event_id, amount, 1, received, received, utc_now()))
                result = {"status": "inserted", "tenant": tenant, "event_id": event_id, "amount": amount, "attempts": 1}
            # The totals view derives from this same insert. COMMIT publishes both identity and money.
            self.db.execute("COMMIT")
            return result
        except BaseException:
            if self.db.in_transaction:
                self.db.execute("ROLLBACK")
            raise

    def replay(self, path):
        inserted = duplicates = 0
        started = utc_now()
        for event in read_events(path):
            result = self.ingest(event)
            inserted += result["status"] == "inserted"
            duplicates += result["status"] == "duplicate"
        return {"started_at": started, "finished_at": utc_now(), "inserted": inserted,
                "duplicates": duplicates, "attempts": inserted + duplicates,
                "batch_duplicate_rate": duplicates / (inserted + duplicates) if inserted + duplicates else 0,
                "state": self.snapshot()}

    def snapshot(self):
        # Readers receive a consistent snapshot even while another writer is committing.
        self.db.execute("BEGIN")
        try:
            rows = self.db.execute("SELECT tenant, COUNT(*), SUM(amount), SUM(attempts) FROM ledger GROUP BY tenant ORDER BY tenant").fetchall()
            result = {"schema_version": SCHEMA_VERSION, "service_version": VERSION,
                      "tenants": {t: {"distinct": n, "total": value, "attempts": a} for t, n, value, a in rows},
                      "distinct": sum(r[1] for r in rows), "total": sum(r[2] for r in rows),
                      "attempts": sum(r[3] for r in rows)}
            result["duplicates"] = result["attempts"] - result["distinct"]
            result["duplicate_rate"] = result["duplicates"] / result["attempts"] if result["attempts"] else 0
            result["integrity"] = self.db.execute("PRAGMA integrity_check").fetchone()[0]
            result["storage"] = {"journal_mode": self.db.execute("PRAGMA journal_mode").fetchone()[0],
                                 "synchronous": self.db.execute("PRAGMA synchronous").fetchone()[0]}
            self.db.execute("COMMIT")
            return result
        except BaseException:
            self.db.execute("ROLLBACK")
            raise

    def export(self, output):
        output = Path(output)
        output.mkdir(parents=True, exist_ok=True)
        self.db.execute("BEGIN")
        try:
            ledger = self.db.execute("SELECT tenant,event_id,amount FROM ledger ORDER BY tenant,event_id").fetchall()
            dup = self.db.execute("SELECT tenant,event_id,attempts FROM ledger WHERE attempts>1 ORDER BY tenant,event_id").fetchall()
            totals = self.db.execute("SELECT tenant,amount FROM totals ORDER BY tenant").fetchall()
            self.db.execute("COMMIT")
        except BaseException:
            self.db.execute("ROLLBACK")
            raise
        write_csv(output / "ledger.csv", ["tenant", "event_id", "amount"], ledger)
        write_csv(output / "duplicates.csv", ["tenant", "event_id", "attempts"], dup)
        write_csv(output / "totals.csv", ["tenant", "total"], totals)
        return {"ledger_rows": len(ledger), "duplicate_identities": len(dup), "tenants": len(totals)}

    def monitor(self, expected_path, policy):
        expected = {}
        for event in read_events(expected_path):
            t, e, a, _ = validate_event(event)
            if (t, e) in expected and expected[t, e] != a:
                raise ServiceError("AMOUNT_CONFLICT", f"expected archive conflicts for {(t, e)!r}")
            expected[t, e] = a
        self.db.execute("BEGIN")
        try:
            actual = {(t, e): a for t, e, a in self.db.execute("SELECT tenant,event_id,amount FROM ledger")}
            attempt_rows = self.db.execute("SELECT tenant,SUM(attempts) FROM ledger GROUP BY tenant").fetchall()
            integrity = self.db.execute("PRAGMA integrity_check").fetchone()[0]
            self.db.execute("COMMIT")
        except BaseException:
            self.db.execute("ROLLBACK")
            raise
        tenants = sorted({k[0] for k in expected} | {k[0] for k in actual})
        attempts = dict(attempt_rows)
        rows, alerts = [], []
        for tenant in tenants:
            exp = {e: a for (t, e), a in expected.items() if t == tenant}
            act = {e: a for (t, e), a in actual.items() if t == tenant}
            missing = len(exp.keys() - act.keys())
            extra = len(act.keys() - exp.keys())
            conflicts = sum(exp[e] != act[e] for e in exp.keys() & act.keys())
            total_delta = sum(act.values()) - sum(exp.values())
            rate = (attempts.get(tenant, 0) - len(act)) / attempts[tenant] if attempts.get(tenant, 0) else 0
            row = {"tenant": tenant, "expected_total": sum(exp.values()), "actual_total": sum(act.values()),
                   "amount_delta": total_delta, "expected_distinct": len(exp), "actual_distinct": len(act),
                   "missing": missing, "extra": extra, "amount_conflicts": conflicts,
                   "attempts": attempts.get(tenant, 0), "duplicate_rate": rate}
            rows.append(row)
            if abs(total_delta) > policy["reconciliation_amount_critical"] or missing + extra > policy["reconciliation_identities_critical"] or conflicts > policy["amount_conflicts_critical"]:
                alerts.append({"severity": "critical", "code": "LEDGER_RECONCILIATION", "tenant": tenant})
            if rate > policy["duplicate_rate_warning"]:
                alerts.append({"severity": "warning", "code": "DUPLICATE_RATE", "tenant": tenant})
        if integrity != "ok":
            alerts.append({"severity": "critical", "code": "DATABASE_INTEGRITY"})
        return {"observed_at": utc_now(), "policy": policy, "scope": "database lifetime; expected archive must cover same horizon",
                "integrity": integrity, "tenants": rows, "alerts": alerts,
                "status": "critical" if any(a["severity"] == "critical" for a in alerts) else "warning" if alerts else "healthy"}

    def close(self):
        self.db.close()


def backup_database(source, destination):
    source, destination = Path(source).resolve(), Path(destination).resolve()
    if not source.is_file():
        raise ServiceError("SOURCE_MISSING", str(source))
    if destination.exists():
        raise ServiceError("DESTINATION_EXISTS", str(destination))
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation protects operator-selected paths; SQLite backup includes committed facts.
    with destination.open("xb"):
        pass
    with sqlite3.connect(source.as_uri() + "?mode=ro", uri=True) as src, sqlite3.connect(destination) as dst:
        src.backup(dst)
        integrity = dst.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise ServiceError("BACKUP_INTEGRITY", integrity)
    return {"source": str(source), "destination": str(destination), "integrity": integrity, "completed_at": utc_now()}


def migrate(legacy_database, events, database, archive):
    if Path(database).exists():
        raise ServiceError("DESTINATION_EXISTS", str(database))
    if Path(database).resolve() in (Path(legacy_database).resolve(), Path(archive).resolve()):
        raise ServiceError("INVALID_DESTINATION", "new database must be a separate path")
    backup = backup_database(legacy_database, archive)
    with sqlite3.connect(Path(archive).resolve().as_uri() + "?mode=ro", uri=True) as old:
        old_totals = dict(old.execute("SELECT tenant,amount FROM totals ORDER BY tenant"))
    service = Service(database)
    try:
        replay = service.replay(events)
        # Archive-derived validation covers identities as well as sums before any switch.
        exact_policy = {"duplicate_rate_warning": 1, "reconciliation_amount_critical": 0,
                        "reconciliation_identities_critical": 0, "amount_conflicts_critical": 0}
        reconciliation = service.monitor(events, exact_policy)
        if reconciliation["status"] != "healthy":
            raise ServiceError("MIGRATION_RECONCILIATION", "reconstructed ledger did not reconcile")
        new_totals = {t: r["total"] for t, r in replay["state"]["tenants"].items()}
        return {"migration": "legacy aggregate v0 -> archive-rebuilt ledger v1", "backup": backup,
                "source_version": "inputs/legacy_service.py v0", "target_version": VERSION,
                "old_totals": old_totals, "new_totals": new_totals,
                "adjustments": {t: new_totals.get(t, 0) - old_totals.get(t, 0) for t in sorted(old_totals.keys() | new_totals.keys())},
                "replay": replay, "reconciliation": reconciliation}
    finally:
        service.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("replay", "status", "export", "monitor"):
        sub = commands.add_parser(name)
        sub.add_argument("--database", required=True)
        if name == "replay":
            sub.add_argument("--events", required=True)
        if name == "export":
            sub.add_argument("--output", required=True)
        if name == "monitor":
            sub.add_argument("--expected", required=True)
            sub.add_argument("--policy", required=True)
    for name in ("backup", "restore"):
        sub = commands.add_parser(name)
        sub.add_argument("--source", required=True)
        sub.add_argument("--destination", required=True)
    sub = commands.add_parser("migrate")
    sub.add_argument("--legacy-database", required=True)
    sub.add_argument("--events", required=True)
    sub.add_argument("--database", required=True)
    sub.add_argument("--archive", required=True)
    args = parser.parse_args()
    service = None
    try:
        if args.command in ("backup", "restore"):
            result = backup_database(args.source, args.destination)
        elif args.command == "migrate":
            result = migrate(args.legacy_database, args.events, args.database, args.archive)
        else:
            service = Service(args.database)
            if args.command == "replay":
                result = service.replay(args.events)
            elif args.command == "status":
                result = service.snapshot()
            elif args.command == "export":
                result = service.export(args.output)
            else:
                policy = json.loads(Path(args.policy).read_text(encoding="utf-8"))
                result = service.monitor(args.expected, policy)
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 2 if args.command == "monitor" and result["alerts"] else 0
    except (ServiceError, sqlite3.Error, OSError, ValueError) as exc:
        code = exc.code if isinstance(exc, ServiceError) else "STORAGE_OR_INPUT_ERROR"
        print(json.dumps({"error": {"code": code, "message": str(exc)}, "observed_at": utc_now()}, ensure_ascii=False), file=sys.stderr)
        return 1
    finally:
        if service:
            service.close()


if __name__ == "__main__":
    sys.exit(main())
