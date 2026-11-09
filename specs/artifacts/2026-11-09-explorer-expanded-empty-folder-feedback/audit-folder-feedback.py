from pathlib import Path
from urllib.parse import parse_qs, urlsplit
import json, os, sqlite3, subprocess, sys

root = Path(sys.argv[1]).resolve()
def data(name):
    return json.loads((root / f"{name}.json").read_text(encoding="utf-8"))
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
projects = {}
for phase, item in data("seed").items():
    directory = Path(item["directory"])
    assert directory.is_relative_to(root)
    relative = "plans/reference/note.txt"
    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
    assert git("rev-parse", "HEAD").decode().strip() == item["head"]
    raw = (directory / relative).read_bytes()
    assert raw == b"Owned nonempty Explorer folder control.\n" == git("show", f"HEAD:{relative}")
    drafts = directory / "plans/drafts"
    children = sorted(child.name for child in drafts.iterdir())
    assert children == ([] if phase == "before" else ["draft-note.txt"])
    if phase == "after":
        assert (drafts / "draft-note.txt").read_bytes() == b""
    assert list((directory / "archive").iterdir()) == []
    database = root / f"profile-{phase}/data/opencorvus.db"
    with sqlite3.connect(database.as_uri() + "?mode=ro", uri=True) as connection:
        counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0]
                  for table in ["project","session","message","engine_task","provider_usage_event","provider_activity_request"]}
    assert counts == {"project": 1, "session": 0, "message": 0, "engine_task": 0,
                      "provider_usage_event": 0, "provider_activity_request": 0}
    projects[phase] = {"head": item["head"], "originalBytes": len(raw), "draftEntries": children, "counts": counts}
proxy = [json.loads(line) for line in (root / "folder-error-proxy.log").read_text(encoding="utf-8-sig").splitlines() if '"requestID"' in line]
log = (root / "profile-after/log/dev.log").read_text(encoding="utf-8")
requests = {}
for line in log.splitlines():
    if not line.startswith("{"):
        continue
    event = json.loads(line)
    payload = event.get("data", {})
    if event.get("service") == "server" and payload.get("path") == "/file" and payload.get("status") == "completed":
        requests[payload["requestID"]] = {"time": event["time"], **payload}
matches = []
for item in proxy:
    source = parse_qs(urlsplit(item["source"]).query)
    target = parse_qs(urlsplit(item["target"]).query)
    assert source["directory"] == target["directory"]
    assert source["path"] == ["archive"]
    expected = "missing-owned-archive" if item["status"] == 404 else "archive"
    assert target["path"] == [expected]
    request = requests[item["requestID"]]
    assert (request["method"], request["statusCode"]) == ("GET", item["status"])
    matches.append({"proxy": item, "upstream": request})
assert [row["proxy"]["status"] for row in matches] == [404, 200, 200]
create = data("file-create-requests")
assert len(create) == 1 and create[0]["status"] == 200 and create[0]["path"] == "/file/item"
shutdown = data("shutdown-verification")
assert len(shutdown) == 4
for row in shutdown:
    assert row["status"] == 200
    assert row["shellExitCode"] == 0 and not row["processPresent"] and not row["listenerPresent"]
result = {"projects": projects, "creation": create[0], "matchedFolderReads": matches, "shutdown": shutdown}
(root / "owned-final-check.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"projects": len(projects), "creation": len(create), "matchedFolderReads": len(matches), "shutdown": len(shutdown)}))