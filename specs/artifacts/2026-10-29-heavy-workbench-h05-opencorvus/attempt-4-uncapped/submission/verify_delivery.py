"""Read-only delivery checks using raw CSV and SQLite, without importing service code."""

import argparse
from collections import Counter, defaultdict
import csv
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
import sys


def read_csv(path, columns=None):
    with path.open(encoding="utf-8", newline="") as stream:
        reader = csv.DictReader(stream)
        if columns is not None:
            assert reader.fieldnames == columns, (str(path), reader.fieldnames)
        return list(reader)


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def check(root):
    source = read_csv(
        root / "inputs/records.csv", ["tenant", "event_id", "amount", "received_at"]
    )
    grouped = defaultdict(list)
    for row in source:
        grouped[(row["tenant"], row["event_id"])].append(int(row["amount"]))
    assert all(min(values) == max(values) for values in grouped.values())
    expected = {key: values[0] for key, values in grouped.items()}
    totals = dict(
        sorted(
            Counter(
                {
                    t: sum(a for (tenant, _), a in expected.items() if tenant == t)
                    for t, _ in expected
                }
            ).items()
        )
    )
    assert len(source) == 823 and len(expected) == 720
    assert Counter(t for t, _ in expected) == {"alpha": 240, "beta": 240, "gamma": 240}
    expected_duplicates = {
        key: len(values) for key, values in grouped.items() if len(values) > 1
    }
    for folder in (root, root / "diagnostics"):
        ledger = read_csv(folder / "ledger.csv", ["tenant", "event_id", "amount"])
        assert len(ledger) == len(expected)
        assert {
            (r["tenant"], r["event_id"]): int(r["amount"]) for r in ledger
        } == expected
        duplicates = read_csv(
            folder / "duplicates.csv", ["tenant", "event_id", "attempts"]
        )
        assert len(duplicates) == len(expected_duplicates)
        assert {
            (r["tenant"], r["event_id"]): int(r["attempts"]) for r in duplicates
        } == expected_duplicates
        aggregate = read_csv(folder / "totals.csv", ["tenant", "total"])
        assert len(aggregate) == 3
        assert {r["tenant"]: int(r["total"]) for r in aggregate} == totals
        replay = read_csv(folder / "replay.csv", ["pass", "distinct", "total"])
        assert replay == [
            {"pass": p, "distinct": "720", "total": str(sum(totals.values()))}
            for p in ("1", "2")
        ]

    verification = root / "verification"
    legacy = read_json(verification / "legacy.json")
    winners = {}
    for row in source:
        if row["event_id"] not in winners:
            winners[row["event_id"]] = row
    old = dict(
        Counter(
            {
                tenant: sum(
                    int(r["amount"]) for r in winners.values() if r["tenant"] == tenant
                )
                for tenant in totals
            }
        )
    )
    assert legacy["same_process"]["first"] == legacy["same_process"]["second"] == old
    assert legacy["new_process"]["first"] == {t: 2 * a for t, a in old.items()}
    assert legacy["same_process"]["pid"] != legacy["new_process"]["pid"]
    for name, multiplier in (("legacy-first", 1), ("legacy-v1", 2)):
        database = verification / "databases" / f"{name}.sqlite"
        with sqlite3.connect(
            database.as_uri() + "?mode=ro&immutable=1", uri=True
        ) as connection:
            assert dict(connection.execute("SELECT tenant,amount FROM totals")) == {
                t: a * multiplier for t, a in old.items()
            }
    for row in read_csv(verification / "impact.csv"):
        t = row["tenant"]
        assert [
            int(row[k])
            for k in (
                "expected",
                "legacy_first",
                "first_delta",
                "legacy_restart",
                "restart_delta",
                "fixed",
            )
        ] == [
            totals[t],
            old[t],
            old[t] - totals[t],
            2 * old[t],
            2 * old[t] - totals[t],
            totals[t],
        ]
    for row in read_csv(verification / "collisions.csv"):
        winner = source[int(row["winner_line"]) - 2]
        suppressed = source[int(row["suppressed_line"]) - 2]
        assert winner["event_id"] == suppressed["event_id"] == row["event_id"]
        assert (
            winner["tenant"]
            == row["winner_tenant"]
            != row["suppressed_tenant"]
            == suppressed["tenant"]
        )
        assert int(row["amount"]) == int(suppressed["amount"])

    database_checks = []
    for name in (
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
        database = verification / "databases" / f"{name}.sqlite"
        assert not database.with_name(database.name + "-wal").exists(), database
        with sqlite3.connect(
            database.as_uri() + "?mode=ro&immutable=1", uri=True
        ) as connection:
            ledger = list(
                connection.execute("SELECT tenant,event_id,amount FROM ledger")
            )
            assert len(ledger) == len(expected)
            assert {(t, e): a for t, e, a in ledger} == expected
            assert (
                dict(connection.execute("SELECT tenant,amount FROM totals")) == totals
            )
            assert connection.execute("PRAGMA integrity_check").fetchall() == [("ok",)]
            primary_key = [
                row[1]
                for row in sorted(
                    connection.execute("PRAGMA table_info(ledger)"), key=lambda r: r[5]
                )
                if row[5]
            ]
            assert primary_key == ["tenant", "event_id"]
        database_checks.append(
            {"database": name, "identities": len(ledger), "integrity": "ok"}
        )

    comparisons = read_json(verification / "comparisons.json")
    assert len(comparisons) == 18
    for comparison in comparisons:
        scenario = comparison["scenario"]
        rows = read_csv(verification / "comparisons" / f"{scenario}.csv")
        wanted = expected
        if scenario == "restart-prefix":
            wanted = {
                (row["tenant"], row["event_id"]): int(row["amount"])
                for row in source[:317]
            }
        elif scenario.endswith("-before-resume"):
            wanted = (
                {(source[0]["tenant"], source[0]["event_id"]): int(source[0]["amount"])}
                if "after-commit" in scenario
                else {}
            )
        assert len(rows) == len(wanted)
        assert {
            (r["tenant"], r["event_id"]): int(r["actual_amount"]) for r in rows
        } == wanted
        assert all(
            r["equal"] == "True" and r["expected_amount"] == r["actual_amount"]
            for r in rows
        )
        assert comparison["mismatches"] == 0 and comparison["totals_equal"] is True

    commands = read_json(verification / "commands.json")
    crashes, warnings, pauses = 0, 0, 0
    for record in commands:
        code = record["exit_code"]
        assert code == record.get("expected_exit_code", 0)
        assert record["started_at"] <= record["finished_at"]
        assert not record["stderr"], record
        crashes += code == 86
        warnings += code == 2
        pauses += code == 3
    assert crashes == 4 and warnings == 4 and pauses == 2
    concurrent = read_json(verification / "concurrent.json")
    workers = concurrent["workers"]
    assert concurrent["all_alive_before_release"]
    assert len(workers) == len({r["pid"] for r in workers}) == 4
    assert sum(w["accepted"] for w in workers) == 720
    assert sum(w["duplicates"] for w in workers) == 4 * 823 - 720
    restart = read_json(verification / "restart.json")
    assert restart["prefix_pid"] != restart["resume_pid"]
    monitor = read_json(verification / "monitor.json")
    assert monitor["raw_window"]["duplicate_rate"] == 103 / 823
    assert monitor["raw_window"]["alerts"] == ["duplicate_rate_high"]
    assert monitor["unique_window"]["alerts"] == []
    assert monitor["balanced_wrong_identity"]["alerts"] == [
        "ledger_reconciliation_failed"
    ]
    assert monitor["balanced_wrong_identity"]["tenants"][0]["identity_mismatches"] == 2
    threshold = read_json(verification / "threshold.json")
    assert threshold["at_threshold"]["alerts"] == []
    assert threshold["above_threshold"]["alerts"] == ["duplicate_rate_high"]
    route = read_json(verification / "cutover.json")
    assert [r["write_enabled"] for r in route["transitions"]] == [True, False, True]
    assert len({r["database"] for r in route["transitions"]}) == 1
    summary = read_json(verification / "summary.json")
    assert summary["command_count"] == len(commands)
    assert summary["totals"] == totals
    assert summary["independent_reviews"].startswith("pending:")
    for name in ("incident.md", "runbook.md"):
        content = (root / name).read_text(encoding="utf-8")
        assert all(str(a) in content for a in totals.values())
        assert str(sum(totals.values())) in content
        assert "独立" in content and "未知" in content
    return {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "delivery": str(root),
        "checker": "raw CSV grouping and direct read-only SQL; does not import service",
        "status": "passed",
        "transmissions": len(source),
        "distinct": len(expected),
        "totals": totals,
        "database_checks": database_checks,
        "comparison_scenarios": len(comparisons),
        "command_receipts": len(commands),
        "independent_human_review": "not performed",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("delivery", type=Path)
    parser.add_argument("--record", type=Path)
    args = parser.parse_args()
    result = check(args.delivery.resolve())
    result["invocation"] = [sys.executable, *sys.argv]
    if args.record:
        args.record.write_text(
            json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    print(json.dumps(result, ensure_ascii=False))
