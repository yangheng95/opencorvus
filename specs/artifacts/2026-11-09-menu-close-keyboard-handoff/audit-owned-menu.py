import json, os, sqlite3, subprocess
from pathlib import Path

root = Path(os.environ["TEMP"]).resolve() / "opencorvus-iteration-20261109-b86"
seed = json.loads((root / "seed.json").read_text(encoding="utf-8"))
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
tables = ("session", "message", "engine_task", "automation_run", "provider_usage_event", "provider_activity_request")
evidence = {}
for phase, original in seed.items():
    project = Path(original["directory"]).resolve()
    profile = (root / f"profile-{phase}").resolve()
    assert project.parent == profile.parent == root
    def git(*args):
        return subprocess.check_output(["git", "-C", str(project), *args], env=env)
    files = {}
    for file, content in original["files"].items():
        physical = (project / file).read_bytes()
        assert physical == git("show", "HEAD:" + file) == content.encode("utf-8")
        files[file] = len(physical)
    assert git("rev-parse", "HEAD").decode().strip() == original["head"]
    db = (profile / "data/opencorvus.db").resolve()
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as conn:
        assert {Path(row[0]) for row in conn.execute("select worktree from project")} == {project}
        counts = {table: conn.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0] for table in tables}
    reads, writes = [], []
    for line in (profile / "log/dev.log").read_text(encoding="utf-8").splitlines():
        try:
            record = json.loads(line)
        except ValueError:
            continue
        data = record.get("data") or {}
        if data.get("status") != "completed" or not (data.get("path") or "").startswith("/file"):
            continue
        if data.get("method") == "GET" and data.get("path") == "/file/content":
            reads.append(data)
        if data.get("method") in {"POST", "PUT", "PATCH", "DELETE"}:
            writes.append(data)
    assert [(record["method"], record["statusCode"]) for record in reads] == [("GET", 200)]
    evidence[phase] = {"project": str(project), "head": original["head"], "fileLengths": files,
                       "counts": counts, "editorReads": reads, "fileWrites": writes,
                       "trackedDiff": git("diff", "--name-status", "HEAD").decode().splitlines()}
(root / "owned-final-check.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
print(json.dumps(evidence))
