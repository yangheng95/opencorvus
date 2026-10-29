"""Real per-transmission contention using a four-process barrier on the delivered Service."""

import csv
from datetime import datetime, timezone
import importlib.util
import json
import multiprocessing as mp
import os
from pathlib import Path
import sqlite3

H = Path(__file__).resolve().parent


def service_type():
    spec = importlib.util.spec_from_file_location(
        "delivered_service", H / "runner/service.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.Service


def worker(gate, queue, database, events):
    service = service_type()(database)
    accepted = 0
    start = datetime.now(timezone.utc).isoformat()
    for event in events:
        gate.wait(timeout=60)
        accepted += service.ingest(event)
    service.close()
    queue.put(
        dict(
            pid=os.getpid(),
            accepted=accepted,
            attempts=len(events),
            started_at=start,
            finished_at=datetime.now(timezone.utc).isoformat(),
        )
    )


if __name__ == "__main__":
    with (H / "runner/inputs/records.csv").open(encoding="utf-8", newline="") as f:
        events = list(csv.DictReader(f))
    target = H / "experiments-v2/barrier-concurrent.sqlite"
    assert not target.exists()
    initial = service_type()(target)
    initial.close()
    context = mp.get_context("spawn")
    gate = context.Barrier(4)
    queue = context.Queue()
    workers = [
        context.Process(target=worker, args=(gate, queue, str(target), events))
        for _ in range(4)
    ]
    for p in workers:
        p.start()
    for p in workers:
        p.join(timeout=180)
        assert p.exitcode == 0, (p.pid, p.exitcode)
    receipts = [queue.get(timeout=5) for _ in workers]
    assert (
        len({r["pid"] for r in receipts}) == 4
        and sum(r["accepted"] for r in receipts) == 720
    )
    wanted = {(r["tenant"], r["event_id"]): int(r["amount"]) for r in events}
    with sqlite3.connect(target) as c:
        ledger = c.execute("SELECT tenant,event_id,amount FROM ledger").fetchall()
        totals = dict(c.execute("SELECT tenant,amount FROM totals"))
        assert len(ledger) == 720 and {(t, e): a for t, e, a in ledger} == wanted
        assert totals == {
            t: sum(a for (tt, e), a in wanted.items() if tt == t) for t, e in wanted
        }
        c.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    result = dict(
        workers=receipts,
        barrier_rounds=len(events),
        total_attempts=4 * len(events),
        new_postings=sum(r["accepted"] for r in receipts),
        identities=len(ledger),
        totals=totals,
        status="passed",
    )
    (H / "barrier-concurrent.json").write_text(
        json.dumps(result, indent=2), encoding="utf-8"
    )
    print(json.dumps(result))
