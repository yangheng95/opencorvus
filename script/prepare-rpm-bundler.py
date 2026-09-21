#!/usr/bin/env python3
"""Prepare the canonical Linux RPM bundler with the upstream short-write repair."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import tomllib
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
PATCH = ROOT / "patches/rpm-0.16.0-short-write.patch"
CACHE = ROOT / ".scratch/rpm-bundler"


def cli_version():
    package = ROOT / "packages/overlay/node_modules/@tauri-apps/cli/package.json"
    version = json.loads(package.read_text(encoding="utf-8"))["version"]
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", version):
        raise ValueError(f"Unsupported installed Tauri CLI version: {version!r}")
    return version


def tool_key(version, architecture):
    digest = hashlib.sha256(Path(__file__).read_bytes() + PATCH.read_bytes()).hexdigest()
    return f"rpm-bundler-{version}-{architecture}-{digest}"


def digest_file(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def rpm_lock_entry(lock):
    entries = [entry for entry in lock["package"] if entry["name"] == "rpm"]
    if len(entries) != 1 or entries[0]["version"] != "0.16.0":
        raise ValueError("The short-write patch requires exactly locked rpm 0.16.0; review the upstream fix before updating it")
    return entries[0]


def verify_patch_lock(before, after):
    expected = json.loads(json.dumps(before["package"]))
    rpm = rpm_lock_entry({"package": expected})
    rpm.pop("source")
    rpm.pop("checksum")
    order = lambda entry: (entry["name"], entry["version"], entry.get("source", ""))
    if sorted(expected, key=order) != sorted(after["package"], key=order):
        raise ValueError("RPM preparation changed dependencies beyond the single local source patch")
    return len(after["package"])


def patch_lock_source(contents):
    """Change only rpm's registry identity; keep every resolved dependency edge."""
    before = tomllib.loads(contents)
    rpm_lock_entry(before)
    sections = contents.split("[[package]]")
    for index, section in enumerate(sections[1:], 1):
        entry = tomllib.loads("[[package]]" + section)["package"][0]
        if entry["name"] == "rpm":
            sections[index] = "".join(
                line for line in section.splitlines(keepends=True)
                if not line.startswith(("source = ", "checksum = "))
            )
    patched = "[[package]]".join(sections)
    verify_patch_lock(before, tomllib.loads(patched))
    return patched


def unpack(archive, destination):
    with tarfile.open(archive) as package:
        package.extractall(destination, filter="data")


def download(url, destination, expected_sha256=None):
    with urllib.request.urlopen(url, timeout=90) as response, destination.open("wb") as output:
        shutil.copyfileobj(response, output, 1024 * 1024)
    if expected_sha256 and digest_file(destination) != expected_sha256:
        raise ValueError(f"Upstream archive integrity mismatch: {destination.name}")


def prepare():
    if sys.platform != "linux":
        raise RuntimeError("RPM bundler preparation requires its native Linux host")
    import fcntl

    version = cli_version()
    key = tool_key(version, platform.machine())
    tool_dir = CACHE / "tool"
    tool = tool_dir / "cargo-tauri"
    receipt = tool_dir / "identity.json"
    CACHE.mkdir(parents=True, exist_ok=True)
    environment = {k: v for k, v in os.environ.items() if not k.startswith("TAURI_SIGNING_")}
    with (CACHE / "prepare.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if receipt.exists():
            identity = json.loads(receipt.read_text())
            if identity["key"] == key:
                if not tool.is_file() or digest_file(tool) != identity["tool_sha256"]:
                    raise ValueError("Cached RPM bundler does not match its immutable tool receipt")
                print(f"Using verified RPM bundler {key}", file=sys.stderr, flush=True)
                return tool

        stage = Path(tempfile.mkdtemp(prefix="build-", dir=CACHE))
        tag = f"refs/tags/tauri-cli-v{version}"
        refs = subprocess.check_output(
            ["git", "ls-remote", "--exit-code", "https://github.com/tauri-apps/tauri.git", tag, tag + "^{}"],
            text=True, env=environment,
        )
        refs = {name: sha for sha, name in (line.split() for line in refs.splitlines())}
        revision = refs.get(tag + "^{}", refs.get(tag))
        if not revision or not re.fullmatch(r"[a-f0-9]{40}", revision):
            raise ValueError("Tauri CLI tag did not resolve to an exact upstream revision")
        print(f"Preparing Tauri CLI {version} from {revision}", file=sys.stderr, flush=True)
        source_archive = stage / "tauri.tar.gz"
        download(f"https://codeload.github.com/tauri-apps/tauri/tar.gz/{revision}", source_archive)
        unpack(source_archive, stage)
        source = stage / f"tauri-{revision}"
        lock_path = source / "Cargo.lock"
        before = tomllib.loads(lock_path.read_text())
        rpm = rpm_lock_entry(before)
        crate_archive = stage / "rpm.crate"
        download("https://crates.io/api/v1/crates/rpm/0.16.0/download", crate_archive, rpm["checksum"])
        unpack(crate_archive, stage)
        crate = stage / "rpm-0.16.0"
        subprocess.run(["patch", "--batch", "--fuzz=0", "-p1", "-i", str(PATCH)], cwd=crate,
                       env=environment, stdout=sys.stderr, check=True)
        with (source / "Cargo.toml").open("a") as manifest:
            manifest.write("\n[patch.crates-io.rpm]\npath = " + json.dumps(str(crate)) + "\n")
        lock_path.write_text(patch_lock_source(lock_path.read_text()))
        verify_patch_lock(before, tomllib.loads(lock_path.read_text()))
        subprocess.run(["cargo", "build", "--release", "--locked", "--package", "tauri-cli", "--bin", "cargo-tauri",
                        "--target-dir", str(stage / "target")], cwd=source,
                       env=environment, stdout=sys.stderr, check=True)
        built = stage / "target/release/cargo-tauri"
        observed = subprocess.check_output([str(built), "--version"], text=True, env=environment).strip()
        if observed != f"tauri-cli {version}":
            raise ValueError(f"Built RPM tool has unexpected identity: {observed!r}")
        identity = {"key": key, "tauri_cli_version": version, "upstream_revision": revision,
                    "rpm_version": rpm["version"], "rpm_archive_sha256": rpm["checksum"],
                    "patch_sha256": digest_file(PATCH), "tool_sha256": digest_file(built)}
        tool_dir.mkdir(parents=True, exist_ok=True)
        staged_tool = tool_dir / "cargo-tauri.next"
        shutil.copy2(built, staged_tool)
        staged_tool.replace(tool)
        staged_receipt = tool_dir / "identity.next.json"
        staged_receipt.write_text(json.dumps(identity, indent=2) + "\n")
        staged_receipt.replace(receipt)
        if stage.parent.resolve() != CACHE.resolve() or not stage.name.startswith("build-"):
            raise ValueError("RPM preparation staging directory escaped its owned cache")
        shutil.rmtree(stage)
        print(f"Prepared RPM bundler: {observed}", file=sys.stderr, flush=True)
        return tool


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-key", action="store_true")
    arguments = parser.parse_args()
    if arguments.cache_key:
        print(tool_key(cli_version(), platform.machine()))
    else:
        print(prepare())
