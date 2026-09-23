from __future__ import annotations

import asyncio
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


def load_agent():
    spec = importlib.util.spec_from_file_location("harbor_ab_agent", ADAPTER / "opencorvus_agent.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_scorer():
    spec = importlib.util.spec_from_file_location("harbor_ab_scorer", ADAPTER / "score_harbor.py")
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
            self.assertEqual(config.count('network_mode = "public"'), 3)
            self.assertIn(generator.UPSTREAM_COMMIT, bridge_dockerfile)
            self.assertIn("util-linux", dockerfile)
            self.assertIn("iptables", dockerfile)
            self.assertIn('git -C /workspace commit -qm "Initialize Harbor task workspace"', dockerfile)
            self.assertIn("git config --system --add safe.directory /workspace", dockerfile)
            self.assertIn('cap_add: ["SYS_ADMIN", "NET_ADMIN"]', (task / "environment" / "docker-compose.yaml").read_text(encoding="utf-8"))
            self.assertIn('upstream_example_id = "4014"', config)
            self.assertIn('"task_completed_correctly"', scorer)
            self.assertIn('"partial_credit"', scorer)
            self.assertTrue((task / "environment" / "runtime" / "automationbench_bridge.py").is_file())

    def test_verifier_requires_agent_settlement_before_reward_projection(self) -> None:
        scorer = load_scorer()
        with tempfile.TemporaryDirectory(prefix="harbor-score-eligibility-") as directory:
            path = Path(directory) / "attempt-disposition.json"
            marker = Path(directory) / "agent-settlement.json"
            revoked = Path(directory) / "agent-settlement-revoked.json"
            path.write_text('{"status":"runtime_settled","score_eligible":false}\n', encoding="utf-8")
            marker.write_text(
                json.dumps(
                    {
                        "status": "agent_settled",
                        "runtime_disposition_sha256": __import__("hashlib").sha256(path.read_bytes()).hexdigest(),
                    }
                ),
                encoding="utf-8",
            )
            self.assertEqual(scorer.require_agent_settlement(path, marker, revoked)["status"], "agent_settled")
            path.write_text('{"status":"invalid_bug","score_eligible":false}\n', encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "not score eligible: invalid_bug"):
                scorer.require_agent_settlement(path, marker, revoked)
            revoked.write_text(
                '{"status":"revoked","reason":"late_publication"}\n', encoding="utf-8"
            )
            path.write_text('{"status":"runtime_settled","score_eligible":false}\n', encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "settlement was revoked: late_publication"):
                scorer.require_agent_settlement(path, marker, revoked)

    def test_agent_installs_uid_scoped_egress_policy(self) -> None:
        source = (ADAPTER / "opencorvus_agent.py").read_text(encoding="utf-8")
        self.assertIn("iptables -C OUTPUT -m owner --uid-owner 60001 -j REJECT", source)
        self.assertIn("ip6tables -C OUTPUT -m owner --uid-owner 60001 -j REJECT", source)
        self.assertIn('"provider_uid\\\":0', source)
        self.assertIn("setpriv --reuid=60001 --regid=60001 --clear-groups git -C /workspace", source)
        self.assertIn("workspace-contract.json", source)

    def test_agent_runtime_config_projects_mission_orchestration_only(self) -> None:
        module = load_agent()
        agent = object.__new__(module.OpenCorvusAgent)
        agent._mount_path = "/opt/opencorvus"
        config = agent._runtime_config()
        self.assertEqual(config["skills"], {"paths": ["/opt/opencorvus/share"]})
        self.assertEqual(
            config["agent"]["mission"]["permission"],
            {
                "bash": "deny",
                "publish_interactive_artifact": "deny",
                "read": "deny",
                "glob": "deny",
                "search_code": "deny",
                "list": "deny",
                "edit": "deny",
                "write": "deny",
                "apply_patch": "deny",
                "webfetch": "deny",
                "websearch": "deny",
                "external_code_search": "deny",
                "question": "deny",
                "todo": "deny",
                "memory": "deny",
                "schedule": "deny",
                "planner": "deny",
                "skill_market": "deny",
            },
        )

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
            runtime = root / "linux-runtime"
            (runtime / "node_modules" / "native-package").mkdir(parents=True)
            (runtime / "opencorvus").write_bytes(b"linux-binary")
            (runtime / "package.json").write_text('{"name":"opencorvus-runtime"}\n', encoding="utf-8")
            (runtime / "node_modules" / "native-package" / "package.json").write_text(
                '{"name":"native-package"}\n', encoding="utf-8"
            )
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
            receipt = module.prepare(root / "bundle", runtime, source)
            self.assertEqual(
                [item["path"] for item in receipt["files"]],
                [
                    "bin/restricted-agent-shell.sh",
                    "bin/run-opencorvus-automationbench.py",
                    "node_modules/native-package/package.json",
                    "opencorvus",
                    "package.json",
                    "share/automationbench-api/SKILL.md",
                ],
            )
            self.assertTrue(all(len(item["sha256"]) == 64 for item in receipt["files"]))
            self.assertEqual(len(receipt["source_commit"]), 40)
            self.assertEqual(len(receipt["source_tree"]), 40)

    def test_bundle_materializes_internal_runtime_links_before_hashing(self) -> None:
        if not hasattr(Path, "symlink_to"):
            self.skipTest("path symlinks unavailable")
        spec = importlib.util.spec_from_file_location("harbor_bundle_links", ADAPTER / "prepare_opencorvus_bundle.py")
        assert spec and spec.loader
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory(prefix="harbor-bundle-link-") as directory:
            root = Path(directory)
            runtime = root / "runtime"
            package = runtime / "packages" / "native"
            package.mkdir(parents=True)
            (runtime / "node_modules").mkdir()
            (runtime / "opencorvus").write_bytes(b"binary")
            (runtime / "package.json").write_text("{}\n", encoding="utf-8")
            (package / "index.js").write_text("export default 1\n", encoding="utf-8")
            link = runtime / "node_modules" / "native"
            try:
                link.symlink_to(package, target_is_directory=True)
            except OSError as error:
                self.skipTest(f"directory symlinks unavailable: {error}")
            source = root / "source"
            (source / "script" / "benchmark" / "harbor").mkdir(parents=True)
            external = source / "script" / "benchmark" / "external-agent"
            external.mkdir(parents=True)
            (source / "script" / "benchmark" / "harbor" / "run_opencorvus_automationbench.py").write_text("pass\n", encoding="utf-8")
            (external / "automationbench-api.SKILL.md").write_text("# Skill\n", encoding="utf-8")
            (external / "restricted-agent-shell.sh").write_text("#!/bin/sh\n", encoding="utf-8")
            subprocess.run(["git", "init", "-q", str(source)], check=True)
            subprocess.run(["git", "-C", str(source), "add", "."], check=True)
            subprocess.run(["git", "-C", str(source), "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixture"], check=True)
            receipt = module.prepare(root / "bundle", runtime, source)
            copied = root / "bundle" / "node_modules" / "native" / "index.js"
            self.assertTrue(copied.is_file())
            self.assertFalse((root / "bundle" / "node_modules" / "native").is_symlink())
            self.assertIn("node_modules/native/index.js", [row["path"] for row in receipt["files"]])

    def test_agent_maps_bundle_link_to_integrity_error(self) -> None:
        module = load_agent()
        with tempfile.TemporaryDirectory(prefix="harbor-agent-bundle-link-") as directory:
            root = Path(directory)
            bundle = root / "bundle"
            bundle.mkdir()
            target = bundle / "target"
            target.write_text("sealed\n", encoding="utf-8")
            link = bundle / "linked"
            try:
                link.symlink_to(target)
            except OSError as error:
                self.skipTest(f"file symlinks unavailable: {error}")
            data = target.read_bytes()
            (bundle / "bundle-manifest.json").write_text(
                json.dumps(
                    {
                        "files": [
                            {
                                "path": "target",
                                "bytes": len(data),
                                "sha256": __import__("hashlib").sha256(data).hexdigest(),
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )
            agent = object.__new__(module.OpenCorvusAgent)
            agent._bundle_path = bundle
            with self.assertRaisesRegex(ValueError, "contains a symbolic link: linked"):
                agent._verify_bundle()

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

    def test_mission_capability_audit_accepts_complete_benchmark_boundary(self) -> None:
        helper = load_runtime_helper()
        rules = [
            {"permission": capability, "pattern": "*", "action": "deny"}
            for capability in helper.MISSION_DENIED_CAPABILITIES
        ]
        audit = helper.audit_mission_capability_boundary(
            [{"name": "coding", "permission": []}, {"name": "mission", "permission": rules}]
        )
        self.assertTrue(audit["passed"])
        self.assertEqual(audit["denied_capabilities"], list(helper.MISSION_DENIED_CAPABILITIES))
        self.assertEqual(audit["missing_denials"], [])

    def test_agent_settlement_is_published_after_runtime_audits(self) -> None:
        helper = load_runtime_helper()
        with tempfile.TemporaryDirectory(prefix="harbor-agent-settlement-") as directory:
            old_logs = helper.LOGS
            old_settlement = helper.AGENT_SETTLEMENT
            old_revoked = helper.AGENT_SETTLEMENT_REVOKED
            helper.LOGS = Path(directory)
            helper.AGENT_SETTLEMENT = Path(directory) / "agent-settlement.json"
            helper.AGENT_SETTLEMENT_REVOKED = Path(directory) / "agent-settlement-revoked.json"
            try:
                (helper.LOGS / "attempt-disposition.json").write_text(
                    '{"status":"runtime_settled","score_eligible":false}\n', encoding="utf-8"
                )
                (helper.LOGS / "process-cleanup-audit.json").write_text(
                    '{"survivors":[]}\n', encoding="utf-8"
                )
                (helper.LOGS / "credential-leak-audit.json").write_text(
                    '{"passed":true}\n', encoding="utf-8"
                )
                self.assertEqual(helper.finalize_agent_settled(), 0)
                settlement = json.loads(helper.AGENT_SETTLEMENT.read_text(encoding="utf-8"))
                self.assertEqual(settlement["status"], "agent_settled")
                self.assertEqual(len(settlement["runtime_disposition_sha256"]), 64)
            finally:
                helper.LOGS = old_logs
                helper.AGENT_SETTLEMENT = old_settlement
                helper.AGENT_SETTLEMENT_REVOKED = old_revoked

    def test_agent_settlement_maps_incomplete_runtime_to_error(self) -> None:
        helper = load_runtime_helper()
        with tempfile.TemporaryDirectory(prefix="harbor-agent-incomplete-") as directory:
            old_logs = helper.LOGS
            old_settlement = helper.AGENT_SETTLEMENT
            old_revoked = helper.AGENT_SETTLEMENT_REVOKED
            helper.LOGS = Path(directory)
            helper.AGENT_SETTLEMENT = Path(directory) / "agent-settlement.json"
            helper.AGENT_SETTLEMENT_REVOKED = Path(directory) / "agent-settlement-revoked.json"
            try:
                (helper.LOGS / "attempt-disposition.json").write_text(
                    '{"status":"invalid_bug","score_eligible":false}\n', encoding="utf-8"
                )
                with self.assertRaisesRegex(RuntimeError, "requires runtime_settled"):
                    helper.finalize_agent_settled()
            finally:
                helper.LOGS = old_logs
                helper.AGENT_SETTLEMENT = old_settlement
                helper.AGENT_SETTLEMENT_REVOKED = old_revoked

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


class HarborAgentSettlementOrderTest(unittest.IsolatedAsyncioTestCase):
    class Environment:
        async def upload_file(self, *_args, **_kwargs):
            return None

    def make_agent(self):
        module = load_agent()
        agent = object.__new__(module.OpenCorvusAgent)
        agent._mount_path = "/opt/opencorvus"
        agent._model = "openai/gpt-5.6-luna"
        agent._profile = "base"
        agent._workflow = "source-planned-execution-verification"
        agent._inactivity_seconds = 600
        agent.render_instruction = lambda instruction: instruction
        return agent

    async def test_primary_error_cleans_up_without_publishing_settlement(self) -> None:
        with tempfile.TemporaryDirectory(prefix="harbor-agent-run-error-") as directory:
            agent = self.make_agent()
            agent.logs_dir = Path(directory)
            events: list[str] = []

            async def execute(*_args, **_kwargs):
                events.append("execute_error")
                raise RuntimeError("agent execution failed")

            async def cleanup(*_args, **_kwargs):
                events.append("cleanup_capture")

            async def finalize(*_args, **_kwargs):
                events.append("finalize")

            agent.exec_as_agent = execute
            agent._cleanup_and_capture_runtime = cleanup
            agent._finalize_agent_settlement = finalize
            with self.assertRaisesRegex(RuntimeError, "agent execution failed"):
                await agent.run("instruction", self.Environment(), object())
            self.assertEqual(events, ["execute_error", "cleanup_capture"])

    async def test_success_publishes_settlement_after_cleanup_and_capture(self) -> None:
        with tempfile.TemporaryDirectory(prefix="harbor-agent-run-success-") as directory:
            agent = self.make_agent()
            agent.logs_dir = Path(directory)
            events: list[str] = []

            async def execute(*_args, **_kwargs):
                events.append("execute")

            async def cleanup(*_args, **_kwargs):
                events.append("cleanup_capture")

            async def finalize(*_args, **_kwargs):
                events.append("finalize")

            agent.exec_as_agent = execute
            agent._cleanup_and_capture_runtime = cleanup
            agent._finalize_agent_settlement = finalize
            await agent.run("instruction", self.Environment(), object())
            self.assertEqual(events, ["execute", "cleanup_capture", "finalize"])

    async def test_cancelled_settlement_publication_revokes_marker(self) -> None:
        agent = self.make_agent()
        calls: list[str] = []

        async def exec_as_root(_environment, command, **_kwargs):
            if "--revoke-agent-settlement" in command:
                calls.append("revoke")
                return None
            calls.append("publish")
            raise asyncio.CancelledError()

        agent.exec_as_root = exec_as_root
        with self.assertRaises(asyncio.CancelledError):
            await agent._finalize_agent_settlement(self.Environment())
        self.assertEqual(calls, ["publish", "revoke"])


if __name__ == "__main__":
    unittest.main()
