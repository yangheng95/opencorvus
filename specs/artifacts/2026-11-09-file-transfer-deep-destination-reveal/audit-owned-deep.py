import json, os, sqlite3, subprocess
from pathlib import Path

root = Path(os.environ["TEMP"]).resolve() / "opencorvus-iteration-20261109-b90"
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
    moves = {file: "move-root/level-two/landing/" + file for file in ("move-a.txt", "move-b.txt")}
    lengths = {}
    for file, content in original["files"].items():
        physical = moves.get(file, file)
        bytes_ = (project / physical).read_bytes()
        assert bytes_ == git("show", "HEAD:" + file) == content.encode("utf-8")
        lengths[physical] = len(bytes_)
    copied = "copy-root/level-two/landing/copied.txt"
    assert (project / copied).read_bytes() == git("show", "HEAD:copy-source.txt")
    assert git("rev-parse", "HEAD").decode().strip() == original["head"]
    db = (profile / "data/opencorvus.db").resolve()
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as conn:
        assert {Path(row[0]) for row in conn.execute("select worktree from project")} == {project}
        counts = {table: conn.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0] for table in tables}
    requests = []
    for line in (profile / "log/dev.log").read_text(encoding="utf-8").splitlines():
        try:
            record = json.loads(line)
        except ValueError:
            continue
        data = record.get("data") or {}
        if (data.get("method"), data.get("path")) in {
            ("POST", "/file/item/copy"), ("PATCH", "/file/item"), ("GET", "/file/content")
        } and data.get("status") == "completed":
            requests.append(data)
    expected = [("POST", "/file/item/copy", 200), ("PATCH", "/file/item", 200), ("PATCH", "/file/item", 200)]
    if phase == "after":
        expected.insert(1, ("GET", "/file/content", 200))
    assert [(record["method"], record["path"], record["statusCode"]) for record in requests] == expected
    evidence[phase] = {"project": str(project), "head": original["head"], "fileLengths": lengths,
                       "copied": copied, "moves": moves, "counts": counts, "requests": requests,
                       "trackedDiff": git("diff", "--name-status", "--no-renames", "HEAD").decode().splitlines()}
(root / "owned-final-check.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
print(json.dumps(evidence))
