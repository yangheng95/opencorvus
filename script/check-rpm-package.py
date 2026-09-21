#!/usr/bin/env python3
"""Verify the native RPM payload, then install its file transaction in an empty root."""

import argparse
from contextlib import closing
import hashlib
import json
import mmap
from pathlib import Path
import platform
import subprocess
import tempfile


def digest_file(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def expected_rpm_binary(compiled_input):
    # Tauri 2.11 patches the FIRST exact bundle-type token, packages the
    # executable, then restores the original file. Bind the installed bytes to
    # that documented transformation of the retained immutable compile input.
    original = b"__TAURI_BUNDLE_TYPE_VAR_UNK"
    replacement = b"__TAURI_BUNDLE_TYPE_VAR_RPM"
    if compiled_input.stat().st_size == 0:
        raise ValueError("RPM_COMPILED_MARKER_MISSING: compiled input is empty")
    with compiled_input.open("rb") as stream, mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as data:
        offset = data.find(original)
        if offset < 0:
            raise ValueError("RPM_COMPILED_MARKER_MISSING: exact Tauri UNK marker is required")
        digest = hashlib.sha256()
        with memoryview(data) as view:
            digest.update(view[:offset])
            digest.update(replacement)
            digest.update(view[offset + len(original):])
        return digest.hexdigest(), offset


def payload_identity(package):
    import rpm

    with closing(rpm.fd.open(str(package))) as source:
        header = rpm.ts().hdrFromFdno(source)
        identity = {key: header[key] for key in ("name", "version", "arch")}
        expected = header["payloaddigestalt"]
        if len(expected) != 1:
            raise ValueError("RPM_IDENTITY_INVALID: expected one uncompressed payload digest")
        digest = hashlib.sha256()
        size = 0
        with closing(rpm.fd.open(source, flags=header["payloadcompressor"])) as payload:
            while chunk := payload.read(1024 * 1024):
                digest.update(chunk)
                size += len(chunk)
        actual = digest.hexdigest()
        if actual != expected[0]:
            raise ValueError(f"RPM_UNCOMPRESSED_DIGEST_MISMATCH: expected {expected[0]}, received {actual}")
    return identity, actual, size


def check(package, compiled_input):
    package = package.resolve(strict=True)
    compiled_input = compiled_input.resolve(strict=True)
    expected_binary, marker_offset = expected_rpm_binary(compiled_input)
    expected_version = json.loads((Path(__file__).resolve().parent.parent / "packages/opencorvus/package.json").read_text())["version"]
    identity, actual_payload, payload_bytes = payload_identity(package)
    name, version, architecture = (identity[key] for key in ("name", "version", "arch"))
    if version != expected_version or architecture != platform.machine():
        raise ValueError(f"RPM_IDENTITY_MISMATCH: received {version}/{architecture}, expected {expected_version}/{platform.machine()}")
    subprocess.run(["rpm", "--checksig", str(package)], check=True)
    # Script hooks require a different, dependency-complete environment. This
    # product currently installs only files; preserve that acceptance boundary.
    scripts = subprocess.check_output(["rpm", "-qp", "--scripts", str(package)], text=True)
    if scripts.strip():
        raise ValueError("RPM_INSTALL_SCRIPTS_REQUIRE_ACCEPTANCE: package hooks need a full distribution install check")
    evidence = Path(tempfile.mkdtemp(prefix="opencorvus-rpm-check-"))
    installed = evidence / "installed"
    installed.mkdir()
    rpm_root = ["sudo", "-n", "rpm", "--root", str(installed), "--dbpath", "/var/lib/rpm"]
    subprocess.run([*rpm_root, "--initdb"], check=True)
    # An empty root has no OS dependency database. Verify the actual file
    # transaction here; this is not a desktop launch or dependency integration test.
    subprocess.run([*rpm_root, "--install", "--nodeps", "--noscripts", str(package)], check=True)
    subprocess.run([*rpm_root, "--verify", "--nodeps", "--noscripts", name], check=True)
    binary = installed / "usr/bin" / compiled_input.name
    installed_binary = digest_file(binary)
    if installed_binary != expected_binary:
        raise ValueError("RPM_COMPILED_INPUT_MISMATCH: installed executable differs from the exact Tauri RPM transformation")
    result = {"package": str(package), "version": version, "architecture": architecture,
              "uncompressed_payload_sha256": actual_payload, "file_install": "passed",
              "installed_binary_sha256": installed_binary, "payload_bytes": payload_bytes,
              "compiled_snapshot_sha256": digest_file(compiled_input),
              "expected_installed_binary_sha256": expected_binary,
              "bundle_type_patch": {"offset": marker_offset, "from": "UNK", "to": "RPM"},
              "file_input": "matched immutable compile input with the first Tauri RPM marker", "evidence_root": str(evidence)}
    (evidence / "result.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result))
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("package", type=Path)
    parser.add_argument("--compiled-input", type=Path, required=True)
    args = parser.parse_args()
    check(args.package, args.compiled_input)
