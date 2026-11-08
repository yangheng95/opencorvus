from pathlib import Path
import json, os, shutil, sqlite3, subprocess

root = Path(os.environ["TEMP"]) / "opencorvus-iteration-20261109-b47"
artifact = Path("D:/myhexin-local/opencorvus/specs/artifacts/2026-11-09-archive-page-read-failure")
seed = json.loads((root / "seed.json").read_text(encoding="utf-8"))
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
    seed_archive = json.loads((root / f"{phase}-archive.json").read_text(encoding="utf-8"))
    db = root / f"profile-{phase}/data/opencorvus.db"
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as connection:
        records = connection.execute("select id, title, directory, project_id, time_created, time_archived from session order by id").fetchall()
        expected = sorted(tuple(row[k] for k in ["id", "title", "directory", "projectID", "created", "archived"]) for row in seed_archive["sessions"])
        assert records == expected
        counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0] for table in ["project", "session", "message", "engine_task"]}
        assert counts == {"project": 1, "session": 102, "message": 0, "engine_task": 0}
    config = root / f"profile-{phase}/config"
    config_listing = sorted(p.relative_to(config).as_posix() for p in config.rglob("*") if p.is_file())
    assert config_listing == []
    checks[phase] = {"gitOriginalBytes": len(original_bytes), "head": original["head"], "gitStatus": git("status", "--short").decode().splitlines(), "counts": counts, "archiveSessionIdentityTitleCreationAndArchiveExact": len(expected), "configFilePaths": config_listing}
(root / "owned-final-check.json").write_text(json.dumps(checks, indent=2) + "\n", encoding="utf-8")
for name in ["seed.json", "before-archive.json", "after-archive.json", "before-online-tcp.json", "after-online-tcp.json", "after-recovered-tcp.json", "before-startup.json", "after-startup.json", "after-final-startup.json", "after-aligned-startup.json", "after-recovered-startup.json", "owned-final-check.json", "initialize-archive.ts", "check-archive-tcp.mjs", "audit-owned-data.py"]:
    shutil.copy2(root / name, artifact / name)
print(json.dumps(checks))