from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def main():
    root = Path(__file__).resolve().parent
    with ZipFile(root / "deliverable.pyz", "w", compression=ZIP_DEFLATED) as archive:
        archive.write(root / "main.py", "main.py")
        archive.writestr("__main__.py", "from main import main\n\nmain()\n")


if __name__ == "__main__":
    main()
