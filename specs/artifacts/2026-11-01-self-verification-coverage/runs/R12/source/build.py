from pathlib import Path
from zipfile import ZIP_STORED, ZipFile


def main():
    root = Path(__file__).resolve().parent
    with ZipFile(root / "deliverable.pyz", "w", compression=ZIP_STORED) as archive:
        archive.writestr("__main__.py", (root / "main.py").read_bytes())


if __name__ == "__main__":
    main()
