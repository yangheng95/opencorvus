"""Build the standalone zipapp: python build.py."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def main():
    root = Path(__file__).resolve().parent
    source = (root / "main.py").read_bytes()
    compile(source, "__main__.py", "exec")
    with ZipFile(root / "deliverable.pyz", "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("__main__.py", source)


if __name__ == "__main__":
    main()
