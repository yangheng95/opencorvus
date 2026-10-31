"""Archive exact native evidence paths, retaining and byte-checking originals."""

from pathlib import Path
import json, zipfile


root = Path(__file__).resolve().parent
names = [
    "native-original",
    "native-complete",
    "native-rebuilt",
    "exports",
    "exports-complete",
    "exports-rebuilt",
    "certificates",
]
files = []
for name in names:
    files += [p for p in (root / name).rglob("*") if p.is_file()]
files += [p for p in root.glob("*.json")]
with zipfile.ZipFile(root / "native-evidence.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for file in sorted(files):
        z.write(file, file.relative_to(root.parent).as_posix())
with zipfile.ZipFile(root / "native-evidence.zip") as z:
    for file in files:
        assert z.read(file.relative_to(root.parent).as_posix()) == file.read_bytes()
    assert len(z.namelist()) == len(files)
(root / "evidence-archive-record.json").write_text(
    json.dumps(
        {
            "archive": "submission/native-evidence.zip",
            "original_paths_preserved": True,
            "all_archive_bytes_compared_to_retained_originals": True,
            "files": len(files),
            "original_bytes": sum(p.stat().st_size for p in files),
            "archive_bytes": (root / "native-evidence.zip").stat().st_size,
        },
        indent=2,
    ),
    encoding="utf-8",
)
print((root / "evidence-archive-record.json").read_text())
