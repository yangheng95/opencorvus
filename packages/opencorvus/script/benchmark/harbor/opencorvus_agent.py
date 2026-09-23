"""Harbor Installed Agent adapter for OpenCorvus Mission/Base AutomationBench trials."""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import shlex
import stat
from pathlib import Path
import tempfile
from types import TracebackType
from typing import Any

from harbor.agents.installed.base import BaseInstalledAgent
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext
from harbor.models.trajectories.agent import Agent
from harbor.models.trajectories.final_metrics import FinalMetrics
from harbor.models.trajectories.step import Step
from harbor.models.trajectories.tool_call import ToolCall
from harbor.models.trajectories.trajectory import Trajectory

class OpenCorvusAgent(BaseInstalledAgent):
    """Run one official task through a real OpenCorvus Mission and Base Squad."""

    SUPPORTS_ATIF = True

    def __init__(self, logs_dir: Path, *args: Any, **kwargs: Any):
        self._runtime_version = str(kwargs.pop("OPENCORVUS_VERSION", "unknown"))
        self._mount_path = str(kwargs.pop("mount_path", "/opt/opencorvus"))
        self._model = str(kwargs.pop("OPENCORVUS_MODEL", "openai/gpt-5.6-luna"))
        self._profile = str(kwargs.pop("OPENCORVUS_PROFILE", "base"))
        self._workflow = str(
            kwargs.pop("OPENCORVUS_WORKFLOW", "source-planned-execution-verification")
        )
        self._inactivity_seconds = int(kwargs.pop("OPENCORVUS_INACTIVITY_SECONDS", 600))
        self._bundle_path = Path(str(kwargs.pop("OPENCORVUS_BUNDLE_PATH")))
        self._auth_path = Path(str(kwargs.pop("OPENCORVUS_AUTH_PATH")))
        self._models_path = Path(str(kwargs.pop("OPENCORVUS_MODELS_PATH")))
        for unused in (
            "model_params",
            "connection",
            "instance_id",
            "context_window",
            "context_compact_pct",
        ):
            kwargs.pop(unused, None)
        super().__init__(logs_dir, *args, version=self._runtime_version, **kwargs)

    @staticmethod
    def name() -> str:
        return "opencorvus"

    def get_version_command(self) -> str | None:
        return f"{shlex.quote(self._mount_path)}/opencorvus --version"

    def _runtime_config(self) -> dict[str, object]:
        return {
            "skills": {"paths": [f"{self._mount_path}/share"]},
            "agent": {
                "mission": {
                    "permission": {
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
                    }
                }
            },
        }

    def _verify_bundle(self) -> None:
        actual: set[str] = set()
        for directory, names, files in os.walk(self._bundle_path, followlinks=False):
            for name in [*names, *files]:
                path = Path(directory) / name
                mode = path.lstat().st_mode
                relative = path.relative_to(self._bundle_path).as_posix()
                if stat.S_ISLNK(mode):
                    raise ValueError(f"OpenCorvus bundle contains a symbolic link: {relative}")
                if stat.S_ISREG(mode):
                    if path.name != "bundle-manifest.json":
                        actual.add(relative)
                elif not stat.S_ISDIR(mode):
                    raise ValueError(f"OpenCorvus bundle contains a special file: {relative}")
        manifest_path = self._bundle_path / "bundle-manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        rows = manifest.get("files") if isinstance(manifest, dict) else None
        if not isinstance(rows, list) or not rows:
            raise ValueError("OpenCorvus bundle manifest has no files")
        recorded: set[str] = set()
        for row in rows:
            relative = str(row.get("path") or "")
            path = self._bundle_path / relative
            if not relative or not path.is_file():
                raise ValueError(f"OpenCorvus bundle file is missing: {relative}")
            data = path.read_bytes()
            size = row.get("bytes")
            if not isinstance(size, int) or len(data) != size or hashlib.sha256(data).hexdigest() != row.get("sha256"):
                raise ValueError(f"OpenCorvus bundle identity mismatch: {relative}")
            recorded.add(relative)
        if actual != recorded:
            raise ValueError("OpenCorvus bundle manifest does not cover the exact file set")

    async def install(self, environment: BaseEnvironment) -> None:
        for path, label in (
            (self._bundle_path, "OpenCorvus bundle"),
            (self._auth_path, "Provider auth projection"),
            (self._models_path, "Provider model projection"),
        ):
            if not path.exists():
                raise FileNotFoundError(f"{label} is missing: {path}")
        self._verify_bundle()
        await environment.upload_dir(self._bundle_path, "/opt/opencorvus")
        await environment.upload_file(self._auth_path, "/tmp/opencorvus-auth.json")
        await environment.upload_file(self._models_path, "/tmp/opencorvus-models.json")
        await self.exec_as_root(
            environment,
            command=(
                "command -v curl >/dev/null 2>&1 && command -v python3 >/dev/null 2>&1 "
                "&& command -v git >/dev/null 2>&1 && command -v ps >/dev/null 2>&1 && exit 0; "
                "if command -v apt-get >/dev/null 2>&1; then "
                "apt-get update && apt-get install -y --no-install-recommends "
                "ca-certificates curl git procps python3; "
                "elif command -v apk >/dev/null 2>&1; then "
                "apk add --no-cache bash ca-certificates curl git procps python3; "
                "elif command -v yum >/dev/null 2>&1; then "
                "yum install -y ca-certificates curl git procps-ng python3; "
                "fi"
            ),
            env={"DEBIAN_FRONTEND": "noninteractive"},
        )
        run_user = getattr(environment, "default_user", None)
        mount = shlex.quote(self._mount_path)
        chown = ""
        if run_user not in (None, "", "root", 0, "0"):
            chown = f"chown -R {shlex.quote(str(run_user))} /tmp/opencorvus-automationbench-home /logs/agent; "
        await self.exec_as_root(
            environment,
            command=(
                "set -eu; "
                "chmod 0755 /opt/opencorvus/opencorvus /opt/opencorvus/bin/run-opencorvus-automationbench.py /opt/opencorvus/bin/restricted-agent-shell.sh; "
                f"test -x {mount}/opencorvus; "
                f"test -x {mount}/bin/run-opencorvus-automationbench.py; "
                f"test -f {mount}/share/automationbench-api/SKILL.md; "
                "install -d -m 0700 /tmp/opencorvus-automationbench-home/data; "
                "install -d -o 60001 -g 60001 -m 0700 /tmp/opencorvus-benchmark-agent-60001; "
                "install -m 0600 /tmp/opencorvus-auth.json "
                "/tmp/opencorvus-automationbench-home/data/auth.json; "
                "install -m 0600 /tmp/opencorvus-models.json "
                "/tmp/opencorvus-automationbench-home/data/models.json; "
                "rm -f /tmp/opencorvus-auth.json /tmp/opencorvus-models.json; "
                "install -m 0755 /opt/automationbench-harbor/automationbench_tool.py /workspace/automationbench-tool; "
                "install -m 0755 /opt/automationbench-harbor/automationbench_tool.py /workspace/automationbench_tool.py; "
                "printf '%s\n' '{\"socket_path\":\"/run/automationbench/tool.sock\"}' > /workspace/.automationbench-tool.json; "
                "chown -R 60001:60001 /workspace; chmod 0700 /workspace; "
                "for attempt in $(seq 1 100); do [ -S /run/automationbench/tool.sock ] && [ -S /run/automationbench/admin.sock ] && break; sleep 0.1; done; "
                "test -S /run/automationbench/tool.sock; test -S /run/automationbench/admin.sock; "
                "install -d -m 0755 /logs/agent; "
                "install -d -m 0700 /run/opencorvus-host; "
                "command -v iptables >/dev/null; command -v ip6tables >/dev/null; "
                "iptables -C OUTPUT -m owner --uid-owner 60001 -j REJECT 2>/dev/null || "
                "iptables -A OUTPUT -m owner --uid-owner 60001 -j REJECT; "
                "ip6tables -C OUTPUT -m owner --uid-owner 60001 -j REJECT 2>/dev/null || "
                "ip6tables -A OUTPUT -m owner --uid-owner 60001 -j REJECT; "
                "iptables -C OUTPUT -m owner --uid-owner 60001 -j REJECT; "
                "ip6tables -C OUTPUT -m owner --uid-owner 60001 -j REJECT; "
                "printf '%s\n' '{\"schema_version\":1,\"agent_uid\":60001,\"ipv4\":\"owner_reject\",\"ipv6\":\"owner_reject\",\"provider_uid\":0}' "
                "> /logs/agent/network-isolation.json; "
                "test \"$(git -C /workspace rev-parse --is-inside-work-tree)\" = true; "
                "test \"$(setpriv --reuid=60001 --regid=60001 --clear-groups git -C /workspace rev-parse --is-inside-work-tree)\" = true; "
                "printf '%s\n' '{\"schema_version\":1,\"workspace\":\"/workspace\",\"git\":true,\"root_access\":true,\"agent_uid_access\":true}' "
                "> /logs/agent/workspace-contract.json; "
                "install -m 0600 /opt/opencorvus/bundle-manifest.json /logs/agent/source-receipt.json; "
                f"{chown}"
                f"{mount}/opencorvus --version"
            ),
        )

    async def run(
        self, instruction: str, environment: BaseEnvironment, context: AgentContext
    ) -> None:
        instruction = self.render_instruction(instruction)
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        instruction_path = self.logs_dir / "instruction.txt"
        instruction_path.write_text(instruction, encoding="utf-8")
        await environment.upload_file(instruction_path, "/logs/agent/instruction.txt")
        mount = shlex.quote(self._mount_path)
        env = {
            "OPENCORVUS_HOME": "/tmp/opencorvus-automationbench-home",
            "OPENCORVUS_BIN": f"{self._mount_path}/opencorvus",
            "OPENCORVUS_CONFIG_CONTENT": json.dumps(self._runtime_config(), separators=(",", ":")),
            "OPENCORVUS_MODEL": self._model,
            "OPENCORVUS_PROFILE": self._profile,
            "OPENCORVUS_WORKFLOW": self._workflow,
            "OPENCORVUS_INACTIVITY_SECONDS": str(self._inactivity_seconds),
            "OPENCORVUS_AGENT_TRACE": "1",
            "OPENCORVUS_BENCH_AGENT_UID": "60001",
            "OPENCORVUS_BENCH_AGENT_HOME": "/tmp/opencorvus-benchmark-agent-60001",
            "SHELL": f"{self._mount_path}/bin/restricted-agent-shell.sh",
            "NO_PROXY": "127.0.0.1,localhost",
        }
        primary_error: BaseException | None = None
        primary_traceback: TracebackType | None = None
        try:
            await self.exec_as_agent(
                environment,
                command=(
                    f"{mount}/bin/run-opencorvus-automationbench.py "
                    "--instruction-file /logs/agent/instruction.txt"
                ),
                env=env,
                cwd="/workspace",
                timeout_sec=None,
            )
        except BaseException as error:
            primary_error = error
            primary_traceback = error.__traceback__

        resource_error: BaseException | None = None
        try:
            await self._cleanup_and_capture_runtime(environment)
        except BaseException as error:
            resource_error = error

        if primary_error is not None:
            if resource_error is not None:
                primary_error.add_note(f"runtime cleanup/capture also failed: {resource_error!r}")
            raise primary_error.with_traceback(primary_traceback)
        if resource_error is not None:
            raise resource_error
        await self._finalize_agent_settlement(environment)

    async def _cleanup_and_capture_runtime(self, environment: BaseEnvironment) -> None:
        cleanup_error: BaseException | None = None
        cleanup = asyncio.create_task(self._cleanup_runtime(environment))
        try:
            await asyncio.shield(cleanup)
        except asyncio.CancelledError as error:
            try:
                await cleanup
            except BaseException as settled_error:
                cleanup_error = settled_error
            else:
                cleanup_error = error
        except BaseException as error:
            cleanup_error = error

        capture_error: BaseException | None = None
        try:
            await self._capture_runtime_evidence(environment)
        except BaseException as error:
            capture_error = error

        if cleanup_error is not None:
            if capture_error is not None:
                cleanup_error.add_note(f"runtime evidence capture also failed: {capture_error!r}")
            raise cleanup_error
        if capture_error is not None:
            raise capture_error

    async def _finalize_agent_settlement(self, environment: BaseEnvironment) -> None:
        helper = f"{shlex.quote(self._mount_path)}/bin/run-opencorvus-automationbench.py"
        try:
            await self.exec_as_root(
                environment,
                command=(
                    "set -eu; "
                    f"OPENCORVUS_HOME=/tmp/opencorvus-automationbench-home {helper} --finalize-agent-settled"
                ),
                timeout_sec=60,
            )
        except BaseException:
            revoke = asyncio.create_task(
                self.exec_as_root(
                    environment,
                    command=(
                        "set -eu; "
                        f"OPENCORVUS_HOME=/tmp/opencorvus-automationbench-home {helper} --revoke-agent-settlement"
                    ),
                    timeout_sec=60,
                )
            )
            await asyncio.shield(revoke)
            raise

    async def _capture_runtime_evidence(self, environment: BaseEnvironment) -> None:
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(
            prefix="opencorvus-credential-audit-", dir=self.logs_dir.parent
        ) as temporary:
            audit_path = Path(temporary) / "credential-leak-audit.json"
            try:
                await environment.download_file(
                    "/run/opencorvus-host/credential-leak-audit.json", audit_path
                )
                audit = json.loads(audit_path.read_text(encoding="utf-8"))
            except BaseException as error:
                (self.logs_dir / "evidence-capture-blocked.json").write_text(
                    json.dumps(
                        {
                            "schema_version": 1,
                            "full_capture_authorized": False,
                            "reason": "credential_audit_unavailable",
                        },
                        indent=2,
                    )
                    + "\n",
                    encoding="utf-8",
                )
                raise RuntimeError("container credential audit was unavailable") from error
            if not isinstance(audit, dict) or audit.get("passed") is not True:
                (self.logs_dir / "evidence-capture-blocked.json").write_text(
                    json.dumps(
                        {
                            "schema_version": 1,
                            "full_capture_authorized": False,
                            "reason": "credential_audit_not_passed",
                        },
                        indent=2,
                    )
                    + "\n",
                    encoding="utf-8",
                )
                raise RuntimeError("container credential audit did not authorize evidence capture")
        await environment.download_dir("/logs/agent", self.logs_dir)
        auth = json.loads(self._auth_path.read_text(encoding="utf-8"))
        secret_bytes: list[bytes] = []

        def collect(value: Any) -> None:
            if isinstance(value, dict):
                for item in value.values():
                    collect(item)
            elif isinstance(value, list):
                for item in value:
                    collect(item)
            elif isinstance(value, str) and len(value) >= 12:
                secret_bytes.append(value.encode())

        collect(auth)
        violations = []
        for path in sorted(self.logs_dir.rglob("*")):
            if not path.is_file() or path.suffix in {".db", ".wal", ".shm"}:
                continue
            data = path.read_bytes()
            if any(secret in data for secret in secret_bytes):
                violations.append(f"credential_bytes_present:{path.relative_to(self.logs_dir).as_posix()}")
        audit = {
            "passed": not violations,
            "method": "host_source_bytes_against_captured_text_evidence",
            "checked_secret_count": len(secret_bytes),
            "violations": violations,
        }
        (self.logs_dir / "credential-leak-audit.json").write_text(
            json.dumps(audit, indent=2) + "\n", encoding="utf-8"
        )
        if violations:
            raise RuntimeError("captured Agent evidence contains Provider credential bytes")

    async def _cleanup_runtime(self, environment: BaseEnvironment) -> None:
        helper = f"{shlex.quote(self._mount_path)}/bin/run-opencorvus-automationbench.py"
        await self.exec_as_root(
            environment,
            command=(
                "set -eu; pid_file=/logs/agent/opencorvus-server.pid; pid=absent; "
                "if [ -f \"$pid_file\" ]; then "
                "pid=$(cat \"$pid_file\"); "
                "case \"$pid\" in ''|*[!0-9]*) echo 'invalid OpenCorvus PID receipt' >&2; exit 1;; esac; "
                "fi; "
                f"OPENCORVUS_HOME=/tmp/opencorvus-automationbench-home {helper} --cleanup-owned-processes; "
                "printf 'server_pid=%s\\nserver_group_stopped=1\\n' \"$pid\" > /logs/agent/host-cleanup.txt; "
                "rm -f /logs/agent/credential-leak-audit.json "
                "/run/opencorvus-host/credential-leak-audit.json; "
                "finalize_rc=0; "
                f"OPENCORVUS_HOME=/tmp/opencorvus-automationbench-home {helper} "
                "--finalize-host-cancelled || finalize_rc=$?; "
                "if [ ! -f /logs/agent/credential-leak-audit.json ]; then "
                "[ \"$finalize_rc\" -ne 0 ] || finalize_rc=1; exit \"$finalize_rc\"; fi; "
                "install -m 0600 /logs/agent/credential-leak-audit.json "
                "/run/opencorvus-host/credential-leak-audit.json; "
                "exit \"$finalize_rc\""
            ),
            timeout_sec=300,
        )

    def populate_context_post_run(self, context: AgentContext) -> None:
        summary_path = self.logs_dir / "terminal-summary.json"
        transcript_path = self.logs_dir / "opencorvus-transcript.json"
        if not summary_path.is_file() or not transcript_path.is_file():
            return
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
        transcript = json.loads(transcript_path.read_text(encoding="utf-8"))
        tokens = summary.get("tokens") or {}
        context.n_input_tokens = int(tokens.get("input") or 0)
        context.n_output_tokens = int(tokens.get("output") or 0)
        context.n_cache_tokens = int(tokens.get("cache_read") or 0)
        if tokens.get("cost_usd") is not None:
            context.cost_usd = float(tokens["cost_usd"])

        steps: list[Step] = []
        step_id = 1
        for message in transcript:
            info = message.get("info") or {}
            if info.get("role") != "assistant":
                continue
            text_parts: list[str] = []
            reasoning_parts: list[str] = []
            tool_calls: list[ToolCall] = []
            for part in message.get("parts") or []:
                if part.get("type") == "text":
                    text_parts.append(str(part.get("text") or ""))
                elif part.get("type") == "reasoning":
                    reasoning_parts.append(str(part.get("text") or ""))
                elif part.get("type") == "tool":
                    state = part.get("state") or {}
                    tool_calls.append(
                        ToolCall(
                            tool_call_id=str(part.get("callID") or part.get("id") or ""),
                            function_name=str(part.get("tool") or ""),
                            arguments=state.get("input") if isinstance(state.get("input"), dict) else {},
                        )
                    )
            steps.append(
                Step(
                    step_id=step_id,
                    source="agent",
                    model_name=self._model,
                    message="\n".join(text_parts),
                    reasoning_content="\n".join(reasoning_parts) or None,
                    tool_calls=tool_calls or None,
                )
            )
            step_id += 1
        trajectory = Trajectory(
            session_id=str(summary.get("mission_session_id") or ""),
            agent=Agent(
                name="opencorvus-mission-base",
                version=self._runtime_version,
                model_name=self._model,
            ),
            steps=steps,
            final_metrics=FinalMetrics(
                total_prompt_tokens=context.n_input_tokens,
                total_completion_tokens=context.n_output_tokens,
                total_cached_tokens=context.n_cache_tokens,
                total_cost_usd=context.cost_usd,
                total_steps=len(steps),
            ),
        )
        (self.logs_dir / "trajectory.json").write_text(
            json.dumps(trajectory.to_json_dict(), indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        files = []
        for path in sorted(self.logs_dir.rglob("*")):
            if not path.is_file() or path.name == "evidence-manifest.json":
                continue
            data = path.read_bytes()
            files.append(
                {
                    "path": path.relative_to(self.logs_dir).as_posix(),
                    "bytes": len(data),
                    "sha256": hashlib.sha256(data).hexdigest(),
                }
            )
        (self.logs_dir / "evidence-manifest.json").write_text(
            json.dumps({"schema_version": 1, "files": files}, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
