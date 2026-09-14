#!/usr/bin/env python3
"""Assemble the immutable Linux OpenCorvus payload uploaded by Harbor."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def prepare(output: Path, binary: Path, source_root: Path) -> dict[str, object]:
    if output.exists():
        raise FileExistsError(f"bundle already exists: {output}")
    helper = source_root / "script" / "benchmark" / "harbor" / "run_opencorvus_automationbench.py"
    skill = source_root / "script" / "benchmark" / "external-agent" / "automationbench-api.SKILL.md"
    restricted_shell = source_root / "script" / "benchmark" / "external-agent" / "restricted-agent-shell.sh"
    for path in (binary, helper, skill, restricted_shell):
        if not path.is_file():
            raise FileNotFoundError(path)
    commit = subprocess.check_output(
        ["git", "-C", str(source_root), "rev-parse", "HEAD"], text=True
    ).strip()
    tree = subprocess.check_output(
        ["git", "-C", str(source_root), "rev-parse", "HEAD^{tree}"], text=True
    ).strip()
    changed = subprocess.check_output(
        ["git", "-C", str(source_root), "status", "--short", "--untracked-files=no"], text=True
    ).strip()
    if changed:
        raise RuntimeError("OpenCorvus bundle must be assembled from a clean tracked source checkout")
    (output / "bin").mkdir(parents=True)
    (output / "share" / "automationbench-api").mkdir(parents=True)
    shutil.copy2(binary, output / "opencorvus")
    shutil.copy2(helper, output / "bin" / "run-opencorvus-automationbench.py")
    shutil.copy2(restricted_shell, output / "bin" / "restricted-agent-shell.sh")
    shutil.copy2(skill, output / "share" / "automationbench-api" / "SKILL.md")
    files = []
    for path in sorted(item for item in output.rglob("*") if item.is_file()):
        files.append(
            {
                "path": path.relative_to(output).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
            }
        )
    receipt = {
        "schema_version": 1,
        "source_commit": commit,
        "source_tree": tree,
        "source_binary": str(binary),
        "files": files,
    }
    (output / "bundle-manifest.json").write_text(
        json.dumps(receipt, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return receipt


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--binary", type=Path, required=True)
    parser.add_argument("--source-root", type=Path, default=Path(__file__).parents[3])
    args = parser.parse_args()
    receipt = prepare(args.output, args.binary, args.source_root)
    print(json.dumps(receipt, ensure_ascii=False))


if __name__ == "__main__":
    main()
