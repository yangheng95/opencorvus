from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def main():
    root = Path(__file__).resolve().parent
    with ZipFile(root / "deliverable.pyz", "w", compression=ZIP_DEFLATED) as archive:
        archive.write(root / "main.py", "__main__.py")


if __name__ == "__main__":
    main()
