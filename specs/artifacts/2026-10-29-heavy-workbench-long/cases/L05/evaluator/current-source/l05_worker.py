"""Small constructive witness, not the full L05 reference task."""
import argparse
from contextlib import closing
import http.client
import json
import os
import sqlite3
import urllib.error
import urllib.parse
import urllib.request


def initialize(db):
    with closing(sqlite3.connect(db, timeout=20)) as connection, connection:
        connection.executescript("""
        CREATE TABLE IF NOT EXISTS entries (
          tenant TEXT NOT NULL, event_id TEXT NOT NULL, payload TEXT NOT NULL,
          amount_minor INTEGER NOT NULL, PRIMARY KEY(tenant,event_id));
        CREATE TABLE IF NOT EXISTS outbox (
          tenant TEXT NOT NULL, event_id TEXT NOT NULL, receipt_id TEXT,
          PRIMARY KEY(tenant,event_id));
        """)


def canonical(data):
    return json.dumps(data, sort_keys=True, separators=(",", ":"))


def ingest(db, data):
    # This mini witness receives validated accepted events from its harness.
    initialize(db)
    with closing(sqlite3.connect(db, timeout=20)) as connection, connection:
        connection.execute("BEGIN IMMEDIATE")
        old = connection.execute("SELECT payload FROM entries WHERE tenant=? AND event_id=?", (data["tenant"], data["event_id"])).fetchone()
        if old:
            return {"status": "duplicate" if old[0] == canonical(data) else "event_conflict"}
        connection.execute("INSERT INTO entries VALUES (?,?,?,?)", (data["tenant"], data["event_id"], canonical(data), data["amount_minor"]))
        connection.execute("INSERT INTO outbox VALUES (?,?,NULL)", (data["tenant"], data["event_id"]))
    return {"status": "accepted"}


def request(url, payload=None):
    raw = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=raw, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)


def drain(db, url, tenant, event_id, probe=False):
    with closing(sqlite3.connect(db, timeout=20)) as connection, connection:
        row = connection.execute("SELECT e.payload,o.receipt_id FROM entries e JOIN outbox o USING(tenant,event_id) WHERE tenant=? AND event_id=?", (tenant, event_id)).fetchone()
    if row is None:
        return {"status": "local_unknown"}
    data = json.loads(row[0])
    try:
        code, response = request(url + "/effects?" + urllib.parse.urlencode({"tenant": tenant, "event_id": event_id}))
        if code == 404 and response["status"] == "unknown":
            code, response = request(url + "/effects", data)
    except (urllib.error.URLError, http.client.RemoteDisconnected, TimeoutError, ConnectionError) as error:
        return {"status": "transport_unknown", "error_type": type(error).__name__}
    if response.get("status") not in ("applied", "replayed", "found"):
        return {"status": "remote_rejected", "remote": response}
    receipt = response["receipt"]
    if any(receipt.get(key) != value for key, value in data.items()) or not isinstance(receipt.get("receipt_id"), str) or not receipt["receipt_id"]:
        return {"status": "receipt_conflict"}
    if probe:
        print(json.dumps({"status": "checkpoint", "stage": "after_remote_receipt_before_local_commit", "pid": os.getpid(), "receipt": receipt}), flush=True)
        input()
    with closing(sqlite3.connect(db, timeout=20)) as connection, connection:
        connection.execute("BEGIN IMMEDIATE")
        connection.execute("UPDATE outbox SET receipt_id=? WHERE tenant=? AND event_id=?", (receipt["receipt_id"], tenant, event_id))
    return {"status": "confirmed", "receipt": receipt}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True)
    sub = parser.add_subparsers(dest="command", required=True)
    accepted = sub.add_parser("ingest")
    accepted.add_argument("--event", required=True)
    delivery = sub.add_parser("drain")
    delivery.add_argument("--url", required=True)
    delivery.add_argument("--tenant", required=True)
    delivery.add_argument("--event-id", required=True)
    delivery.add_argument("--probe", action="store_true")
    args = parser.parse_args()
    result = ingest(args.db, json.loads(args.event)) if args.command == "ingest" else drain(args.db, args.url, args.tenant, args.event_id, args.probe)
    print(json.dumps(result), flush=True)
