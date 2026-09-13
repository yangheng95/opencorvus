from __future__ import annotations

import http.server
import json
import socket
import socketserver
import subprocess
import tempfile
import threading
import unittest
from pathlib import Path


class UnixHTTPServer(socketserver.UnixStreamServer):
    allow_reuse_address = True


class RecordingHandler(http.server.BaseHTTPRequestHandler):
    records: list[tuple[str, dict]] = []
    drop_routes: set[str] = set()

    def do_POST(self) -> None:
        body = json.loads(self.rfile.read(int(self.headers["content-length"])))
        self.records.append((self.path, body))
        if self.path in self.drop_routes:
            self.connection.shutdown(socket.SHUT_RDWR)
            self.connection.close()
            return
        status = 404 if self.path == "/v1/base64" else 200
        payload = (
            {"error": {"code": 404, "message": "record unavailable"}}
            if self.path == "/v1/fetch" and body.get("url") == "https://example.test/typed-404"
            else {"route": self.path, "accepted": status < 400}
        )
        response = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)

    def log_message(self, format: str, *args: object) -> None:
        pass


class AutomationBenchToolBatchTest(unittest.TestCase):
    def run_client(
        self,
        arguments: list[str],
        standard_input: str | None = None,
        *,
        check: bool = True,
        drop_routes: set[str] | None = None,
    ) -> tuple[subprocess.CompletedProcess[str], list[tuple[str, dict]]]:
        with tempfile.TemporaryDirectory(prefix="ab-tool-") as directory:
            root = Path(directory)
            socket_path = root / "tool.sock"
            config_path = root / "config.json"
            config_path.write_text(json.dumps({"socket_path": str(socket_path)}), encoding="utf-8")
            RecordingHandler.records = []
            RecordingHandler.drop_routes = drop_routes or set()
            server = UnixHTTPServer(str(socket_path), RecordingHandler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                result = subprocess.run(
                    ["python3", str(Path(__file__).with_name("automationbench_tool.py")), "--config", str(config_path), *arguments],
                    input=standard_input,
                    text=True,
                    capture_output=True,
                    check=check,
                )
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)
        return result, RecordingHandler.records

    def test_single_search_preserves_the_existing_transport_contract(self) -> None:
        result, records = self.run_client(["search", "LinkedIn post", "--top-k", "3"])
        self.assertEqual(records, [("/v1/search", {"query": "LinkedIn post", "top_k": 3})])
        self.assertEqual(json.loads(result.stdout), {"route": "/v1/search", "accepted": True})

    def test_batch_preserves_order_payloads_and_typed_statuses(self) -> None:
        operations = [
            {"command": "search", "query": "current policy", "top_k": 7},
            {"command": "fetch", "method": "GET", "url": "https://example.test/items", "params": {"q": "Nimbus"}},
            {"command": "base64", "text": "hello"},
        ]
        result, records = self.run_client(["batch"], json.dumps(operations))

        self.assertEqual(
            records,
            [
                ("/v1/search", {"query": "current policy", "top_k": 7}),
                ("/v1/fetch", {"method": "GET", "url": "https://example.test/items", "params": '{"q":"Nimbus"}', "body": None}),
                ("/v1/base64", {"text": "hello"}),
            ],
        )
        output = json.loads(result.stdout)
        self.assertFalse(output["transport_complete"])
        self.assertEqual([item["transport_status"] for item in output["results"]], [200, 200, 404])
        self.assertEqual([item["transport_ok"] for item in output["results"]], [True, True, False])
        self.assertEqual([item["body"]["route"] for item in output["results"]], ["/v1/search", "/v1/fetch", "/v1/base64"])

    def test_batch_validates_every_operation_before_starting_requests(self) -> None:
        operations = [
            {"command": "search", "query": "current policy", "top_k": 5},
            {"command": "fetch", "method": "POST", "url": "https://example.test/mutate", "body": {}},
        ]
        result, records = self.run_client(["batch"], json.dumps(operations), check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(records, [])
        self.assertEqual(result.stdout, "")
        self.assertIn("batch fetch permits GET only", result.stderr)

    def test_batch_reports_completed_unknown_and_unexecuted_partitions(self) -> None:
        operations = [
            {"command": "search", "query": "current policy", "top_k": 5},
            {"command": "base64", "text": "disconnect"},
            {"command": "search", "query": "must not execute", "top_k": 5},
        ]
        result, records = self.run_client(["batch"], json.dumps(operations), drop_routes={"/v1/base64"})
        self.assertEqual([route for route, _ in records], ["/v1/search", "/v1/base64"])
        output = json.loads(result.stdout)
        self.assertFalse(output["transport_complete"])
        self.assertEqual(output["results"][0]["transport_status"], 200)
        self.assertEqual(
            output["results"][1],
            {"index": 1, "transport_ok": False, "error": {"type": "transport_outcome_unknown"}},
        )
        self.assertEqual(
            output["results"][2],
            {
                "index": 2,
                "transport_ok": False,
                "error": {"type": "not_executed", "reason": "prior_transport_error"},
            },
        )

    def test_batch_keeps_official_typed_error_inside_successful_transport_body(self) -> None:
        operations = [
            {"command": "fetch", "method": "GET", "url": "https://example.test/typed-404", "params": {}},
        ]
        result, records = self.run_client(["batch"], json.dumps(operations))
        self.assertEqual([route for route, _ in records], ["/v1/fetch"])
        output = json.loads(result.stdout)
        self.assertTrue(output["transport_complete"])
        self.assertEqual(output["results"][0]["transport_status"], 200)
        self.assertTrue(output["results"][0]["transport_ok"])
        self.assertEqual(output["results"][0]["body"]["error"]["code"], 404)


if __name__ == "__main__":
    unittest.main()
