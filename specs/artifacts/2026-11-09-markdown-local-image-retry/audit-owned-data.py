from pathlib import Path
import json, os, shutil, sqlite3, subprocess

root = Path(os.environ["TEMP"]) / "opencorvus-iteration-20261109-b131"
artifact = Path("D:/myhexin-local/opencorvus/specs/artifacts/2026-11-09-markdown-local-image-retry")
seed = json.loads((root / "seed.json").read_text(encoding="utf-8"))
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
files = ["guide.md", "other.md", "media/retry-diagram.svg", "media/sibling.svg"]
checks = {}
for phase, original in seed.items():
    directory = Path(original["directory"])
    assert directory.is_relative_to(root)
    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
    assert git("rev-parse", "HEAD").decode().strip() == original["head"]
    status = git("status", "--short").decode().splitlines()
    assert status == ["?? .gitattributes", "?? .gitignore", "?? .opencorvus/"]
    lengths = {}
    for file in files:
        data = (directory / file).read_bytes()
        assert git("show", "HEAD:" + file) == data
        lengths[file] = len(data)
    db = root / f"profile-{phase}/data/opencorvus.db"
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as connection:
        counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0] for table in ["project", "session", "message", "engine_task", "provider_usage_event", "provider_activity_request"]}
        assert counts == {"project": 1, "session": 0, "message": 0, "engine_task": 0, "provider_usage_event": 0, "provider_activity_request": 0}
    checks[phase] = {"originalFileBytes": lengths, "head": original["head"], "status": status, "counts": counts}
assert list(root.glob("*.held")) == []
(root / "owned-final-check.json").write_text(json.dumps(checks, indent=2) + "\n", encoding="utf-8")
artifact.mkdir(parents=True, exist_ok=True)
evidence = [p.name for p in root.glob("*.jpg")] + [
    "seed.json", "before-startup.json", "before-shutdown.json", "before-proxy-shutdown.json", "before-proxy.jsonl",
    "first-candidate-startup.json", "first-candidate-shutdown.json", "first-candidate-proxy.jsonl", "first-candidate-proxy-shutdown.json", "first-candidate-file-contracts.json",
    "final-startup.json", "final-shutdown.json", "final-proxy.jsonl", "final-proxy-shutdown.json",
    "before-file-contracts.json", "after-file-contracts.json", "owned-final-check.json",
    "check-file-contracts.mjs", "file-content-delay.mjs", "audit-owned-data.py",
]
for name in evidence:
    shutil.copy2(root / name, artifact / name)
for file in files:
    target = artifact / "fixtures" / file
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(Path(seed["before"]["directory"]) / file, target)
print(json.dumps(checks))