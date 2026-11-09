from pathlib import Path
import json, os, shutil, sqlite3, subprocess

root = Path(os.environ["TEMP"]).resolve() / "opencorvus-iteration-20261109-b73"
artifact = Path("D:/myhexin-local/opencorvus/specs/artifacts/2026-11-09-composer-market-install-continuity")
read = lambda name: json.loads((root / name).read_text(encoding="utf-8"))
seed = read("seed.json")
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
checks = {}
first_installation = None
for phase, original in seed.items():
    profile = (root / f"profile-{phase}").resolve()
    directory = Path(original["directory"]).resolve()
    assert profile.parent == directory.parent == root
    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
    for relative, text in original["files"].items():
        assert git("show", f"HEAD:{relative}") == (directory / relative).read_bytes() == text.encode("utf-8")
    assert git("rev-parse", "HEAD").decode().strip() == original["head"]
    assert not git("diff", "--name-only", "HEAD")
    install_root = (directory / ".opencorvus/expert-squads/builtin/deep-research").resolve()
    assert install_root.is_relative_to(directory) and install_root.is_dir()
    contents = {}
    for file in install_root.rglob("*"):
        if file.is_file():
            assert file.resolve().is_relative_to(install_root)
            contents[file.relative_to(install_root).as_posix()] = file.read_bytes()
    assert contents["expert-squad.jsonc"] and contents["README.md"]
    if first_installation is None:
        first_installation = contents
    else:
        assert contents == first_installation
    db = (profile / "data/opencorvus.db").resolve()
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as connection:
        assert connection.execute("select worktree from project").fetchall() == [(str(directory),)]
        counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0] for table in ["session", "message", "engine_task", "provider_usage_event", "provider_activity_request"]}
        assert counts == {table: 0 for table in counts}
    events = []
    for line in (profile / "log/dev.log").read_text(encoding="utf-8").splitlines():
        try:
            record = json.loads(line)
        except ValueError:
            continue
        data = record.get("data") or {}
        if data.get("path") == "/expert-squad/install-payload":
            events.append({"time": record["time"], **data})
    assert len(events) == 2 and [event["status"] for event in events] == ["started", "completed"]
    assert events[0]["requestID"] == events[1]["requestID"] and events[1]["statusCode"] == 200
    checks[phase] = {"project": str(directory), "head": original["head"], "originalTrackedFiles": len(original["files"]), "counts": counts, "installation": {"root": str(install_root), "files": sorted(contents)}, "installRequests": events}
(root / "owned-final-check.json").write_text(json.dumps(checks, indent=2) + "\n", encoding="utf-8")
for name in ["seed.json", "before-startup.json", "after-startup.json", "before-installed.json", "after-available.json", "after-installed.json", "after-keyboard-attempt.json", "owned-final-check.json", "check-composer-market-install.mjs", "audit-owned-data.py"]:
    shutil.copy2(root / name, artifact / name)
print(json.dumps({phase: {"count": len(item["installation"]["files"]), "counts": item["counts"], "install": item["installRequests"][1]} for phase, item in checks.items()}))
