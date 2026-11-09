from pathlib import Path
import json, os, shutil, sqlite3, subprocess

root = Path(os.environ["TEMP"]).resolve() / "opencorvus-iteration-20261109-b72"
artifact = Path("D:/myhexin-local/opencorvus/specs/artifacts/2026-11-09-expert-squad-market-installation-identity")
read = lambda name: json.loads((root / name).read_text(encoding="utf-8"))
seed = read("seed.json")
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
checks = {}
package_contents = None
for phase, original in seed.items():
    profile = (root / f"profile-{phase}").resolve()
    assert profile.parent == root
    git_projects = {}
    for record in [original, original["blocked"]]:
        directory = Path(record["directory"]).resolve()
        assert directory.parent == root
        def git(*args):
            return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
        for relative, text in record["files"].items():
            assert git("show", f"HEAD:{relative}") == (directory / relative).read_bytes() == text.encode("utf-8")
        assert git("rev-parse", "HEAD").decode().strip() == record["head"]
        assert not git("diff", "--name-only", "HEAD")
        git_projects[str(directory)] = {"head": record["head"], "trackedFiles": len(record["files"])}
    for relative, text in original["globalFiles"].items():
        assert (profile / relative).read_bytes() == text.encode("utf-8")
    installed_root = (Path(original["directory"]) / ".opencorvus/expert-squads/builtin/deep-research").resolve()
    assert installed_root.is_relative_to(root) and installed_root.is_dir()
    source_files = {}
    for file in installed_root.rglob("*"):
        if file.is_file():
            assert file.resolve().is_relative_to(installed_root)
            source_files[file.relative_to(installed_root).as_posix()] = file.read_bytes()
    assert source_files["expert-squad.jsonc"] and source_files["README.md"]
    if package_contents is None:
        package_contents = source_files
    else:
        assert source_files == package_contents
    db = (profile / "data/opencorvus.db").resolve()
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as connection:
        actual_projects = {row[0] for row in connection.execute("select worktree from project")}
        assert actual_projects == set(git_projects)
        counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0] for table in ["session", "message", "engine_task", "provider_usage_event", "provider_activity_request"]}
        assert counts == {table: 0 for table in counts}
    events = []
    for line in (profile / "log/dev.log").read_text(encoding="utf-8").splitlines():
        try:
            event = json.loads(line)
        except ValueError:
            continue
        data = event.get("data") or {}
        if data.get("path") == "/expert-squad/install-payload" and data.get("status") == "completed":
            events.append({key: data[key] for key in ("method", "path", "requestID", "statusCode")})
    assert sorted(event["statusCode"] for event in events) == [200, 400]
    assert next(event["requestID"] for event in events if event["statusCode"] == 400) == read(f"{phase}-blocked.json")["install"]["requestID"]
    if phase == "before":
        assert next(event["requestID"] for event in events if event["statusCode"] == 200) == read("before-catalog-advance.json")["installed"][0]["requestID"]
    checks[phase] = {"projects": git_projects, "globalOriginalFiles": sorted(original["globalFiles"]), "bundledProjectInstall": {"root": str(installed_root), "files": sorted(source_files)}, "runtimeCounts": counts, "actualInstallRequests": events}
(root / "owned-final-check.json").write_text(json.dumps(checks, indent=2) + "\n", encoding="utf-8")
for name in ["seed.json", "before-startup.json", "before-ui-startup.json", "after-startup.json", "before-initial.json", "before-installed.json", "before-blocked.json", "before-catalog-advance.json", "before-composer-query.json", "after-initial.json", "after-installed.json", "after-blocked.json", "after-composer-query.json", "owned-final-check.json", "check-market-installation-identity.mjs", "advance-owned-catalog.mjs", "audit-owned-data.py"]:
    shutil.copy2(root / name, artifact / name)
print(json.dumps({phase: {"projects": len(item["projects"]), "fileCount": len(item["bundledProjectInstall"]["files"]), "counts": item["runtimeCounts"], "installs": item["actualInstallRequests"]} for phase, item in checks.items()}))
