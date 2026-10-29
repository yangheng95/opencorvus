"""Isolated process exercises; fault injection stays outside the production service."""

import argparse
import csv
import json
import os
import sqlite3
import sys
import time
from pathlib import Path

from service import Service, read_events, utc_now, write_json


def legacy_type(inputs):
    namespace = {}
    source = Path(inputs) / "legacy_service.py"
    exec(compile(source.read_text(encoding="utf-8"), str(source), "exec"), namespace)
    return namespace["Service"]


def wait_release(args):
    if args.ready:
        write_json(args.ready, {"pid": os.getpid(), "ready_at": utc_now()})
        deadline = time.monotonic() + 45
        while not Path(args.release).exists():
            if time.monotonic() > deadline:
                raise RuntimeError("release barrier timed out")
            time.sleep(0.02)


def legacy_exercise(inputs, output):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    legacy = legacy_type(inputs)
    events = Path(inputs) / "records.csv"
    service = legacy(output / "legacy.sqlite")
    first = service.replay(events)
    with sqlite3.connect(output / "legacy-first.sqlite") as snapshot:
        service.db.backup(snapshot)
    same_process = service.replay(events)
    service.close()
    service = legacy(output / "legacy.sqlite")
    restart_once = service.replay(events)
    service.close()
    service = legacy(output / "legacy.sqlite")
    restart_twice = service.replay(events)
    service.close()
    # Demonstrate the volatile seen-before-commit failure using the actual original service.
    service = legacy(output / "legacy-write-failure.sqlite")
    event = next(read_events(events))
    service.db.execute("CREATE TRIGGER fault BEFORE INSERT ON totals BEGIN SELECT RAISE(ABORT,'injected-write-failure'); END")
    failure = None
    try:
        service.ingest(event)
    except sqlite3.IntegrityError as exc:
        failure = str(exc)
    service.db.execute("DROP TRIGGER fault")
    service.db.commit()
    service.ingest(event)
    retry_totals = dict(service.db.execute("SELECT tenant,amount FROM totals"))
    same_seen = sorted(service.seen)
    service.close()
    # Persist the archive-to-first-winner attribution behind legacy aggregate omissions.
    winners = {}
    omitted = []
    for line, row in enumerate(read_events(events), start=2):
        if row["event_id"] not in winners:
            winners[row["event_id"]] = {"tenant": row["tenant"], "line": line}
        if winners[row["event_id"]]["tenant"] != row["tenant"]:
            omitted.append({**row, "csv_line": line, "winner_tenant": winners[row["event_id"]]["tenant"], "winner_line": winners[row["event_id"]]["line"]})
    write_json(output / "legacy-omission-attribution.json", omitted)
    result = {"pid": os.getpid(), "observed_at": utc_now(), "first": first,
              "same_process_replay": same_process, "restart_once": restart_once, "restart_twice": restart_twice,
              "global_distinct_ids": len(winners), "first_winners": winners,
              "write_failure": {"event": event, "injected_error": failure, "seen_after_retry": same_seen, "totals_after_retry": retry_totals}}
    write_json(output / "observations.json", result)
    return result


def drill(args):
    if args.mode == "legacy":
        return legacy_exercise(args.inputs, args.output)
    if args.mode in ("concurrent", "legacy-concurrent"):
        cls = legacy_type(args.inputs) if args.mode == "legacy-concurrent" else Service
        service = cls(args.database)
        wait_release(args)
        start = utc_now()
        try:
            result = service.replay(args.events)
        finally:
            service.close()
        return {"pid": os.getpid(), "started_at": start, "finished_at": utc_now(), "replay": result}
    if args.mode in ("crash-before-commit", "crash-after-commit"):
        event = next(read_events(args.events))
        service = Service(args.database)
        if args.mode == "crash-before-commit":
            def observer(sql):
                if sql == "COMMIT":
                    write_json(args.output, {"pid": os.getpid(), "checkpoint": "COMMIT statement trace before execution", "event": event, "observed_at": utc_now()})
                    os._exit(73)
            service.db.set_trace_callback(observer)
        result = service.ingest(event)
        write_json(args.output, {"pid": os.getpid(), "checkpoint": "committed but caller receives no acknowledgment", "result": result, "observed_at": utc_now()})
        os._exit(74)
    if args.mode == "active-client":
        # Simulated deployed client resolves one atomically updated active pointer per session.
        active = json.loads(Path(args.pointer).read_text(encoding="utf8"))
        service = Service(active["database"])
        try:
            replay = service.replay(args.events) if args.events else None
            return {"pid": os.getpid(), "active": active, "replay": replay, "state": service.snapshot()}
        finally:
            service.close()
    raise RuntimeError(args.mode)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["legacy", "concurrent", "legacy-concurrent", "crash-before-commit", "crash-after-commit", "active-client"])
    for name in ("inputs", "output", "database", "events", "ready", "release", "pointer"):
        parser.add_argument("--" + name)
    args = parser.parse_args()
    print(json.dumps(drill(args), ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
