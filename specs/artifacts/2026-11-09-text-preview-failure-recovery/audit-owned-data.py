from pathlib import Path
import json, os, shutil, sqlite3, subprocess

root = Path(os.environ["TEMP"]) / "opencorvus-iteration-20261109-b129"
artifact = Path("D:/myhexin-local/opencorvus/specs/artifacts/2026-11-09-text-preview-failure-recovery")
seed = json.loads((root / "seed.json").read_text(encoding="utf-8"))
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
checks = {}
for phase, original in seed.items():
    directory = Path(original["directory"])
    assert directory.is_relative_to(root)
    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
    expected = f"Owned text attachment preview {phase}\n".encode("utf-8")
    assert (directory / "note.txt").read_bytes() == expected
    assert git("show", "HEAD:note.txt") == expected
    assert git("rev-parse", "HEAD").decode().strip() == original["head"]
    status = git("status", "--short").decode().splitlines()
    assert status == ["?? .gitattributes", "?? .gitignore", "?? .opencorvus/"]
    names = []
    for sidecar in (directory / ".opencorvus/.r/project/attachments").rglob("*.metadata.json"):
        meta = json.loads(sidecar.read_text(encoding="utf-8"))
        name = meta["filename"]
        assert name in {"owned-readable-text.txt", "owned-invalid-utf8.txt", "owned-second-text.txt"}
        fixture = (root / "inputs" / name).read_bytes()
        assert len(fixture) == meta["size"]
        assert sidecar.with_name(sidecar.name.removesuffix(".metadata.json")).read_bytes() == fixture
        names.append(name)
    expected_files = ["owned-invalid-utf8.txt", "owned-readable-text.txt"]
    if phase == "after":
        expected_files += ["owned-second-text.txt"]
    assert sorted(names) == expected_files
    db = root / f"profile-{phase}/data/opencorvus.db"
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as connection:
        counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0] for table in ["project", "session", "message", "engine_task", "provider_usage_event", "provider_activity_request"]}
        assert counts == {"project": 1, "session": 0, "message": 0, "engine_task": 0, "provider_usage_event": 0, "provider_activity_request": 0}
    checks[phase] = {"originalNoteBytes": len(expected), "head": original["head"], "status": status, "counts": counts, "attachments": sorted(names)}
assert (root / "downloaded-owned-invalid-utf8.txt").read_bytes() == (root / "inputs/owned-invalid-utf8.txt").read_bytes()
assert list(root.glob("*.held")) == []
(root / "owned-final-check.json").write_text(json.dumps(checks, indent=2) + "\n", encoding="utf-8")
artifact.mkdir(parents=True, exist_ok=True)
evidence = [p.name for p in root.glob("*.jpg")] + [
    "seed.json", "before-startup.json", "before-shutdown.json", "before-true-404.json", "before-restored.json",
    "after-startup.json", "after-shutdown.json", "after-proxy.jsonl", "after-proxy-shutdown.json", "after-project-and-originals.json",
    "second-build-startup.json", "second-build-shutdown.json", "second-build-proxy.jsonl", "second-build-proxy-shutdown.json", "second-build-project-and-originals.json",
    "final-startup.json", "final-shutdown.json", "final-project-and-originals.json", "final-true-404.json",
    "download-original.json", "owned-final-check.json", "check-attachment-origins.mjs", "attachment-response-delay.mjs", "audit-owned-data.py",
]
for name in evidence:
    shutil.copy2(root / name, artifact / name)
print(json.dumps(checks))