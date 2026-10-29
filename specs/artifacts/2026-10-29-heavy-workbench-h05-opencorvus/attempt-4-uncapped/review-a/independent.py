"""Reviewer A: raw-source expectations, direct SQL, independent failure probes.
All writes restricted to this directory. Does not import producer's checker.
"""

import sys

sys.dont_write_bytecode = True
from pathlib import Path
import csv, collections, json, sqlite3, subprocess, os, time, random
from decimal import Decimal
from datetime import datetime, timezone

H = Path(__file__).resolve().parent
R = H.parents[1]
COPY = H / "copy"
sys.path.insert(0, str(COPY))
from service import Service


def csvrows(path):
    with path.open(encoding="utf-8", newline="") as f:
        r = csv.DictReader(f)
        return r.fieldnames, list(r)


def writecsv(path, rows):
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)


def sqlstate(path, immutable=False):
    uri = path.resolve().as_uri() + "?mode=ro" + ("&immutable=1" if immutable else "")
    c = sqlite3.connect(uri, uri=True)
    try:
        c.execute("BEGIN")
        ledger = list(c.execute("SELECT tenant,event_id,amount FROM ledger"))
        totals = dict(c.execute("SELECT tenant,amount FROM totals"))
        integrity = c.execute("PRAGMA integrity_check").fetchall()
        assert integrity == [("ok",)]
        return {(t, e): a for t, e, a in ledger}, totals
    finally:
        c.close()


def sums(ledger):
    out = collections.Counter()
    for (t, e), a in ledger.items():
        out[t] += a
    return dict(out)


if len(sys.argv) > 1 and sys.argv[1] == "kill-worker":
    database, stage, ready, raw = sys.argv[2:]
    _, events = csvrows(Path(raw))
    s = Service(database)
    for e in events[:79]:
        s.ingest(e)
    done = {(e["tenant"], e["event_id"]) for e in events[:79]}
    target = next(e for e in events[79:] if (e["tenant"], e["event_id"]) not in done)

    def callback(at):
        if at == stage:
            Path(ready).write_text(
                json.dumps({"stage": at, "pid": os.getpid(), "target": target}),
                encoding="utf-8",
            )
            while True:
                time.sleep(0.05)

    s.ingest(target, callback)
    raise AssertionError("worker did not pause")


