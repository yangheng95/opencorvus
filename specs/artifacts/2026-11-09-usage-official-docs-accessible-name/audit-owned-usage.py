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


for phase, project in seed.items():
    directory = Path(project["directory"])
    assert directory.is_relative_to(root)
    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
    note = project["originalNote"].encode()
    assert (directory / "note.txt").read_bytes() == git("show", "HEAD:note.txt") == note
    assert git("rev-parse", "HEAD").decode().strip() == project["head"]
    db = root / f"profile-{phase}/data/opencorvus.db"
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as connection:
        counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0]
                  for table in ["project", "session", "message", "engine_task", "provider_usage_event", "provider_activity_request"]}
        assert counts == {"project": 1, "session": 0, "message": 0, "engine_task": 0,
                          "provider_usage_event": 0, "provider_activity_request": 0}

    with (root / f"profile-{phase}/log/dev.log").open(encoding="utf-8") as log:
        requests = []
        for line in log:
            if not line.startswith("{"):
                continue
            entry = json.loads(line)
            data = entry.get("data", {})
            if entry.get("service") == "server" and data.get("method") == "GET" and data.get("path") == "/global/usage" and data.get("status") == "completed":
                requests.append({"time": entry["time"], "requestID": data["requestID"], "status": data["statusCode"]})
    retained_run = phase
    minimum = 5
    assert len(requests) >= minimum and all(request["status"] == 200 for request in requests)
    results[phase] = {"head": project["head"], "originalBytes": len(note), "counts": counts, "retainedLogRun": retained_run, "actualUsageRequests": requests}

shutdown = report("shutdown-verification")
assert len(shutdown) == 2
for check in shutdown:
    assert check["processPresent"] is False
    assert check["listenerPresent"] is False
    if check["phase"] in {"before", "after", "after-recovered"}:
        assert check["shellExitCode"] == 0
(root / "owned-final-check.json").write_text(json.dumps({"projects": results, "shutdown": shutdown}, indent=2) + "\n", encoding="utf-8")
print(json.dumps({phase: row["counts"] for phase, row in results.items()}))
