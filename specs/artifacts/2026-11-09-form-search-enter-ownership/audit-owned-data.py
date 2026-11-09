from pathlib import Path
import json, os, shutil, sqlite3, subprocess

root = Path(os.environ["TEMP"]).resolve() / "opencorvus-iteration-20261109-b75"
artifact = Path("D:/myhexin-local/opencorvus/specs/artifacts/2026-11-09-form-search-enter-ownership")
def read(name):
    return json.loads((root / name).read_text(encoding="utf-8"))
seed = read("seed.json")
expected = read("expected-draft.json")
[mission] = read("after-saved.json")["missions"]["body"]
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
checks = {}
for phase, original in seed.items():
    profile = (root / f"profile-{phase}").resolve()
    directory = Path(original["directory"]).resolve()
    assert profile.parent == directory.parent == root
    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
    for relative, content in original["files"].items():
        assert git("show", f"HEAD:{relative}") == (directory / relative).read_bytes() == content.encode("utf-8")
    assert git("rev-parse", "HEAD").decode().strip() == original["head"]
    assert git("diff", "--name-only", "HEAD") == b""
    db = (profile / "data/opencorvus.db").resolve()
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as conn:
        [(project_id, worktree)] = conn.execute("select id, worktree from project").fetchall()
        assert Path(worktree) == directory
        counts = {table: conn.execute(f'select count(*) from "{table}"').fetchone()[0] for table in [
            "message", "engine_task", "automation", "automation_fire", "automation_run",
            "provider_usage_event", "provider_activity_request",
        ]}
        assert all(value == 0 for value in counts.values())
        rows = conn.execute("select id, project_id, directory, title, kind, metadata from session").fetchall()
        draft = None
        if phase == "after":
            [(session_id, parent_project_id, cwd, title, kind, metadata)] = rows
            assert (session_id, parent_project_id, Path(cwd), title, kind) == (mission["sessionID"], project_id, directory, expected["title"], "mission")
            metadata = json.loads(metadata)["mission"]
            assert metadata["id"] == mission["missionID"]
            assert Path(metadata["cwd"]) == directory
            assert metadata["productPillar"] == "work"
            assert metadata["pendingPrompt"] == {"text": expected["request"]}
            assert metadata["visibleExpertSquadIDs"] == ["dynamic"]
            draft = {"sessionID": session_id, "projectID": project_id, "title": title, "kind": kind, "mission": metadata}
        else:
            assert rows == []
        counts["session"] = len(rows)
    events = []
    for line in (profile / "log/dev.log").read_text(encoding="utf-8").splitlines():
        try:
            record = json.loads(line)
        except ValueError:
            continue
        data = record.get("data") or {}
        if data.get("method") != "GET" and data.get("path", "").startswith(("/mission/", "/global/automations", "/panel/knowledge/memory/search")):
            events.append({"time": record["time"], **data})
    paths = ["/mission/draft", "/panel/knowledge/memory/search"] if phase == "after" else []
    assert [event["path"] for event in events] == [route for route in paths for _ in range(2)]
    for first, second in zip(events[::2], events[1::2]):
        assert (first["method"], first["status"], second["status"], second["statusCode"]) == ("POST", "started", "completed", 200)
        assert first["requestID"] == second["requestID"]
    checks[phase] = {"project": str(directory), "head": original["head"], "originalTrackedFiles": len(original["files"]), "counts": counts, "draft": draft, "requests": events}
(root / "owned-final-check.json").write_text(json.dumps(checks, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
for name in ["seed.json", "expected-draft.json", "before-startup.json", "after-startup.json", "before-empty.json", "after-empty.json", "after-saved.json", "owned-final-check.json", "check-form-search-enter.mjs", "audit-owned-data.py"]:
    shutil.copy2(root / name, artifact / name)
print(json.dumps(checks, ensure_ascii=True))
