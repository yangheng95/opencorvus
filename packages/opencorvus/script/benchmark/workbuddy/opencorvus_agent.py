"""Harbor Installed Agent adapter for OpenCorvus Mission/Base WorkBuddy trials."""

from __future__ import annotations

import asyncio
import hashlib
import json
import shlex
from pathlib import Path
from typing import Any

from harbor.agents.installed.base import BaseInstalledAgent
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext
from harbor.models.trajectories.agent import Agent
from harbor.models.trajectories.final_metrics import FinalMetrics
from harbor.models.trajectories.step import Step
from harbor.models.trajectories.tool_call import ToolCall
from harbor.models.trajectories.trajectory import Trajectory

from workbuddy_bench.agents._agent_user import ensure_agent_user


class OpenCorvusAgent(BaseInstalledAgent):
    """Run one official task through a real OpenCorvus Mission and Base Squad."""

    SUPPORTS_ATIF = True

    def __init__(self, logs_dir: Path, *args: Any, **kwargs: Any):
        self._runtime_version = str(kwargs.pop("OPENCORVUS_VERSION", "unknown"))
        self._mount_path = str(kwargs.pop("mount_path", "/opt/opencorvus"))
        self._model = str(kwargs.pop("OPENCORVUS_MODEL", "openai/gpt-5.6-luna"))
        self._profile = str(kwargs.pop("OPENCORVUS_PROFILE", "base"))
        self._workflow = str(
            kwargs.pop("OPENCORVUS_WORKFLOW", "planner-execution-verification")
        )
        self._inactivity_seconds = int(kwargs.pop("OPENCORVUS_INACTIVITY_SECONDS", 600))
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

    async def install(self, environment: BaseEnvironment) -> None:
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
        await ensure_agent_user(self, environment)
        run_user = getattr(environment, "default_user", None)
        mount = shlex.quote(self._mount_path)
        chown = ""
        if run_user not in (None, "", "root", 0, "0"):
            chown = f"chown -R {shlex.quote(str(run_user))} /tmp/opencorvus-workbuddy-home /logs/agent; "
        await self.exec_as_root(
            environment,
            command=(
                "set -eu; "
                f"test -x {mount}/opencorvus; "
                f"test -x {mount}/bin/run-opencorvus-workbuddy.py; "
                f"test -f {mount}/share/workbuddybench-code/SKILL.md; "
                "test -f /run/secrets/opencorvus-provider/auth.json; "
                "test -f /run/secrets/opencorvus-provider/models.json; "
                "install -d -m 0700 /tmp/opencorvus-workbuddy-home/data; "
                "install -m 0600 /run/secrets/opencorvus-provider/auth.json "
                "/tmp/opencorvus-workbuddy-home/data/auth.json; "
                "install -m 0600 /run/secrets/opencorvus-provider/models.json "
                "/tmp/opencorvus-workbuddy-home/data/models.json; "
                "install -d -m 0755 /logs/agent; "
                f"{chown}"
                f"{mount}/opencorvus --version"
            ),
        )

    async def run(
        self, instruction: str, environment: BaseEnvironment, context: AgentContext
    ) -> None:
        instruction = self.render_instruction(instruction)
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        (self.logs_dir / "instruction.txt").write_text(instruction, encoding="utf-8")
        mount = shlex.quote(self._mount_path)
        env = {
            "OPENCORVUS_HOME": "/tmp/opencorvus-workbuddy-home",
            "OPENCORVUS_BIN": f"{self._mount_path}/opencorvus",
            "OPENCORVUS_CONFIG_CONTENT": json.dumps(
                {"skills": {"paths": [f"{self._mount_path}/share"]}}, separators=(",", ":")
            ),
            "OPENCORVUS_MODEL": self._model,
            "OPENCORVUS_PROFILE": self._profile,
            "OPENCORVUS_WORKFLOW": self._workflow,
            "OPENCORVUS_INACTIVITY_SECONDS": str(self._inactivity_seconds),
            "OPENCORVUS_AGENT_TRACE": "1",
            "NO_PROXY": "127.0.0.1,localhost",
        }
        try:
            await self.exec_as_agent(
                environment,
                command=(
                    f"{mount}/bin/run-opencorvus-workbuddy.py "
                    "--instruction-file /logs/agent/instruction.txt"
                ),
                env=env,
                cwd="/workspace",
                timeout_sec=None,
            )
        finally:
            cleanup = asyncio.create_task(self._cleanup_runtime(environment))
            try:
                await asyncio.shield(cleanup)
            except asyncio.CancelledError:
                await cleanup
                raise

    async def _cleanup_runtime(self, environment: BaseEnvironment) -> None:
        helper = f"{shlex.quote(self._mount_path)}/bin/run-opencorvus-workbuddy.py"
        await self.exec_as_root(
            environment,
            command=(
                "set -eu; pid_file=/logs/agent/opencorvus-server.pid; pid=absent; "
                "if [ -f \"$pid_file\" ]; then "
                "pid=$(cat \"$pid_file\"); "
                "case \"$pid\" in ''|*[!0-9]*) echo 'invalid OpenCorvus PID receipt' >&2; exit 1;; esac; "
                "fi; "
                f"OPENCORVUS_HOME=/tmp/opencorvus-workbuddy-home {helper} --cleanup-owned-processes; "
                "printf 'server_pid=%s\\nserver_group_stopped=1\\n' \"$pid\" > /logs/agent/host-cleanup.txt; "
                f"OPENCORVUS_HOME=/tmp/opencorvus-workbuddy-home {helper} --finalize-host-cancelled"
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
