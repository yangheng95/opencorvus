"""Black-box checks of the released archive, with independently supplied bytes."""

import json
from pathlib import Path
import random
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile


APP = Path(__file__).resolve().with_name("deliverable.pyz")


class DeliveryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.inputs = self.root / "input files"
        self.inputs.mkdir()
        self.cwd = self.root / "unrelated cwd"
        self.cwd.mkdir()
        # Only the archive, interpreter and inputs are available at runtime.
        self.app = self.cwd / "standalone.pyz"
        shutil.copyfile(APP, self.app)
        self.output = self.cwd / "output archive.zip"

    def manifest(self, rows):
        (self.inputs / "manifest.json").write_text(
            json.dumps({"files": rows}, ensure_ascii=False), encoding="utf-8"
        )

    def source(self, name, data):
        path = self.inputs / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def run_app(self, output=None):
        return subprocess.run(
            [
                sys.executable,
                "-I",
                str(self.app),
                "../input files",
                "--output",
                str(output or self.output),
            ],
            cwd=self.cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

    def inspect(self, expected):
        with zipfile.ZipFile(self.output) as archive:
            self.assertIsNone(archive.testzip())
            names = [item.filename for item in archive.infolist() if not item.is_dir()]
            self.assertEqual(len(names), len(set(names)))
            self.assertEqual(set(names), set(expected) | {"_bundle_index.json"})
            for name, data in expected.items():
                self.assertEqual(archive.read(name), data)
            index_bytes = archive.read("_bundle_index.json")
            self.assertEqual(
                json.loads(index_bytes),
                {
                    "files": [
                        {"path": name, "bytes": len(expected[name])}
                        for name in sorted(expected)
                    ]
                },
            )
            return index_bytes

    def test_binary_names_nested_and_manifest_permutation(self):
        fixtures = [
            ("left/same.dat", "nested/雪, data.bin", bytes(range(256)) * 5000),
            ("right/same.dat", "other/same.dat", b"\xff\x00\r\n\x80"),
            ("empty", "empty file", b""),
            ("café space, dot.txt", "é/words.txt", "雪\r\ncafé\n".encode("utf-8")),
            (".hidden", ".dots/a..b,c", b"no final newline"),
        ]
        rows = []
        expected = {}
        for source, target, data in fixtures:
            self.source(source, data)
            rows.append({"source": source, "target": target})
            expected[target] = data
        self.source("not selected.txt", b"must not leak")
        self.manifest(rows)
        result = self.run_app()
        self.assertEqual(result.returncode, 0, result.stderr)
        first_index = self.inspect(expected)
        first_zip = self.output.read_bytes()
        self.manifest(list(reversed(rows)))
        result = self.run_app()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.inspect(expected), first_index)
        self.assertEqual(self.output.read_bytes(), first_zip)

    def test_empty_manifest(self):
        self.manifest([])
        self.assertEqual(self.run_app().returncode, 0)
        self.inspect({})

    def test_supplied_sample_with_relative_output(self):
        sample = APP.parent / "sample"
        shutil.copytree(sample, self.inputs, dirs_exist_ok=True)
        rows = json.loads((sample / "manifest.json").read_text(encoding="utf-8"))[
            "files"
        ]
        expected = {
            row["target"]: (sample / row["source"]).read_bytes() for row in rows
        }
        result = self.run_app("output archive.zip")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.inspect(expected)

    def test_archive_contains_current_source_only(self):
        with zipfile.ZipFile(APP) as archive:
            self.assertEqual(archive.namelist(), ["__main__.py"])
            self.assertEqual(
                archive.read("__main__.py"), APP.with_name("main.py").read_bytes()
            )

    def test_many_legal_inputs_and_reused_source(self):
        rng = random.Random(1701)
        expected = {}
        rows = []
        for i in range(40):
            source = "dir {}/same.bin".format(i)
            target = "目录 {}/file,{}.dat".format(i % 7, i)
            data = bytes(rng.randrange(256) for _ in range(i * 37))
            self.source(source, data)
            rows.append({"source": source, "target": target})
            expected[target] = data
        rows.append({"source": rows[3]["source"], "target": "copy/second.bin"})
        expected["copy/second.bin"] = expected[rows[3]["target"]]
        rng.shuffle(rows)
        self.manifest(rows)
        result = self.run_app()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.inspect(expected)

    def test_rejects_invalid_paths_duplicates_and_reserved_index(self):
        self.source("good", b"original")
        for target in (
            "",
            "/abs",
            "../escape",
            "a/../b",
            "a//b",
            "a/./b",
            "C:/abs",
            "a\\b",
            "_bundle_index.json",
        ):
            with self.subTest(target=target):
                self.manifest([{"source": "good", "target": target}])
                self.assertNotEqual(self.run_app().returncode, 0)
                self.assertFalse(self.output.exists())
        self.manifest([{"source": "good", "target": "same"}] * 2)
        self.assertNotEqual(self.run_app().returncode, 0)
        self.assertFalse(self.output.exists())

    def test_missing_source_preserves_existing_output(self):
        self.output.write_bytes(b"previous output")
        self.manifest([{"source": "missing", "target": "file"}])
        self.assertNotEqual(self.run_app().returncode, 0)
        self.assertEqual(self.output.read_bytes(), b"previous output")

    def test_source_traversal_and_output_collision_rejected(self):
        self.source("good", b"original")
        self.manifest([{"source": "../outside", "target": "file"}])
        self.assertNotEqual(self.run_app().returncode, 0)
        self.manifest([{"source": "good", "target": "file"}])
        self.assertNotEqual(self.run_app(self.inputs / "good").returncode, 0)
        self.assertEqual((self.inputs / "good").read_bytes(), b"original")


if __name__ == "__main__":
    unittest.main()
