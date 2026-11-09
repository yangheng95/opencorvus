
from pathlib import Path
import json, os, shutil, sqlite3, subprocess
root = Path(os.environ["TEMP"]) / "opencorvus-iteration-20261110-b135"
artifact = Path("D:/myhexin-local/opencorvus/specs/artifacts/2026-11-10-installed-expert-squad-catalog-continuation")
seed = json.loads((root / "seed.json").read_text(encoding="utf-8"))
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
installed_bytes = {}
result = {}
for phase, initial in seed.items():
    directory = Path(initial["directory"]).resolve()
    assert directory == (root / f"project-{phase}").resolve()
    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
    assert git("rev-parse", "HEAD").decode().strip() == initial["head"]
    tracked = git("ls-files", "-z").decode().strip("\0").split("\0")
    assert len(tracked) == 67
    for name in tracked:
        assert (directory / name).read_bytes() == git("show", "HEAD:" + name)
    assert (directory / "notes.txt").read_text(encoding="utf-8") == initial["notes"]
    receipt = json.loads((root / (phase + "-catalog-advance.json")).read_text(encoding="utf-8"))["installed"]
    assert len(receipt) == 1
    installed = directory / ".opencorvus/expert-squads/builtin/deep-research"
    assert Path(receipt[0]["root"]) == installed
    assert receipt[0]["scope"] == "project" and receipt[0]["id"] == "deep-research"
    installed_bytes[phase] = {f.relative_to(installed).as_posix(): f.read_bytes() for f in installed.rglob("*") if f.is_file()}
    assert "expert-squad.jsonc" in installed_bytes[phase]
    assert installed_bytes[phase]
    db = root / f"profile-{phase}/data/opencorvus.db"
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as connection:
        counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0] for table in ["project", "session", "message", "engine_task", "provider_usage_event", "provider_activity_request"]}
        assert counts == {"project": 1, "session": 0, "message": 0, "engine_task": 0, "provider_usage_event": 0, "provider_activity_request": 0}
    config = root / f"profile-{phase}/config"
    config_files = sorted(f.relative_to(config).as_posix() for f in config.rglob("*") if f.is_file())
    assert config_files == []
    result[phase] = {"trackedOriginalFiles":len(tracked),"originalPackages":len(initial["packages"]),"newPackageFiles":len(installed_bytes[phase]),"counts":counts,"profileConfigFiles":config_files}
assert installed_bytes["before"] == installed_bytes["after"]
(root / "owned-final-check.json").write_text(json.dumps(result, indent=2) + "\n",encoding="utf-8")
names = ["seed.json","before-tcp.json","after-tcp.json","after-advanced-tcp.json","before-startup.json","after-startup.json","before-proxy.jsonl","after-proxy.jsonl","before-shutdown.json","after-shutdown.json","before-proxy-shutdown.json","after-proxy-shutdown.json","before-catalog-advance.json","after-catalog-advance.json","owned-final-check.json","catalog-page-delay.mjs","check-catalog-pages.mjs","seed-installations.ts","advance-owned-catalog.mjs","audit-owned-data.py","first-candidate-proxy.jsonl","first-candidate-startup.json","first-candidate-shutdown.json","first-candidate-proxy-shutdown.json"]
for name in names + [f.name for f in sorted(root.glob("*.jpg"))]:
    shutil.copy2(root / name, artifact / name)
print(json.dumps(result))
