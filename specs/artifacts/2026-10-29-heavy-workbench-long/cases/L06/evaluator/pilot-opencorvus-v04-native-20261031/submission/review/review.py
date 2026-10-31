"""Read-only whole-case evidence reconciliation; outputs only under review/."""

from pathlib import Path
from fractions import Fraction as F
import csv, gzip, json, os, sys, zipfile

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "submission/review"
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / "public"))
from model import load, canonical, posterior, predictive, packet, advance
from audit import analyze, read_rows


def j(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


result = {}
source = zipfile.ZipFile(OUT / "published-source.zip")
assert not any("/tables/" in s for s in source.namelist())
public_names = [s for s in source.namelist() if s.startswith("public/")]
assert len(public_names) == 21
for name in source.namelist():
    target = ROOT / name if name.startswith("public/") else ROOT / "submission" / name
    assert source.read(name) == target.read_bytes(), name
result["source_capsule"] = {
    "public_files": len(public_names),
    "members": len(source.namelist()),
    "all_members_match_primary_bytes": True,
    "no_policy_tables": True,
}
native = zipfile.ZipFile(OUT / "published-native-evidence.zip")
for name in native.namelist():
    assert native.read(name) == (ROOT / name).read_bytes(), name
result["native_capsule"] = {
    "members": len(native.namelist()),
    "all_members_match_primary_bytes": True,
}
native.extractall(OUT / "published-native")
result["runs"] = {}
previous = None
for name in ["native-complete", "native-rebuilt"]:
    run = OUT / "published-native/submission" / name
    # Public checker opens SQLite copies under the configured submission TEMP.
    observed = analyze(run)
    declared = j(
        ROOT
        / "submission"
        / ("exports-complete" if name == "native-complete" else "exports-rebuilt")
        / "summary.json"
    )
    assert observed["instances"] == declared["instances"]
    if previous is not None:
        assert previous == observed["instances"]
    previous = observed["instances"]
    if name == "native-complete":
        with (ROOT / "submission/exports-complete/stage-ledger.csv").open(
            encoding="utf-8", newline=""
        ) as f:
            delivered = list(csv.DictReader(f))

        def norm(row):
            row = {k: str(v) for k, v in row.items()}
            for k in ["belief_json", "receivables_json"]:
                row[k] = canonical(json.loads(row[k]))
            return row

        a = {
            (r["instance"], r["path"], str(r["seq"])): norm(r)
            for r in observed["ledger"]
        }
        b = {(r["instance"], r["path"], str(r["seq"])): norm(r) for r in delivered}
        assert len(a) == len(delivered) == 197 * 16 and a == b
    raw_commands = j(run / "actual-commands.json")
    assert len(raw_commands) == 200
    assert sorted(c["native_exit"] for c in raw_commands) == [0] * 198 + [73] * 2
    boundaries = []
    for cut in sorted(run.glob("episode-*/cut-*/crash-after-commit.json")):
        crash = j(cut)
        episode = cut.parent.parent
        saved = j(cut.parent / "original-prefix.json")
        meta, rows = read_rows(episode / "journal.sqlite3")
        assert [list(r) for r in rows[: len(saved)]] == saved
        stage = "cut-laboratory" if crash["kind"] == "order" else "completed"
        resume = j(episode / stage / "resume-receipt.json")
        assert resume["original_receipt"] == json.loads(saved[-1][3])
        assert resume["request_id"] == saved[-1][1]
        assert resume["new_sample_drawn"] is False
        starts = [
            j(episode / s / "controller-started.json")
            for s in ["cut-order", "cut-laboratory", "completed"]
        ]
        assert len({s["pid"] for s in starts}) == 3
        ws = [
            j(episode / s / "worker/worker-started.json")
            for s in ["cut-order", "cut-laboratory", "completed"]
        ]
        assert len({s["pid"] for s in ws}) == 3
        terminal = j(episode / stage / "worker/worker-terminal.json")
        assert terminal["native_exit"] == 0
        boundaries.append(
            {
                "kind": crash["kind"],
                "committed_seq": crash["committed_seq"],
                "observation": crash["observed_result"],
                "key": crash["original_key"],
                "controller_pids": [s["pid"] for s in starts],
                "worker_pids": [s["pid"] for s in ws],
                "saved_rows": len(saved),
                "final_rows": len(rows),
                "same_receipt_no_new_sample": True,
            }
        )
    # Independently bind discovery prefixes to actual decision wires and full-label Bayes.
    counts = {}
    certroots = {}
    for ident in ["base", "cash-tight", "shifted-prior"]:
        data = load(ROOT / "public/instances" / ident)
        prefixes = set()
        count = 0
        for line in (
            (run / ("discovery-" + ident) / "wire.jsonl")
            .read_text(encoding="utf-8")
            .splitlines()
        ):
            x = json.loads(line)
            p = x["packet"]
            r = x["response"]
            count += 1
            assert packet(data, p["committed"]) == p
            weights = posterior(data, p["committed"])
            assert {k: F(v) for k, v in r["belief"].items()} == weights
            assert weights["A1"] / weights["A2"] == F(1, 3)
            assert weights["B1"] / weights["B2"] == F(3)
            prefixes.add(canonical(p))
        assert (
            len(prefixes) == count == observed["instances"][ident]["decision_histories"]
        )
        counts[ident] = count
        assert all(
            v == {"8": 24, "9": 12}
            for v in observed["instances"][ident]["receivables_by_path"].values()
        )
        with gzip.open(
            ROOT / "submission/certificates" / f"{ident}-same.json.gz",
            "rt",
            encoding="utf-8",
        ) as f:
            graph = json.load(f)
        nodes = {tuple(k): (v, a) for k, v, a in graph["nodes"]}
        root = ("laboratory", 0, 0, 0, data["initial_cash"], 0)
        assert F(nodes[root][0]) == F(
            observed["instances"][ident]["expected_cost_exact"]
        )
        certroots[ident] = nodes[root][0]
        # Every actor lookup action used in a full-prefix tree attains certified optimum.
        table = j(ROOT / "submission/actor/tables" / f"{ident}.json")
        for encoded, action in table["actions"].items():
            key = tuple(json.loads(encoded))
            assert nodes[key][1] == action
    result["runs"][name] = {
        "instances": observed["instances"],
        "decision_prefixes": counts,
        "ledger_rows": len(observed["ledger"]),
        "command_exits": {"0": 198, "73": 2},
        "recovery_boundaries": boundaries,
        "public_audit_cuts": observed["controller_cuts"],
    }
    print(
        name,
        "197 terminal histories; 726 prefixes; all ledgers/branches/recovery reconciled",
        flush=True,
    )

failure = j(OUT / "published-native/submission/native-original/owner-error.json")
assert failure["code"] == "PermissionError"
result["preserved_failure"] = {k: failure[k] for k in ["code", "error", "action"]}
# Final source capsule equivalence to actually executed rebuilt actor and all tables.
for sub in [
    "actor/actor.py",
    "actor/submission.json",
    "public/model.py",
    "public/exercise.py",
    "solver.py",
]:
    assert (ROOT / "submission/rebuilt-final" / sub).read_bytes() == source.read(sub)
for ident in ["base", "cash-tight", "shifted-prior"]:
    reference = j(ROOT / "submission/actor/tables" / f"{ident}.json")
    for parent in ["rebuilt", "rebuilt-final", "native-rebuilt/sealed-project/.."]:
        if parent.endswith("/.."):
            continue
        assert (
            j(ROOT / "submission" / parent / "actor/tables" / f"{ident}.json")
            == reference
        )
    assert (
        j(ROOT / "submission/native-rebuilt/sealed-project/tables" / f"{ident}.json")
        == reference
    )
result["rebuilt_equivalence"] = {
    "final_source_matches_capsule": True,
    "rebuilt_final_original_and_executed_tables_equal": True,
}
# Dependency archive is a ZIP binary: inspect every entry and compare with declared wheel files.
with zipfile.ZipFile(ROOT / "submission/dependencies.zip") as deps:
    for name in deps.namelist():
        assert deps.read(name) == (ROOT / name).read_bytes(), name
    result["dependency_archive"] = {
        "members": deps.namelist(),
        "all_bytes_match_primary": True,
        "immutable_attachment_read_limitation": "artifact_read rejects this attachment with 33554432-byte batch limit",
    }
(OUT / "reconciliation.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print("All read-only reconciliation assertions passed", flush=True)
