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
def expected_proxy(port):
    return dict(url=f"http://127.0.0.1:{port}", llmProvider=False, webResearch=False)

result = {}
for phase, project in seed.items():
    directory = Path(project["directory"])
    assert directory.is_relative_to(root)
    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
    original = project["originalNote"].encode()
    assert (directory / "note.txt").read_bytes() == git("show", "HEAD:note.txt") == original
    assert git("rev-parse", "HEAD").decode().strip() == project["head"]
    config = json.loads((directory / ".opencorvus/opencorvus.jsonc").read_text(encoding="utf-8"))
    saved = config["network"]["proxy"]
    assert saved == expected_proxy(31302 if phase == "before" else 31303)
    db = root / f"profile-{phase}/data/opencorvus.db"
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as connection:
        counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0]
                  for table in ["project", "session", "message", "engine_task", "provider_activity_request"]}
        assert counts == {"project": 1, "session": 0, "message": 0, "engine_task": 0, "provider_activity_request": 0}

    receipts = []
    with (root / f"profile-{phase}/log/dev.log").open(encoding="utf-8") as log:
        for line in log:
            if not line.startswith("{"):
                continue
            entry = json.loads(line)
            data = entry.get("data", {})
            if entry.get("service") == "server" and data.get("status") == "completed" and data.get("method") == "PATCH" and data.get("path") == "/config":
                receipts.append(dict(time=entry["time"], **data))
    assert [entry["statusCode"] for entry in receipts] == ([200, 200] if phase == "before" else [200, 200, 200])
    result[phase] = {
        "head": project["head"], "originalBytes": len(original), "counts": counts, "savedProxy": saved,
        "orderedPatchReceipts": receipts,
    }
(root / "owned-final-check.json").write_text(json.dumps({
    "projects": result, "shutdown": report("shutdown-receipts"),
}, indent=2) + "\n", encoding="utf-8")
print(json.dumps({phase: {"counts": row["counts"], "writes": len(row["orderedPatchReceipts"]), "saved": row["savedProxy"]}
                  for phase, row in result.items()}))
