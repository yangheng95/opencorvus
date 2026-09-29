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
    def test_clock_context_preserves_supplied_and_unspecified_values(self):
        generator = module(HELPER.with_name("generate_automationbench_tasks.py"))
        prompt = [{"role": "system", "content": "Original rule."}, {"role": "user", "content": "Original request."}]
        for clock in ("2026-02-26T10:00:00", "2026-02-15T10:00:00Z", None):
            with self.subTest(clock=clock):
                text = generator.render_instruction(prompt, current_time=clock)
                expected = clock if clock is not None else "unspecified in the official sample."
                self.assertIn("Simulated business current_time: " + expected, text)
                self.assertTrue(text.endswith("SYSTEM:\nOriginal rule.\n\nUSER:\nOriginal request.\n"))
        for clock in ("", "not-a-date", 42):
            with self.subTest(clock=clock), self.assertRaisesRegex(ValueError, "Official current_time must be an ISO 8601 string"):
                generator.render_instruction(prompt, current_time=clock)

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
                    generator = module(HELPER.with_name("generate_automationbench_tasks.py"))
                    instruction = generator.render_instruction(
                        [{"role": "user", "content": "perform the original operation"}],
                        current_time="2026-02-15T10:00:00Z",
                    )
                    identity = helper.start_execution(instruction)
                    self.assertEqual(identity, ("t1" if entrypoint == "task" else "m1", "s1"))
                    route, body = requests[0]
                    self.assertEqual(route, "/task" if entrypoint == "task" else "/mission/wake")
                    self.assertEqual(body["model"], "openai/gpt-5.6-luna")
                    if entrypoint == "task":
                        self.assertEqual(body["promptProfile"], "automationbench")
                        self.assertEqual(body["request"].split("\n\n[OpenCorvus harness notice]")[0], instruction)
                        self.assertEqual(json.loads((helper.LOGS / "task-create-response.json").read_text())["task_id"], "t1")
                    else:
                        self.assertEqual(body["expertSquadIDs"], ["automationbench"])
                        self.assertEqual(body["text"].split("\n\n[OpenCorvus harness notice]")[0], instruction)
                        self.assertIn("Create one initial business Task", body["text"])
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

    def test_workflow_receipt_uses_package_and_successful_dispatch_facts(self):
        helper = module(HELPER)
        helper.PROFILE = "automationbench"
        helper.WORKFLOW = "execute-verify"
        subject = {"kind": "virtual_workflow", "workflow_id": "execute-verify", "node_id": "executor"}
        package = {"id": "automationbench", "version": "frozen", "package_digest": "immutable-identity"}
        observation = {"tasks": [{"task_id": "t1", "board": {"task": {"packageRevisionBinding": package}},
            "transcript": [{"parts": [
                {"type": "tool", "tool": "dispatch_agent", "callID": "initial", "state": {"status": "completed",
                 "input": {"dispatch": {"target": "executor", "turn": {"kind": "initial", "workflow_subject": subject}}}}},
                {"type": "tool", "tool": "dispatch_agent", "callID": "repair", "state": {"status": "completed",
                 "input": {"dispatch": {"target": "executor", "turn": {"kind": "continuation"}}}}},
            ]}]}]}
        audit = helper.workflow_audit(observation)
        self.assertEqual(audit, {"identity_matches": True, "expected_workflow": "execute-verify",
            "bindings": [{"task_id": "t1", "package": package, "workflow_observation": "observed", "dispatches": [
                {"call_id": "initial", "target": "executor", "turn_kind": "initial", "workflow_subject": subject},
                {"call_id": "repair", "target": "executor", "turn_kind": "continuation", "workflow_subject": None},
            ]}], "violations": []})

    def test_public_cancellation_preserves_root_and_owned_children(self):
        for entrypoint, abort_error in (("task", False), ("mission", False), ("mission", True)):
            with self.subTest(entrypoint=entrypoint, abort_error=abort_error), tempfile.TemporaryDirectory() as directory:
                helper = module(HELPER)
                helper.ENTRYPOINT = entrypoint
                helper.LOGS = Path(directory)
                receipt_name = "mission-wake-response.json" if entrypoint == "mission" else "task-create-response.json"
                helper.write_json(helper.LOGS / receipt_name, {"missionID": "m1"} if entrypoint == "mission" else {"task_id": "t1"})
                helper.write_json(helper.LOGS / "last-public-observation.json", {"mission_id": "m1", "task_ids": ["t1"]})
                calls = []

                class Handler(http.server.BaseHTTPRequestHandler):
                    def do_POST(self):
                        path = urllib.parse.urlsplit(self.path).path
                        body = json.loads(self.rfile.read(int(self.headers["content-length"])))
                        calls.append((path, body))
                        if path.endswith("/abort") and abort_error:
                            self.reply({"name": "TaskCancellationIncompleteError", "data": {"handle": "mission.abort"}}, status=409)
                            return
                        self.reply(True if path.endswith("/abort") else {"task_id": "t1", "status": "cancelled"})

                    def do_GET(self):
                        path = urllib.parse.urlsplit(self.path).path
                        self.reply({"tasks": [{"taskID": "t1"}, {"taskID": "t2"}]} if path.endswith("/status") else
                                   {"id": path.rsplit("/", 1)[-1], "status": "completed" if path.endswith("/t2") else "active"})

                    def reply(self, value, status=200):
                        body = json.dumps(value).encode()
                        self.send_response(status)
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
                    result = helper.cancel_admitted_execution()
                    expected = ["/mission/m1/abort", "/task/t1/cancel"] if entrypoint == "mission" else ["/task/t1/cancel"]
                    self.assertEqual([path for path, body in calls], expected)
                    self.assertEqual(result["request_status"], "incomplete" if abort_error else "acknowledged")
                    if abort_error:
                        self.assertEqual(result["actions"][0]["status"], "error")
                        self.assertIn("TaskCancellationIncompleteError", result["actions"][0]["message"])
                    self.assertEqual(result["root_id"], "m1" if entrypoint == "mission" else "t1")
                    self.assertTrue(all(body == {"surface": "api", "reason": "Harbor observation ended before natural settlement"} for path, body in calls))
                    if entrypoint == "mission":
                        self.assertEqual(result["actions"][-1], {"task_id": "t2", "status": "already_terminal", "native_status": "completed"})
                finally:
                    server.shutdown()
                    server.server_close()
                    thread.join(timeout=2)

    def test_harbor_totals_include_cached_input_and_reasoning_output(self):
        from harbor.models.agent.context import AgentContext
        adapter = module(HELPER.with_name("opencorvus_agent.py"))
        with tempfile.TemporaryDirectory() as directory:
            agent = object.__new__(adapter.OpenCorvusAgent)
            agent.logs_dir = Path(directory)
            agent._model = "openai/gpt-5.6-luna"
            agent._runtime_version = "0.1.18"
            agent._entrypoint = "task"
            agent._profile = "automationbench"
            tokens = {"input": 20, "cache_read": 70, "cache_write": 10, "output": 8, "reasoning": 2, "cost_usd": 0.0}
            (agent.logs_dir / "terminal-summary.json").write_text(json.dumps({"session_id": "s1", "tokens": tokens}))
            (agent.logs_dir / "opencorvus-transcript.json").write_text(json.dumps([
                {"info": {"role": "assistant"}, "parts": [{"type": "text", "text": "Recorded result."}]}
            ]))
            context = AgentContext()
            agent.populate_context_post_run(context)
            self.assertEqual((context.n_input_tokens, context.n_cache_tokens, context.n_output_tokens), (100, 70, 10))
            self.assertEqual(context.metadata, {"runtime_tokens": tokens, "local_estimated_cost_usd": 0.0, "external_billing": "unknown"})
            self.assertEqual(json.loads((agent.logs_dir / "trajectory.json").read_text())["final_metrics"]["total_prompt_tokens"], 100)


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
