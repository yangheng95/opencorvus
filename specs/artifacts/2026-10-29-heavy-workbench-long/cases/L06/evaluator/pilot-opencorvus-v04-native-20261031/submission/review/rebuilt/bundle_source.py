"""Explicit source/input capsule. Generated tables and run outputs are excluded."""

from pathlib import Path
import json, zipfile


root = Path(__file__).resolve().parent
files = list(root.glob("*.py")) + list(root.glob("requirements*.txt"))
files += [root / "actor/actor.py", root / "actor/submission.json"]
files += [root / "OPERATOR-HANDOFF.txt"]
files += [
    p
    for p in (root.parent / "public").rglob("*")
    if p.is_file() and "__pycache__" not in p.parts
]
with zipfile.ZipFile(root / "source.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted(files):
        name = (
            p.relative_to(root).as_posix()
            if p.is_relative_to(root)
            else p.relative_to(root.parent).as_posix()
        )
        z.writestr(name, p.read_bytes())
with zipfile.ZipFile(root / "source.zip") as z:
    assert not any("/tables/" in n for n in z.namelist())
    assert sum(n.startswith("public/") for n in z.namelist()) == 21
    assert all(
        z.read(
            (
                p.relative_to(root).as_posix()
                if p.is_relative_to(root)
                else p.relative_to(root.parent).as_posix()
            )
        )
        == p.read_bytes()
        for p in files
    )
print(
    json.dumps(
        {
            "archive": "submission/source.zip",
            "files": len(files),
            "contains_generated_tables": False,
            "source_bytes_compared": True,
        }
    )
)
