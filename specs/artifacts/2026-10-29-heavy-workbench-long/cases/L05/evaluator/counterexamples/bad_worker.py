"""Deliberately wrong executable controls. Never a current reference/fallback."""
import argparse
import json
import os
import sqlite3


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True)
    parser.add_argument("--events", required=True)
    parser.add_argument("--fault", choices=["global_event_id", "early_sent"], required=True)
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()
    if args.resume:
        connection = sqlite3.connect(args.db)
        rows = connection.execute("SELECT tenant,event_id,receipt_id FROM outbox").fetchall()
        print(json.dumps({"status": "already_sent", "rows": rows}), flush=True)
        connection.close()
    else:
        events = json.loads(open(args.events, encoding="utf-8").read())
        connection = sqlite3.connect(args.db)
        key = "event_id" if args.fault == "global_event_id" else "tenant,event_id"
        connection.execute(f"CREATE TABLE entries(tenant TEXT NOT NULL,event_id TEXT NOT NULL,payload TEXT NOT NULL,amount_minor INTEGER NOT NULL,PRIMARY KEY({key}))")
        connection.execute("CREATE TABLE outbox(tenant TEXT NOT NULL,event_id TEXT NOT NULL,receipt_id TEXT,PRIMARY KEY(tenant,event_id))")
        for event in events:
            inserted = connection.execute("INSERT OR IGNORE INTO entries VALUES(?,?,?,?)", (event["tenant"], event["event_id"], json.dumps(event, sort_keys=True, separators=(",", ":")), event["amount_minor"])).rowcount
            if inserted:
                connection.execute("INSERT INTO outbox VALUES(?,?,?)", (event["tenant"], event["event_id"], "sent-before-request" if args.fault == "early_sent" else None))
        connection.commit()
        connection.close()
        if args.fault == "early_sent":
            print(json.dumps({"status": "checkpoint", "stage": "early_confirm_before_remote_request", "pid": os.getpid()}), flush=True)
            input()
        print(json.dumps({"status": "ingested_wrong_control"}), flush=True)
