from pathlib import Path
import json, os, sqlite3, subprocess, sys

root = Path(sys.argv[1]).resolve()
seed = json.loads((root / "seed.json").read_text(encoding="utf-8"))
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
projects, profiles = {}, {}
for phase, item in seed.items():
    directory = Path(item["directory"])
    assert directory.is_relative_to(root)
    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
    assert git("rev-parse", "HEAD").decode().strip() == item["head"]
    files = {}
    for rel, value in {
        "filled/nested/note.txt": f"Owned tree scope note {phase}.\n",
        ".opencorvus-handbook/manual.txt": "Owned similarly named user documentation.\n",
    }.items():
        raw = (directory / rel).read_bytes()
        assert raw == value.encode() == git("show", f"HEAD:{rel}")
        files[rel] = len(raw)
    projects[phase] = {"head": item["head"], "files": files}
    for label in [phase, f"cli-{phase}"]:
        database = root / f"profile-{label}/data/opencorvus.db"
        with sqlite3.connect(database.as_uri() + "?mode=ro", uri=True) as connection:
            counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0]
                      for table in ["project","session","message","engine_task","provider_usage_event","provider_activity_request"]}
        assert counts == {"project": 1, "session": 0, "message": 0, "engine_task": 0,
                          "provider_usage_event": 0, "provider_activity_request": 0}
        profiles[label] = counts
shutdown = json.loads((root / "shutdown-verification.json").read_text(encoding="utf-8"))
for row in shutdown:
    assert row["httpShutdown"]["ok"] is True
    assert row["shellExitCode"] == 0 and not row["processPresent"] and not row["listenerPresent"]
result = {"projects": projects, "profiles": profiles, "shutdown": shutdown}
(root / "owned-final-check.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"projects": len(projects), "isolatedProfiles": len(profiles), "shutdown": len(shutdown)}))