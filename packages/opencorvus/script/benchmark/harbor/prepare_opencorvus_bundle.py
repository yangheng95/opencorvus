#!/usr/bin/env python3
"""Assemble the immutable Linux OpenCorvus payload uploaded by Harbor."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import stat
import subprocess
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_runtime_tree(runtime_root: Path) -> None:
    resolved_root = runtime_root.resolve(strict=True)
    for directory, names, files in os.walk(runtime_root, followlinks=False):
        for name in [*names, *files]:
            path = Path(directory) / name
            mode = path.lstat().st_mode
            if stat.S_ISLNK(mode):
                target = path.resolve(strict=True)
                if not target.is_relative_to(resolved_root):
                    raise ValueError(f"runtime symlink escapes release root: {path}")
            elif not stat.S_ISDIR(mode) and not stat.S_ISREG(mode):
                raise ValueError(f"runtime contains unsupported special file: {path}")


def prepare(output: Path, runtime_root: Path, source_root: Path) -> dict[str, object]:
    if output.exists():
        raise FileExistsError(f"bundle already exists: {output}")
    helper = source_root / "script" / "benchmark" / "harbor" / "run_opencorvus_automationbench.py"
    skill = source_root / "script" / "benchmark" / "external-agent" / "automationbench-api.SKILL.md"
    restricted_shell = source_root / "script" / "benchmark" / "external-agent" / "restricted-agent-shell.sh"
    binary = runtime_root / "opencorvus"
    runtime_package = runtime_root / "package.json"
    runtime_modules = runtime_root / "node_modules"
    for path in (binary, runtime_package, helper, skill, restricted_shell):
        if not path.is_file():
            raise FileNotFoundError(path)
    if not runtime_modules.is_dir():
        raise FileNotFoundError(runtime_modules)
    validate_runtime_tree(runtime_root)
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
    shutil.copytree(runtime_root, output, symlinks=False)
    (output / "bin").mkdir(parents=True, exist_ok=True)
    (output / "share" / "automationbench-api").mkdir(parents=True)
    shutil.copy2(helper, output / "bin" / "run-opencorvus-automationbench.py")
    shutil.copy2(restricted_shell, output / "bin" / "restricted-agent-shell.sh")
    shutil.copy2(skill, output / "share" / "automationbench-api" / "SKILL.md")
    validate_runtime_tree(output)
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
        "source_runtime": str(runtime_root),
        "files": files,
    }
    (output / "bundle-manifest.json").write_text(
        json.dumps(receipt, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return receipt


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--runtime-dir", type=Path, required=True)
    parser.add_argument("--source-root", type=Path, default=Path(__file__).parents[3])
    args = parser.parse_args()
    receipt = prepare(args.output, args.runtime_dir, args.source_root)
    print(json.dumps(receipt, ensure_ascii=False))


if __name__ == "__main__":
    main()
