from pathlib import Path
import json, os, shutil, sqlite3, subprocess

root = Path(os.environ["TEMP"]) / "opencorvus-iteration-20261109-b48"
artifact = Path("D:/myhexin-local/opencorvus/specs/artifacts/2026-11-09-archive-continuation-focus")
seed = json.loads((root / "seed.json").read_text(encoding="utf-8"))
edge = json.loads((root / "empty-tail-runtime.json").read_text(encoding="utf-8"))
restored = {row["id"] for row in edge["restored"]}
assert len(restored) == 2
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
checks = {}
for phase, original in seed.items():
    directory = Path(original["directory"])
    assert directory.is_relative_to(root)
    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
    original_bytes = original["notes"].encode("utf-8")
    assert (directory / "notes.txt").read_bytes() == original_bytes
    assert git("show", "HEAD:notes.txt") == original_bytes
    assert git("rev-parse", "HEAD").decode().strip() == original["head"]
    archive = json.loads((root / f"{phase}-archive.json").read_text(encoding="utf-8"))
    intentional = restored if phase == "empty" else set()
    if phase == "empty":
        assert intentional == {row["id"] for row in archive["pages"][-1]["rows"]}
    expected = []
    for row in archive["sessions"]:
        expected.append((row["id"], row["title"], row["directory"], row["projectID"], row["created"], None if row["id"] in intentional else row["archived"]))
    db = root / f"profile-{phase}/data/opencorvus.db"
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as connection:
        records = connection.execute("select id, title, directory, project_id, time_created, time_archived from session order by id").fetchall()
        assert records == sorted(expected)
        counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0] for table in ["project", "session", "message", "engine_task"]}
        assert counts == {"project": 1, "session": 102 if phase == "empty" else 202, "message": 0, "engine_task": 0}
    config = root / f"profile-{phase}/config"
    config_listing = sorted(p.relative_to(config).as_posix() for p in config.rglob("*") if p.is_file())
    assert config_listing == []
    checks[phase] = {"gitOriginalBytes": len(original_bytes), "head": original["head"], "gitStatus": git("status", "--short").decode().splitlines(), "counts": counts, "sessionIdentityTitleAndCreationExact": len(expected), "archivedAsSeeded": len(expected) - len(intentional), "intentionallyRestored": sorted(intentional), "configFilePaths": config_listing}
(root / "owned-final-check.json").write_text(json.dumps(checks, indent=2) + "\n", encoding="utf-8")
for name in ["seed.json", "before-archive.json", "after-archive.json", "empty-archive.json", "before-online-tcp.json", "after-online-tcp.json", "empty-tail-runtime.json", "before-startup.json", "after-startup.json", "empty-startup.json", "owned-final-check.json", "initialize-archive.ts", "check-archive-tcp.mjs", "restore-edge-tail.mjs", "audit-owned-data.py"]:
    shutil.copy2(root / name, artifact / name)
print(json.dumps(checks))