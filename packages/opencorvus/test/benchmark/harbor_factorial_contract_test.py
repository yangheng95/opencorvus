from __future__ import annotations

import http.server
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.parse

from mcp.server.fastmcp import FastMCP

ROOT = Path(__file__).parents[4]
HELPER = ROOT / "packages/opencorvus/script/benchmark/harbor/run_opencorvus_automationbench.py"
SHARED = ROOT / "packages/inspect-benchmark/src/opencorvus_inspect/automationbench/mcp_tools.py"


def module(path: Path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


class EntrypointContractTest(unittest.TestCase):
    def test_public_task_and_mission_creation_preserve_native_identity(self):
        for entrypoint in ("task", "mission"):
            with self.subTest(entrypoint=entrypoint), tempfile.TemporaryDirectory() as directory:
                helper = module(HELPER)
                helper.PROFILE = "automationbench"
                helper.ENTRYPOINT = entrypoint
                helper.LOGS = Path(directory)
                requests = []

                class Handler(http.server.BaseHTTPRequestHandler):
                    def do_POST(self):
                        route = urllib.parse.urlsplit(self.path).path
                        body = json.loads(self.rfile.read(int(self.headers["content-length"])))
                        requests.append((route, body))
                        value = {"task_id": "t1", "project_id": "p1", "directory": "/workspace"} if route == "/task" else {
                            "created": True, "productPillar": "work", "missionID": "m1", "sessionID": "s1",
                        }
                        self.reply(value)

                    def do_GET(self):
                        self.reply({"id": "t1", "sessionID": "s1"})

                    def reply(self, value):
                        body = json.dumps(value).encode()
                        self.send_response(200)
                        self.send_header("content-length", str(len(body)))
                        self.end_headers()
                        self.wfile.write(body)

                    def log_message(self, *_args):
                        pass

                server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
                thread = threading.Thread(target=server.serve_forever, daemon=True)
                thread.start()
                helper.SERVER = f"http://127.0.0.1:{server.server_port}"
                try:
                    identity = helper.start_execution("USER: perform the original operation")
                    self.assertEqual(identity, ("t1" if entrypoint == "task" else "m1", "s1"))
                    route, body = requests[0]
                    self.assertEqual(route, "/task" if entrypoint == "task" else "/mission/wake")
                    self.assertEqual(body["model"], "openai/gpt-5.6-luna")
                    if entrypoint == "task":
                        self.assertEqual(body["promptProfile"], "automationbench")
                        self.assertEqual(body["request"].split("\n\n")[0], "USER: perform the original operation")
                        self.assertEqual(json.loads((helper.LOGS / "task-create-response.json").read_text())["task_id"], "t1")
                    else:
                        self.assertEqual(body["expertSquadIDs"], ["automationbench"])
                        self.assertEqual(body["text"].split("\n\n")[0], "USER: perform the original operation")
                finally:
                    server.shutdown()
                    server.server_close()
                    thread.join(timeout=2)

    def test_exact_mission_outcomes_settle_even_with_zero_child_tasks(self):
        helper = module(HELPER)
        for outcome in ("accepted", "blocked"):
            observation = {"entrypoint": "mission", "mission_status": {"status": "inactive", "tasks": []},
                           "mission_record": {"outcome": {"kind": outcome}, "interruptible": False},
                           "durable_settlement": {"passed": True}}
            self.assertTrue(helper.natural_terminal(observation))

    def test_task_terminal_and_public_evidence_use_task_identity(self):
        helper = module(HELPER)
        observation = {"entrypoint": "task", "task_ids": ["t1"], "all_transcript": [],
                       "tasks": [{"task_id": "t1", "board": {"task": {"status": "failed"}}, "transcript": []}],
                       "durable_settlement": {"passed": True}}
        self.assertTrue(helper.natural_terminal(observation))
        self.assertEqual(helper.public_observation(observation), {
            "entrypoint": "task", "task_ids": ["t1"], "task_statuses": [{"task_id": "t1", "status": "failed"}],
            "message_count": 0, "durable_settlement": {"passed": True},
        })
        with tempfile.TemporaryDirectory() as directory:
            helper.LOGS = Path(directory)
            helper.capture_observation(observation)
            self.assertEqual(json.loads((helper.LOGS / "task-evidence.json").read_text()), observation["tasks"])


class SharedMcpContractTest(unittest.IsolatedAsyncioTestCase):
    async def test_sdk_exposes_same_four_tools_and_serializes_official_fetch_arguments(self):
        shared = module(SHARED)
        mcp = FastMCP("automationbench")
        calls = []

        def call(name, arguments):
            calls.append((name, arguments))
            return json.dumps({"ok": True})

        shared.register_tools(mcp, call, lambda service: json.dumps({"service": service}))
        declared = await mcp.list_tools()
        self.assertEqual(sorted(tool.name for tool in declared), ["api_catalog", "api_fetch", "api_search", "base64_encode"])
        await mcp.call_tool("api_fetch", {"method": "POST", "url": "https://example.invalid/records", "body": {"title": "original"}})
        self.assertEqual(calls, [("api_fetch", {"method": "POST", "url": "https://example.invalid/records", "params": None, "body": '{"title": "original"}'})])
        await mcp.call_tool("api_search", {"query": "invoice"})
        self.assertEqual(calls[-1], ("api_search", {"query": "invoice", "top_k": 5}))


if __name__ == "__main__":
    unittest.main()
