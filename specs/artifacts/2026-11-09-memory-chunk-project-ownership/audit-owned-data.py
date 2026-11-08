from pathlib import Path
import json, os, sqlite3, subprocess, shutil

root = Path(r"C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b42")
artifact = Path(r"D:/myhexin-local/opencorvus/specs/artifacts/2026-11-09-memory-chunk-project-ownership")
seed = json.loads((root / "seed.json").read_text(encoding="utf-8"))
env = os.environ.copy()
env.update(GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
report = {"phases": {}, "qualification": "Before intentionally reproduces one inconsistent parent through the original domain writer, not direct SQL. After verifies the precise named error and legitimate Caller replacement. Unknown user historical records are neither inspected nor repaired. Mutable host-document times are not equality gates."}
for phase, items in seed.items():
    originals = []
    for item in items:
        directory = Path(item["directory"])
        assert directory.is_relative_to(root)
        def git(*args):
            return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
        content = item["notes"].encode("utf-8")
        assert (directory / "notes.txt").read_bytes() == content
        assert git("show", "HEAD:notes.txt") == content
        assert git("rev-parse", "HEAD").decode().strip() == item["head"]
        originals.append({"directory": str(directory), "originalNotesBytes": len(content), "originalFileAndGitContentExact": True, "head": item["head"], "status": git("status", "--short").decode("utf-8").splitlines()})
    domain = json.loads((root / f"{phase}-domain-probe.json").read_text(encoding="utf-8"))
    owner = next(project for project in domain["projects"] if project["role"] == "owner")
    caller = next(project for project in domain["projects"] if project["role"] == "caller")
    connection = sqlite3.connect("file:" + (root / f"profile-{phase}/data/opencorvus.db").as_posix() + "?mode=ro", uri=True)
    counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0] for table in ["project", "session", "message", "memory_file", "memory_chunk"]}
    assert counts["project"] == 2 and counts["session"] == 0 and counts["message"] == 0
    files = []
    for project in domain["projects"]:
        original = project["file"]
        row = connection.execute("select id,project_id,title,source,kind,time_created from memory_file where id=?", (original["id"],)).fetchone()
        assert row == (original["id"], project["id"], original["title"], original["source"], original["kind"], original["timeCreated"])
        files.append({"id": row[0], "projectID": row[1], "title": row[2], "source": row[3], "kind": row[4], "timeCreated": row[5], "originalIdentityAndCreationExact": True})
    rows = connection.execute("select f.id,c.project_id,f.project_id,c.content from memory_chunk c join memory_file f on f.id=c.file_id where f.kind='note'").fetchall()
    caller_content = caller["originalContent"] if phase == "before" else domain["callerSearch"][0]["content"]
    expected = [(owner["file"]["id"], owner["id"], owner["id"], owner["originalContent"]), (caller["file"]["id"], caller["id"], caller["id"], caller_content)]
    if phase == "before":
        expected.append((owner["file"]["id"], caller["id"], owner["id"], domain["callerSearch"][0]["content"]))
    assert sorted(rows) == sorted(expected)
    connection.close()
    config = root / f"profile-{phase}/config"
    listing = sorted(str(path.relative_to(config)) for path in config.rglob("*") if path.is_file()) if config.exists() else []
    assert listing == []
    report["phases"][phase] = {"gitProjects": originals, "files": files, "chunks": [{"fileID": row[0], "chunkProjectID": row[1], "fileProjectID": row[2], "content": row[3], "parentConsistent": row[1] == row[2]} for row in rows], "exactExpectedDomainState": True, "databaseCounts": counts, "configFiles": listing}
(root / "owned-final-check.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
for name in ["seed.json", "before-domain-probe.json", "after-domain-probe.json", "before-tcp-schema-check.json", "after-tcp-schema-check.json", "before-startup.json", "after-startup.json", "owned-final-check.json", "initialize-and-probe.ts", "check-memory-tcp.mjs", "audit-owned-data.py", "helper-parse-failed.log", "chunk-contracts-before.log", "chunk-contracts-after.log"]:
    shutil.copy2(root / name, artifact / name)
print(json.dumps({"originalGitProjects": 4, "originalMemoryFiles": 4, "exactExpectedDomainState": True, "counts": {phase: data["databaseCounts"] for phase, data in report["phases"].items()}}))
