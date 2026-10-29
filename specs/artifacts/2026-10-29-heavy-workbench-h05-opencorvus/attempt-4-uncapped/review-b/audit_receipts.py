"""Independently decode receipts and per-identity comparisons after clean execution."""

import csv
import json
from pathlib import Path

H = Path(__file__).resolve().parent


def load(p):
    return json.loads(p.read_text(encoding="utf-8"))


def csvrows(p):
    with p.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


source = csvrows(H / "runner/inputs/records.csv")
expected = {(r["tenant"], r["event_id"]): int(r["amount"]) for r in source}
out = []
for label, base in [("published", H / "published"), ("clean", H / "clean")]:
    v = base / "verification"
    commands = load(v / "commands.json")
    assert len(commands) == 50
    codes = {str(c): sum(r["exit_code"] == c for r in commands) for c in (0, 2, 3, 86)}
    assert codes == {"0": 40, "2": 4, "3": 2, "86": 4}
    for record in commands:
        assert record["exit_code"] == record.get("expected_exit_code", 0)
        assert not record["stderr"]
    legacy = load(v / "legacy.json")
    winners = {}
    for r in source:
        winners.setdefault(r["event_id"], r)
    old = {
        t: sum(int(r["amount"]) for r in winners.values() if r["tenant"] == t)
        for t in ("alpha", "beta", "gamma")
    }
    assert legacy["same_process"]["first"] == legacy["same_process"]["second"] == old
    assert legacy["new_process"]["first"] == {t: 2 * a for t, a in old.items()}
    assert legacy["same_process"]["pid"] != legacy["new_process"]["pid"]
    workers = load(v / "concurrent.json")["workers"]
    assert len({w["pid"] for w in workers}) == 4
    assert sum(w["accepted"] for w in workers) == 720
    assert sum(w["duplicates"] for w in workers) == 2572
    scenarios = []
    for r in load(v / "comparisons.json"):
        n = r["scenario"]
        want = expected
        if n == "restart-prefix":
            want = {
                (e["tenant"], e["event_id"]): int(e["amount"]) for e in source[:317]
            }
        if n.endswith("before-resume"):
            want = (
                {(source[0]["tenant"], source[0]["event_id"]): int(source[0]["amount"])}
                if "after-commit" in n
                else {}
            )
        compare = csvrows(v / "comparisons" / f"{n}.csv")
        actual = {
            (x["tenant"], x["event_id"]): int(x["actual_amount"]) for x in compare
        }
        assert len(compare) == len(want) and actual == want
        assert all(
            int(x["expected_amount"]) == int(x["actual_amount"])
            and x["equal"] == "True"
            for x in compare
        )
        scenarios.append({"name": n, "identities": len(want)})
    assert len(scenarios) == 18
    monitor = load(v / "monitor.json")
    assert monitor["raw_window"]["duplicate_rate"] == 103 / 823
    assert monitor["raw_window"]["alerts"] == ["duplicate_rate_high"]
    assert monitor["unique_window"]["alerts"] == []
    assert monitor["totals_fault"]["alerts"] == ["ledger_reconciliation_failed"]
    assert monitor["missing_identity"]["tenants"][0]["identity_mismatches"] == 1
    assert monitor["balanced_wrong_identity"]["tenants"][0]["identity_mismatches"] == 2
    assert all(
        t["source_ledger_delta"] == t["ledger_totals_delta"] == 0
        for t in monitor["balanced_wrong_identity"]["tenants"]
    )
    boundary = load(v / "threshold.json")
    assert (
        boundary["at_threshold"]["duplicate_rate"] == 0.1
        and not boundary["at_threshold"]["alerts"]
    )
    assert boundary["above_threshold"]["alerts"] == ["duplicate_rate_high"]
    route = load(v / "cutover.json")
    assert [r["write_enabled"] for r in route["transitions"]] == [True, False, True]
    assert {r["database"] for r in route["transitions"]} == {
        "databases/fixed-v2.sqlite"
    }
    paused = [r for r in commands if r["exit_code"] == 3]
    assert any("paused-probe.csv" in " ".join(r["command"]) for r in paused)
    # Locate command receipts for all the material effects, rather than summary-only checks.
    selected = []
    for i, r in enumerate(commands):
        args = r["command"]
        if "--legacy-worker" in args or r["exit_code"] or "--start-gate" in args:
            value = json.loads(r["stdout"]) if r["stdout"].strip() else None
            selected.append(
                {
                    "index": i,
                    "command": args,
                    "exit_code": r["exit_code"],
                    "pid": value.get("pid") if value else None,
                }
            )
    out.append(
        dict(
            surface=label,
            exit_codes=codes,
            scenarios=scenarios,
            legacy=legacy,
            concurrent_pids=[w["pid"] for w in workers],
            concurrent_accepted=[w["accepted"] for w in workers],
            selected_receipts=selected,
        )
    )
(H / "receipt-audit.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(
    json.dumps(
        [
            {
                "surface": r["surface"],
                "exit_codes": r["exit_codes"],
                "concurrent_pids": r["concurrent_pids"],
                "concurrent_accepted": r["concurrent_accepted"],
                "scenario_count": len(r["scenarios"]),
            }
            for r in out
        ]
    )
)
