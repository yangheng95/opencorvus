from pathlib import Path
import json, os, shutil, sqlite3, subprocess

root = Path(os.environ["TEMP"]) / "opencorvus-iteration-20261109-b128"
artifact = Path("D:/myhexin-local/opencorvus/specs/artifacts/2026-11-09-release-history-date-search")
seed = json.loads((root / "seed.json").read_text(encoding="utf-8"))
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
checks = {}
for phase, original in seed.items():
    directory = Path(original["directory"])
    assert directory.is_relative_to(root)
    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
    expected = f"Owned release date discovery {phase}\n".encode("utf-8")
    assert (directory / "note.txt").read_bytes() == expected
    assert git("show", "HEAD:note.txt") == expected
    assert git("rev-parse", "HEAD").decode().strip() == original["head"]
    status = git("status", "--short").decode().splitlines()
    assert status == ["?? .gitattributes", "?? .gitignore", "?? .opencorvus/"]
    db = root / f"profile-{phase}/data/opencorvus.db"
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as connection:
        counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0] for table in ["project", "session", "message", "engine_task", "provider_usage_event", "provider_activity_request"]}
        assert counts == {"project": 1, "session": 0, "message": 0, "engine_task": 0, "provider_usage_event": 0, "provider_activity_request": 0}
    checks[phase] = {"originalNoteBytes": len(expected), "head": original["head"], "status": status, "counts": counts}
(root / "owned-final-check.json").write_text(json.dumps(checks, indent=2) + "\n", encoding="utf-8")
artifact.mkdir(parents=True, exist_ok=True)
evidence = [p.name for p in root.glob("*.jpg")] + [
    "seed.json", "before-tcp.json", "after-tcp.json", "before-startup.json", "after-startup.json",
    "before-shutdown.json", "after-shutdown.json", "owned-final-check.json", "check-release-date-tcp.mjs", "audit-owned-data.py",
]
for name in evidence:
    shutil.copy2(root / name, artifact / name)
print(json.dumps(checks))