import json
import os
import sqlite3
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

root = Path(sys.argv[1]).resolve()
def report(name):
    return json.loads((root / f"{name}.json").read_text(encoding="utf-8"))

seed = report("seed")
changed = report("routing-correction")
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
results = {}

def query(url):
    return parse_qs(urlsplit(url).query)

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

    proxy_log = (root / f"{phase}-proxy.log").read_text(encoding="utf-8-sig")
    proxy = [entry for line in proxy_log.splitlines() if line.startswith("{")
             and (entry := json.loads(line)).get("source")]
    finished = {}
    with (root / f"profile-{phase}/log/dev.log").open(encoding="utf-8") as log:
        for line in log:
            if not line.startswith("{"):
                continue
            entry = json.loads(line)
            data = entry.get("data", {})
            if entry.get("service") == "server" and data.get("path") == "/global/usage" and data.get("status") == "completed":
                finished[data["requestID"]] = dict(time=entry["time"], **data)
    pairs = []
    for request in proxy:
        upstream = finished[request["requestID"]]
        assert query(request["source"]) == {"period": ["week"], "timeZone": ["Asia/Shanghai"]}
        assert (request["status"], upstream["statusCode"]) == (200, 200)
        pairs.append(dict(proxy=request, upstream=upstream))
    sequence = [query(item["proxy"]["target"])["period"][0] for item in pairs]
    assert sequence == (["year", "year", "year"] if phase == "before" else ["year", "year", "week", "week"])
    if phase == "after":
        corrected_at = datetime.fromisoformat(changed["changedAt"])
        assert datetime.fromisoformat(pairs[1]["upstream"]["time"]) < corrected_at < datetime.fromisoformat(pairs[2]["upstream"]["time"])
        assert pairs[-1]["proxy"]["requestID"] == report("after-recovered-tcp")["checks"][0]["requestID"]

    results[phase] = {"head": project["head"], "originalBytes": len(note), "counts": counts,
                      "matchedProxyAndUpstream": pairs}
(root / "owned-final-check.json").write_text(json.dumps({
    "projects": results, "routingCorrection": changed, "shutdown": report("shutdown-receipts"),
}, indent=2) + "\n", encoding="utf-8")
print(json.dumps({phase: {"counts": row["counts"], "matched": len(row["matchedProxyAndUpstream"])}
                  for phase, row in results.items()}))
