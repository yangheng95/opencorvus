"""Package only this review's evidence; exclude the separately published input delivery."""

import json
from pathlib import Path
import zipfile

H = Path(__file__).resolve().parent
archive = H / "review-evidence.zip"
files = []
for folder in ("runner", "clean", "experiments", "experiments-v2"):
    files.extend(
        p
        for p in (H / folder).rglob("*")
        if p.is_file() and "__pycache__" not in p.parts
    )
files.extend(
    H / n
    for n in (
        "report.md",
        "review_checks.py",
        "audit_receipts.py",
        "concurrent_probe.py",
        "commands.json",
        "results.json",
        "receipt-audit.json",
        "barrier-concurrent.json",
        "published-check.json",
        "boundary.json",
        "package_evidence.py",
    )
)
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted(files):
        z.write(p, p.relative_to(H).as_posix())
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert sorted(z.namelist()) == sorted(p.relative_to(H).as_posix() for p in files)
    # Direct representation check against the exact private evidence files just packaged.
    assert all(z.read(p.relative_to(H).as_posix()) == p.read_bytes() for p in files)
print(
    json.dumps(
        {"archive": str(archive), "members": len(files), "verified_contents": True}
    )
)
