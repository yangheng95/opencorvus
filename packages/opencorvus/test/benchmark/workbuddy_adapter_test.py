from __future__ import annotations

import asyncio
import hashlib
import importlib.util
import json
import sqlite3
from pathlib import Path
import types


MODULE_PATH = (
    Path(__file__).resolve().parents[2]
    / "script"
    / "benchmark"
    / "workbuddy"
    / "run_opencorvus_trial.py"
)
SPEC = importlib.util.spec_from_file_location("run_opencorvus_trial", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
CATALOG_PATH = MODULE_PATH.with_name("catalog_chain_proof.py")
CATALOG_SPEC = importlib.util.spec_from_file_location("catalog_chain_proof", CATALOG_PATH)
assert CATALOG_SPEC and CATALOG_SPEC.loader
CATALOG = importlib.util.module_from_spec(CATALOG_SPEC)
CATALOG_SPEC.loader.exec_module(CATALOG)
AGENT_PATH = MODULE_PATH.with_name("opencorvus_agent.py")
AGENT_SPEC = importlib.util.spec_from_file_location("opencorvus_agent", AGENT_PATH)
assert AGENT_SPEC and AGENT_SPEC.loader
AGENT_MODULE = importlib.util.module_from_spec(AGENT_SPEC)
AGENT_SPEC.loader.exec_module(AGENT_MODULE)
JOB_CONFIG_PATH = MODULE_PATH.parent / "configs" / "jobs" / "opencorvus-luna-code-chain-proof.yaml"
PREPARE_PATH = MODULE_PATH.parent / "prepare-chain-proof.sh"
SUPERVISOR_PATH = MODULE_PATH.parent / "run-chain-proof.sh"
VOLUME_LIFECYCLE_PATH = MODULE_PATH.parent / "docker-volume-lifecycle.sh"
VERIFIER_PERMISSION_PATCH_PATH = MODULE_PATH.parent / "workbuddy-verifier-upload-permission.patch"


def assistant(agent: str, session: str, parts: list[dict]) -> dict:
    return {
        "info": {
            "id": f"message-{agent}-{session}",
            "role": "assistant",
            "agent": agent,
            "sessionID": session,
            "time": {"created": 1},
        },
        "parts": parts,
    }


def skill_part() -> dict:
    return {
        "type": "tool",
        "tool": "skill",
        "state": {"status": "completed", "input": {"name": "workbuddybench-code"}},
    }


def test_job_projects_exact_engine_private_provider_files_read_only() -> None:
    content = JOB_CONFIG_PATH.read_text()
    assert content.count("source: __OPENCORVUS_PROVIDER_MOUNTPOINT__/") == 3
    assert content.count("read_only: true") == 4
    assert "target: /run/secrets/opencorvus-provider/auth.json" in content
    assert "target: /run/secrets/opencorvus-provider/models.json" in content
    assert "target: /run/evidence/source-receipt.json" in content


def test_provider_projection_permissions_and_cleanup_follow_runtime_owners() -> None:
    preparation = PREPARE_PATH.read_text()
    supervisor = SUPERVISOR_PATH.read_text()
    assert "chmod 600 /target/auth.json /target/models.json" in preparation
    assert "chmod 644 /target/source-receipt.json" in preparation
    assert supervisor.index("flock -n 9") < supervisor.index("trap cleanup_owned_exit EXIT")


def test_prepare_and_run_share_lock_and_engine_cleanup_contract() -> None:
    preparation = PREPARE_PATH.read_text()
    supervisor = SUPERVISOR_PATH.read_text()
    lifecycle = VOLUME_LIFECYCLE_PATH.read_text()
    assert "chain-proof.lock" in preparation
    assert preparation.index("flock -n 8") < preparation.rindex("workbuddy_remove_provider_volume")
    assert supervisor.index("flock -n 9") < supervisor.index("trap cleanup_owned_exit EXIT")
    assert supervisor.index("trap cleanup_owned_exit EXIT") < supervisor.index("test -S \"$docker_socket\"")
    assert "workbuddy_windows_docker" in lifecycle
    assert "provider-volume-cleanup-pending.json" in lifecycle
    assert "setsid env PYTHONPATH=" in supervisor
    assert 'mounts.get("/run/secrets/opencorvus-provider/auth.json")' in supervisor
    assert "--cleanup-owned-processes" in supervisor
    assert "orphan-recovery" in supervisor
    assert "/run/evidence/attempt-owner.json" in supervisor
    assert "orphan-recovery-pending.json" in supervisor
    assert "credential-leak-audit.json" in supervisor


def test_preparation_records_exact_verifier_permission_overlay() -> None:
    preparation = PREPARE_PATH.read_text()
    permission_patch = VERIFIER_PERMISSION_PATCH_PATH.read_text()
    assert "workbuddy-verifier-upload-permission.patch" in preparation
    assert "workbuddy-verifier-download.patch" in preparation
    assert "tmp_path.chmod(0o644)" in permission_patch
    assert "src/workbuddy_bench/judge/runtime/harbor.py" in permission_patch


def test_accepts_exact_skill_as_each_participating_owners_first_tool() -> None:
    messages = [
        assistant(owner, f"session-{owner}", [skill_part(), {"type": "tool", "tool": "artifact_publish", "state": {}}])
        for owner in MODULE.OWNERS
    ]
    result = MODULE.audit_skill_load_order(messages)
    assert result["passed"] is True
    assert len(result["successful_skill_loads"]) == 4


def test_accepts_skill_discovery_before_exact_load_and_ignores_mission_outer_agent() -> None:
    messages = [
        assistant(
            "mission",
            "mission-session",
            [{"type": "tool", "tool": "mission_skill", "state": {"status": "completed"}}],
        ),
        assistant(
            "orchestrator",
            "orchestrator-session",
            [
                {
                    "type": "tool",
                    "tool": "skill",
                    "state": {"status": "completed", "input": {"action": "list"}},
                },
                skill_part(),
                {"type": "tool", "tool": "read", "state": {"status": "completed"}},
            ],
        ),
    ]
    result = MODULE.audit_skill_load_order(messages, ["orchestrator"])
    assert result["passed"] is True
    assert result["dispatched_agents"] == ["orchestrator"]
    assert result["unexpected_dispatched_agents"] == []


def test_reports_action_before_skill_load_as_runtime_non_adherence() -> None:
    messages = [
        assistant(
            "orchestrator",
            "session-orchestrator",
            [
                {"type": "tool", "tool": "task", "state": {"status": "completed", "input": {}}},
                skill_part(),
            ],
        )
    ]
    result = MODULE.audit_skill_load_order(messages)
    assert result["passed"] is False
    assert result["violations"] == ["action_before_skill_load:orchestrator:session-orchestrator"]


def test_projection_accepts_exact_base_owner_matrix() -> None:
    matrix = {
        "active_profile": "base",
        "skills": [{"ref": "default/skill/workbuddybench-code"}],
        "agents": [
            {"agent_id": owner, "skill_mountable": True, "skill_tool_available": True}
            for owner in MODULE.OWNERS
        ],
        "matrix": [
            {
                "agent_id": owner,
                "grants": [
                    {
                        "ref": "default/skill/workbuddybench-code",
                        "effective": True,
                        "enabled": True,
                    }
                ],
            }
            for owner in MODULE.OWNERS
        ],
    }
    result = MODULE.audit_projection(matrix)
    assert result["passed"] is True
    assert result["violations"] == []


def test_durable_settlement_accepts_terminal_fact_sets(tmp_path: Path) -> None:
    home = tmp_path / "home"
    data = home / "data"
    data.mkdir(parents=True)
    connection = sqlite3.connect(data / "opencorvus.db")
    connection.executescript(
        """
        CREATE TABLE provider_activity_request(id TEXT PRIMARY KEY);
        CREATE TABLE provider_activity_outcome(id TEXT PRIMARY KEY, request_id TEXT);
        CREATE TABLE tool_part_request(id TEXT PRIMARY KEY, data TEXT, time_created INTEGER);
        CREATE TABLE tool_part_outcome(id TEXT PRIMARY KEY, request_part_id TEXT);
        CREATE TABLE protocol_inbox(id TEXT PRIMARY KEY, actor TEXT, actor_id TEXT, visible_at INTEGER, time_created INTEGER);
        CREATE TABLE protocol_delivery_receipt(id TEXT PRIMARY KEY, inbox_id TEXT, receipt TEXT, time_created INTEGER);
        CREATE TABLE session_control_record(id TEXT PRIMARY KEY, session_id TEXT, kind TEXT, time_created INTEGER);
        CREATE TABLE session_control_event(id TEXT PRIMARY KEY, control_id TEXT, kind TEXT);
        CREATE TABLE automation_run(id TEXT PRIMARY KEY, automation_revision_id TEXT, started_at INTEGER);
        CREATE TABLE automation_run_receipt(id TEXT PRIMARY KEY, run_id TEXT, outcome TEXT);
        CREATE TABLE automation(id TEXT PRIMARY KEY, definition_id TEXT, revision INTEGER, task_id TEXT, due_at INTEGER, status TEXT, kind TEXT);
        CREATE TABLE automation_definition_tombstone(id TEXT PRIMARY KEY, definition_id TEXT, revision INTEGER);
        CREATE TABLE engine_workflow_node_occurrence(task_id TEXT, workflow_id TEXT, workflow_node_id TEXT, child_session_id TEXT);
        CREATE TABLE worker_turn_descriptor(id TEXT PRIMARY KEY, session_id TEXT, agent TEXT, time_created INTEGER);
        INSERT INTO engine_workflow_node_occurrence VALUES ('task-1','planner-execution-verification','implementation','session-1');
        INSERT INTO worker_turn_descriptor VALUES ('descriptor-1','session-1','base-developer',1);
        """
    )
    connection.commit()
    connection.close()
    previous = MODULE.HOME
    MODULE.HOME = home
    try:
        result = MODULE.durable_settlement(["task-1"])
    finally:
        MODULE.HOME = previous
    assert result["passed"] is True
    assert result["occurrences"][0]["agent"] == "base-developer"
    connection = sqlite3.connect(data / "opencorvus.db")
    connection.execute("INSERT INTO provider_activity_request VALUES ('request-pending')")
    connection.commit()
    connection.close()
    previous = MODULE.HOME
    MODULE.HOME = home
    try:
        pending = MODULE.durable_settlement(["task-1"])
    finally:
        MODULE.HOME = previous
    assert pending["passed"] is False
    assert pending["violations"] == ["pending_provider:1"]


def test_workflow_audit_accepts_exact_base_virtual_workflow() -> None:
    observation = {
        "tasks": [
            {
                "task_id": "task-1",
                "board": {
                    "task": {
                        "packageRevisionBinding": {"id": "base"},
                        "completionDecision": {
                            "workflowBinding": {
                                "kind": "virtual_workflow",
                                "workflow_id": "planner-execution-verification",
                            }
                        },
                    }
                },
            }
        ]
    }
    result = MODULE.workflow_audit(observation)
    assert result["passed"] is True
    assert result["violations"] == []


def test_streaming_part_growth_advances_activity_signature() -> None:
    observation = {
        "mission_status": {"status": "active"},
        "mission_record": {"completion": None},
        "all_transcript": [
            {
                "info": {"id": "message-1", "time": {"updated": 1}},
                "parts": [{"type": "reasoning", "text": "first"}],
            }
        ],
        "tasks": [
            {
                "task_id": "task-1",
                "board": {"task": {"status": "active"}},
                "trace": {"events": []},
                "interactions": [],
            }
        ],
        "durable_settlement": {"passed": False, "violations": ["executing_sessions:1"]},
    }
    before = MODULE.activity_signature(observation)
    observation["all_transcript"][0]["parts"][0]["text"] = "first and more streamed reasoning"
    after = MODULE.activity_signature(observation)
    assert before != after


def test_activity_signature_ignores_query_generation_time() -> None:
    observation = {
        "mission_status": {"status": "inactive", "generatedAt": 100},
        "mission_record": {"completion": {"status": "completed"}},
        "all_transcript": [],
        "tasks": [],
        "durable_settlement": {"passed": True, "violations": []},
    }
    first = MODULE.activity_signature(observation)
    observation["mission_status"]["generatedAt"] = 200
    assert MODULE.activity_signature(observation) == first


def test_runtime_evidence_is_downloaded_after_cleanup_failure(tmp_path: Path) -> None:
    agent = object.__new__(AGENT_MODULE.OpenCorvusAgent)
    agent.logs_dir = tmp_path / "agent"

    async def cleanup(_self: object, _environment: object) -> None:
        raise RuntimeError("cleanup failed after finalization")

    class Environment:
        async def download_file(self, source: str, target: Path) -> None:
            assert source == "/run/opencorvus-host/credential-leak-audit.json"
            Path(target).write_text('{"passed":true}\n')

        async def download_dir(self, source: str, target: Path) -> None:
            assert source == "/logs/agent"
            target.mkdir(parents=True, exist_ok=True)
            (target / "captured.json").write_text('{"captured":true}\n')

    agent._cleanup_runtime = types.MethodType(cleanup, agent)
    try:
        asyncio.run(agent._cleanup_and_capture_runtime(Environment()))
    except RuntimeError as error:
        assert str(error) == "cleanup failed after finalization"
    else:
        raise AssertionError("cleanup failure must remain visible")
    assert json.loads((agent.logs_dir / "captured.json").read_text()) == {"captured": True}


def test_runtime_evidence_is_downloaded_before_cancellation_propagates(tmp_path: Path) -> None:
    agent = object.__new__(AGENT_MODULE.OpenCorvusAgent)
    agent.logs_dir = tmp_path / "agent"

    async def cleanup(_self: object, _environment: object) -> None:
        await asyncio.sleep(0.01)

    class Environment:
        async def download_file(self, source: str, target: Path) -> None:
            assert source == "/run/opencorvus-host/credential-leak-audit.json"
            Path(target).write_text('{"passed":true}\n')

        async def download_dir(self, source: str, target: Path) -> None:
            assert source == "/logs/agent"
            target.mkdir(parents=True, exist_ok=True)
            (target / "captured.json").write_text('{"captured":true}\n')

    agent._cleanup_runtime = types.MethodType(cleanup, agent)

    async def scenario() -> None:
        task = asyncio.create_task(agent._cleanup_and_capture_runtime(Environment()))
        await asyncio.sleep(0)
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            return
        raise AssertionError("cancellation must propagate after evidence capture")

    asyncio.run(scenario())
    assert json.loads((agent.logs_dir / "captured.json").read_text()) == {"captured": True}


def test_failed_credential_audit_blocks_full_evidence_download(tmp_path: Path) -> None:
    agent = object.__new__(AGENT_MODULE.OpenCorvusAgent)
    agent.logs_dir = tmp_path / "agent"

    class Environment:
        full_download_called = False

        async def download_file(self, source: str, target: Path) -> None:
            assert source == "/run/opencorvus-host/credential-leak-audit.json"
            Path(target).write_text('{"passed":false,"violations":["redacted"]}\n')

        async def download_dir(self, _source: str, _target: Path) -> None:
            self.full_download_called = True

    environment = Environment()
    try:
        asyncio.run(agent._capture_runtime_evidence(environment))
    except RuntimeError as error:
        assert str(error) == "container credential audit did not authorize evidence capture"
    else:
        raise AssertionError("failed credential audit must block full evidence capture")
    assert environment.full_download_called is False
    blocked = json.loads((agent.logs_dir / "evidence-capture-blocked.json").read_text())
    assert blocked == {
        "schema_version": 1,
        "full_capture_authorized": False,
        "reason": "credential_audit_not_passed",
    }


def test_primary_agent_failure_is_not_replaced_by_resource_failure(tmp_path: Path) -> None:
    agent = AGENT_MODULE.OpenCorvusAgent(
        tmp_path,
        model_name="gpt-5.6-luna",
        OPENCORVUS_VERSION="chain-proof-r1",
    )

    async def primary_failure(_self: object, *_args: object, **_kwargs: object) -> None:
        raise ValueError("primary agent failure")

    async def resource_failure(_self: object, _environment: object) -> None:
        raise RuntimeError("resource settlement failure")

    class Environment:
        async def upload_file(self, _source: Path, _target: str) -> None:
            return None

    agent.exec_as_agent = types.MethodType(primary_failure, agent)
    agent._cleanup_and_capture_runtime = types.MethodType(resource_failure, agent)
    try:
        asyncio.run(agent.run("instruction", Environment(), object()))
    except ValueError as error:
        assert str(error) == "primary agent failure"
        assert error.__notes__ == [
            "runtime cleanup/capture also failed: RuntimeError('resource settlement failure')"
        ]
    else:
        raise AssertionError("primary Agent failure must remain the Trial exception")


def test_credential_audit_accepts_logs_without_projected_secret_bytes(tmp_path: Path) -> None:
    home = tmp_path / "home"
    logs = tmp_path / "logs"
    (home / "data").mkdir(parents=True)
    logs.mkdir()
    (home / "data" / "auth.json").write_text(
        json.dumps({"openai": {"access": "secret-access-value", "refresh": "secret-refresh-value"}})
    )
    (logs / "server.log").write_text("safe runtime evidence")
    previous_home, previous_logs = MODULE.HOME, MODULE.LOGS
    MODULE.HOME, MODULE.LOGS = home, logs
    try:
        result = MODULE.credential_leak_audit()
    finally:
        MODULE.HOME, MODULE.LOGS = previous_home, previous_logs
    assert result == {"passed": True, "checked_secret_count": 2, "violations": []}


def test_catalog_adopts_one_fully_audited_official_result(tmp_path: Path) -> None:
    trial = tmp_path / "run-1" / "trial-1"
    agent = trial / "agent"
    agent.mkdir(parents=True)
    (agent / "attempt-disposition.json").write_text(
        json.dumps({"schema_version": 1, "status": "agent_settled", "score_eligible": False})
    )
    for name in (
        "skill-projection-audit",
        "skill-load-order-audit",
        "workflow-binding-audit",
        "physical-settlement-audit",
        "credential-leak-audit",
        "provider-usage-audit",
        "process-cleanup-audit",
    ):
        (agent / f"{name}.json").write_text(json.dumps({"passed": True, "violations": []}))
    for name in ("trajectory.json", "source-receipt.json"):
        (agent / name).write_text(json.dumps({"schema_version": 1}))
    (agent / "host-cleanup.txt").write_text("server_pid=123\nserver_group_stopped=1\n")
    manifest_files = []
    for path in sorted(agent.rglob("*")):
        if not path.is_file():
            continue
        data = path.read_bytes()
        manifest_files.append(
            {
                "path": path.relative_to(agent).as_posix(),
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            }
        )
    (agent / "evidence-manifest.json").write_text(
        json.dumps({"schema_version": 1, "files": manifest_files})
    )
    (trial / "result.json").write_text(
        json.dumps(
            {
                "task_name": "task-1",
                "trial_name": "task-1__attempt",
                "agent_result": {"n_input_tokens": 10, "n_output_tokens": 2},
                "verifier_result": {"rewards": {"reward": 1.0}},
                "exception_info": None,
            }
        )
    )
    catalog = CATALOG.build_catalog(tmp_path)
    assert catalog["counts"] == {"sealed_candidate": 1, "invalid_bug": 0, "incomplete": 0}
    assert catalog["attempts"][0]["score_eligible"] is True
    (agent / "trajectory.json").write_text(json.dumps({"schema_version": 2}))
    corrupted = CATALOG.build_catalog(tmp_path)
    assert corrupted["counts"] == {"sealed_candidate": 0, "invalid_bug": 1, "incomplete": 0}
    assert "audit_not_passed:evidence-manifest" in corrupted["attempts"][0]["violations"]


def test_catalog_preserves_official_trial_when_agent_evidence_is_missing(tmp_path: Path) -> None:
    trial = tmp_path / "run-1" / "trial-1"
    trial.mkdir(parents=True)
    (trial / "result.json").write_text(
        json.dumps(
            {
                "task_name": "workbuddy/task-1",
                "trial_name": "task-1__attempt",
                "agent_result": {"n_input_tokens": None},
                "verifier_result": {"rewards": {"reward": 0.0}},
                "exception_info": {"exception_type": "NonZeroAgentExitCodeError"},
            }
        )
    )
    (trial / "agent").mkdir()
    (trial / "agent" / "instruction.txt").write_text("preserved input")
    catalog = CATALOG.build_catalog(tmp_path)
    assert catalog["counts"] == {"sealed_candidate": 0, "invalid_bug": 1, "incomplete": 0}
    attempt = catalog["attempts"][0]
    assert attempt["disposition"]["reason"] == "agent_evidence_missing_after_trial"
    assert attempt["official_result"] == "run-1/trial-1/result.json"
    assert attempt["violations"] == ["agent_evidence_missing_after_trial"]


def test_catalog_pairs_orphan_recovery_evidence_with_sibling_official_result(tmp_path: Path) -> None:
    slot = tmp_path / "attempts" / "run-1"
    trial = slot / "2026-08-25__00-00-00" / "task-1__attempt"
    trial.mkdir(parents=True)
    (trial / "result.json").write_text(
        json.dumps(
            {
                "task_name": "workbuddy/task-1",
                "trial_name": "task-1__attempt",
                "agent_result": {"n_input_tokens": None},
                "verifier_result": {"rewards": {"reward": 0.0}},
                "exception_info": {"exception_type": "HostInterruption"},
            }
        )
    )
    recovered = slot / "orphan-recovery" / "container-1" / "agent"
    recovered.mkdir(parents=True)
    (recovered / "attempt-disposition.json").write_text(
        json.dumps(
            {
                "schema_version": 1,
                "status": "invalid_bug",
                "score_eligible": False,
                "reason": "host_cancelled_before_agent_settlement",
            }
        )
    )
    catalog = CATALOG.build_catalog(tmp_path)
    assert catalog["counts"] == {"sealed_candidate": 0, "invalid_bug": 1, "incomplete": 0}
    attempt = catalog["attempts"][0]
    assert attempt["slot_root"] == "attempts/run-1"
    assert attempt["official_result"] == (
        "attempts/run-1/2026-08-25__00-00-00/task-1__attempt/result.json"
    )


def test_manifest_audit_preserves_zero_byte_files(tmp_path: Path) -> None:
    wal = tmp_path / "opencorvus.db-wal"
    wal.write_bytes(b"")
    (tmp_path / "evidence-manifest.json").write_text(
        json.dumps(
            {
                "schema_version": 1,
                "files": [
                    {
                        "path": "opencorvus.db-wal",
                        "bytes": 0,
                        "sha256": hashlib.sha256(b"").hexdigest(),
                    }
                ],
            }
        )
    )
    assert CATALOG.evidence_manifest_audit(tmp_path) == {
        "passed": True,
        "files": 1,
        "violations": [],
    }


def test_host_cleanup_settles_exact_server_group_after_agent_cancellation(tmp_path: Path) -> None:
    class Result:
        return_code = 0
        stdout = ""
        stderr = ""

    class Environment:
        default_user = "dev"

        def __init__(self) -> None:
            self.started = asyncio.Event()
            self.commands: list[str] = []
            self.uploads: list[tuple[Path, str]] = []

        async def upload_file(self, source_path: Path, target_path: str) -> None:
            self.uploads.append((Path(source_path), target_path))

        async def download_dir(self, source_path: str, target_path: Path) -> None:
            assert source_path == "/logs/agent"
            Path(target_path).mkdir(parents=True, exist_ok=True)
            (Path(target_path) / "captured.json").write_text('{"captured":true}\n')

        async def download_file(self, source_path: str, target_path: Path) -> None:
            assert source_path == "/run/opencorvus-host/credential-leak-audit.json"
            Path(target_path).write_text('{"passed":true}\n')

        async def exec(self, *, command: str, **_: object) -> Result:
            self.commands.append(command)
            if "--instruction-file" in command:
                self.started.set()
                await asyncio.Event().wait()
            return Result()

    async def scenario() -> tuple[list[str], list[tuple[Path, str]]]:
        environment = Environment()
        agent = AGENT_MODULE.OpenCorvusAgent(
            tmp_path,
            model_name="gpt-5.6-luna",
            OPENCORVUS_VERSION="chain-proof-r1",
        )
        task = asyncio.create_task(agent.run("instruction", environment, object()))
        await environment.started.wait()
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        else:
            raise AssertionError("cancelled adapter run did not propagate cancellation")
        return environment.commands, environment.uploads

    commands, uploads = asyncio.run(scenario())
    assert len(commands) == 2
    assert uploads == [(tmp_path / "instruction.txt", "/logs/agent/instruction.txt")]
    assert "opencorvus-server.pid" in commands[1]
    assert "install -m 0600 /logs/agent/credential-leak-audit.json" in commands[1]
    assert "/run/opencorvus-host/credential-leak-audit.json" in commands[1]
    assert json.loads((tmp_path / "captured.json").read_text()) == {"captured": True}
    assert "host-cleanup.txt" in commands[1]


def test_cleanup_before_process_baseline_records_settled_noop(tmp_path: Path) -> None:
    previous_logs = MODULE.LOGS
    MODULE.LOGS = tmp_path
    try:
        assert MODULE.cleanup_owned_processes() == 0
    finally:
        MODULE.LOGS = previous_logs
    cleanup = json.loads((tmp_path / "process-cleanup.json").read_text())
    assert cleanup == {
        "schema_version": 1,
        "passed": True,
        "baseline_present": False,
        "owned_processes": [],
    }


def test_host_cancel_finalizer_seals_database_usage_and_invalid_disposition(tmp_path: Path) -> None:
    home = tmp_path / "home"
    logs = tmp_path / "logs"
    (home / "data").mkdir(parents=True)
    logs.mkdir()
    (home / "data" / "auth.json").write_text(
        json.dumps({"openai": {"access": "secret-access-value", "refresh": "secret-refresh-value"}})
    )
    database = sqlite3.connect(home / "data" / "opencorvus.db")
    database.execute(
        """CREATE TABLE provider_usage_event(
             id TEXT, occurred_at INTEGER, provider_id TEXT, model_id TEXT, purpose TEXT,
             input_tokens INTEGER, output_tokens INTEGER, reasoning_tokens INTEGER,
             cache_read_tokens INTEGER, cache_write_tokens INTEGER, total_tokens INTEGER,
             cost_usd REAL, billing_status TEXT, session_id TEXT, agent_id TEXT)"""
    )
    database.execute(
        "INSERT INTO provider_usage_event VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ("usage-1", 1, "openai", "gpt-5.6-luna", "task", 10, 2, 1, 3, 0, 12, 0.01, "known", "s1", "base-developer"),
    )
    database.commit()
    database.close()
    (logs / "attempt-disposition.json").write_text(json.dumps({"status": "running"}))
    (logs / "last-public-observation.json").write_text(json.dumps({"mission_status": {"status": "active"}}))
    previous_home, previous_logs = MODULE.HOME, MODULE.LOGS
    MODULE.HOME, MODULE.LOGS = home, logs
    try:
        assert MODULE.finalize_host_cancelled() == 0
    finally:
        MODULE.HOME, MODULE.LOGS = previous_home, previous_logs
    disposition = json.loads((logs / "attempt-disposition.json").read_text())
    usage = json.loads((logs / "provider-usage.json").read_text())
    assert disposition["status"] == "invalid_bug"
    assert disposition["reason"] == "host_cancelled_before_agent_settlement"
    assert len(usage) == 1
    assert (logs / "opencorvus-data" / "opencorvus.db").is_file()
    assert (logs / "evidence-manifest.json").is_file()


def test_host_cancel_finalizer_rejects_secret_bearing_evidence(tmp_path: Path) -> None:
    home = tmp_path / "home"
    logs = tmp_path / "logs"
    (home / "data").mkdir(parents=True)
    logs.mkdir()
    secret = "secret-access-value"
    (home / "data" / "auth.json").write_text(json.dumps({"openai": {"access": secret}}))
    (logs / "server.log").write_text(f"unsafe {secret}")
    previous_home, previous_logs = MODULE.HOME, MODULE.LOGS
    MODULE.HOME, MODULE.LOGS = home, logs
    try:
        assert MODULE.finalize_host_cancelled() == 2
    finally:
        MODULE.HOME, MODULE.LOGS = previous_home, previous_logs
    audit = json.loads((logs / "credential-leak-audit.json").read_text())
    assert audit["passed"] is False
    assert audit["violations"] == ["credential_bytes_present:server.log"]
