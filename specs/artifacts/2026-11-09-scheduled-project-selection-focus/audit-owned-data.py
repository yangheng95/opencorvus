from pathlib import Path
import json, os, shutil, sqlite3, subprocess

root = Path(os.environ["TEMP"]).resolve() / "opencorvus-iteration-20261109-b76"
artifact = Path("D:/myhexin-local/opencorvus/specs/artifacts/2026-11-09-scheduled-project-selection-focus")
def read(name):
    return json.loads((root / name).read_text(encoding="utf-8"))
seed = read("seed.json")
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
checks = {}
for phase, originals in seed.items():
    profile = (root / f"profile-{phase}").resolve()
    assert profile.parent == root
    discovery = read(f"{phase}-read-check.json")["discovery"]["body"]["projects"]
    owned = []
    for original in originals.values():
        directory = Path(original["directory"]).resolve()
        assert directory.parent == root
        def git(*args):
            return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
        for relative, content in original["files"].items():
            assert git("show", f"HEAD:{relative}") == (directory / relative).read_bytes() == content.encode("utf-8")
        assert git("rev-parse", "HEAD").decode().strip() == original["head"]
        assert git("diff", "--name-only", "HEAD") == b""
        [discovered] = [entry for entry in discovery if Path(entry["directory"]) == directory]
        owned.append({"directory": str(directory), "id": discovered["id"], "head": original["head"], "originalTrackedFiles": len(original["files"])})
    db = (profile / "data/opencorvus.db").resolve()
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as conn:
        projects = set(conn.execute("select id, worktree from project").fetchall())
        assert projects == {(entry["id"], entry["directory"]) for entry in owned}
        counts = {table: conn.execute(f'select count(*) from "{table}"').fetchone()[0] for table in [
            "session", "message", "engine_task", "automation", "automation_fire", "automation_run",
            "provider_usage_event", "provider_activity_request",
        ]}
        assert all(value == 0 for value in counts.values())
    schedule_events = []
    for line in (profile / "log/dev.log").read_text(encoding="utf-8").splitlines():
        try:
            record = json.loads(line)
        except ValueError:
            continue
        data = record.get("data") or {}
        if data.get("path", "").startswith("/global/automations") and data.get("status") == "completed":
            schedule_events.append({"time": record["time"], **data})
    assert schedule_events and all((event["method"], event["statusCode"]) == ("GET", 200) for event in schedule_events)
    checks[phase] = {"ownedProjects": owned, "counts": counts, "scheduleReads": schedule_events}
(root / "owned-final-check.json").write_text(json.dumps(checks, indent=2) + "\n", encoding="utf-8")
for name in ["seed.json", "before-startup.json", "after-startup.json", "before-read-check.json", "after-read-check.json", "owned-final-check.json", "check-scheduled-target-focus.mjs", "audit-owned-data.py"]:
    shutil.copy2(root / name, artifact / name)
print(json.dumps(checks))
