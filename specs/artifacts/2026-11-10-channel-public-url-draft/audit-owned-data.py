from pathlib import Path
import json, os, shutil, sqlite3, subprocess

root = Path(os.environ["TEMP"]) / "opencorvus-iteration-20261110-b139"
artifact = Path("D:/myhexin-local/opencorvus/specs/artifacts/2026-11-10-channel-public-url-draft")
seed = json.loads((root / "seed.json").read_text(encoding="utf-8"))
env = dict(os.environ, GIT_CONFIG_GLOBAL=str(root / "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM="1")
checks = {}
for phase, original in seed.items():
    directory = Path(original["directory"]).resolve()
    assert directory.is_relative_to(root.resolve())
    def git(*args):
        return subprocess.check_output(["git", "-C", str(directory), *args], env=env)
    original_bytes = original["notes"].encode("utf-8")
    assert git("show", "HEAD:notes.txt") == (directory / "notes.txt").read_bytes() == original_bytes
    assert git("rev-parse", "HEAD").decode().strip() == original["head"]
    assert git("diff", "--name-only", "HEAD").decode().splitlines() == []
    db = root / f"profile-{phase}/data/opencorvus.db"
    with sqlite3.connect(db.as_uri() + "?mode=ro", uri=True) as connection:
        counts = {table: connection.execute(f'select count(*) from "{table}"').fetchone()[0] for table in ["project", "session", "message", "engine_task", "provider_usage_event", "provider_activity_request", "permission_ledger", "permission_policy", "permission_execution_result"]}
        assert counts == {"project": 1, "session": 0, "message": 0, "engine_task": 0, "provider_usage_event": 0, "provider_activity_request": 0, "permission_ledger": 0, "permission_policy": 0, "permission_execution_result": 0}
    path = directory / ".opencorvus/opencorvus.jsonc"
    stored = json.loads(path.read_text(encoding="utf-8"))
    expected = "https://channel-draft-" + ("first" if phase == "before" else "next") + ".example.invalid/preview"
    assert stored.get("server", {}) == {"publicUrl": expected}
    proxy = [json.loads(line) for line in (root / f"{phase}-proxy.jsonl").read_text(encoding="utf-8").splitlines()]
    origins = [row for row in proxy if row.get("stage") == "origin"]
    released = [row for row in proxy if row.get("stage") == "released"]
    assert len(origins) == len(released) == (1 if phase == "before" else 3)
    assert [item["status"] for item in origins] == [200] * len(origins)
    assert [item["publicUrl"] for item in released] == [item["publicUrl"] for item in origins]
    assert origins[-1]["publicUrl"] == expected
    with (root / f"profile-{phase}/log/dev.log").open(encoding="utf-8") as log:
        logs = [json.loads(line) for line in log if line.startswith("{")]
    writes = [entry["data"] for entry in logs if entry.get("service") == "server" and entry.get("data", {}).get("status") == "completed" and entry["data"].get("method") == "PATCH" and entry["data"].get("path") == "/config"]
    # A new dev process starts a new dev.log; the intermediate write has its proxy and direct readback.
    assert [entry["statusCode"] for entry in writes] == [200] * (1 if phase == "before" else 2)
    if phase == "after":
        first_readback = json.loads((root / "after-first-tcp.json").read_text(encoding="utf-8"))
        assert first_readback["savedPublicUrl"] == origins[0]["publicUrl"]
    config = root / f"profile-{phase}/config"
    config_files = sorted(path.relative_to(config).as_posix() for path in config.rglob("*") if path.is_file())
    assert config_files == []
    checks[phase] = {"head": original["head"], "originalTrackedBytes": len(original_bytes), "status": git("status", "--short").decode().splitlines(), "counts": counts, "profileConfigFiles": config_files, "savedPublicUrl": expected, "patchRequestIDs": [item["requestID"] for item in origins], "writesInFinalProcessLog": len(writes)}

catalogs = [json.loads(file.read_text(encoding="utf-8"))["channels"] for file in sorted(root.glob("*-tcp.json"))]
assert len(catalogs) == 6 and all(len(catalog) == 27 and catalog == catalogs[0] for catalog in catalogs)
(root / "owned-final-check.json").write_text(json.dumps(checks, indent=2) + "\n", encoding="utf-8")
for name in ["seed.json", "before-startup.json", "candidate-startup.json", "after-startup.json", "owned-final-check.json", "check-public-url.mjs", "audit-owned-data.py", "before-proxy.jsonl", "after-proxy.jsonl", "before-shutdown.json", "candidate-shutdown.json", "after-shutdown.json", "before-proxy-shutdown.json", "after-proxy-shutdown.json", "public-url-delay.mjs"] + [file.name for file in sorted(root.glob("*.jpg")) + sorted(root.glob("*-tcp.json"))]:
    shutil.copy2(root / name, artifact / name)
print(json.dumps(checks))
