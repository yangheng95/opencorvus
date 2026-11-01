"""Rebuild the standalone application using only the standard library."""

from pathlib import Path
import tempfile
import zipfile
import zipapp


def main():
    root = Path(__file__).resolve().parent
    with tempfile.TemporaryDirectory() as directory:
        entry = Path(directory) / "__main__.py"
        entry.write_bytes((root / "main.py").read_bytes())
        zipapp.create_archive(directory, root / "deliverable.pyz", compressed=True)
    with zipfile.ZipFile(root / "deliverable.pyz") as archive:
        assert archive.namelist() == ["__main__.py"]
        assert archive.testzip() is None
    print("Built deliverable.pyz")


if __name__ == "__main__":
    main()
