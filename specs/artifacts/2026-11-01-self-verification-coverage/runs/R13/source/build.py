"""Rebuild the standalone archive using only the Python standard library."""

from pathlib import Path
import tempfile
import zipapp


def main():
    project = Path(__file__).resolve().parent
    with tempfile.TemporaryDirectory() as directory:
        entry = Path(directory) / "__main__.py"
        entry.write_bytes((project / "main.py").read_bytes())
        zipapp.create_archive(
            directory, target=project / "deliverable.pyz", compressed=True
        )


if __name__ == "__main__":
    main()
