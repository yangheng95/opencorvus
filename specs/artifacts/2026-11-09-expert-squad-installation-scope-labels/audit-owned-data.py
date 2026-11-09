from pathlib import Path
import json, os, shutil, sqlite3, subprocess

root = Path(os.environ["TEMP"]) / "opencorvus-iteration-20261109-b66"
artifact = Path("D:/myhexin-local/opencorvus/specs/artifacts/2026-11-09-expert-squad-installation-scope-labels")
read = lambda name: json.loads((root / name).read_text(encoding="utf-8"))
seed = read("seed.json")
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
checks = {}
original_package_files = None
for phase, original in seed.items():
    directory = Path(original["directory"]).resolve()
    assert directory.is_relative_to(root.resolve())
    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
    original_bytes = original["notes"].encode("utf-8")
    assert git("show", "HEAD:notes.txt") == (directory / "notes.txt").read_bytes() == original_bytes
    assert git("rev-parse", "HEAD").decode().strip() == original["head"]
    assert git("diff", "--name-only", "HEAD").decode().splitlines() == []
    installed = read(f"{phase}-installations.json")["installed"]
    install_roots = {}
    for item in installed:
        scope = item["scope"]
        install_root = Path(item["root"]).resolve()
        expected_root = directory / ".opencorvus" if scope == "project" else root / f"profile-{phase}" / "config"
        assert install_root == (expected_root / "expert-squads" / "builtin" / "data-analysis").resolve()
        contents = {}
        for file in install_root.rglob("*"):
            if file.is_file():
                assert file.resolve().is_relative_to(install_root)
                contents[file.relative_to(install_root).as_posix()] = file.read_bytes()
        assert contents["expert-squad.jsonc"] and contents["README.md"]
        if original_package_files is None:
            original_package_files = contents
        else:
            assert contents == original_package_files
        install_roots[scope] = {"root": str(install_root), "files": sorted(contents)}
    db = root / f"profile-{phase}/data/opencorvus.db"
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as connection:
        counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0] for table in ["project", "session", "message", "engine_task", "provider_usage_event", "provider_activity_request"]}
        assert counts == {"project": 1, "session": 0, "message": 0, "engine_task": 0, "provider_usage_event": 0, "provider_activity_request": 0}
    checks[phase] = {"head": original["head"], "originalTrackedBytes": len(original_bytes), "status": git("status", "--short").decode().splitlines(), "counts": counts, "physicalInstallations": install_roots}

(root / "owned-final-check.json").write_text(json.dumps(checks, indent=2) + "\n", encoding="utf-8")
for name in ["seed.json", "before-tcp.json", "after-tcp.json", "before-installations.json", "after-installations.json", "before-startup.json", "after-startup.json", "owned-final-check.json", "check-project-tcp.mjs", "audit-owned-data.py", "install-owned-payloads.mjs"]:
    shutil.copy2(root / name, artifact / name)
print(json.dumps({phase: {"counts": proof["counts"], "filesPerInstallation": {scope: len(data["files"]) for scope, data in proof["physicalInstallations"].items()}} for phase, proof in checks.items()}))
