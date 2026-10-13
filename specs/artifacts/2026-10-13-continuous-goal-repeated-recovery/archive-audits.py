"""Losslessly archive only this checker's stopped private run audit snapshots."""
import gzip
import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parent
for name in sys.argv[1:]:
    run = (root / name).resolve()
    if run.parent != root or name not in {
        "task-repeated-run1", "mission-repeated-run1", "mission-repeated-run2", "mission-child-run1", "mission-child-run2"
    }:
        raise ValueError("Expected an exact owned run immediately below the evidence root")
    settlement = json.loads((run / "settlement.json").read_text(encoding="utf-8"))
    assert settlement["credentialPairRemoved"] is True
    assert all(item["exited"] for item in settlement["processes"])
    assert all(item["reachable"] is False for item in settlement["ports"])
    directories = sorted(p.resolve() for p in run.glob("*-audit") if p.is_dir())
    assert all(p.parent == run for p in directories)
    sources = sorted(p for directory in directories for p in directory.rglob("*") if p.is_file())
    assert sources
    entries = [{"path": p.relative_to(run).as_posix(), "json": json.loads(p.read_text(encoding="utf-8"))} for p in sources]
    archive = run / "audit-snapshots.jsonl.gz"
    with gzip.open(archive, "wt", encoding="utf-8", newline="\n") as output:
        for entry in entries:
            output.write(json.dumps(entry, ensure_ascii=False, separators=(",", ":")) + "\n")
    with gzip.open(archive, "rt", encoding="utf-8") as source:
        restored = [json.loads(line) for line in source]
    assert restored == entries
    receipt = {"run": name, "snapshotCount": len(entries), "verification": "every decompressed path and JSON equals its original",
               "directories": [str(p) for p in directories], "archiveBytes": archive.stat().st_size}
    (run / "audit-archive.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in receipt.items() if key != "directories"}))
