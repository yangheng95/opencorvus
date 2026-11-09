from pathlib import Path
import json, os, shutil, sqlite3, subprocess

root = Path(os.environ["TEMP"]).resolve() / "opencorvus-iteration-20261109-b77"
artifact = Path("D:/myhexin-local/opencorvus/specs/artifacts/2026-11-09-scheduled-project-selection-order")
def read(name):
    return json.loads((root / name).read_text(encoding="utf-8"))
seed = read("seed.json")
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
checks = {}
for phase, originals in seed.items():
    profile = (root / f"profile-{phase}").resolve()
    assert profile.parent == root
    baseline = read(f"{phase}-paused-plan.json")
    edited = read(f"{phase}-edited-plan.json")
    [final_plan] = edited["response"]["body"]
    original_order = edited["expected"][:2]
    new_order = edited["expected"] if phase == "after" else [original_order[1], original_order[0], edited["expected"][2]]
    assert final_plan["target"]["projectIds"] == new_order
    if phase == "after":
        assert read("after-edited-plan-post-cancel.json")["response"]["body"] == edited["response"]["body"]
    owned = []
    for label, original in originals.items():
        directory = Path(original["directory"]).resolve()
        assert directory.parent == root
        def git(*args):
            return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
        for relative, content in original["files"].items():
            assert git("show", f"HEAD:{relative}") == (directory / relative).read_bytes() == content.encode("utf-8")
        assert git("rev-parse", "HEAD").decode().strip() == original["head"]
        assert git("diff", "--name-only", "HEAD") == b""
        canonical = baseline["projects"][label]
        assert Path(canonical["directory"]) == directory
        owned.append({"directory": str(directory), "id": canonical["id"], "head": original["head"], "originalTrackedFiles": len(original["files"])})
    db = (profile / "data/opencorvus.db").resolve()
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as conn:
        projects = set(conn.execute("select id, worktree from project").fetchall())
        assert projects == {(entry["id"], entry["directory"]) for entry in owned}
        definitions = conn.execute("select definition_id, id, revision, status from automation order by revision").fetchall()
        ids = [baseline["created"]["body"]["revisionId"], baseline["paused"]["body"]["revisionId"], final_plan["revisionId"]]
        assert definitions == [(final_plan["id"], rev_id, index, status) for index, (rev_id, status) in enumerate(zip(ids, ["active", "paused", "paused"]), 1)]
        memberships = {}
        for rev_id, order in zip(ids, [original_order, original_order, new_order]):
            rows = conn.execute("select position, project_id from automation_project_target where automation_revision_id=? order by position", (rev_id,)).fetchall()
            assert rows == list(enumerate(order))
            memberships[rev_id] = rows
        [fire] = conn.execute("select id, automation_revision_id, origin, scheduled_due_at from automation_fire").fetchall()
        assert fire[1:] == (ids[0], "scheduled", 4071258000000)
        counts = {table: conn.execute(f'select count(*) from "{table}"').fetchone()[0] for table in [
            "session", "message", "engine_task", "automation_fire_frontier", "automation_fire_attempt",
            "automation_run", "provider_usage_event", "provider_activity_request",
        ]}
        assert all(value == 0 for value in counts.values())
    schedule_events = []
    for line in (profile / "log/dev.log").read_text(encoding="utf-8").splitlines():
        try:
            record = json.loads(line)
        except ValueError:
            continue
        data = record.get("data") or {}
        if data.get("method") != "GET" and data.get("path", "").startswith("/global/automations") and data.get("status") == "completed":
            schedule_events.append({"time": record["time"], **data})
    assert [(event["method"], event["path"], event["statusCode"]) for event in schedule_events] == [
        ("POST", "/global/automations", 201),
        ("PATCH", f"/global/automations/{final_plan['id']}", 200),
        ("PATCH", f"/global/automations/{final_plan['id']}", 200),
    ]
    assert schedule_events[0]["requestID"] == baseline["created"]["requestID"]
    assert schedule_events[1]["requestID"] == baseline["paused"]["requestID"]
    checks[phase] = {"ownedProjects": owned, "definitions": definitions, "memberships": memberships, "originalFutureFire": fire, "counts": counts, "scheduleWrites": schedule_events}
(root / "owned-final-check.json").write_text(json.dumps(checks, indent=2) + "\n", encoding="utf-8")
for name in [
    "seed.json", "before-startup.json", "after-startup.json", "before-paused-plan.json", "after-paused-plan.json",
    "before-edited-plan.json", "after-edited-plan.json", "after-edited-plan-post-cancel.json",
    "owned-final-check.json", "check-scheduled-target-order.mjs", "audit-owned-data.py",
]:
    shutil.copy2(root / name, artifact / name)
print(json.dumps({phase: {"counts": data["counts"], "save": data["scheduleWrites"][-1], "memberships": data["memberships"]} for phase, data in checks.items()}))
