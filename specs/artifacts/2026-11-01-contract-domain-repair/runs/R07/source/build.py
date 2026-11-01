"""Build a self-contained archive using only the Python standard library."""

from pathlib import Path
import tempfile
import zipapp
import zipfile


def build():
    project = Path(__file__).resolve().parent
    with tempfile.TemporaryDirectory() as directory:
        entry = Path(directory) / "__main__.py"
        entry.write_bytes((project / "main.py").read_bytes())
        zipapp.create_archive(directory, project / "deliverable.pyz")
    with zipfile.ZipFile(project / "source.zip", "w", zipfile.ZIP_DEFLATED) as archive:
        for name in (
            "main.py",
            "build.py",
            "test_download.py",
            "demo_server.py",
            "sample.jobs.json",
            "CONTRACT.md",
            "HANDOFF.md",
        ):
            archive.write(project / name, name)


if __name__ == "__main__":
    build()
