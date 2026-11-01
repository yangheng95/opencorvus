"""Build the self-contained standard-library zip application beside this script."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def build():
    root = Path(__file__).resolve().parent
    with ZipFile(root / "deliverable.pyz", "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("__main__.py", "from main import main\nmain()\n")
        archive.write(root / "main.py", "main.py")


if __name__ == "__main__":
    build()
