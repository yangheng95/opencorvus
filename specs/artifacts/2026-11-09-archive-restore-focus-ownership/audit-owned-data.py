from pathlib import Path
import json, os, sqlite3, subprocess, sys

root = Path(sys.argv[1]).resolve()
seed = json.loads((root / "seed.json").read_text(encoding="utf-8"))
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
checks = {}
for phase, original in seed.items():
    directory = Path(original["directory"])
    assert directory.is_relative_to(root)
    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
    note = original["notes"].encode()
    assert (directory / "notes.txt").read_bytes() == git("show", "HEAD:notes.txt") == note
    assert git("rev-parse", "HEAD").decode().strip() == original["head"]
    status = git("status", "--short").decode().splitlines()
    assert status == ["?? .gitattributes", "?? .gitignore", "?? .opencorvus/"]
    archive = json.loads((root / f"{phase}-archive.json").read_text(encoding="utf-8"))
    wanted = ["Restore review 202", "Restore review 201"] + (["Restore review 001"] if phase == "after" else [])
    restored = {row["title"]: row["id"] for row in archive["sessions"] if row["title"] in wanted}
    assert len(restored) == len(wanted)
    expected = [
        (row["id"], row["title"], row["directory"], row["projectID"], row["created"],
         None if row["title"] in restored else row["archived"])
        for row in archive["sessions"]
    ]
    db = root / f"profile-{phase}/data/opencorvus.db"
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as connection:
        actual = connection.execute("select id,title,directory,project_id,time_created,time_archived from session order by id").fetchall()
        assert actual == sorted(expected)
        counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0]
                  for table in ["project", "session", "message", "engine_task", "provider_activity_request"]}
        assert counts == {"project": 1, "session": 202, "message": 0, "engine_task": 0, "provider_activity_request": 0}
    with (root / f"profile-{phase}/log/dev.log").open(encoding="utf-8") as log:
        entries = [json.loads(line) for line in log if line.startswith("{")]
    mutations = [entry["data"] for entry in entries if entry.get("service") == "server"
                 and entry.get("data", {}).get("method") == "PATCH"
                 and entry["data"].get("path", "").endswith("/archive")
                 and entry["data"].get("status") == "completed"]
    assert [(item["path"], item["statusCode"]) for item in mutations] == [
        (f"/coding/chat/session/{restored[title]}/archive", 200) for title in wanted]
    checks[phase] = {
        "gitOriginalBytes": len(note), "head": original["head"], "generatedProjectEntries": status, "counts": counts,
        "exactSessionIdentities": len(expected), "archivedAsSeeded": len(expected) - len(wanted),
        "restored": restored, "mutationReceipts": mutations,
    }
(root / "owned-final-check.json").write_text(json.dumps(checks, indent=2) + "\n", encoding="utf-8")
print(json.dumps({phase: {key: value for key, value in result.items() if key != "mutationReceipts"} for phase, result in checks.items()}))
