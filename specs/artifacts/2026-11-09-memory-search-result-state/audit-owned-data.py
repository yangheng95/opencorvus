from pathlib import Path
import json, os, sqlite3, subprocess, shutil

root = Path(r"C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b41")
artifact = Path(r"D:/myhexin-local/opencorvus/specs/artifacts/2026-11-09-memory-search-result-state")
seed = json.loads((root / "seed.json").read_text(encoding="utf-8"))
env = os.environ.copy()
env.update(GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
report = {"phases": {}, "qualification": "Original owned file/identity/content/creation contracts. Mutable host project-memory metadata is recorded by its production owner and is not compared across observations. UI accepted only manually."}
for phase, item in seed.items():
    project_path = Path(item["directory"])
    expected_notes = item["notes"].encode("utf-8")
    def git(*args):
        return subprocess.check_output(["git", "-C", str(project_path), *args], env=env)
    assert project_path.is_relative_to(root)
    assert (project_path / "notes.txt").read_bytes() == expected_notes
    assert git("show", "HEAD:notes.txt") == expected_notes
    assert git("rev-parse", "HEAD").decode().strip() == item["head"]
    original = json.loads((root / f"{phase}-memory.json").read_text(encoding="utf-8"))
    connection = sqlite3.connect("file:" + (root / f"profile-{phase}/data/opencorvus.db").as_posix() + "?mode=ro", uri=True)
    counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0] for table in ["project", "session", "message", "memory_file", "memory_chunk"]}
    assert counts["session"] == 0 and counts["message"] == 0
    memories = []
    for file in original["files"]:
        row = connection.execute("select id,project_id,title,source,kind,time_created from memory_file where id=?", (file["id"],)).fetchone()
        assert row == (file["id"], original["project"]["id"], file["title"], file["source"], file["kind"], file["timeCreated"])
        chunks = [chunk[0] for chunk in connection.execute("select content from memory_chunk where file_id=? and project_id=? order by time_created,id", (file["id"], original["project"]["id"]))]
        content = "corvuslocale evidence: keep this original bilingual note. 保留原始笔记内容。" if file["id"] == original["files"][0]["id"] else "Separate original evidence belongs to this isolated project."
        assert "\n\n".join(chunks) == content
        memories.append({"id": row[0], "projectID": row[1], "title": row[2], "source": row[3], "kind": row[4], "timeCreated": row[5], "content": content, "identityContentCreationExact": True})
    connection.close()
    config = root / f"profile-{phase}/config"
    listing = sorted(str(path.relative_to(config)) for path in config.rglob("*") if path.is_file()) if config.exists() else []
    assert listing == []
    report["phases"][phase] = {"directory": str(project_path), "originalNotesBytes": len(expected_notes), "worktreeAndGitContentExact": True, "head": item["head"], "status": git("status", "--short").decode("utf-8").splitlines(), "databaseCounts": counts, "configFiles": listing, "originalMemory": memories}
(root / "owned-final-check.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
for name in ["seed.json", "before-memory.json", "after-memory.json", "before-tcp-schema-check.json", "after-tcp-schema-check.json", "before-startup.json", "after-startup.json", "owned-final-check.json", "initialize-memory.ts", "check-memory-tcp.mjs", "audit-owned-data.py"]:
    shutil.copy2(root / name, artifact / name)
print(json.dumps({"originalGitProjects": 2, "originalMemoryFiles": 4, "identitiesContentsCreationExact": True, "counts": {phase: data["databaseCounts"] for phase, data in report["phases"].items()}}))
