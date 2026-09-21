"""Exercise the real native checker with a small system-rpmbuild package."""

import importlib.util
import json
from pathlib import Path
import platform
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("checker", Path(__file__).with_name("check-rpm-package.py"))
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


class NativeRpmChecker(unittest.TestCase):
    def test_accepts_verified_payload_and_installed_file_transaction(self):
        root = Path(tempfile.mkdtemp(prefix="opencorvus-rpm-contract-"))
        binary = root / "opencorvus-rpm-check"
        binary.write_bytes(b"#!/bin/sh\nprintf 'rpm checker contract\\n'\n")
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
install -m 755 {binary} %{{buildroot}}/usr/bin/{binary.name}
%files
/usr/bin/{binary.name}
""")
        subprocess.run(["rpmbuild", "-bb", "--define", f"_topdir {root}",
                        "--define", "_binary_payload w6.gzdio", str(recipe)], check=True)
        package, = root.glob("RPMS/*/*.rpm")
        result = checker.check(package, binary, binary)
        self.assertEqual(result["file_install"], "passed")
        self.assertEqual(result["bundled_input_sha256"], checker.digest_file(binary))
        self.assertEqual(result["version"], version)


if __name__ == "__main__":
    unittest.main()
