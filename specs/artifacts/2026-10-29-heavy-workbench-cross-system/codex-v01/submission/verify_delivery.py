"""Independent artifact checker: derive expected business facts only from raw inputs."""

import argparse
import collections
import csv
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


def csv_rows(path, fields):
    with path.open(newline="", encoding="utf-8-sig") as stream:
        reader = csv.DictReader(stream)
        assert reader.fieldnames == fields, (str(path), reader.fieldnames, fields)
        return list(reader)


def actual(path, keys, number):
    rows = csv_rows(path, keys + [number])
    result = {tuple(r[k] for k in keys): int(r[number]) for r in rows}
    assert len(result) == len(rows), f"duplicate result keys in {path}"
    return result


def verify(inputs, output, comparison=None):
    inputs, output = inputs.resolve(), output.resolve()
    rows = csv_rows(inputs / "records.csv", ["tenant", "event_id", "amount", "received_at"])
    expected, attempts, totals = {}, collections.Counter(), collections.Counter()
    for row in rows:
        identity = row["tenant"], row["event_id"]
        value = int(row["amount"])
        assert identity not in expected or expected[identity] == value, "inconsistent source amounts"
        expected[identity] = value
        attempts[identity] += 1
    for (tenant, _), value in expected.items():
        totals[tenant,] += value
    tables = {
        "ledger": (["tenant", "event_id"], "amount", expected),
        "duplicates": (["tenant", "event_id"], "attempts", {k: v for k, v in attempts.items() if v > 1}),
        "totals": (["tenant"], "total", dict(totals))}
    observed = {}
    for name, (keys, column, values) in tables.items():
        observed[name] = actual(output / (name + ".csv"), keys, column)
        assert observed[name] == values, f"business {name} disagrees with raw input"
        assert actual(output / "diagnostics" / (name + ".csv"), keys, column) == values, f"diagnostic {name} differs"
    replay = csv_rows(output / "replay.csv", ["pass", "distinct", "total"])
    expected_replay = {"1": (len(expected), sum(expected.values())), "2": (len(expected), sum(expected.values()))}
    assert len(replay) == 2 and {r["pass"]: (int(r["distinct"]), int(r["total"])) for r in replay} == expected_replay
    assert csv_rows(output / "diagnostics/replay.csv", ["pass", "distinct", "total"]) == replay
    database_facts = {}
    for name, factor in (("ledger", 1), ("replay", 2), ("concurrent", 4), ("rollout-candidate", 1), ("rollout-restored", 1)):
        path = output / "verification/databases" / (name + ".sqlite")
        with sqlite3.connect(path.as_uri() + "?mode=ro", uri=True) as db:
            data = {(t, e): (a, n) for t, e, a, n in db.execute("SELECT tenant,event_id,amount,attempts FROM ledger")}
            assert data == {k: (v, attempts[k]*factor) for k, v in expected.items()}, f"persistent database {name} differs from original events"
            assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok", f"{name} integrity"
            database_facts[name] = {"distinct": len(data), "total": sum(a for a, _ in data.values()), "attempts": sum(n for _, n in data.values())}
    commands = json.loads((output / "verification/commands.json").read_text(encoding="utf8"))
    for command in commands:
        assert command["exit_code"] == command["expected_exit_code"], command
        for stream in ("stdout", "stderr"):
            (output / "verification" / command[stream]).read_text(encoding="utf8")
    checks = json.loads((output / "verification/checks.json").read_text(encoding="utf8"))
    assert all(c["passed"] for c in checks), "integration check failure"
    document_links = []
    documents = [output / "incident.md", output / "runbook.md", output / "verification/README.md"]
    documents.extend(sorted((output / "specs").rglob("*.md")))
    for doc in documents:
        content = doc.read_text(encoding="utf8")
        for target in re.findall(r"\]\(([^)]+)\)", content):
            if "://" in target or target.startswith("#"):
                continue
            link = (doc.parent / target.split("#")[0]).resolve()
            assert link.exists(), f"broken document link {doc}: {target}"
            document_links.append(str(link.relative_to(output)))
    compared = None
    if comparison:
        comparison = comparison.resolve()
        for name, (keys, column, _) in tables.items():
            assert actual(comparison / (name + ".csv"), keys, column) == observed[name], f"clean reproduction {name} differs"
        assert csv_rows(comparison / "replay.csv", ["pass", "distinct", "total"]) == replay
        compared = str(comparison)
    result = {"checked_at": datetime.now(timezone.utc).isoformat(), "checker": "verify_delivery.py",
              "input_records": len(rows), "business_identities": len(expected), "business_total": sum(expected.values()),
              "duplicate_identities": len(observed["duplicates"]), "extra_transmissions": len(rows)-len(expected),
              "tenant_totals": {k[0]: v for k, v in totals.items()}, "persistent_databases": database_facts,
              "command_records_with_expected_exits": len(commands), "integration_checks_passed": len(checks),
              "document_links_resolved": document_links, "clean_reproduction_compared": compared, "status": "passed"}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inputs", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--comparison", type=Path)
    args = parser.parse_args()
    verify(args.inputs, args.output, args.comparison)
