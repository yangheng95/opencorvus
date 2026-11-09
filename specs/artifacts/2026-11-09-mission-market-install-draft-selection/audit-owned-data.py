from pathlib import Path
import json, os, shutil, sqlite3, subprocess

root = Path(os.environ["TEMP"]).resolve() / "opencorvus-iteration-20261109-b74"
artifact = Path("D:/myhexin-local/opencorvus/specs/artifacts/2026-11-09-mission-market-install-draft-selection")
seed = json.loads((root / "seed.json").read_text(encoding="utf-8"))
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
checks = {}
deep_contents = {}
targets = {"before": ["deep-research"], "after": ["deep-research", "academic-paper-review"]}
for phase, original in seed.items():
    profile = (root / f"profile-{phase}").resolve()
    directory = Path(original["directory"]).resolve()
    assert profile.parent == directory.parent == root
    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
    for relative, value in original["files"].items():
        assert git("show", f"HEAD:{relative}") == (directory / relative).read_bytes() == value.encode("utf-8")
    assert git("rev-parse", "HEAD").decode().strip() == original["head"]
    assert git("diff", "--name-only", "HEAD") == b""
    install_parent = (directory / ".opencorvus/expert-squads/builtin").resolve()
    assert install_parent.is_relative_to(directory)
    assert sorted(p.name for p in install_parent.iterdir() if p.is_dir()) == sorted(targets[phase])
    installations = {}
    for squad in targets[phase]:
        install_root = (install_parent / squad).resolve()
        assert install_root.parent == install_parent
        contents = {}
        for file in install_root.rglob("*"):
            if file.is_file():
                assert file.resolve().is_relative_to(install_root)
                contents[file.relative_to(install_root).as_posix()] = file.read_bytes()
        assert contents["expert-squad.jsonc"] and contents["README.md"]
        installations[squad] = {"root": str(install_root), "files": sorted(contents)}
        if squad == "deep-research":
            deep_contents[phase] = contents
    db = (profile / "data/opencorvus.db").resolve()
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as connection:
        assert connection.execute("select worktree from project").fetchall() == [(str(directory),)]
        counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0] for table in ["session", "message", "engine_task", "provider_usage_event", "provider_activity_request"]}
        counts["mission_sessions"] = connection.execute("select count(*) from session where kind = 'mission'").fetchone()[0]
        assert counts == {table: 0 for table in counts}
    install_events = []
    for line in (profile / "log/dev.log").read_text(encoding="utf-8").splitlines():
        try:
            record = json.loads(line)
        except ValueError:
            continue
        data = record.get("data") or {}
        if data.get("path") == "/expert-squad/install-payload":
            install_events.append({"time": record["time"], **data})
    assert len(install_events) == 2 * len(targets[phase])
    for first, second in zip(install_events[::2], install_events[1::2]):
        assert (first["status"], second["status"], second["statusCode"]) == ("started", "completed", 200)
        assert first["requestID"] == second["requestID"]
    assert len(set(event["requestID"] for event in install_events)) == len(targets[phase])
    checks[phase] = {"project": str(directory), "head": original["head"], "originalTrackedFiles": len(original["files"]), "counts": counts, "installations": installations, "installRequests": install_events}
assert deep_contents["before"] == deep_contents["after"]
(root / "owned-final-check.json").write_text(json.dumps(checks, indent=2) + "\n", encoding="utf-8")
for name in ["seed.json", "before-startup.json", "after-startup.json", "before-installed.json", "after-available.json", "after-academic-paper-review-available.json", "after-installed.json", "after-academic-paper-review-installed.json", "owned-final-check.json", "check-mission-market-install.mjs", "audit-owned-data.py"]:
    shutil.copy2(root / name, artifact / name)
print(json.dumps({phase: {"files": {squad: len(installation["files"]) for squad, installation in item["installations"].items()}, "counts": item["counts"], "install": item["installRequests"][1::2]} for phase, item in checks.items()}))
