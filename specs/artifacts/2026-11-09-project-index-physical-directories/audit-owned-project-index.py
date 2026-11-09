from pathlib import Path
import json, os, sqlite3, subprocess, sys

root = Path(sys.argv[1]).resolve()
fixture_env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
expected = {
    "before": ("4e62634372920fc9152f00f725e9c1a9593efdcb", "opal-occupied/opal-note.txt", b"Owned positive file search control.\n"),
    "after": ("73988a00570bfa1b5f205f035acc46df6af03945", "opal-occupied/opal-note.txt", b"Owned positive file search control.\n"),
    "sibling": ("2b38bd5e85335b1396c90d2f40400422f9577a0f", "control.txt", b"Owned sibling comparison.\n"),
}
projects = {}
for phase, (head, relative, content) in expected.items():
    directory = root / f"project-{phase}"
    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=fixture_env)
    assert git("rev-parse", "HEAD").decode().strip() == head
    assert git("show", f"HEAD:{relative}") == (directory / relative).read_bytes() == content
    projects[phase] = {"head": head, "input": relative, "inputBytes": len(content),
                       "bootstrapFiles": git("status", "--short").decode().splitlines()}
tables = ["project","session","message","engine_task","provider_usage_event","provider_activity_request"]
profiles = {}
for phase, project_count, session_count in [("before",1,0),("after",2,0),("tool-check",1,1)]:
    db = root / f"profile-{phase}" / "data" / "opencorvus.db"
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as connection:
        counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0] for table in tables}
    assert counts == dict(zip(tables, [project_count, session_count, 0, 0, 0, 0]))
    profiles[phase] = counts
shutdown = json.loads((root / "shutdown-verification.json").read_text(encoding="utf-8"))
for row in shutdown:
    assert row["httpShutdown"]["ok"] is True
    assert row["shellExitCode"] == 0 and not row["processPresent"] and not row["listenerPresent"]
result = {"projects": projects, "profiles": profiles, "shutdown": shutdown}
(root / "owned-final-check.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"profiles": profiles, "shutdownCount": len(shutdown)}))