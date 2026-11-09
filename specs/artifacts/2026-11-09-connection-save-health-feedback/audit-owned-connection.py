import json
import os
import re
import sqlite3
import subprocess
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
seed = json.loads((root / "seed.json").read_text(encoding="utf-8"))
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
def report(name):
    return json.loads((root / f"{name}.json").read_text(encoding="utf-8"))

def request_receipts(phase):
    path = root / f"profile-{phase}/log/dev.log"
    selected = []
    with path.open(encoding="utf-8") as log:
        for line in log:
            if not line.startswith("{"):
                continue
            entry = json.loads(line)
            data = entry.get("data", {})
            if (entry.get("service") == "server" and data.get("status") == "completed"
                and data.get("method") == "GET" and data.get("path") in ("/global/health", "/missing-prefix/global/health")):
                selected.append(dict(time=entry["time"], **data))
    return selected

after_id = next(re.search(r"Request ID: (\S+)", line).group(1) for line in report("after-observed")["details"] if line.startswith("Request ID: "))
matched = next(row for row in request_receipts("after") if row["requestID"] == after_id)
assert (matched["path"], matched["statusCode"]) == ("/missing-prefix/global/health", 400)
recovery = request_receipts("recovery")
external_id = report("recovery-tcp")["checks"][0]["requestID"]
external = next(row for row in recovery if row["requestID"] == external_id)
browser = next(row for row in recovery if row["statusCode"] == 200)
assert browser["time"] < external["time"]

projects = {}
for phase, original in seed.items():
    path = Path(original["directory"])
    assert path.is_relative_to(root)
    def git(*args):
        return subprocess.check_output(["git", "-C", str(path), *args], env=env)
    assert git("rev-parse", "HEAD").decode().strip() == original["head"]
    note = original["originalNote"].encode("utf-8")
    assert (path / "note.txt").read_bytes() == git("show", "HEAD:note.txt") == note
    db = root / f"profile-{phase}/data/opencorvus.db"
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as connection:
        counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0]
                  for table in ["session", "message", "engine_task", "provider_activity_request"]}
        assert counts == {"session": 0, "message": 0, "engine_task": 0, "provider_activity_request": 0}
    projects[phase] = {"head": original["head"], "originalBytes": len(note), "counts": counts}

summary = {"matchingPageDiagnostic": matched, "automaticRecoveryProbe": browser,
           "independentRecoveryProbe": external, "isolatedProjects": projects,
           "shutdown": report("shutdown-receipts")}
(root / "owned-final-check.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
print(json.dumps(summary))
