from pathlib import Path
import zipfile, json, csv, collections, subprocess, sys

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
CACHE = (
    ROOT
    / ".opencorvus/.r/tasks/tsk_g00VZOYBUC00Kv0WzDFa/artifacts/materializations/reads"
)
# Exact already-read immutable resources. No grader or other worktree is inspected.
resources = {
    "service.py": "0ddbb8d74f733a68aa401af03f8e1296c5055c11c16b0fe62d570cb256fc2e72",
    "reproduce.py": "25196f59f9acd07bfb20e2189c7f6166c0bd174ef32f9ee3843b2f3d8ca1975a",
    "verify_delivery.py": "7b54515247b92666a2d89c491573f6734f4987f982560d79deb7e42403a846ee",
    "incident.md": "b5005df0af535f522b299f1734ec7b58ec516f406cd2092024288a7a33f74e23",
    "runbook.md": "8631c3364498747b016e194474d92a04772c45e608f694e28f57201cf94cefc2",
    "ledger.csv": "3bb58a904647b9153af95730e99c31302500e005f2dd2f5ae4676308450d6303",
    "duplicates.csv": "5d757cc33e52f2a186c3c976d8bf07f84d0fc021068b2dc99013ef58408a9f3f",
    "totals.csv": "1fa8dea8a062974a9bf96e6d0738744bfa0e14b168c24f1cf0282c0c1d7e592b",
    "replay.csv": "17696ad0d60f42bb00c76a5587cb2e7c6b28cbe5af21fd032020ad7040404338",
    "verification/clean-rerun.json": "db417b96c37e8c65369186433b50a043e73ac1fa4a21dda6437dd4bd0f940fff",
    "verification/clean-rerun/delivery-check.json": "6351597343fc26e8e83e67b9047f9fd7cdca154d2a5459bc35109ec1f6ba19d6",
    "verification/comparisons.json": "2ea4a9f72729e037478ac73242bdbf604d55d1b3444f04c99af28dc30974c48a",
    "verification/cutover.json": "651663ce6e4e7c4300e9850d393f67e904b74949d7be1f1cf26eb0a0cb81e1bd",
    "verification/entrypoints.json": "e508d6f24d5cbe5539c1c1c65e063e958805a2abdf3bede98c2da333ea781a56",
    "verification/impact.csv": "715357b0896ec416bae21be573c4434780f7b28e27863279aad6919e86049466",
    "verification/legacy.json": "c214507fad95493604863dfbd4a7653b7a6ef1fca8a62cdc2818eb5ec8d80193",
    "verification/monitor.json": "0c61b0266306e7a2b35d57ccb02ae829db05bdef39b64443addaf5a23a1da145",
    "verification/package-manifest.json": "abaf1dfa093f2cf4d864cfb9aa9a950764abbc602a411cfab5dbf7acbf9e30fd",
    "verification/primary-check.json": "140c6bc7b843deedb3f28a08fc6804d4fd731b0f501c60969d7c1e82d9bbd6d5",
    "verification/storage.json": "1ebf53a8d0ed30682d59fc9e06a65ad2620e76d0c40e4c25413c876e7f347933",
    "verification/summary.json": "cf7e0c6cc880a1a49f7a55442d403b195884297fab5055e106d6814b70f84d4d",
    "verification/timeline.json": "3b54e6c494756a83e92b8949525723783fd6b81369aa93ac5181a0b1e78a209e",
    "TASK.md": "de1b2f2cbc94ed6bf49b74265f54ac1a0f629dc7f793d3bf57622d7ad8027594",
    "task.json": "9f9520bc2c73752bec5a4a2b3eaceb02005b8f2085428f86c6166f72efd96630",
    "inputs/records.csv": "a13086b8f071962a003303be2088b46ebebe10752e50576516a68d1bf4575116",
    "inputs/context.json": "1fc398da3fda65cdbdbdb6569ed833f299f00592b5b50afb245d7565dc1dfacb",
    "inputs/legacy_service.py": "3c1c0dcd2e258d8484a9696d32818243274ede2ea1b3f1b2e9ba49b124b9c316",
    "inputs/source-notes.md": "0f8a9f6206a1271700b5574fcf388b49df0148ec80824ba2b4390e704e2643c2",
}
for n in ["ledger", "duplicates", "totals", "replay"]:
    resources["diagnostics/" + n + ".csv"] = resources[n + ".csv"]
results = []
for name, digest in resources.items():
    source = CACHE / (digest + "-" + Path(name).name)
    raw = source.read_bytes()
    # Exact resource bytes are the independently established publication reference.
    results.append(
        {"path": name, "published_equals_primary": raw == (ROOT / name).read_bytes()}
    )
assert all(r["published_equals_primary"] for r in results), results
with zipfile.ZipFile(HERE / "published.zip") as z:
    names = z.namelist()
    assert all(not Path(n).is_absolute() and ".." not in Path(n).parts for n in names)
    archive_compare = [
        {"path": n, "equals_primary": z.read(n) == (ROOT / n).read_bytes()}
        for n in names
    ]
    assert all(r["equals_primary"] for r in archive_compare)
    z.extractall(HERE / "copy")
assert (HERE / "published.zip").read_bytes() == (ROOT / "h05-delivery.zip").read_bytes()
records = list(
    csv.DictReader(
        (CACHE / (resources["inputs/records.csv"] + "-records.csv")).open(
            newline="", encoding="utf-8"
        )
    )
)
expected = {}
attempts = collections.Counter()
for r in records:
    k = (r["tenant"], r["event_id"])
    a = int(r["amount"])
    assert k not in expected or expected[k] == a
    expected[k] = a
    attempts[k] += 1
totals = collections.Counter()
for (t, e), a in expected.items():
    totals[t] += a
shared = collections.defaultdict(set)
for t, e in expected:
    shared[e].add(t)
out = {
    "primary_commit": subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
    ).strip(),
    "published_primary": results,
    "archive_primary": archive_compare,
    "archive_files": len(names),
    "records": len(records),
    "identities": len(expected),
    "duplicate_identities": sum(v > 1 for v in attempts.values()),
    "extra_duplicates": len(records) - len(expected),
    "totals": dict(totals),
    "shared_ids": sum(len(ts) > 1 for ts in shared.values()),
    "media_requiring_view": [
        n for n in names if Path(n).suffix.lower() in [".pdf", ".png", ".jpg", ".svg"]
    ],
}
(HERE / "boundary.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
print(
    json.dumps(
        {
            k: v
            for k, v in out.items()
            if k not in ["published_primary", "archive_primary"]
        },
        indent=2,
    )
)
