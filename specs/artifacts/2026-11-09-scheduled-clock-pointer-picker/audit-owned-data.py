from pathlib import Path
import json, os, shutil, sqlite3, subprocess

root = Path(os.environ["TEMP"]).resolve() / "opencorvus-iteration-20261109-b79"
artifact = Path("D:/myhexin-local/opencorvus/specs/artifacts/2026-11-09-scheduled-clock-pointer-picker")
def read(name):
    return json.loads((root / name).read_text(encoding="utf-8"))
seed = read("seed.json")
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
checks = {}
for phase in ("before", *seed):
    profile = (root / f"profile-{phase}").resolve()
    original = seed.get(phase)
    assert profile.parent == root
    directory = Path(original["directory"]).resolve() if original else None
    if directory:
        assert directory.parent == root
        def git(*args):
            return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
        for relative, content in original["files"].items():
            assert git("show", f"HEAD:{relative}") == (directory / relative).read_bytes() == content.encode("utf-8")
        assert git("rev-parse", "HEAD").decode().strip() == original["head"]
        assert git("diff", "--name-only", "HEAD") == b""
    db = (profile / "data/opencorvus.db").resolve()
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as conn:
        projects = conn.execute("select id, worktree from project").fetchall()
        assert {Path(worktree) for _, worktree in projects} == ({directory} if directory else set())
        rows = conn.execute("select definition_id, id, revision, status, recurrence, scope, name, prompt from automation order by revision").fetchall()
        fires = conn.execute("select id, automation_revision_id, origin, scheduled_due_at from automation_fire").fetchall()
        counts = {table: conn.execute(f'select count(*) from "{table}"').fetchone()[0] for table in [
            "session", "message", "engine_task", "automation_fire_frontier", "automation_fire_attempt",
            "automation_run", "provider_usage_event", "provider_activity_request",
        ]}
        assert all(value == 0 for value in counts.values())
        if phase == "delivery":
            [active] = read("delivery-active.json")["plans"]["body"]
            [paused] = read("delivery-paused.json")["plans"]["body"]
            assert active["id"] == paused["id"]
            assert rows == [(plan["id"], plan["revisionId"], index, plan["status"], plan["recurrence"], "global", plan["name"], plan["prompt"])
                            for index, plan in enumerate([active, paused], 1)]
            [fire] = fires
            assert fire[1:] == (active["revisionId"], "scheduled", active["nextRun"])
        else:
            assert rows == [] and fires == []
    schedule_writes = []
    for line in (profile / "log/dev.log").read_text(encoding="utf-8").splitlines():
        try:
            record = json.loads(line)
        except ValueError:
            continue
        data = record.get("data") or {}
        if data.get("method") != "GET" and data.get("path", "").startswith("/global/automations") and data.get("status") == "completed":
            schedule_writes.append({"time": record["time"], **data})
    expected = [("POST", "/global/automations", 201), ("PATCH", f"/global/automations/{paused['id']}", 200)] if phase == "delivery" else []
    assert [(event["method"], event["path"], event["statusCode"]) for event in schedule_writes] == expected
    checks[phase] = {"project": str(directory) if directory else None, "head": original["head"] if original else None, "counts": counts,
                     "definitions": rows, "futureFires": fires, "scheduleWrites": schedule_writes}
(root / "owned-final-check.json").write_text(json.dumps(checks, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
for name in [
    "seed.json", "before-startup.json", "after-startup.json", "delivery-startup.json",
    "after-empty.json", "delivery-empty.json", "delivery-active.json", "delivery-paused.json",
    "owned-final-check.json", "check-schedule-clock.mjs", "audit-owned-data.py",
]:
    shutil.copy2(root / name, artifact / name)
print(json.dumps(checks, ensure_ascii=True))
