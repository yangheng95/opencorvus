"""Second review: no product mutations; independent raw grouping and SQL checks."""

import collections
import csv
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CACHE = (
    ROOT
    / ".opencorvus/.r/tasks/tsk_g00VZOYBUC00Kv0WzDFa/artifacts/materializations/reads"
)
LOG = (
    json.loads((HERE / "commands.json").read_text(encoding="utf-8"))
    if (HERE / "commands.json").exists()
    else []
)
RESULT = {}


def save(name, obj):
    (HERE / name).write_text(
        json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def rows(path):
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def sql(path, query):
    # A crashed private experiment can have committed schema/data in WAL.
    # Never ignore that WAL. Frozen published/primary databases are checkpointed.
    private_experiment = path.is_relative_to(HERE / "experiments-v2")
    with sqlite3.connect(
        path.resolve().as_uri()
        + ("?mode=ro" if private_experiment else "?mode=ro&immutable=1"),
        uri=True,
    ) as c:
        return c.execute(query).fetchall()


def call(args, code=0, cwd=HERE):
    start = datetime.now(timezone.utc).isoformat()
    p = subprocess.run(
        [sys.executable, "-B", *map(str, args)],
        cwd=cwd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1", "PYTHONIOENCODING": "utf-8"},
    )
    LOG.append(
        dict(
            command=[sys.executable, "-B", *map(str, args)],
            cwd=str(cwd),
            started_at=start,
            finished_at=datetime.now(timezone.utc).isoformat(),
            exit_code=p.returncode,
            stdout=p.stdout,
            stderr=p.stderr,
        )
    )
    save("commands.json", LOG)
    assert p.returncode == code, LOG[-1]
    return json.loads(p.stdout) if p.stdout.strip() else None


def check_db(path, expected):
    actual_rows = sql(path, "SELECT tenant,event_id,amount FROM ledger")
    actual = {(t, e): a for t, e, a in actual_rows}
    assert len(actual_rows) == len(expected) and actual == expected, str(path)
    wanted_totals = {
        t: sum(a for (tt, e), a in expected.items() if tt == t) for t, e in expected
    }
    assert dict(sql(path, "SELECT tenant,amount FROM totals")) == wanted_totals, str(
        path
    )
    assert sql(path, "PRAGMA integrity_check") == [("ok",)]
    return dict(path=str(path), identities=len(actual), totals=wanted_totals)


def main():
    published = HERE / "published"
    published.mkdir(exist_ok=True)
    with zipfile.ZipFile(HERE / "published.zip") as z:
        names = z.namelist()
        assert len(names) == len(set(names))
        assert all(
            not Path(n).is_absolute() and ".." not in Path(n).parts for n in names
        )
        z.extractall(published)
    # Read every extracted member; compare actual primary files, not a digest inventory.
    diffs = []
    for n in names:
        a, b = (published / n).read_bytes(), (ROOT / n).read_bytes()
        if a != b:
            diffs.append(n)
    RESULT["archive"] = dict(
        members=len(names),
        primary_byte_differences=diffs,
        visual_resources=[
            n
            for n in names
            if Path(n).suffix.lower() in (".pdf", ".png", ".jpg", ".svg")
        ],
    )
    assert not diffs
    # Independently established immutable source and delivered materializations.
    raw_path = (
        CACHE
        / "a13086b8f071962a003303be2088b46ebebe10752e50576516a68d1bf4575116-records.csv"
    )
    source = rows(raw_path)
    assert (
        source
        == rows(published / "inputs/records.csv")
        == rows(ROOT / "inputs/records.csv")
    )
    groups = collections.defaultdict(list)
    winners = {}
    collisions = []
    for line, r in enumerate(source, 2):
        key = (r["tenant"], r["event_id"])
        groups[key].append((line, int(r["amount"])))
        winner = winners.setdefault(r["event_id"], (line, r))
        if winner[1]["tenant"] != r["tenant"]:
            collisions.append(
                dict(
                    event_id=r["event_id"],
                    winner_line=str(winner[0]),
                    winner_tenant=winner[1]["tenant"],
                    suppressed_line=str(line),
                    suppressed_tenant=r["tenant"],
                    amount=r["amount"],
                )
            )
    assert all(len(set(a for _, a in g)) == 1 for g in groups.values())
    expected = {k: g[0][1] for k, g in groups.items()}
    totals = {
        t: sum(a for (tt, e), a in expected.items() if tt == t) for t, e in expected
    }
    old = {
        t: sum(int(r["amount"]) for _, r in winners.values() if r["tenant"] == t)
        for t in totals
    }
    RESULT["source"] = dict(
        transmissions=len(source),
        identities=len(expected),
        per_tenant=dict(collections.Counter(t for t, e in expected)),
        duplicated_identities=sum(len(g) > 1 for g in groups.values()),
        extra_duplicates=sum(len(g) - 1 for g in groups.values()),
        totals=totals,
        legacy_first=old,
        first_delta={t: old[t] - totals[t] for t in totals},
        legacy_restart={t: 2 * old[t] for t in totals},
        restart_delta={t: 2 * old[t] - totals[t] for t in totals},
        received_min=min(r["received_at"] for r in source),
        received_max=max(r["received_at"] for r in source),
        adjacent_inversions=sum(
            a["received_at"] > b["received_at"] for a, b in zip(source, source[1:])
        ),
        collision_examples=collisions[:5],
        suppressed_transmissions=len(collisions),
        suppressed_business_identities=len(expected) - len(winners),
    )
    assert collisions == rows(published / "verification/collisions.csv")
    RESULT["source_rows_exact"] = rows(published / "verification/source_rows.csv") == [
        dict(csv_line=str(i), **r) for i, r in enumerate(source, 2)
    ]
    assert RESULT["source_rows_exact"]

    # Check four prescribed tables on all three surfaces without importing service/checker.
    def check_tables(base):
        for folder in (base, base / "diagnostics"):
            ledger = rows(folder / "ledger.csv")
            assert (
                len(ledger) == len(expected)
                and {(r["tenant"], r["event_id"]): int(r["amount"]) for r in ledger}
                == expected
            )
            duplicate = rows(folder / "duplicates.csv")
            wanted = {k: len(g) for k, g in groups.items() if len(g) > 1}
            assert (
                len(duplicate) == len(wanted)
                and {
                    (r["tenant"], r["event_id"]): int(r["attempts"]) for r in duplicate
                }
                == wanted
            )
            assert {
                r["tenant"]: int(r["total"]) for r in rows(folder / "totals.csv")
            } == totals
            assert rows(folder / "replay.csv") == [
                {"pass": p, "distinct": "720", "total": str(sum(totals.values()))}
                for p in ("1", "2")
            ]

    check_tables(ROOT)
    check_tables(published)
    RESULT["database_checks"] = []
    for base in (ROOT, published):
        for n in (
            "fixed-v2",
            "restart",
            "reordered",
            "concurrent",
            "monitor-rebuilt",
            "crash-after-ledger",
            "crash-after-total",
            "crash-before-commit",
            "crash-after-commit",
        ):
            RESULT["database_checks"].append(
                check_db(base / f"verification/databases/{n}.sqlite", expected)
            )
        for n, m in (("legacy-first", 1), ("legacy-v1", 2)):
            assert dict(
                sql(
                    base / f"verification/databases/{n}.sqlite",
                    "SELECT tenant,amount FROM totals",
                )
            ) == {t: m * a for t, a in old.items()}
    # Clean reproduction starts from code plus raw inputs ONLY: no old outputs or databases.
    runner = HERE / "runner"
    runner.mkdir(exist_ok=True)
    for name in ("service.py", "reproduce.py", "verify_delivery.py"):
        shutil.copyfile(published / name, runner / name)
    shutil.copytree(published / "inputs", runner / "inputs", dirs_exist_ok=True)
    clean = HERE / "clean"
    if not clean.exists():
        call(
            [runner / "reproduce.py", "--inputs", runner / "inputs", "--output", clean],
            cwd=runner,
        )
    check_tables(clean)
    for n in (
        "fixed-v2",
        "restart",
        "reordered",
        "concurrent",
        "monitor-rebuilt",
        "crash-after-ledger",
        "crash-after-total",
        "crash-before-commit",
        "crash-after-commit",
    ):
        RESULT["database_checks"].append(
            check_db(clean / f"verification/databases/{n}.sqlite", expected)
        )
    # Exercise producer checker too, but never use it as our sole evidence.
    call(
        [
            published / "verify_delivery.py",
            published,
            "--record",
            HERE / "published-check.json",
        ]
    )
    # Additional independent fault boundaries occur after 47 transmissions, not row zero.
    experiments = HERE / "experiments-v2"
    experiments.mkdir()
    service = runner / "service.py"
    raw = runner / "inputs/records.csv"
    for stage in ("after-ledger", "after-total", "before-commit", "after-commit"):
        db = experiments / (stage + ".sqlite")
        call(
            [
                service,
                "ingest",
                "--database",
                db,
                "--events",
                raw,
                "--crash-at",
                stage,
                "--crash-row",
                "47",
            ],
            86,
        )
        prefix = source[: 48 if stage == "after-commit" else 47]
        want = {(r["tenant"], r["event_id"]): int(r["amount"]) for r in prefix}
        RESULT["database_checks"].append(check_db(db, want))
        call([service, "ingest", "--database", db, "--events", raw])
        RESULT["database_checks"].append(check_db(db, expected))
    # Real CLI route: pause rejects a NEW identity, retain database and allow snapshot.
    db = experiments / "route.sqlite"
    route = experiments / "route.json"
    call([service, "ingest", "--database", db, "--events", raw])
    novel = experiments / "novel.csv"
    novel.write_text(
        "tenant,event_id,amount\nalpha,review-b-never-post,19\n", encoding="utf-8"
    )
    route_results = []
    for enabled in (True, False, True):
        temp = route.with_suffix(".next")
        temp.write_text(
            json.dumps(
                dict(database=db.name, release="review-b", write_enabled=enabled)
            ),
            encoding="utf-8",
        )
        temp.replace(route)
        call(
            [
                service,
                "ingest",
                "--route",
                route,
                "--events",
                raw if enabled else novel,
            ],
            0 if enabled else 3,
        )
        snapshot = call([service, "snapshot", "--route", route])
        assert {(t, e): a for t, e, a in snapshot["ledger"]} == expected
        route_results.append(dict(write_enabled=enabled, **check_db(db, expected)))
    RESULT["route"] = route_results
    # Same-money identity swap must be detected; restore by raw-input rebuild, not total edits.
    fault = experiments / "fault.sqlite"
    shutil.copyfile(db, fault)
    with sqlite3.connect(fault) as c:
        k = next(iter(expected))
        c.execute(
            "UPDATE ledger SET event_id=? WHERE tenant=? AND event_id=?",
            ("review-b-wrong", *k),
        )
    alarm = call(
        [
            service,
            "monitor",
            "--database",
            fault,
            "--events",
            clean / "verification/unique.csv",
        ],
        2,
    )
    assert alarm["alerts"] == ["ledger_reconciliation_failed"]
    assert sum(t["identity_mismatches"] for t in alarm["tenants"]) == 2
    assert all(
        t["source_ledger_delta"] == t["ledger_totals_delta"] == 0
        for t in alarm["tenants"]
    )
    rebuilt = experiments / "rebuilt.sqlite"
    call([service, "ingest", "--database", rebuilt, "--events", raw])
    recovered = call(
        [
            service,
            "monitor",
            "--database",
            rebuilt,
            "--events",
            clean / "verification/unique.csv",
        ]
    )
    assert not recovered["alerts"]
    RESULT["balanced_identity_alarm"] = alarm
    RESULT["recovered_monitor"] = recovered
    RESULT["clean_summary"] = json.loads(
        (clean / "verification/summary.json").read_text()
    )
    RESULT["command_count"] = len(LOG)
    RESULT["status"] = "independent-checks-passed"
    save("results.json", RESULT)
    print(
        json.dumps(
            {k: RESULT[k] for k in ("status", "source", "archive", "command_count")},
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
