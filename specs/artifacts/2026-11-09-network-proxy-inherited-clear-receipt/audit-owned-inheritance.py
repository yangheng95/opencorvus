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

result = {}
for phase, project in seed.items():
    directory = Path(project["directory"])
    assert directory.is_relative_to(root)
    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
    original = project["originalNote"].encode()
    assert (directory / "note.txt").read_bytes() == git("show", "HEAD:note.txt") == original
    assert git("rev-parse", "HEAD").decode().strip() == project["head"]
    intermediate = report(f"{phase}-inherited-disk")
    assert intermediate == {"project": None, "global": proxy(31298)}
    config_file = directory / ".opencorvus/opencorvus.jsonc"
    global_file = root / f"profile-{phase}/config/opencorvus.jsonc"
    def saved(file):
        return json.loads(file.read_text(encoding="utf-8")).get("network", {}).get("proxy")
    final = {"project": saved(config_file), "global": saved(global_file)}
    assert final == {"project": proxy(31300 if phase == "after" else None), "global": proxy(31298)}
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
            if entry.get("service") == "server" and data.get("status") == "completed" and data.get("method") == "PATCH" and data.get("path") in {"/config", "/global/config"}:
                receipts.append(dict(time=entry["time"], **data))
    assert [(entry["path"], entry["statusCode"]) for entry in receipts] == [
        ("/global/config", 200),
        ("/config", 200),
        ("/config", 200),
    ] + ([("/config", 200)] if phase == "after" else [])
    seed_request_ids = [row["requestID"] for row in report(f"{phase}-seed-tcp")["checks"][:2]]
    assert [entry["requestID"] for entry in receipts[:2]] == seed_request_ids
    result[phase] = {
        "head": project["head"], "originalBytes": len(original), "counts": counts,
        "intermediate": intermediate, "final": final, "orderedPatchReceipts": receipts,
    }
(root / "owned-final-check.json").write_text(json.dumps({
    "projects": result, "shutdown": report("shutdown-receipts"),
}, indent=2) + "\n", encoding="utf-8")
print(json.dumps({phase: {"counts": row["counts"], "writes": len(row["orderedPatchReceipts"]), "final": row["final"]}
                  for phase, row in result.items()}))
