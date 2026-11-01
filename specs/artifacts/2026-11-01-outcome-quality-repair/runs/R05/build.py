"""Build the standalone zipapp: python build.py."""

from pathlib import Path
from zipfile import ZIP_STORED, ZipFile, ZipInfo


def build():
    root = Path(__file__).resolve().parent
    # Fixed metadata makes repeated builds reproducible without dependencies.
    with ZipFile(root / "deliverable.pyz", "w", compression=ZIP_STORED) as archive:
        archive.writestr(ZipInfo("__main__.py"), (root / "main.py").read_bytes())


if __name__ == "__main__":
    build()
