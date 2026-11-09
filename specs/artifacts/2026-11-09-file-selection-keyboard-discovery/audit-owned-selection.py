import json, os, sqlite3, subprocess
from pathlib import Path

root = Path(os.environ["TEMP"]).resolve() / "opencorvus-iteration-20261109-b84"
seed = json.loads((root / "seed.json").read_text(encoding="utf-8"))
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
tables = ("session", "message", "engine_task", "automation_run", "provider_usage_event", "provider_activity_request")
evidence = {}
for phase, original in seed.items():
    directory = Path(original["directory"]).resolve()
    profile = (root / f"profile-{phase}").resolve()
    assert directory.parent == profile.parent == root

    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
    for file, content in original["files"].items():
        assert (directory / file).read_bytes() == git("show", "HEAD:" + file) == content.encode("utf-8")
    assert git("rev-parse", "HEAD").decode().strip() == original["head"]
    assert git("diff", "--name-only", "HEAD") == b""

    db = (profile / "data/opencorvus.db").resolve()
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as conn:
        projects = conn.execute("select worktree from project").fetchall()
        assert {Path(row[0]) for row in projects} == {directory}
        counts = {table: conn.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0] for table in tables}
        assert all(value == 0 for value in counts.values())
    writes = []
    for line in (profile / "log/dev.log").read_text(encoding="utf-8").splitlines():
        try:
            record = json.loads(line)
        except ValueError:
            continue
        data = record.get("data") or {}
        if data.get("method") == "POST" and data.get("path") == "/file/item/copy" and data.get("status") == "completed":
            writes.append(data)
    expected = [200, 200] if phase == "delivery" else []
    assert [record["statusCode"] for record in writes] == expected
    evidence[phase] = {"project": str(directory), "head": original["head"], "trackedOriginals": list(original["files"]),
                       "counts": counts, "copyWrites": writes}
(root / "owned-final-check.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
print(json.dumps(evidence))
