"""Black-box tests consume the final archive and inspect the resulting ZIP."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile


PROJECT = Path(__file__).resolve().parent


class DeliveryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.inputs = self.root / "input data"
        self.inputs.mkdir()
        self.cwd = self.root / "unrelated cwd"
        self.cwd.mkdir()
        self.app = self.cwd / "standalone.pyz"
        shutil.copyfile(PROJECT / "deliverable.pyz", self.app)

    def manifest(self, rows):
        (self.inputs / "manifest.json").write_text(
            json.dumps({"files": rows}, ensure_ascii=False), encoding="utf-8"
        )

    def run_app(self, output="result.zip", success=True):
        result = subprocess.run(
            [sys.executable, "-I", str(self.app), "../input data", "--output", output],
            cwd=self.cwd,
            capture_output=True,
        )
        if success:
            self.assertEqual(result.returncode, 0, result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0)
        return self.cwd / output

    def inspect(self, output, expected):
        with zipfile.ZipFile(output) as archive:
            names = archive.namelist()
            self.assertEqual(len(names), len(set(names)))
            self.assertEqual(set(names), set(expected) | {"_bundle_index.json"})
            self.assertIsNone(archive.testzip())
            actual = {name: archive.read(name) for name in expected}
            self.assertEqual(actual, expected)
            index = json.loads(archive.read("_bundle_index.json"))
            self.assertEqual(
                index,
                {
                    "files": [
                        {"path": name, "bytes": len(expected[name])}
                        for name in sorted(expected)
                    ]
                },
            )
            return actual, index

    def test_exact_bytes_names_and_order_independence(self):
        fixtures = [
            ("first/same.bin", "nested/alpha, one.bin", bytes(range(256)) * 5000),
            ("second/same.bin", "nested/deeper/empty.file", b""),
            (
                "Unicode \u96ea, dots...folder/caf\u00e9.txt",
                "\u96ea/\u00e9 space,...txt",
                "\u96ea\r\ncaf\u00e9\n".encode("utf-8"),
            ),
            ("hidden/.payload", ".hidden/...dots", b"\x00\xff\xfe\r\n"),
            ("z.txt", "Z", b"z"),
            ("a.txt", "a", b"a"),
            ("astral.txt", "\U0001f600.txt", b"astral"),
            ("bmp.txt", "\ue000.txt", b"BMP ordering boundary"),
        ]
        rows = []
        expected = {}
        for source, target, payload in fixtures:
            path = self.inputs / source
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(payload)
            rows.append({"source": source, "target": target})
            expected[target] = payload
        (self.inputs / "unlisted.txt").write_bytes(b"must not ship")
        rows.append({"source": "first/same.bin", "target": "second copy.bin"})
        expected["second copy.bin"] = fixtures[0][2]
        self.manifest(rows)
        first = self.inspect(self.run_app(), expected)
        self.manifest(list(reversed(rows)))
        second = self.inspect(self.run_app("reordered.zip"), expected)
        self.assertEqual(first, second)

    def test_empty_manifest(self):
        self.manifest([])
        self.inspect(self.run_app(), {})

    @unittest.skipUnless(os.name == "nt", "Windows-native source representation")
    def test_native_source_separators(self):
        (self.inputs / "sub").mkdir()
        (self.inputs / "sub" / "native.bin").write_bytes(b"native\x00\xff")
        self.manifest([{"source": "sub\\native.bin", "target": "folder/native.bin"}])
        self.inspect(self.run_app(), {"folder/native.bin": b"native\x00\xff"})

    def test_invalid_manifest_preserves_existing_output(self):
        (self.inputs / "file").write_bytes(b"data")
        for target in (
            "../escape",
            "/absolute",
            "a\\b",
            "_bundle_index.json",
            "a/../b",
        ):
            with self.subTest(target=target):
                self.manifest([{"source": "file", "target": target}])
                output = self.cwd / "result.zip"
                output.write_bytes(b"existing")
                self.run_app(success=False)
                self.assertEqual(output.read_bytes(), b"existing")

    def test_duplicate_and_missing_sources(self):
        (self.inputs / "file").write_bytes(b"data")
        for rows in (
            [{"source": "file", "target": "same"}] * 2,
            [{"source": "missing", "target": "valid"}],
            [{"source": "../outside", "target": "valid"}],
        ):
            self.manifest(rows)
            self.run_app(success=False)
            self.assertFalse((self.cwd / "result.zip").exists())


if __name__ == "__main__":
    unittest.main()
