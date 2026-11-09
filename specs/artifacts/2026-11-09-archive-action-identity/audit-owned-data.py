from pathlib import Path
import json, os, shutil, sqlite3, subprocess

root = Path(os.environ["TEMP"]) / "opencorvus-iteration-20261109-b49"
artifact = Path("D:/myhexin-local/opencorvus/specs/artifacts/2026-11-09-archive-action-identity")
seed = json.loads((root / "seed.json").read_text(encoding="utf-8"))
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
checks = {}
for phase, projects in seed.items():
    project_checks = []
    for project in projects:
        directory = Path(project["directory"])
        assert directory.is_relative_to(root)
        def git(*args):
            return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
        notes = project["notes"].encode("utf-8")
        assert (directory / "notes.txt").read_bytes() == notes
        assert git("show", "HEAD:notes.txt") == notes
        assert git("rev-parse", "HEAD").decode().strip() == project["head"]
        project_checks.append({"key": project["key"], "projectTitle": project["projectTitle"], "gitOriginalBytes": len(notes), "head": project["head"], "status": git("status", "--short").decode().splitlines()})
    original = json.loads((root / f"{phase}-archive.json").read_text(encoding="utf-8"))
    expected = []
    for row in original["originals"]:
        archive_time = None if phase == "after" and row["key"] == "south" else row["archived"]
        expected.append((row["sessionID"], row["title"], row["directory"], row["projectID"], row["created"], archive_time))
    db = root / f"profile-{phase}/data/opencorvus.db"
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as connection:
        sessions = connection.execute("select id,title,directory,project_id,time_created,time_archived from session order by id").fetchall()
        assert sessions == sorted(expected)
        counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0] for table in ["project", "session", "message", "engine_task"]}
        assert counts == {"project": 2, "session": 2, "message": 0, "engine_task": 0}
    config = root / f"profile-{phase}/config"
    config_files = sorted(path.relative_to(config).as_posix() for path in config.rglob("*") if path.is_file())
    assert config_files == []
    checks[phase] = {"projects": project_checks, "counts": counts, "exactOriginalIdentityTitleAndCreation": [dict(zip(["id","title","directory","projectID","created","archived"], row)) for row in sessions], "configFiles": config_files}
(root / "owned-final-check.json").write_text(json.dumps(checks, indent=2) + "\n", encoding="utf-8")
for name in ["seed.json", "before-archive.json", "after-archive.json", "before-seeded-tcp.json", "after-seeded-tcp.json", "after-restored-tcp.json", "before-startup.json", "after-startup.json", "owned-final-check.json", "initialize-archive.ts", "check-archive-tcp.mjs", "audit-owned-data.py"]:
    shutil.copy2(root / name, artifact / name)
print(json.dumps({key: {"counts": value["counts"], "gitOriginals": len(value["projects"]), "sessions": [{"id": row["id"], "projectID": row["projectID"], "archived": row["archived"]} for row in value["exactOriginalIdentityTitleAndCreation"]]} for key, value in checks.items()}))