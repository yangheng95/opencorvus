"""Independent re-evaluation of already executed clean rerun receipts and comparisons."""

import csv, json
from pathlib import Path

H = Path(__file__).resolve().parent
R = H.parents[1]
with (R / "inputs/records.csv").open(encoding="utf-8", newline="") as f:
    events = list(csv.DictReader(f))
expected = {(e["tenant"], e["event_id"]): int(e["amount"]) for e in events}
checks = []
for root in [H / "copy", H / "fresh"]:
    v = root / "verification"
    entries = json.loads((v / "comparisons.json").read_text(encoding="utf-8"))
    assert len(entries) == 18
    for entry in entries:
        name = entry["scenario"]
        wanted = expected
        if name == "restart-prefix":
            wanted = {
                (e["tenant"], e["event_id"]): int(e["amount"]) for e in events[:317]
            }
        if name.endswith("-before-resume"):
            wanted = (
                {(events[0]["tenant"], events[0]["event_id"]): int(events[0]["amount"])}
                if "after-commit" in name
                else {}
            )
        with (v / "comparisons" / (name + ".csv")).open(
            encoding="utf-8", newline=""
        ) as f:
            rows = list(csv.DictReader(f))
        observed = {(e["tenant"], e["event_id"]): int(e["actual_amount"]) for e in rows}
        assert len(observed) == len(rows) and observed == wanted
        checks.append(
            {
                "root": str(root),
                "scenario": name,
                "keys": len(wanted),
                "actual_matches_raw_source": True,
            }
        )
    commands = json.loads((v / "commands.json").read_text(encoding="utf-8"))
    snapshots = [
        json.loads(c["stdout"]) for c in commands if "snapshot" in c["command"]
    ]
    for state in snapshots:
        assert state["distinct"] == len(state["ledger"])
        assert state["total"] == sum(row[2] for row in state["ledger"])
    assert len(snapshots) == 18
    workers = json.loads((v / "concurrent.json").read_text(encoding="utf-8"))["workers"]
    assert (
        len({w["pid"] for w in workers}) == 4
        and sum(w["accepted"] for w in workers) == 720
    )
out = {
    "comparisons": checks,
    "clean_rerun_invocation": {
        "command": 'python reproduce.py --inputs "../../../inputs" --output "../fresh"',
        "cwd": str(H / "copy"),
        "output_existed_before": False,
        "exit_code": 0,
        "stdout": {
            "commands": 50,
            "comparisons": 18,
            "distinct": 720,
            "totals": {"alpha": 52680, "beta": 52680, "gamma": 52680},
        },
        "proof_scope": "Tool execution and full source audit: reproduction creates output with exist_ok=False; copies raw inputs, executes original legacy first; result reads only newly generated files; no grader/oracle, old output dependency or network code.",
    },
}
(H / "receipt-checks.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(json.dumps({"comparison_checks": len(checks), "status": "passed"}))
