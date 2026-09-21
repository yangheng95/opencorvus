"""Exercise the real native checker with a small system-rpmbuild package."""

import importlib.util
import hashlib
import json
from pathlib import Path
import platform
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("checker", Path(__file__).with_name("check-rpm-package.py"))
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


class RpmBinaryIdentity(unittest.TestCase):
    def test_binds_the_first_exact_tauri_marker_and_all_other_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            binary = Path(directory) / "compiled"
            binary.write_bytes(b"header\0__TAURI_BUNDLE_TYPE_VAR_UNK\0tail\0__TAURI_BUNDLE_TYPE_VAR_UNK")
            expected = b"header\0__TAURI_BUNDLE_TYPE_VAR_RPM\0tail\0__TAURI_BUNDLE_TYPE_VAR_UNK"
            self.assertEqual(checker.expected_rpm_binary(binary), (hashlib.sha256(expected).hexdigest(), 7))

    def test_classifies_a_missing_compiled_marker(self):
        with tempfile.TemporaryDirectory() as directory:
            binary = Path(directory) / "compiled"
            binary.write_bytes(b"__TAURI_BUNDLE_TYPE_VAR_RPM")
            with self.assertRaisesRegex(ValueError, "RPM_COMPILED_MARKER_MISSING"):
                checker.expected_rpm_binary(binary)


class NativeRpmChecker(unittest.TestCase):
    def test_accepts_verified_payload_and_installed_file_transaction(self):
        root = Path(tempfile.mkdtemp(prefix="opencorvus-rpm-contract-"))
        binary = root / "opencorvus-rpm-check"
        binary.write_bytes(b"#!/bin/sh\n# __TAURI_BUNDLE_TYPE_VAR_UNK\nprintf 'rpm checker contract\\n'\n")
        packaged_binary = root / "packaged-input"
        packaged_binary.write_bytes(b"#!/bin/sh\n# __TAURI_BUNDLE_TYPE_VAR_RPM\nprintf 'rpm checker contract\\n'\n")
        version = json.loads((Path(__file__).resolve().parent.parent / "packages/opencorvus/package.json").read_text())["version"]
        recipe = root / "contract.spec"
        recipe.write_text(f"""Name: opencorvus-rpm-check
Version: {version}
Release: 1
Summary: Native package checker contract
License: MIT
BuildArch: {platform.machine()}
AutoReqProv: no
%description
Native package checker contract.
%install
mkdir -p %{{buildroot}}/usr/bin
install -m 755 {packaged_binary} %{{buildroot}}/usr/bin/{binary.name}
%files
/usr/bin/{binary.name}
""")
        subprocess.run(["rpmbuild", "-bb", "--define", f"_topdir {root}",
                        "--define", "_binary_payload w6.gzdio", str(recipe)], check=True)
        package, = root.glob("RPMS/*/*.rpm")
        result = checker.check(package, binary)
        self.assertEqual(result["file_install"], "passed")
        self.assertEqual(result["installed_binary_sha256"], checker.digest_file(packaged_binary))
        self.assertEqual(result["compiled_snapshot_sha256"], checker.digest_file(binary))
        self.assertEqual(result["version"], version)


if __name__ == "__main__":
    unittest.main()
