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
def proxy(port):
    return dict(url=f"http://127.0.0.1:{port}", llmProvider=False, webResearch=False) if port else None

expected = {"project-before": 31294, "sibling-before": None, "project-after": 31296, "sibling-after": 31297}
projects = {}
for name, original in seed.items():
    directory = Path(original["directory"])
    assert directory.is_relative_to(root)
    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
    original_bytes = original["originalNote"].encode()
    assert (directory / "note.txt").read_bytes() == git("show", "HEAD:note.txt") == original_bytes
    assert git("rev-parse", "HEAD").decode().strip() == original["head"]
    config_file = directory / ".opencorvus/opencorvus.jsonc"
    current = json.loads(config_file.read_text(encoding="utf-8"))
    saved = current.get("network", {}).get("proxy")
    assert saved == proxy(expected[name])
    projects[name] = {"head": original["head"], "originalBytes": len(original_bytes), "proxy": saved}

runtime = {}
for phase, write_count in [("before", 1), ("after", 2)]:
    db = root / f"profile-{phase}/data/opencorvus.db"
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as connection:
        counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0]
                  for table in ["project", "session", "message", "engine_task", "provider_activity_request"]}
        assert counts == {"project": 2, "session": 0, "message": 0, "engine_task": 0, "provider_activity_request": 0}
    receipts = []
    with (root / f"profile-{phase}/log/dev.log").open(encoding="utf-8") as log:
        for line in log:
            if not line.startswith("{"):
                continue
            entry = json.loads(line)
            data = entry.get("data", {})
            if entry.get("service") == "server" and data.get("status") == "completed" and data.get("method") == "PATCH" and data.get("path") == "/config":
                receipts.append(dict(time=entry["time"], **data))
    assert [entry["statusCode"] for entry in receipts] == [200] * write_count
    runtime[phase] = {"counts": counts, "projectConfigPatchReceipts": receipts}

result = {"projects": projects, "runtime": runtime, "shutdown": report("shutdown-receipts")}
(root / "owned-final-check.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result))
