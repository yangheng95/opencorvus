"""Black-box contract checks of the actual archive, from an isolated cwd."""

import base64
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from demo_server import Handler as DemoHandler


ARCHIVE = Path(__file__).resolve().parent / "deliverable.pyz"


class ArchiveTests(unittest.TestCase):
    def run_batch(self, handler, jobs, expected, suffix="", prefix="/api/v1"):
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as directory:
                cwd = Path(directory)
                shutil.copyfile(ARCHIVE, cwd / "deliverable.pyz")
                base = "http://127.0.0.1:{}{}".format(server.server_port, prefix)
                (cwd / "jobs.json").write_text(
                    json.dumps(
                        {
                            "base_url": base + suffix,
                            "jobs": jobs,
                        },
                        ensure_ascii=False,
                    ),
                    encoding="utf-8",
                )
                result = subprocess.run(
                    [
                        sys.executable,
                        "deliverable.pyz",
                        "jobs.json",
                        "--output",
                        "output folder",
                    ],
                    cwd=cwd,
                    capture_output=True,
                    text=True,
                    env={
                        key: value
                        for key, value in os.environ.items()
                        if key != "PYTHONPATH"
                    },
                    timeout=30,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                root = cwd / "output folder"
                receipt = json.loads(
                    (root / "receipt.json").read_text(encoding="utf-8")
                )
                records = []
                for job, segment, payload in expected:
                    self.assertEqual((root / job["output"]).read_bytes(), payload)
                    records.append(
                        dict(
                            document_id=job["document_id"],
                            output=job["output"],
                            url=base + "/documents/" + segment,
                            bytes=len(payload),
                        )
                    )
                self.assertEqual(
                    receipt,
                    {"files": sorted(records, key=lambda item: item["document_id"])},
                )
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_public_demo(self):
        job = dict(document_id="sample", output="documents/sample.bin")
        self.run_batch(DemoHandler, [job], [(job, "sample", b"sample document\n")])

    def test_identifier_and_output_domains(self):
        # Expected wire segments are literal fixtures, not computed by the downloader.
        fixtures = [
            ("a/b", "a%2Fb", b"\x00\xff\x80\r\n"),
            ("%2F", "%252F", b"literal percent"),
            ("what?x#y", "what%3Fx%23y", b""),
            (
                " snow \u96ea ",
                "%20snow%20%E9%9B%AA%20",
                "Unicode payload \u96ea\n".encode(),
            ),
            ("../business", "..%2Fbusiness", b"legal source ID"),
            ("100%", "100%25", bytes(range(256))),
            ("a\\b", "a%5Cb", b"backslash source ID"),
            (".", ".", b"dot business ID"),
            ("..", "..", b"two dots business ID"),
        ]
        for suffix in ("", "/"):
            seen = []
            expected = []
            routes = {}
            for index, (identifier, segment, payload) in enumerate(fixtures):
                output = os.path.join(
                    "nested folder", "\u96ea", "file {} %2F#.bin".format(index)
                )
                job = dict(document_id=identifier, output=output)
                expected.append((job, segment, payload))
                routes["/tenant/api/v2/documents/" + segment] = (identifier, payload)

            class Handler(BaseHTTPRequestHandler):
                def do_GET(self):
                    seen.append(self.path)
                    if self.path not in routes:
                        self.send_error(404)
                        return
                    identifier, payload = routes[self.path]
                    body = json.dumps(
                        dict(
                            document_id=identifier,
                            content_base64=base64.b64encode(payload).decode(),
                        )
                    ).encode()
                    self.send_response(200)
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)

                def log_message(self, *args):
                    pass

            with self.subTest(trailing_slash=suffix):
                jobs = [item[0] for item in reversed(expected)]
                self.run_batch(Handler, jobs, expected, suffix, "/tenant/api/v2")
                self.assertEqual(
                    seen,
                    [
                        "/tenant/api/v2/documents/" + item[1]
                        for item in reversed(expected)
                    ],
                )

    def test_empty_batch(self):
        self.run_batch(DemoHandler, [], [])


if __name__ == "__main__":
    unittest.main()
