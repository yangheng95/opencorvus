from pathlib import Path
import json, os, shutil, sqlite3, subprocess

root = Path(os.environ["TEMP"]) / "opencorvus-iteration-20261109-b63"
artifact = Path("D:/myhexin-local/opencorvus/specs/artifacts/2026-11-09-mission-skill-catalog-issue-details")
seed = json.loads((root / "seed.json").read_text(encoding="utf-8"))
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
repaired = ".opencorvus/mission-skills/broken-demo/SKILL.md"
checks = {}
for phase, original in seed.items():
    directory = Path(original["directory"]).resolve()
    assert directory.is_relative_to(root.resolve())
    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
    changed = []
    for relative, text in original["files"].items():
        expected = text.encode("utf-8")
        assert git("show", f"HEAD:{relative}") == expected
        actual = (directory / relative).read_bytes()
        if phase == "after" and relative == repaired:
            corrected = expected.replace(b"---\n", b"---\nname: repaired-demo\n", 1)
            assert actual == corrected
            changed.append(relative)
        else:
            assert actual == expected
    assert git("rev-parse", "HEAD").decode().strip() == original["head"]
    assert git("diff", "--name-only", "HEAD").decode().splitlines() == changed
    db = root / f"profile-{phase}/data/opencorvus.db"
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as connection:
        counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0] for table in ["project", "session", "message", "engine_task", "provider_usage_event", "provider_activity_request"]}
        assert counts == {"project": 1, "session": 0, "message": 0, "engine_task": 0, "provider_usage_event": 0, "provider_activity_request": 0}
    config = root / f"profile-{phase}/config"
    config_files = sorted(path.relative_to(config).as_posix() for path in config.rglob("*") if path.is_file())
    assert config_files == []
    checks[phase] = {"head": original["head"], "originalTrackedFiles": len(original["files"]), "correctedFixtureFiles": changed, "status": git("status", "--short").decode().splitlines(), "counts": counts, "profileConfigFiles": config_files}

(root / "owned-final-check.json").write_text(json.dumps(checks, indent=2) + "\n", encoding="utf-8")
for name in ["seed.json", "before-tcp.json", "after-tcp.json", "repaired-tcp.json", "before-startup.json", "after-startup.json", "owned-final-check.json", "check-project-tcp.mjs", "audit-owned-data.py"]:
    shutil.copy2(root / name, artifact / name)
print(json.dumps(checks))
