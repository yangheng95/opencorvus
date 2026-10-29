from pathlib import Path
import zipfile, json

H = Path(__file__).resolve().parent
files = [
    H / n
    for n in [
        "report.md",
        "setup.py",
        "independent.py",
        "check_receipts.py",
        "package_evidence.py",
        "boundary.json",
        "independent-results.json",
        "receipt-checks.json",
    ]
]
for folder in ["fresh", "experiments"]:
    files.extend(
        p
        for p in (H / folder).rglob("*")
        if p.is_file() and "__pycache__" not in p.parts
    )
archive = H / "review-a-evidence.zip"
paths = sorted(p.relative_to(H).as_posix() for p in files)
assert len(paths) == len(set(paths))
with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as z:
    for name in paths:
        z.write(H / name, name)
with zipfile.ZipFile(archive) as z:
    assert z.namelist() == paths and z.testzip() is None
    assert all(z.read(n) == (H / n).read_bytes() for n in paths)
print(
    json.dumps(
        {
            "files": len(paths),
            "bytes": archive.stat().st_size,
            "archive": str(archive),
            "exact_membership_and_bytes": True,
        }
    )
)
