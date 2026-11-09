import json
import os
import sqlite3
import subprocess
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
def report(name):
    return json.loads((root / f"{name}.json").read_text(encoding="utf-8"))

seed = report("seed")
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
results = {}
for phase, original in seed.items():
    directory = Path(original["directory"])
    assert directory.is_relative_to(root)
    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
    note = original["originalNote"].encode()
    assert (directory / "note.txt").read_bytes() == git("show", "HEAD:note.txt") == note
    assert git("rev-parse", "HEAD").decode().strip() == original["head"]
    db = root / f"profile-{phase}/data/opencorvus.db"
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as connection:
        counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0]
                  for table in ["session", "message", "engine_task", "provider_activity_request"]}
        assert counts == {"session": 0, "message": 0, "engine_task": 0, "provider_activity_request": 0}

    proxy = report("before-proxy-observed") if phase == "before" else [
        entry for line in (root / "after-proxy.log").read_text(encoding="utf-8-sig").splitlines()
        if line.startswith("{") and (entry := json.loads(line)).get("source") == "/global/health"]
    finished = {}
    with (root / f"profile-{phase}/log/dev.log").open(encoding="utf-8") as log:
        for line in log:
            if not line.startswith("{"):
                continue
            entry = json.loads(line)
            data = entry.get("data", {})
            if entry.get("service") == "server" and data.get("status") == "completed":
                finished[data["requestID"]] = dict(time=entry["time"], **data)
    matched = []
    for request in proxy:
        receipt = finished[request["requestID"]]
        assert (request["source"], request["target"], request["status"]) == ("/global/health", "/global/automations", 200)
        assert (receipt["path"], receipt["statusCode"]) == (request["target"], request["status"])
        matched.append(dict(proxy=request, upstream=receipt))
    assert len(matched) >= 2
    if phase == "before":
        observed_id = "07aa982d-9c88-43d4-8cdd-9aebb6341e64"
        assert next(row for row in matched if row["proxy"]["requestID"] == observed_id)
    results[phase] = {
        "head": original["head"], "originalBytes": len(note), "counts": counts,
        "matchedProxyAndUpstream": matched,
    }
(root / "owned-final-check.json").write_text(json.dumps({
    "projects": results, "shutdown": report("shutdown-receipts"),
}, indent=2) + "\n", encoding="utf-8")
print(json.dumps({phase: {"identity": row["head"], "counts": row["counts"], "matched": len(row["matchedProxyAndUpstream"])}
                  for phase, row in results.items()}))
