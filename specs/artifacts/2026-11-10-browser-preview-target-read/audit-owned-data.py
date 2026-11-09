import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess

root = Path(os.environ["TEMP"]).resolve() / "opencorvus-iteration-20261110-b140"
artifact = Path("D:/myhexin-local/opencorvus/specs/artifacts/2026-11-10-browser-preview-target-read")
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")

def load(name):
    return json.loads((root / f"{name}.json").read_text(encoding="utf-8"))

results = {}
for phase in ("before", "after"):
    seed = load(f"{phase}-seed")
    directory = Path(seed["directory"]).resolve()
    assert directory == root / f"project-{phase}"
    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
    git_root = git("rev-list", "--max-parents=0", "HEAD").decode().strip()
    notes = f"Owned browser preview {phase}\n".encode()
    assert git("show", f"{git_root}:notes.txt") == (directory / "notes.txt").read_bytes() == notes
    assert git("show", "HEAD:notes.txt") == notes
    baseline = load(f"{phase}-seed-tcp")["accepted"]
    final = load(f"{phase}-{'settled' if phase == 'before' else 'settled-new'}-tcp")["accepted"]
    assert baseline["taskID"] == final["taskID"] == seed["taskID"]
    if phase == "before":
        assert baseline == final
    else:
        assert load("after-reveal-tcp")["accepted"] == final
        assert final["url"] == baseline["url"] + "-new"
    with sqlite3.connect((root / f"profile-{phase}/data/opencorvus.db").as_uri() + "?mode=ro", uri=True) as db:
        counts = {table: db.execute(f"select count(*) from {table}").fetchone()[0]
                  for table in ("project", "session", "engine_task", "message", "provider_activity_request",
                                "provider_usage_event", "permission_ledger", "permission_policy")}
        assert counts == {"project": 1, "session": 1, "engine_task": 1, "message": 0,
                          "provider_activity_request": 0, "provider_usage_event": 0,
                          "permission_ledger": 0, "permission_policy": 0}
        expected_ids = [baseline["id"]] if phase == "before" else [baseline["id"], final["id"]]
        actual_targets = db.execute("select id from engine_artifact where task_id = ? and kind = 'browser_preview_target' order by id",
                                    (seed["taskID"],)).fetchall()
        assert [row[0] for row in actual_targets] == sorted(expected_ids)
    log = [json.loads(row) for row in (root / f"{phase}-proxy.jsonl").read_text(encoding="utf-8").splitlines()]
    origins = [row for row in log if row.get("stage") == "origin"]
    terminals = [row for row in log if row.get("stage") in ("cut", "released")]
    expected_stages = (["cut", "released", "cut", "released", "released"] if phase == "before"
                       else ["cut", "cut", "released", "cut", "released", "released", "released"])
    expected_targets = [baseline["id"]] * (5 if phase == "before" else 6)
    if phase == "after":
        expected_targets.append(final["id"])
    assert [row["stage"] for row in terminals] == expected_stages
    assert [row["target"]["id"] for row in origins] == [row["target"]["id"] for row in terminals] == expected_targets
    assert [row["status"] for row in origins] == [200] * len(expected_targets)
    results[phase] = {
        "task": seed["taskID"], "gitOriginalCommit": git_root, "originalTrackedBytes": len(notes),
        "counts": counts, "targetIDs": expected_ids,
        "targetReadReceipts": [{"id": origin["requestID"], "target": terminal["target"], "outcome": terminal["stage"]}
                               for origin, terminal in zip(origins, terminals, strict=True)],
    }

(root / "owned-final-check.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
files = ("seed-task.ts", "check-target.mjs", "target-read-proxy.mjs", "audit-owned-data.py", "owned-final-check.json",
         "before-seed.json", "after-seed.json", "before-startup.json", "after-startup.json",
         "before-shutdown.json", "after-shutdown.json", "before-proxy-shutdown.json", "after-proxy-shutdown.json",
         "initial-candidate-startup.json", "initial-candidate-shutdown.json", "before-proxy.jsonl", "after-proxy.jsonl")
for filename in files + tuple(p.name for p in sorted(root.glob("*.jpg"))) + tuple(p.name for p in sorted(root.glob("*-tcp.json"))):
    shutil.copy2(root / filename, artifact / filename)
print(json.dumps({phase: {"counts": row["counts"], "targets": row["targetIDs"], "readCount": len(row["targetReadReceipts"])}
                  for phase, row in results.items()}))