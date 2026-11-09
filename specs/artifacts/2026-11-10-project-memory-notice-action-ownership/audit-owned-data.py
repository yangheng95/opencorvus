import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess

root = Path(os.environ["TEMP"]).resolve() / "opencorvus-iteration-20261110-b141"
artifact = Path("D:/myhexin-local/opencorvus/specs/artifacts/2026-11-10-project-memory-notice-action-ownership")
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")

def load(name):
    return json.loads((root / f"{name}.json").read_text(encoding="utf-8"))

results = {}
for phase in ("before", "after"):
    seeds = load(f"{phase}-seed")
    settled = load(f"{phase}-settled-tcp")
    final_flags = [True, phase == "after"]
    projects = []
    if phase == "after":
        initial = load("after-initial-tcp")
        failed = load("after-failed-tcp")
        assert [p["content"] for p in initial] == [p["content"] for p in failed] == [p["content"] for p in settled] == ["", ""]
    with sqlite3.connect((root / f"profile-{phase}/data/opencorvus.db").as_uri() + "?mode=ro", uri=True) as db:
        counts = {table: db.execute(f"select count(*) from {table}").fetchone()[0]
                  for table in ("project", "session", "engine_task", "message", "provider_activity_request",
                                "provider_usage_event", "permission_ledger", "memory_file", "memory_chunk")}
        assert counts == {"project": 2, "session": 0, "engine_task": 0, "message": 0, "provider_activity_request": 0,
                          "provider_usage_event": 0, "permission_ledger": 0, "memory_file": 2, "memory_chunk": 2}
        for index, (seed, confirmed, flag) in enumerate(zip(seeds, settled, final_flags, strict=True)):
            key = "ab"[index]
            directory = Path(seed["directory"]).resolve()
            assert directory == root / f"project-{phase}-{key}"
            def git(*args):
                return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
            note = f"Owned project memory notice {phase} {key}\n".encode()
            assert git("show", "HEAD:notes.txt") == (directory / "notes.txt").read_bytes() == note
            assert git("rev-parse", "HEAD").decode().strip() == git("rev-list", "--max-parents=0", "HEAD").decode().strip()
            row = db.execute("select c.content from memory_chunk c join memory_file f on c.file_id=f.id where f.project_id=? and f.kind='project_context' and f.key='project-memory-document'",
                             (seed["projectID"],)).fetchone()
            envelope = json.loads(row[0])
            assert envelope["markdown"] == "" and envelope["revision"] == 0 and envelope["tokenCount"] == 0
            expected = {name: seed[name] for name in ("generation", "status", "message")} | {"acknowledged": flag}
            assert envelope["notice"] == confirmed["notice"] == expected
            projects.append({"projectID": seed["projectID"], "notice": expected, "originalTrackedBytes": len(note),
                             "gitHead": git("rev-parse", "HEAD").decode().strip(), "protectedDocument": {"revision": 0, "content": ""}})
    entries = [json.loads(row) for row in (root / f"{phase}-proxy.jsonl").read_text(encoding="utf-8").splitlines()]
    origins = [row for row in entries if row.get("stage") == "origin"]
    outcomes = [row for row in entries if row.get("stage") in ("client-closed", "before-origin-cut", "released")]
    assert [row["stage"] for row in outcomes] == (["client-closed"] if phase == "before" else ["client-closed", "before-origin-cut", "before-origin-cut", "before-origin-cut", "released"])
    assert [(row["receipt"], row["status"], row["result"]["acknowledged"]) for row in origins] == ([(1, 200, True)] if phase == "before" else [(1, 200, True), (5, 200, True)])
    results[phase] = {"projects": projects, "counts": counts, "originalAcknowledgements": origins, "browserOutcomes": outcomes}

(root / "owned-final-check.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
files = ("seed-notices.ts", "check-notices.mjs", "before-notice-ack-proxy.mjs", "after-notice-ack-proxy.mjs",
         "audit-owned-data.py", "owned-final-check.json", "before-seed.json", "after-seed.json",
         "before-startup.json", "after-startup.json", "before-shutdown.json", "after-shutdown.json", "candidate-startup.json", "candidate-shutdown.json",
         "before-proxy-shutdown.json", "after-proxy-shutdown.json", "before-proxy.jsonl", "after-proxy.jsonl")
for name in files + tuple(p.name for p in sorted(root.glob("*.jpg"))) + tuple(p.name for p in sorted(root.glob("*-tcp.json"))):
    shutil.copy2(root / name, artifact / name)
print(json.dumps({phase: {"counts": row["counts"], "acknowledged": [p["notice"]["acknowledged"] for p in row["projects"]]}
                  for phase, row in results.items()}))