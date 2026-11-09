from pathlib import Path
import json, os, shutil, sqlite3, subprocess

root = Path(os.environ["TEMP"]) / "opencorvus-iteration-20261109-b133"
artifact = Path("D:/myhexin-local/opencorvus/specs/artifacts/2026-11-09-mission-skill-detail-identity")
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
    skill_file = ".opencorvus/mission-skills/inspection-demo/SKILL.md"
    assert (directory / skill_file).read_bytes() == original["skill"].encode("utf-8")
    assert git("show", f"HEAD:{skill_file}") == original["skill"].encode("utf-8")
    assert git("rev-parse", "HEAD").decode().strip() == original["head"]
    db = root / f"profile-{phase}/data/opencorvus.db"
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as connection:
        counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0] for table in ["project", "session", "message", "engine_task", "provider_usage_event", "provider_activity_request"]}
        assert counts == {"project": 1, "session": 0, "message": 0, "engine_task": 0, "provider_usage_event": 0, "provider_activity_request": 0}
    config = root / f"profile-{phase}/config"
    config_files = sorted(path.relative_to(config).as_posix() for path in config.rglob("*") if path.is_file())
    assert config_files == []
    checks[phase] = {"gitOriginalBytes": len(original_bytes), "head": original["head"], "status": git("status", "--short").decode().splitlines(), "counts": counts, "configFiles": config_files}
(root / "owned-final-check.json").write_text(json.dumps(checks, indent=2) + "\n", encoding="utf-8")
artifact.mkdir(parents=True, exist_ok=True)
for name in [p.name for p in root.glob("*.jpg")] + ["seed.json", "before-direct.json", "after-direct.json", "before-proxy.jsonl", "after-proxy.jsonl", "before-proxy-shutdown.json", "after-proxy-shutdown.json", "catalog-response-delay.mjs", "before-startup.json", "after-startup.json", "owned-final-check.json", "check-mission-skill-catalog.mjs", "before-shutdown.json", "after-shutdown.json", "audit-owned-data.py"]:
    shutil.copy2(root / name, artifact / name)
print(json.dumps(checks))