#!/usr/bin/env python3
"""Verify the native RPM payload, then install its file transaction in an empty root."""

import argparse
import hashlib
import json
from pathlib import Path
import platform
import subprocess
import tempfile


def digest_file(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def check(package, compiled_input):
    package = package.resolve(strict=True)
    compiled_input = compiled_input.resolve(strict=True)
    expected_version = json.loads((Path(__file__).resolve().parent.parent / "packages/opencorvus/package.json").read_text())["version"]
    metadata = subprocess.check_output(
        ["rpm", "-qp", "--queryformat", "%{NAME}\n%{VERSION}\n%{ARCH}\n%{PAYLOADDIGESTALT}\n", str(package)],
        text=True,
    ).splitlines()
    if len(metadata) != 4:
        raise ValueError("RPM_IDENTITY_INVALID: expected name, version, architecture and uncompressed digest")
    name, version, architecture, expected_payload = metadata
    if version != expected_version or architecture != platform.machine():
        raise ValueError(f"RPM_IDENTITY_MISMATCH: received {version}/{architecture}, expected {expected_version}/{platform.machine()}")
    subprocess.run(["rpm", "--checksig", str(package)], check=True)
    # Script hooks require a different, dependency-complete environment. This
    # product currently installs only files; preserve that acceptance boundary.
    scripts = subprocess.check_output(["rpm", "-qp", "--scripts", str(package)], text=True)
    if scripts.strip():
        raise ValueError("RPM_INSTALL_SCRIPTS_REQUIRE_ACCEPTANCE: package hooks need a full distribution install check")
    evidence = Path(tempfile.mkdtemp(prefix="opencorvus-rpm-check-"))
    payload = evidence / "payload.cpio"
    with payload.open("wb") as output:
        subprocess.run(["rpm2cpio", str(package)], stdout=output, check=True)
    actual_payload = digest_file(payload)
    if actual_payload != expected_payload:
        raise ValueError(f"RPM_UNCOMPRESSED_DIGEST_MISMATCH: expected {expected_payload}, received {actual_payload}")
    installed = evidence / "installed"
    installed.mkdir()
    rpm_root = ["sudo", "-n", "rpm", "--root", str(installed), "--dbpath", "/var/lib/rpm"]
    subprocess.run([*rpm_root, "--initdb"], check=True)
    # An empty root has no OS dependency database. Verify the actual file
    # transaction here; this is not a desktop launch or dependency integration test.
    subprocess.run([*rpm_root, "--install", "--nodeps", "--noscripts", str(package)], check=True)
    subprocess.run([*rpm_root, "--verify", "--nodeps", "--noscripts", name], check=True)
    binary = installed / "usr/bin" / compiled_input.name
    if digest_file(binary) != digest_file(compiled_input):
        raise ValueError("RPM_COMPILED_INPUT_MISMATCH: installed executable differs from the immutable compile artifact")
    result = {"package": str(package), "version": version, "architecture": architecture,
              "uncompressed_payload_sha256": actual_payload, "file_install": "passed",
              "compiled_input": "matched", "evidence_root": str(evidence)}
    (evidence / "result.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package", type=Path)
    parser.add_argument("compiled_input", type=Path)
    args = parser.parse_args()
    check(args.package, args.compiled_input)
