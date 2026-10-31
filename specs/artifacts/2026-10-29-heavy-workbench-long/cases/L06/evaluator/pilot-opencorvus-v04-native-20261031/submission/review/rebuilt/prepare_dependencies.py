"""Record the isolated plot/PDF environment and retain its offline wheel set."""

from pathlib import Path
import json, os, subprocess, sys, zipfile


root = Path(__file__).resolve().parent
os.environ.update(
    PIP_CACHE_DIR=str(root / "cache"),
    TEMP=str(root / "tmp"),
    TMP=str(root / "tmp"),
    PYTHONDONTWRITEBYTECODE="1",
)
freeze = subprocess.run(
    [sys.executable, "-B", "-m", "pip", "freeze"],
    capture_output=True,
    text=True,
    check=True,
)
(root / "requirements-lock.txt").write_text(freeze.stdout, encoding="utf-8")
(root / "wheels").mkdir(exist_ok=True)
argv = [
    sys.executable,
    "-B",
    "-m",
    "pip",
    "download",
    "--dest",
    str(root / "wheels"),
    "--cache-dir",
    str(root / "cache"),
    "-r",
    str(root / "requirements-lock.txt"),
]
r = subprocess.run(argv, capture_output=True, text=True)
(root / "dependencies-process.json").write_text(
    json.dumps(
        {"argv": argv, "exit": r.returncode, "stdout": r.stdout, "stderr": r.stderr},
        indent=2,
    ),
    encoding="utf-8",
)
assert r.returncode == 0, r.stderr
with zipfile.ZipFile(root / "dependencies.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for file in sorted((root / "wheels").iterdir()):
        z.write(file, "submission/wheels/" + file.name)
    for file in root.glob("requirements*.txt"):
        z.write(file, "submission/" + file.name)
print(
    f"Retained {len(list((root / 'wheels').iterdir()))} dependency wheels with exact installed version lock"
)
