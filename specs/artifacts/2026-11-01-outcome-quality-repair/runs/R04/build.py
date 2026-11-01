"""Rebuild the standalone application using only the Python standard library."""

from pathlib import Path
import zipfile


def build():
    root = Path(__file__).resolve().parent
    info = zipfile.ZipInfo("__main__.py", date_time=(1980, 1, 1, 0, 0, 0))
    info.create_system = 3
    info.external_attr = 0o100644 << 16
    with zipfile.ZipFile(root / "deliverable.pyz", "w") as archive:
        archive.writestr(info, (root / "main.py").read_bytes())


if __name__ == "__main__":
    build()