def main():
    experiment = H / "experiments"
    experiment.mkdir(exist_ok=False)
    _, events = csvrows(R / "inputs/records.csv")
    expected = {}
    counts = collections.Counter()
    for e in events:
        k = e["tenant"], e["event_id"]
        value = int(e["amount"])
        assert expected.get(k, value) == value
        expected[k] = value
        counts[k] += 1
    wanted_totals = sums(expected)
    assert len(expected) == 720 and len(events) == 823
    report = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "python": sys.version,
        "sqlite": sqlite3.sqlite_version,
        "root": str(R),
        "tested_copy": str(COPY),
        "original_input": str(R / "inputs/records.csv"),
        "totals": wanted_totals,
        "observations": [],
        "commands": [],
    }

    def save():
        (H / "independent-results.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def note(name, **kw):
        report["observations"].append({"name": name, **kw})
        save()

    def run(args, code=0, cwd=experiment):
        begin = datetime.now(timezone.utc).isoformat()
        p = subprocess.run(
            [sys.executable, "-B", *map(str, args)],
            cwd=cwd,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        report["commands"].append(
            {
                "args": [sys.executable, "-B", *map(str, args)],
                "cwd": str(cwd),
                "started_at": begin,
                "ended_at": datetime.now(timezone.utc).isoformat(),
                "exit_code": p.returncode,
                "stdout": p.stdout,
                "stderr": p.stderr,
            }
        )
        save()
        assert p.returncode == code, report["commands"][-1]
        return json.loads(p.stdout) if p.stdout.strip() else None

    def ingest(db, raw=R / "inputs/records.csv"):
        return run([COPY / "service.py", "ingest", "--database", db, "--events", raw])

    # Exact headers, exact canonical keys, no duplicate output rows, numeric equivalence.
    expected_tables = {
        "ledger": (
            ["tenant", "event_id", "amount"],
            {k: (Decimal(v),) for k, v in expected.items()},
            2,
        ),
        "duplicates": (
            ["tenant", "event_id", "attempts"],
            {k: (Decimal(v),) for k, v in counts.items() if v > 1},
            2,
        ),
        "totals": (
            ["tenant", "total"],
            {(k,): (Decimal(v),) for k, v in wanted_totals.items()},
            1,
        ),
        "replay": (
            ["pass", "distinct", "total"],
            {(p,): (Decimal(720), Decimal(sum(expected.values()))) for p in ["1", "2"]},
            1,
        ),
    }
    for root in [R, COPY, H / "fresh"]:
        for folder in [root, root / "diagnostics"]:
            for name, (cols, wanted, nkeys) in expected_tables.items():
                headers, rows = csvrows(folder / (name + ".csv"))
                assert headers == cols
                mapped = {
                    tuple(r[c] for c in cols[:nkeys]): tuple(
                        Decimal(r[c]) for c in cols[nkeys:]
                    )
                    for r in rows
                }
                assert len(mapped) == len(rows) and mapped == wanted
    note("tables", status="passed", table_checks=24, identities=720, duplicates=103)
    # Primary immutable main databases are checkpointed delivery artifacts, never opened writable.
    for root in [R, COPY, H / "fresh"]:
        for name in [
            "fixed-v2",
            "restart",
            "reordered",
            "concurrent",
            "monitor-rebuilt",
            "crash-after-ledger",
            "crash-after-total",
            "crash-before-commit",
            "crash-after-commit",
        ]:
            db = root / "verification/databases" / (name + ".sqlite")
            assert not Path(str(db) + "-wal").exists()
            actual, totals = sqlstate(db, immutable=True)
            assert actual == expected and totals == wanted_totals
            note(
                "direct_database",
                root=str(root),
                database=name,
                identities=len(actual),
                status="passed",
            )
    winners = {}
    for e in events:
        winners.setdefault(e["event_id"], e)
    old = collections.Counter()
    for e in winners.values():
        old[e["tenant"]] += int(e["amount"])
    for root in [R, COPY, H / "fresh"]:
        for name, m in [("legacy-first", 1), ("legacy-v1", 2)]:
            db = root / "verification/databases" / (name + ".sqlite")
            with sqlite3.connect(
                db.resolve().as_uri() + "?mode=ro&immutable=1", uri=True
            ) as c:
                observed = dict(c.execute("SELECT tenant,amount FROM totals"))
            assert observed == {t: a * m for t, a in old.items()}
    note(
        "old_impact",
        old_first=dict(old),
        old_restarted={t: a * 2 for t, a in old.items()},
        first_delta={t: old[t] - wanted_totals[t] for t in wanted_totals},
        restarted_delta={t: 2 * old[t] - wanted_totals[t] for t in wanted_totals},
    )
    inversion = sum(
        b["received_at"] < a["received_at"] for a, b in zip(events, events[1:])
    )
    assert inversion == 410
    note(
        "timeline",
        inversions=inversion,
        received_min=min(e["received_at"] for e in events),
        received_max=max(e["received_at"] for e in events),
        business_time="unknown",
        historical_processing="unknown",
    )
    # Fresh receipts are independently decoded, not accepted from a PASS field.
    commands = json.loads(
        (H / "fresh/verification/commands.json").read_text(encoding="utf-8")
    )
    assert (
        "--legacy-worker" in commands[0]["command"]
        and "--legacy-worker" in commands[1]["command"]
    )
    assert commands[0]["exit_code"] == commands[1]["exit_code"] == 0
    assert json.loads(commands[0]["stdout"])["first"] == dict(old)
    assert json.loads(commands[1]["stdout"])["first"] == {
        t: 2 * a for t, a in old.items()
    }
    assert len(commands) == 50
    for c in commands:
        assert c["exit_code"] == c.get("expected_exit_code", 0)
    for stage in ["after-ledger", "after-total", "before-commit", "after-commit"]:
        relevant = [
            c
            for c in commands
            if "--crash-at" in c["command"] and stage in c["command"]
        ]
        assert len(relevant) == 1 and relevant[0]["exit_code"] == 86
    note(
        "clean_rerun_receipts",
        commands=50,
        first_two="original legacy same process, then restarted",
        status="passed",
    )
    # External OS termination at a non-empty prefix: distinguish lost prefix and partial posting.
    prefix = {(e["tenant"], e["event_id"]): int(e["amount"]) for e in events[:79]}
    for stage in ["after-ledger", "after-total", "before-commit", "after-commit"]:
        db = experiment / ("external-" + stage + ".sqlite")
        ready = experiment / (stage + ".ready")
        args = [
            sys.executable,
            "-B",
            str(Path(__file__).resolve()),
            "kill-worker",
            str(db),
            stage,
            str(ready),
            str(R / "inputs/records.csv"),
        ]
        p = subprocess.Popen(
            args,
            cwd=experiment,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
        )
        try:
            deadline = time.monotonic() + 60
            while (
                not ready.exists() and p.poll() is None and time.monotonic() < deadline
            ):
                time.sleep(0.01)
            assert ready.exists(), ("no ready marker", p.poll())
            marker = json.loads(ready.read_text(encoding="utf-8"))
            target = marker["target"]
            committed = dict(prefix)
            if stage == "after-commit":
                committed[(target["tenant"], target["event_id"])] = int(
                    target["amount"]
                )
            # Independent reader sees only committed prefix, never in-flight half-posting.
            assert sqlstate(db) == (committed, sums(committed))
            p.kill()  # Exact child handle, not a process-name kill.
            stdout, stderr = p.communicate(timeout=30)
            report["commands"].append(
                {
                    "args": args,
                    "cwd": str(experiment),
                    "pid": p.pid,
                    "exit_code": p.returncode,
                    "termination": "parent killed exact child after ready marker",
                    "stdout": stdout,
                    "stderr": stderr,
                }
            )
            assert p.returncode != 0
            assert sqlstate(db) == (committed, sums(committed))
            receipt = ingest(db)
            assert receipt["accepted"] == len(expected) - len(committed)
            assert sqlstate(db) == (expected, wanted_totals)
            assert ingest(db)["accepted"] == 0
            note(
                "external_kill",
                stage=stage,
                prior_commits=len(prefix),
                surviving_commits=len(committed),
                child_pid=p.pid,
                exit_code=p.returncode,
                final_identities=720,
                status="passed",
            )
        finally:
            if p.poll() is None:
                p.kill()
                p.wait()
    # Independent six-process run with reversed/rotated/shuffled streams and virgin database.
    db = experiment / "six-process.sqlite"
    gate = experiment / "six.start"
    children = []
    for i in range(6):
        stream = list(events)
        random.Random(651 + i).shuffle(stream)
        if i % 2:
            stream.reverse()
        raw = experiment / (str(i) + ".csv")
        writecsv(raw, stream)
        args = [
            sys.executable,
            "-B",
            str(COPY / "service.py"),
            "ingest",
            "--database",
            str(db),
            "--events",
            str(raw),
            "--start-gate",
            str(gate),
        ]
        children.append(
            (
                subprocess.Popen(
                    args,
                    cwd=experiment,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    encoding="utf-8",
                ),
                args,
            )
        )
    try:
        assert all(p.poll() is None for p, a in children)
        gate.write_text("go", encoding="utf-8")
        receipts = []
        for p, args in children:
            stdout, stderr = p.communicate(timeout=180)
            report["commands"].append(
                {
                    "args": args,
                    "cwd": str(experiment),
                    "pid": p.pid,
                    "exit_code": p.returncode,
                    "stdout": stdout,
                    "stderr": stderr,
                }
            )
            assert p.returncode == 0, (p.returncode, stderr)
            receipts.append(json.loads(stdout))
        assert len({r["pid"] for r in receipts}) == 6
        assert sum(r["accepted"] for r in receipts) == 720
        assert sum(r["duplicates"] for r in receipts) == 6 * 823 - 720
        assert sqlstate(db) == (expected, wanted_totals)
        note(
            "independent_concurrency",
            pids=[r["pid"] for r in receipts],
            accepted=720,
            transmissions=4938,
            status="passed",
        )
    finally:
        for p, a in children:
            if p.poll() is None:
                p.kill()
                p.wait()
    reverse = experiment / "reverse.csv"
    writecsv(reverse, list(reversed(events)))
    db = experiment / "reverse.sqlite"
    ingest(db, reverse)
    assert sqlstate(db) == (expected, wanted_totals)
    note("independent_reverse", status="passed", identities=720)
    # Roll back an actual SQL failure between ledger INSERT and totals update, not a callback.
    db = experiment / "sql-failure.sqlite"
    s = Service(db)
    s.db.execute(
        "CREATE TRIGGER abort_total BEFORE INSERT ON totals BEGIN SELECT RAISE(ABORT,'review fault'); END"
    )
    try:
        s.ingest(events[0])
        raise AssertionError("expected SQL failure")
    except sqlite3.IntegrityError:
        pass
    assert sqlstate(db) == ({}, {})
    s.db.execute("DROP TRIGGER abort_total")
    assert s.ingest(events[0]) and not s.ingest(events[0])
    s.close()
    note("sql_failure_atomicity", status="passed", retry_accepted=True)
    # Monitoring boundary and equal-total amount corruption, plus zero/negative values.
    db = experiment / "monitor.sqlite"
    s = Service(db)
    base = [{"tenant": "t", "event_id": str(i), "amount": str(i - 4)} for i in range(9)]
    for e in base:
        s.ingest(e)
    at = s.monitor(base + base[:1])
    above = s.monitor(base + base[:2])
    empty = s.monitor([])
    assert at["duplicate_rate"] == 0.1 and at["alerts"] == []
    assert above["alerts"] == ["duplicate_rate_high"]
    assert empty["alerts"] == ["ledger_reconciliation_failed"]
    s.db.execute("UPDATE ledger SET amount=amount+1 WHERE event_id='0'")
    s.db.execute("UPDATE ledger SET amount=amount-1 WHERE event_id='1'")
    balanced = s.monitor(base)
    assert balanced["tenants"][0]["identity_mismatches"] == 2
    assert (
        balanced["tenants"][0]["source_ledger_delta"]
        == balanced["tenants"][0]["ledger_totals_delta"]
        == 0
    )
    assert balanced["alerts"] == ["ledger_reconciliation_failed"]
    s.close()
    note(
        "monitor_boundaries",
        at_threshold=at,
        above_threshold=above,
        empty_source=empty,
        balanced_amount_fault=balanced,
        status="passed",
    )
    # Route pause and resume at same database. Only this experiment's synthetic identity is used.
    route = experiment / "route.json"
    db = experiment / "route.sqlite"
    raw = experiment / "one.csv"
    one = [{"tenant": "review", "event_id": "one", "amount": "7"}]
    writecsv(raw, one)

    def routing(enabled):
        tmp = route.with_suffix(".next")
        tmp.write_text(
            json.dumps(
                {"release": "review", "database": db.name, "write_enabled": enabled}
            ),
            encoding="utf-8",
        )
        tmp.replace(route)

    routing(True)
    run([COPY / "service.py", "ingest", "--route", route, "--events", raw])
    first = sqlstate(db)
    routing(False)
    writecsv(raw, [{"tenant": "review", "event_id": "paused", "amount": "9"}])
    run([COPY / "service.py", "ingest", "--route", route, "--events", raw], 3)
    assert sqlstate(db) == first
    routing(True)
    writecsv(raw, one)
    assert (
        run([COPY / "service.py", "ingest", "--route", route, "--events", raw])[
            "accepted"
        ]
        == 0
    )
    assert sqlstate(db) == first
    note("route_sequential_pause_resume", status="passed", same_ledger=True)
    # Explicitly measure in-flight CLI pause limitation using a copied service instrumented only
    # to signal reaching its documented start gate (business code remains unchanged).
    probe = experiment / "route_probe.py"
    text = (COPY / "service.py").read_text(encoding="utf-8")
    assert text.count("    if args.start_gate:") == 1
    probe.write_text(
        text.replace(
            "    if args.start_gate:",
            "    if args.start_gate:\n        Path(args.start_gate + '.ready').write_text('route loaded', encoding='utf-8')",
            1,
        ),
        encoding="utf-8",
    )
    gate = experiment / "route.start"
    routing(True)
    writecsv(raw, [{"tenant": "review", "event_id": "inflight", "amount": "11"}])
    args = [
        sys.executable,
        "-B",
        str(probe),
        "ingest",
        "--route",
        str(route),
        "--events",
        str(raw),
        "--start-gate",
        str(gate),
    ]
    p = subprocess.Popen(
        args,
        cwd=experiment,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
    )
    try:
        deadline = time.monotonic() + 60
        while (
            not Path(str(gate) + ".ready").exists()
            and p.poll() is None
            and time.monotonic() < deadline
        ):
            time.sleep(0.01)
        assert Path(str(gate) + ".ready").exists()
        routing(False)
        gate.write_text("go", encoding="utf-8")
        stdout, stderr = p.communicate(timeout=60)
        receipt = json.loads(stdout)
        report["commands"].append(
            {
                "args": args,
                "cwd": str(experiment),
                "pid": p.pid,
                "exit_code": p.returncode,
                "stdout": stdout,
                "stderr": stderr,
            }
        )
        assert receipt["accepted"] == 1 and p.returncode == 0
        assert ("review", "inflight") in sqlstate(db)[0]
        note(
            "inflight_pause_limitation",
            observed="already-started CLI retains true route and commits after file switches false",
            instrumentation="only ready marker inserted before start-gate wait",
            receipt=receipt,
            disposition="known boundary: drain writers; file selector is not a write fence",
        )
    finally:
        if p.poll() is None:
            p.kill()
            p.wait()
    report["finished_at"] = datetime.now(timezone.utc).isoformat()
    save()
    print(
        json.dumps(
            {
                "observations": len(report["observations"]),
                "commands": len(report["commands"]),
                "functional_checks": "passed",
                "inflight_pause_requires_drain": True,
                "results": str(H / "independent-results.json"),
            }
        )
    )


if __name__ == "__main__":
    main()
