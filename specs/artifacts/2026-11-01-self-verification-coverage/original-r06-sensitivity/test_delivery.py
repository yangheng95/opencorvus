"""Black-box acceptance tests against the delivered zipapp and resulting ZIPs."""

import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile


APPLICATION = Path(__file__).resolve().with_name("deliverable.pyz")


class DeliveryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.inputs = self.base / "input space"
        self.inputs.mkdir()
        self.cwd = self.base / "unrelated cwd"
        self.cwd.mkdir()
        self.app = self.cwd / "standalone.pyz"
        shutil.copyfile(APPLICATION, self.app)

    def manifest(self, rows):
        (self.inputs / "manifest.json").write_text(
            json.dumps({"files": rows}, ensure_ascii=False), encoding="utf-8"
        )

    def invoke(self, output="result.zip"):
        return subprocess.run(
            [sys.executable, str(self.app), str(self.inputs), "--output", output],
            cwd=self.cwd,
            capture_output=True,
            text=True,
        )

    def consume(self, name="result.zip"):
        with zipfile.ZipFile(self.cwd / name) as archive:
            self.assertIsNone(archive.testzip())
            names = [info.filename for info in archive.infolist() if not info.is_dir()]
            self.assertEqual(len(names), len(set(names)))
            return {name: archive.read(name) for name in names}

    def test_exact_bytes_names_order_and_standalone_execution(self):
        payloads = [
            ("one/same.bin", "nested/数据, file.bin", bytes(range(256))),
            ("two/same.bin", "z/same.bin", b"\xff\xfe\x00\x80\r\n"),
            ("empty", "empty", b""),
            ("text.txt", "A space, dots.../résumé.txt", "你好\r\n café\n".encode()),
            (".hidden/..dots", ".hidden/...", b"dots"),
            ("large", "大/large", b"\x00\xffabc" * 300000),
        ]
        rows = []
        expected = {}
        for source, target, data in payloads:
            path = self.inputs / source
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            rows.append({"source": source, "target": target})
            expected[target] = data
        (self.inputs / "unlisted.txt").write_bytes(b"must not leak")
        # A source can be selected more than once under different targets.
        rows.append({"source": "one/same.bin", "target": "copy.bin"})
        expected["copy.bin"] = bytes(range(256))
        expected_index = {
            "files": [
                {"path": target, "bytes": len(expected[target])}
                for target in sorted(expected)
            ]
        }
        results = []
        for order in (rows, list(reversed(rows))):
            self.manifest(order)
            process = self.invoke()
            self.assertEqual(process.returncode, 0, process.stderr)
            tree = self.consume()
            index = json.loads(tree.pop("_bundle_index.json"))
            self.assertEqual(tree, expected)
            self.assertEqual(index, expected_index)
            results.append((tree, index))
        self.assertEqual(results[0], results[1])

    def test_empty_manifest(self):
        self.manifest([])
        result = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr)
        tree = self.consume()
        self.assertEqual(set(tree), {"_bundle_index.json"})
        self.assertEqual(json.loads(tree["_bundle_index.json"]), {"files": []})

    def test_relative_input_and_output(self):
        (self.inputs / "data").write_bytes(b"relative")
        self.manifest([{"source": "data", "target": "nested/data"}])
        result = subprocess.run(
            [
                sys.executable,
                "standalone.pyz",
                "../input space",
                "--output",
                "relative.zip",
            ],
            cwd=self.cwd,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.consume("relative.zip")["nested/data"], b"relative")

    def test_invalid_manifests_preserve_existing_output(self):
        (self.inputs / "data").write_bytes(b"original")
        output = self.cwd / "result.zip"
        invalid = [
            [{"source": "../outside", "target": "ok"}],
            [{"source": "data", "target": "../bad"}],
            [{"source": "data", "target": "/absolute"}],
            [{"source": "data", "target": "C:/absolute"}],
            [{"source": "data", "target": "a\\b"}],
            [{"source": "data", "target": ""}],
            [{"source": "missing", "target": "ok"}],
            [{"source": "data", "target": "_bundle_index.json"}],
            [{"source": "data", "target": "same"}] * 2,
            [{"source": 1, "target": "ok"}],
        ]
        for rows in invalid:
            with self.subTest(rows=rows):
                output.write_bytes(b"previous output")
                self.manifest(rows)
                result = self.invoke()
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(output.read_bytes(), b"previous output")


if __name__ == "__main__":
    unittest.main()
