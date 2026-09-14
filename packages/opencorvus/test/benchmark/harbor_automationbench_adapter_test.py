from __future__ import annotations

import importlib.util
import http.server
import json
import subprocess
import sys
import tempfile
import threading
import types
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[2]
ADAPTER = ROOT / "script" / "benchmark" / "harbor"
EXTERNAL = ROOT / "script" / "benchmark" / "external-agent"


def load_generator():
    package = types.ModuleType("automationbench")
    domains = types.ModuleType("automationbench.domains")
    contract = types.ModuleType("automationbench.task_contract")
    domains.get_domain_dataset = lambda _domain: []
    contract.task_contract_sha256 = lambda **_kwargs: "a" * 64
    sys.modules["automationbench"] = package
    sys.modules["automationbench.domains"] = domains
    sys.modules["automationbench.task_contract"] = contract
    spec = importlib.util.spec_from_file_location("harbor_ab_generator", ADAPTER / "generate_automationbench_tasks.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_runtime_helper():
    spec = importlib.util.spec_from_file_location(
        "harbor_ab_runtime", ADAPTER / "run_opencorvus_automationbench.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class HarborAutomationBenchAdapterTest(unittest.TestCase):
    def test_instruction_preserves_real_roles_and_one_authority_block(self) -> None:
        generator = load_generator()
        prompt = [
            {"role": "system", "content": "Use official APIs."},
            {
                "role": "user",
                "content": "Create the invoices. " + generator.STOCK_BUDGET + " Keep exact totals.",
            },
        ]
        rendered = generator.render_instruction(prompt)
        self.assertIn("SYSTEM:\nUse official APIs.", rendered)
        self.assertIn("USER:\nCreate the invoices. " + generator.STOCK_BUDGET + " Keep exact totals.", rendered)
        self.assertEqual(rendered.count(generator.STOCK_BUDGET), 1)

    def test_export_emits_one_native_harbor_task_with_official_verifier(self) -> None:
        generator = load_generator()
        generator.load_case = lambda _domain, _task: {
            "example_id": 4014,
            "info": {"assertions": [], "initial_state": {}, "zapier_tools": [], "task_name": "finance.wave_freelance_invoice"},
            "prompt": [
                {"role": "system", "content": "Use official APIs."},
                {"role": "user", "content": "Do the task. " + generator.STOCK_BUDGET},
            ]
        }
        with tempfile.TemporaryDirectory(prefix="harbor-ab-") as directory:
            task = generator.export_task(Path(directory), "finance", "wave_freelance_invoice", EXTERNAL)
            config = (task / "task.toml").read_text(encoding="utf-8")
            dockerfile = (task / "environment" / "Dockerfile").read_text(encoding="utf-8")
            bridge_dockerfile = (task / "environment" / "Bridge.Dockerfile").read_text(encoding="utf-8")
            scorer = (task / "tests" / "score_harbor.py").read_text(encoding="utf-8")
            self.assertIn('name = "automationbench/finance-wave-freelance-invoice"', config)
            self.assertIn('user = "root"', config)
            self.assertIn('network_mode = "allowlist"', config)
            self.assertIn('network_mode = "no-network"', config)
            self.assertIn(generator.UPSTREAM_COMMIT, bridge_dockerfile)
            self.assertIn("util-linux", dockerfile)
            self.assertIn('upstream_example_id = "4014"', config)
            self.assertIn('"task_completed_correctly"', scorer)
            self.assertIn('"partial_credit"', scorer)
            self.assertTrue((task / "environment" / "runtime" / "automationbench_bridge.py").is_file())

    def test_job_selects_public_custom_agent_and_one_case(self) -> None:
        import yaml

        config = yaml.safe_load((ADAPTER / "job-base-case2.yaml").read_text(encoding="utf-8"))
        self.assertEqual(config["agents"][0]["import_path"], "opencorvus_agent:OpenCorvusAgent")
        self.assertEqual(config["agents"][0]["kwargs"]["OPENCORVUS_PROFILE"], "base")
        self.assertEqual(
            config["agents"][0]["kwargs"]["OPENCORVUS_WORKFLOW"],
            "source-planned-execution-verification",
        )
        self.assertEqual(
            config["datasets"][0]["task_names"],
            ["finance-wave-freelance-invoice"],
        )
        self.assertEqual(config["n_concurrent_trials"], 1)

    def test_bridge_declares_root_scoped_admin_socket_contract(self) -> None:
        source = (EXTERNAL / "automationbench_bridge.py").read_text(encoding="utf-8")
        self.assertIn('parser.add_argument("--admin-socket", type=Path)', source)
        self.assertIn('"admin_transport": "unix_socket_root_scoped"', source)
        self.assertIn("os.chmod(args.admin_socket, 0o600)", source)

    def test_bundle_manifest_fixes_binary_helper_and_skill(self) -> None:
        spec = importlib.util.spec_from_file_location("harbor_bundle", ADAPTER / "prepare_opencorvus_bundle.py")
        assert spec and spec.loader
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="harbor-bundle-") as directory:
            root = Path(directory)
            binary = root / "linux-opencorvus"
            binary.write_bytes(b"linux-binary")
            source = root / "source"
            skill = source / "script" / "benchmark" / "external-agent"
            skill.mkdir(parents=True)
            helper = source / "script" / "benchmark" / "harbor"
            helper.mkdir(parents=True)
            (skill / "automationbench-api.SKILL.md").write_text("# Skill\n", encoding="utf-8")
            (skill / "restricted-agent-shell.sh").write_text("#!/bin/sh\n", encoding="utf-8")
            (helper / "run_opencorvus_automationbench.py").write_text("print('helper')\n", encoding="utf-8")
            subprocess.run(["git", "init", "-q", str(source)], check=True)
            subprocess.run(["git", "-C", str(source), "add", "."], check=True)
            subprocess.run(
                ["git", "-C", str(source), "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixture"],
                check=True,
            )
            receipt = module.prepare(root / "bundle", binary, source)
            self.assertEqual(
                [item["path"] for item in receipt["files"]],
                [
                    "bin/restricted-agent-shell.sh",
                    "bin/run-opencorvus-automationbench.py",
                    "opencorvus",
                    "share/automationbench-api/SKILL.md",
                ],
            )
            self.assertTrue(all(len(item["sha256"]) == 64 for item in receipt["files"]))
            self.assertEqual(len(receipt["source_commit"]), 40)
            self.assertEqual(len(receipt["source_tree"]), 40)

    def test_skill_audit_requires_load_only_for_real_client_callers(self) -> None:
        helper = load_runtime_helper()
        messages = [
            {
                "info": {"id": "m1", "role": "assistant", "agent": "orchestrator", "sessionID": "s1", "time": {"created": 1}},
                "parts": [{"type": "tool", "tool": "panel_read_task", "state": {"status": "completed", "input": {}}}],
            },
            {
                "info": {"id": "m2", "role": "assistant", "agent": "base-developer", "sessionID": "s2", "time": {"created": 2}},
                "parts": [
                    {"type": "tool", "tool": "artifact_read", "state": {"status": "completed", "input": {}}},
                    {"type": "tool", "tool": "skill", "state": {"status": "completed", "input": {"name": "automationbench-api"}}},
                    {"type": "tool", "tool": "bash", "state": {"status": "completed", "input": {"command": "python3 automationbench_tool.py search invoice"}}},
                ],
            },
        ]
        audit = helper.audit_skill_load_order(messages, ["orchestrator", "base-developer"])
        self.assertTrue(audit["passed"])
        self.assertEqual(audit["benchmark_client_callers"], [{"agent_id": "base-developer", "session_id": "s2"}])

    def test_skill_audit_distinguishes_reading_client_source_from_execution(self) -> None:
        helper = load_runtime_helper()
        messages = [
            {
                "info": {"id": "m1", "role": "assistant", "agent": "base-developer", "sessionID": "s1", "time": {"created": 1}},
                "parts": [
                    {"type": "tool", "tool": "bash", "state": {"status": "completed", "input": {"command": "cat automationbench_tool.py"}}},
                    {"type": "tool", "tool": "bash", "state": {"status": "completed", "input": {"command": "echo python3 automationbench_tool.py"}}},
                    {"type": "tool", "tool": "dispatch_agent", "state": {"status": "completed", "input": {"instruction": "Use python3 automationbench_tool.py after loading the Skill"}}},
                ],
            }
        ]
        audit = helper.audit_skill_load_order(messages, ["base-developer"])
        self.assertFalse(audit["passed"])
        self.assertEqual(audit["benchmark_client_callers"], [])
        self.assertEqual(len(audit["unknown_client_commands"]), 2)

    def test_natural_terminal_accepts_truthful_business_failure(self) -> None:
        helper = load_runtime_helper()
        observation = {
            "mission_status": {
                "status": "inactive",
                "tasks": [{"lifecycleStatus": "failed"}],
            },
            "mission_record": {"completion": None, "interruptible": False},
            "durable_settlement": {"passed": True},
        }
        self.assertTrue(helper.natural_terminal(observation))

    def test_helper_authenticates_every_server_request(self) -> None:
        helper = load_runtime_helper()

        class Handler(http.server.BaseHTTPRequestHandler):
            authorization = ""

            def do_GET(self) -> None:
                type(self).authorization = self.headers.get("authorization", "")
                body = b'{"ok":true}'
                self.send_response(200)
                self.send_header("content-type", "application/json")
                self.send_header("content-length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, _format: str, *_args: object) -> None:
                return

        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        old_server = helper.SERVER
        old_password = helper.os.environ.get("OPENCORVUS_SERVER_PASSWORD")
        try:
            helper.SERVER = f"http://127.0.0.1:{server.server_port}"
            helper.os.environ["OPENCORVUS_SERVER_PASSWORD"] = "non-secret-test-password"
            self.assertEqual(helper.request_json("/health", project_scoped=False), {"ok": True})
            self.assertTrue(Handler.authorization.startswith("Basic "))
        finally:
            helper.SERVER = old_server
            if old_password is None:
                helper.os.environ.pop("OPENCORVUS_SERVER_PASSWORD", None)
            else:
                helper.os.environ["OPENCORVUS_SERVER_PASSWORD"] = old_password
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
