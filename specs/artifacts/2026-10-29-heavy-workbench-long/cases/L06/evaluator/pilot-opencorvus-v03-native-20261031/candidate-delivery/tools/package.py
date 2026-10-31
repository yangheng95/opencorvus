"""Package verified deliverables; retain native raw diagnostics without rewriting."""

import json
import zipfile
from common import ROOT


def capsule(destination, files):
    files = sorted(set(files))
    with zipfile.ZipFile(ROOT / destination, "w", zipfile.ZIP_DEFLATED) as archive:
        for p in files:
            archive.write(p, p.relative_to(ROOT).as_posix())
    with zipfile.ZipFile(ROOT / destination) as archive:
        assert archive.testzip() is None
        assert len(archive.infolist()) == len(files)
        # Direct binary comparison verifies the archive's actual resource bytes.
        for p in files:
            assert archive.read(p.relative_to(ROOT).as_posix()) == p.read_bytes()
    return {
        "path": destination,
        "files": len(files),
        "bytes": (ROOT / destination).stat().st_size,
    }


def files_under(path):
    return [
        p
        for p in (ROOT / path).rglob("*")
        if p.is_file() and "__pycache__" not in p.parts
    ]


def main():
    checked = json.loads((ROOT / "results/self-check.json").read_text())
    assert checked["status"] == "passed"
    evidence = capsule(
        "diagnostic-evidence.zip",
        files_under("exercise/run-001") + files_under("results"),
    )
    files = [
        ROOT / p
        for p in [
            "policy.json",
            "requirements.txt",
            "requirements-lock.txt",
            "HANDOFF.md",
            "REPORT.md",
            "REPORT.pdf",
        ]
    ]
    for path in ["actor", "tools", "results", "figures", "public"]:
        files += files_under(path)
    source = capsule("delivery-source.zip", files)
    print(
        json.dumps(
            {
                "archives": [source, evidence],
                "integrity": "archive CRC and direct exact uncompressed-byte comparison passed",
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
