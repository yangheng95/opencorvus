#!/usr/bin/env python3
"""Execute one AutomationBench instruction through OpenCorvus Mission/Base under Harbor."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import shlex
import secrets
import signal
import sqlite3
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


LOGS = Path("/logs/agent")
PROJECT = Path("/workspace")
HOME = Path(os.environ.get("OPENCORVUS_HOME", "/tmp/opencorvus-automationbench-home"))
SERVER = "http://127.0.0.1:7878"
SKILL_NAME = "automationbench-api"
SKILL_REF = f"default/skill/{SKILL_NAME}"
PROFILE = os.environ.get("OPENCORVUS_PROFILE", "base")
MODEL = os.environ.get("OPENCORVUS_MODEL", "openai/gpt-5.6-luna")
WORKFLOW = os.environ.get("OPENCORVUS_WORKFLOW", "source-planned-execution-verification")
OWNERS = ("orchestrator", "base-planner", "base-developer", "base-tester")
AGENT_SETTLEMENT = Path("/run/opencorvus-host/agent-settlement.json")
AGENT_SETTLEMENT_REVOKED = Path("/run/opencorvus-host/agent-settlement-revoked.json")
MISSION_DENIED_CAPABILITIES = (
    "bash",
    "publish_interactive_artifact",
    "read",
    "glob",
    "search_code",
    "list",
    "edit",
    "write",
    "apply_patch",
    "webfetch",
    "websearch",
    "external_code_search",
    "question",
    "todo",
    "memory",
    "schedule",
    "planner",
    "skill_market",
)
STOCK_BUDGET = "You have a budget of ~50 tool-using turns — favor parallel tool calls and avoid duplicate searches."


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)


def base_harness_request(instruction: str) -> str:
    if instruction.count(STOCK_BUDGET) != 1:
        raise ValueError("AutomationBench instruction must contain one stock single-model budget")
    index = instruction.index(STOCK_BUDGET)
    before = instruction[:index]
    after = instruction[index + len(STOCK_BUDGET) :]
    if before.endswith(" ") and after.startswith(" "):
        after = after[1:]
    authority = "\n\n".join(
        [
            "This is an AutomationBench API-mode evaluation. The simulated business end state is the only scored deliverable.",
            "Load the mounted automationbench-api Skill with the real skill Tool before the first benchmark client operation, then use only the project-local client for benchmark operations.",
            before + after,
            "END OF AUTOMATIONBENCH CHILD TASK AUTHORITY.",
        ]
    )
    return "\n\n".join(
        [
            "Mission is the real intake coordinator. Delegate the complete business workflow to child Task work owned by the selected Expert Squad; Mission must not execute benchmark operations itself.",
            "Use the authority block below to preserve the benchmark operations, constraints and client Skill directive in every applicable assignment. You may paraphrase and organize each Task request for its assigned scope; preserve exact source values when required by the operation.",
            "Do not ask the operator a question, modify product files, or replace benchmark operations with a prose report.",
            authority,
        ]
    )


def process_snapshot() -> dict[tuple[int, int], dict[str, Any]]:
    snapshot: dict[tuple[int, int], dict[str, Any]] = {}
    for entry in Path("/proc").iterdir():
        if not entry.name.isdigit():
            continue
        try:
            raw = (entry / "stat").read_text()
            closing = raw.rfind(")")
            if closing < 0:
                continue
            pid = int(raw[: raw.find(" ")])
            fields = raw[closing + 2 :].split()
            state = fields[0]
            ppid = int(fields[1])
            start_time = int(fields[19])
        except (OSError, ValueError, IndexError):
            continue
        snapshot[(pid, start_time)] = {
            "pid": pid,
            "ppid": ppid,
            "start_time": start_time,
            "state": state,
        }
    return snapshot


def ancestor_pids(snapshot: dict[tuple[int, int], dict[str, Any]], pid: int) -> set[int]:
    by_pid = {row["pid"]: row for row in snapshot.values()}
    ancestors = {pid}
    current = pid
    while current in by_pid:
        parent = by_pid[current]["ppid"]
        if parent <= 1 or parent in ancestors:
            break
        ancestors.add(parent)
        current = parent
    return ancestors


def capture_process_baseline() -> None:
    snapshot = process_snapshot()
    excluded = ancestor_pids(snapshot, os.getpid())
    baseline = [row for row in snapshot.values() if row["pid"] not in excluded or row["pid"] == 1]
    write_json(LOGS / "process-baseline.json", {"schema_version": 1, "processes": baseline})


def cleanup_owned_processes() -> int:
    baseline_path = LOGS / "process-baseline.json"
    if not baseline_path.is_file():
        write_json(
            LOGS / "process-cleanup.json",
            {
                "schema_version": 1,
                "passed": True,
                "baseline_present": False,
                "owned_processes": [],
            },
        )
        return 0
    baseline = {
        (int(row["pid"]), int(row["start_time"]))
        for row in read_json_file(baseline_path).get("processes") or []
    }
    current = process_snapshot()
    protected = ancestor_pids(current, os.getpid()) | {1}
    targets = [
        row
        for identity, row in current.items()
        if identity not in baseline and row["pid"] not in protected
    ]
    for row in sorted(targets, key=lambda item: item["pid"], reverse=True):
        try:
            os.kill(row["pid"], signal.SIGTERM)
        except ProcessLookupError:
            pass
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        live = process_snapshot()
        if not [row for identity, row in live.items() if identity not in baseline and row["pid"] not in protected]:
            break
        time.sleep(0.1)
    live = process_snapshot()
    survivors = [row for identity, row in live.items() if identity not in baseline and row["pid"] not in protected]
    for row in survivors:
        try:
            os.kill(row["pid"], signal.SIGKILL)
        except ProcessLookupError:
            pass
    time.sleep(0.25)
    live = process_snapshot()
    final_residual = [
        row for identity, row in live.items() if identity not in baseline and row["pid"] not in protected
    ]
    final_survivors = [row for row in final_residual if row.get("state") != "Z"]
    final_zombies = [row for row in final_residual if row.get("state") == "Z"]
    audit = {
        "schema_version": 1,
        "passed": not final_survivors,
        "baseline_count": len(baseline),
        "targeted_processes": targets,
        "sigkill_processes": survivors,
        "survivors": final_survivors,
        "zombies_awaiting_parent_reap": final_zombies,
    }
    write_json(LOGS / "process-cleanup-audit.json", audit)
    if final_survivors:
        raise RuntimeError(f"OpenCorvus-owned processes survived cleanup: {final_survivors}")
    return 0


def read_json_file(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def request_json(
    route: str,
    *,
    method: str = "GET",
    body: Any = None,
    project_scoped: bool = True,
    timeout: float = 30,
) -> Any:
    url = urllib.parse.urljoin(SERVER, route)
    if project_scoped:
        separator = "&" if "?" in url else "?"
        url += separator + urllib.parse.urlencode({"directory": str(PROJECT)})
    headers = {"x-opencorvus-request-id": os.urandom(16).hex()}
    password = os.environ.get("OPENCORVUS_SERVER_PASSWORD")
    if password:
        username = os.environ.get("OPENCORVUS_SERVER_USERNAME", "opencorvus")
        token = base64.b64encode(f"{username}:{password}".encode()).decode()
        headers["authorization"] = f"Basic {token}"
    if project_scoped:
        headers["x-opencorvus-directory"] = str(PROJECT)
    payload = None
    if body is not None:
        payload = json.dumps(body).encode()
        headers["content-type"] = "application/json"
    request = urllib.request.Request(url, data=payload, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {route} failed {error.code}: {detail}") from error
    return json.loads(raw) if raw else None


def wait_for_server() -> dict[str, Any]:
    deadline = time.monotonic() + 90
    last_error = ""
    while time.monotonic() < deadline:
        try:
            health = request_json("/global/health", project_scoped=False, timeout=3)
            if health.get("healthy") is True:
                return health
        except Exception as error:  # server bootstrap is an expected retry window
            last_error = str(error)
        time.sleep(1)
    raise RuntimeError(f"OpenCorvus server did not become healthy: {last_error}")


def audit_projection(matrix: dict[str, Any]) -> dict[str, Any]:
    required = set(OWNERS)
    agents = {str(row.get("agent_id") or ""): row for row in matrix.get("agents") or []}
    grants = {
        str(row.get("agent_id") or ""): next(
            (grant for grant in row.get("grants") or [] if grant.get("ref") == SKILL_REF),
            None,
        )
        for row in matrix.get("matrix") or []
    }
    violations: list[str] = []
    for owner in OWNERS:
        agent = agents.get(owner)
        grant = grants.get(owner)
        if not agent:
            violations.append(f"required_agent_missing:{owner}")
            continue
        if agent.get("skill_mountable") is not True:
            violations.append(f"required_agent_not_mountable:{owner}")
        if agent.get("skill_tool_available") is not True:
            violations.append(f"required_agent_skill_tool_unavailable:{owner}")
        if not grant or grant.get("effective") is not True or grant.get("enabled") is not True:
            violations.append(f"required_grant_not_effective:{owner}")
    for agent_id, grant in grants.items():
        if agent_id not in required and grant and grant.get("effective") is True:
            violations.append(f"unexpected_effective:{agent_id}")
    skill = next((row for row in matrix.get("skills") or [] if row.get("ref") == SKILL_REF), None)
    if not skill:
        violations.append("skill_absent_from_pool")
    if matrix.get("active_profile") != PROFILE:
        violations.append("profile_mismatch")
    return {
        "passed": not violations,
        "profile": PROFILE,
        "skill_name": SKILL_NAME,
        "skill_ref": SKILL_REF,
        "required_agents": list(OWNERS),
        "projection_hash": matrix.get("projection_hash"),
        "violations": violations,
    }


def audit_mission_capability_boundary(agents: list[dict[str, Any]]) -> dict[str, Any]:
    mission = next((agent for agent in agents if agent.get("name") == "mission"), None)
    rules = mission.get("permission") if isinstance(mission, dict) else None
    denied: list[str] = []
    for capability in MISSION_DENIED_CAPABILITIES:
        action = "allow"
        for rule in rules if isinstance(rules, list) else []:
            if rule.get("permission") in {"*", capability} and rule.get("pattern") == "*":
                action = str(rule.get("action") or "allow")
        if action == "deny":
            denied.append(capability)
    missing = [capability for capability in MISSION_DENIED_CAPABILITIES if capability not in denied]
    return {
        "schema_version": 1,
        "passed": not missing,
        "mission_agent_present": mission is not None,
        "denied_capabilities": denied,
        "missing_denials": missing,
    }


def mount_skill() -> tuple[dict[str, Any], dict[str, Any]]:
    discovered = request_json(f"/skill/mounts?expertSquadID={PROFILE}&refresh=true")
    agents = {str(row.get("agent_id") or ""): row for row in discovered.get("agents") or []}
    for owner in OWNERS:
        agent = agents.get(owner)
        if not agent or agent.get("skill_mountable") is not True or agent.get("skill_tool_available") is not True:
            raise RuntimeError(f"Skill owner is not physically mountable: {PROFILE}/{owner}")
        request_json(
            "/skill/mount",
            method="PATCH",
            body={
                "scope": "project",
                "expertSquadID": PROFILE,
                "agentID": owner,
                "defaultSkillRef": SKILL_REF,
                "override": True,
            },
        )
    projected = request_json(f"/skill/mounts?expertSquadID={PROFILE}")
    audit = audit_projection(projected)
    if not audit["passed"]:
        raise RuntimeError(f"Skill projection failed: {audit['violations']}")
    return projected, audit


def session_id(message: dict[str, Any]) -> str | None:
    info = message.get("info") or {}
    value = info.get("sessionID") or info.get("session_id")
    return value if isinstance(value, str) and value else None


def canonical_messages(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def key(message: dict[str, Any]) -> tuple[int, str]:
        info = message.get("info") or {}
        created = (info.get("time") or {}).get("created") or 0
        return int(created), str(info.get("id") or "")

    return sorted(messages, key=key)


def public_messages(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    public = []
    for message in canonical_messages(messages):
        copied = dict(message)
        copied["parts"] = [
            part for part in message.get("parts") or [] if part.get("type") != "reasoning"
        ]
        public.append(copied)
    return public


def public_observation(observation: dict[str, Any]) -> dict[str, Any]:
    return {
        "mission_status": observation["mission_status"],
        "mission_id": observation["mission_record"].get("missionID"),
        "mission_completion": observation["mission_record"].get("completion"),
        "task_ids": observation["task_ids"],
        "task_statuses": [
            {
                "task_id": task["task_id"],
                "status": (task["board"].get("task") or {}).get("status"),
            }
            for task in observation["tasks"]
        ],
        "message_count": len(observation["all_transcript"]),
        "durable_settlement": observation["durable_settlement"],
    }


def audit_skill_load_order(
    messages: list[dict[str, Any]], occurrence_agents: list[str] | None = None
) -> dict[str, Any]:
    owner_sessions: dict[tuple[str, str], list[tuple[int, dict[str, Any]]]] = {}
    for message_index, message in enumerate(canonical_messages(messages)):
        info = message.get("info") or {}
        agent = info.get("agent")
        if info.get("role") != "assistant" or agent not in OWNERS:
            continue
        current_session = session_id(message)
        if current_session:
            owner_sessions.setdefault((agent, current_session), []).append((message_index, message))

    loads: list[dict[str, Any]] = []
    callers: list[dict[str, Any]] = []
    unknown_client_commands: list[dict[str, Any]] = []
    violations: list[str] = []

    def invokes_client(part: dict[str, Any]) -> bool:
        if part.get("tool") != "bash":
            return False
        command = str(((part.get("state") or {}).get("input") or {}).get("command") or "")
        try:
            lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|")
            lexer.whitespace_split = True
            tokens = list(lexer)
        except ValueError:
            return False
        for index, token in enumerate(tokens):
            if index > 0 and tokens[index - 1] not in {";", "&&", "||", "|"}:
                continue
            executable = token.rsplit("/", 1)[-1]
            if not (executable == "python" or executable == "python3" or executable.startswith("python3.")):
                continue
            cursor = index + 1
            while cursor < len(tokens) and tokens[cursor].startswith("-"):
                option = tokens[cursor]
                if option in {"-c", "-m"}:
                    return False
                cursor += 1
                if option in {"-W", "-X", "--check-hash-based-pycs"}:
                    cursor += 1
            if cursor < len(tokens) and tokens[cursor].rsplit("/", 1)[-1] == "automationbench_tool.py":
                return True
        return False
    for (agent, current_session), session_messages in sorted(owner_sessions.items()):
        tools: list[tuple[int, int, dict[str, Any]]] = []
        for message_index, message in session_messages:
            for part_index, part in enumerate(message.get("parts") or []):
                if part.get("type") == "tool":
                    tools.append((message_index, part_index, part))
                    command = str(((part.get("state") or {}).get("input") or {}).get("command") or "")
                    if part.get("tool") == "bash" and "automationbench_tool.py" in command and not invokes_client(part):
                        unknown_client_commands.append(
                            {
                                "agent_id": agent,
                                "session_id": current_session,
                                "message_index": message_index,
                                "part_index": part_index,
                            }
                        )
        client_call = next(
            (
                (message_index, part_index, part)
                for message_index, part_index, part in tools
                if invokes_client(part)
            ),
            None,
        )
        if not client_call:
            continue
        callers.append({"agent_id": agent, "session_id": current_session})
        exact_load = next(
            (
                (message_index, part_index, part)
                for message_index, part_index, part in tools
                if part.get("tool") == "skill"
                and ((part.get("state") or {}).get("input") or {}).get("name") == SKILL_NAME
                and (part.get("state") or {}).get("status") == "completed"
            ),
            None,
        )
        if not exact_load:
            violations.append(f"missing_skill_load:{agent}:{current_session}")
            continue
        if exact_load[:2] > client_call[:2]:
            violations.append(f"client_call_before_skill_load:{agent}:{current_session}")
        loads.append(
            {
                "agent_id": agent,
                "session_id": current_session,
                "message_index": exact_load[0],
                "part_index": exact_load[1],
            }
        )
    violations.extend(
        f"client_invocation_parse_incomplete:{item['agent_id']}:{item['session_id']}:{item['message_index']}:{item['part_index']}"
        for item in unknown_client_commands
    )
    return {
        "passed": not violations,
        "owners_with_assistant_messages": [
            {"agent_id": agent, "session_id": current_session}
            for agent, current_session in sorted(owner_sessions)
        ],
        "benchmark_client_callers": callers,
        "unknown_client_commands": unknown_client_commands,
        "successful_skill_loads": loads,
        "observed_occurrence_agents": sorted(set(occurrence_agents or [])),
        "violations": violations,
    }


def read_rows(connection: sqlite3.Connection, query: str, parameters: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    return [dict(row) for row in connection.execute(query, parameters).fetchall()]


def durable_settlement(task_ids: list[str]) -> dict[str, Any]:
    database = HOME / "data" / "opencorvus.db"
    if not database.is_file():
        return {"passed": False, "violations": ["runtime_database_missing"]}
    connection = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        pending_provider = read_rows(
            connection,
            """SELECT request.id
               FROM provider_activity_request request
               LEFT JOIN provider_activity_outcome outcome ON outcome.request_id=request.id
               WHERE outcome.id IS NULL ORDER BY request.id""",
        )
        pending_tools = read_rows(
            connection,
            """SELECT request.id, json_extract(request.data,'$.tool') AS tool
               FROM tool_part_request request
               LEFT JOIN tool_part_outcome outcome ON outcome.request_part_id=request.id
               WHERE outcome.id IS NULL ORDER BY request.time_created, request.id""",
        )
        pending_protocol = read_rows(
            connection,
            """SELECT inbox.id, inbox.actor, inbox.actor_id, inbox.visible_at
               FROM protocol_inbox inbox
               WHERE NOT EXISTS (
                 SELECT 1 FROM protocol_delivery_receipt receipt
                 WHERE receipt.inbox_id=inbox.id
                   AND json_extract(receipt.receipt,'$.kind') <> 'retry_wait'
               ) ORDER BY inbox.time_created, inbox.id""",
        )
        dead_protocol = read_rows(
            connection,
            """SELECT inbox_id, json_extract(receipt,'$.kind') AS kind
               FROM protocol_delivery_receipt
               WHERE json_extract(receipt,'$.kind')='dead_letter'
               ORDER BY time_created, id""",
        )
        pending_controls = read_rows(
            connection,
            """SELECT control.id, control.session_id, control.kind
               FROM session_control_record control
               WHERE NOT EXISTS (
                 SELECT 1 FROM session_control_event event
                 WHERE event.control_id=control.id AND event.kind IN ('consumed','failed')
               ) ORDER BY control.time_created, control.id""",
        )
        pending_automation_runs = read_rows(
            connection,
            """SELECT run.id, run.automation_revision_id
               FROM automation_run run
               WHERE NOT EXISTS (
                 SELECT 1 FROM automation_run_receipt receipt
                 WHERE receipt.run_id=run.id AND receipt.outcome IN ('succeeded','failed')
               ) ORDER BY run.started_at, run.id""",
        )
        occurrences: list[dict[str, Any]] = []
        if task_ids:
            placeholders = ",".join("?" for _ in task_ids)
            occurrences = read_rows(
                connection,
                f"""SELECT descriptor.task_id, descriptor.session_id AS child_session_id,
                           descriptor.agent
                    FROM worker_turn_descriptor descriptor
                    WHERE descriptor.task_id IN ({placeholders})
                    ORDER BY descriptor.task_id, descriptor.time_created, descriptor.id""",
                tuple(task_ids),
            )
    finally:
        connection.close()
    violations = []
    if pending_provider:
        violations.append(f"pending_provider:{len(pending_provider)}")
    if pending_tools:
        violations.append(f"pending_tools:{len(pending_tools)}")
    if pending_protocol:
        violations.append(f"pending_protocol:{len(pending_protocol)}")
    if dead_protocol:
        violations.append(f"dead_protocol:{len(dead_protocol)}")
    if pending_controls:
        violations.append(f"pending_session_controls:{len(pending_controls)}")
    if pending_automation_runs:
        violations.append(f"pending_automation_runs:{len(pending_automation_runs)}")
    invalid_occurrences = [
        row for row in occurrences if not row.get("child_session_id") or not row.get("agent")
    ]
    if invalid_occurrences:
        violations.append(f"occurrence_descriptor_missing:{len(invalid_occurrences)}")
    return {
        "passed": not violations,
        "pending_provider": pending_provider,
        "pending_tools": pending_tools,
        "pending_protocol": pending_protocol,
        "dead_protocol": dead_protocol,
        "pending_session_controls": pending_controls,
        "pending_automation_runs": pending_automation_runs,
        "occurrences": occurrences,
        "invalid_occurrences": invalid_occurrences,
        "violations": violations,
    }


def observe(mission_id: str, mission_session_id: str) -> dict[str, Any]:
    mission_status = request_json(f"/mission/{mission_id}/status")
    mission_records = request_json("/mission?limit=100")
    mission_record = next((row for row in mission_records if row.get("missionID") == mission_id), None)
    if not mission_record:
        raise RuntimeError(f"Mission record disappeared: {mission_id}")
    mission_transcript = request_json(f"/session/{mission_session_id}/message")
    session_status = request_json("/session/status")
    task_ids = sorted(
        {
            str(row.get("taskID"))
            for row in mission_status.get("tasks") or []
            if row.get("taskID")
        }
    )
    tasks: list[dict[str, Any]] = []
    for task_id in task_ids:
        tasks.append(
            {
                "task_id": task_id,
                "board": request_json(f"/task/{task_id}/board?sync=0"),
                "transcript": request_json(f"/task/{task_id}/transcript"),
                "trace": request_json(f"/task/{task_id}/trace"),
                "interactions": request_json(f"/task/{task_id}/interactions"),
            }
        )
    all_transcript = canonical_messages(
        list(mission_transcript) + [message for task in tasks for message in task["transcript"]]
    )
    durable = durable_settlement(task_ids)
    executing_sessions = sorted(
        session_id
        for session_id, status in session_status.items()
        if (status or {}).get("type") in {"streaming", "retry"}
    )
    if executing_sessions:
        durable["passed"] = False
        durable["violations"] = [
            *durable["violations"],
            f"executing_sessions:{len(executing_sessions)}",
        ]
    durable["session_status"] = session_status
    durable["executing_sessions"] = executing_sessions
    return {
        "mission_status": mission_status,
        "mission_record": mission_record,
        "mission_transcript": mission_transcript,
        "task_ids": task_ids,
        "tasks": tasks,
        "all_transcript": all_transcript,
        "durable_settlement": durable,
    }


def activity_signature(observation: dict[str, Any]) -> str:
    mission_status = {
        key: value
        for key, value in observation["mission_status"].items()
        if key != "generatedAt"
    }
    compact = {
        "mission_status": mission_status,
        "mission_completion": observation["mission_record"].get("completion"),
        "messages": [
            (
                (row.get("info") or {}).get("id"),
                ((row.get("info") or {}).get("time") or {}).get("updated"),
                hashlib.sha256(
                    json.dumps(row.get("parts") or [], sort_keys=True, default=str).encode()
                ).hexdigest(),
            )
            for row in observation["all_transcript"]
        ],
        "tasks": [
            {
                "id": task["task_id"],
                "status": (task["board"].get("task") or {}).get("status"),
                "trace_events": len((task["trace"] or {}).get("events") or []),
                "trace_sha256": hashlib.sha256(
                    json.dumps((task["trace"] or {}).get("events") or [], sort_keys=True, default=str).encode()
                ).hexdigest(),
                "interactions": len(task["interactions"] or []),
            }
            for task in observation["tasks"]
        ],
        "durable_settlement": observation["durable_settlement"],
    }
    return hashlib.sha256(json.dumps(compact, sort_keys=True).encode()).hexdigest()


def natural_terminal(observation: dict[str, Any]) -> bool:
    status = observation["mission_status"]
    task_rows = status.get("tasks") or []
    return bool(
        status.get("status") == "inactive"
        and observation["mission_record"].get("interruptible") is False
        and task_rows
        and observation["durable_settlement"].get("passed") is True
        and all(
            row.get("lifecycleStatus") in {"completed", "failed", "cancelled"}
            for row in task_rows
        )
    )


def wait_for_terminal(mission_id: str, mission_session_id: str) -> dict[str, Any]:
    inactivity = int(os.environ.get("OPENCORVUS_INACTIVITY_SECONDS", "600"))
    deadline = time.monotonic() + inactivity
    previous = ""
    while True:
        observation = observe(mission_id, mission_session_id)
        write_json(LOGS / "last-public-observation.json", public_observation(observation))
        signature = activity_signature(observation)
        if signature != previous:
            previous = signature
            deadline = time.monotonic() + inactivity
            print(
                json.dumps(
                    {
                        "event": "opencorvus_activity",
                        "mission_id": mission_id,
                        "task_ids": observation["task_ids"],
                        "messages": len(observation["all_transcript"]),
                        "status": observation["mission_status"].get("status"),
                    },
                    ensure_ascii=False,
                ),
                flush=True,
            )
        if natural_terminal(observation):
            time.sleep(5)
            confirmed = observe(mission_id, mission_session_id)
            write_json(LOGS / "last-public-observation.json", public_observation(confirmed))
            if natural_terminal(confirmed) and activity_signature(confirmed) == signature:
                return confirmed
            previous = activity_signature(confirmed)
            deadline = time.monotonic() + inactivity
        if time.monotonic() >= deadline:
            raise RuntimeError(f"No durable OpenCorvus activity for {inactivity} seconds")
        time.sleep(2)


def usage_rows(database: Path) -> list[dict[str, Any]]:
    if not database.is_file():
        return []
    connection = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        rows = connection.execute(
            """SELECT id, occurred_at, provider_id, model_id, purpose,
                      input_tokens, output_tokens, reasoning_tokens,
                      cache_read_tokens, cache_write_tokens, total_tokens,
                      cost_usd, billing_status, session_id, agent_id
               FROM provider_usage_event
               WHERE purpose <> 'provider-connectivity'
               ORDER BY occurred_at, id"""
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()


def capture_runtime_database() -> list[dict[str, Any]]:
    source = HOME / "data" / "opencorvus.db"
    rows = usage_rows(source)
    write_json(LOGS / "provider-usage.json", rows)
    return rows


def token_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    def total(key: str) -> int:
        return sum(int(row.get(key) or 0) for row in rows)

    costs = [row.get("cost_usd") for row in rows if row.get("cost_usd") is not None]
    return {
        "input": total("input_tokens"),
        "output": total("output_tokens"),
        "reasoning": total("reasoning_tokens"),
        "cache_read": total("cache_read_tokens"),
        "cache_write": total("cache_write_tokens"),
        "total": total("total_tokens"),
        "model_calls": len(rows),
        "cost_usd": sum(float(value) for value in costs) if costs else None,
    }


def provider_usage_audit(rows: list[dict[str, Any]]) -> dict[str, Any]:
    violations = []
    if not rows:
        violations.append("provider_usage_empty")
    for row in rows:
        if row.get("provider_id") != "openai":
            violations.append(f"provider_mismatch:{row.get('id')}")
        if row.get("model_id") != "gpt-5.6-luna":
            violations.append(f"model_mismatch:{row.get('id')}")
    return {
        "passed": not violations,
        "provider": "openai",
        "model": "gpt-5.6-luna",
        "calls": len(rows),
        "violations": violations,
    }


def workflow_audit(observation: dict[str, Any]) -> dict[str, Any]:
    bindings = []
    violations = []
    for task in observation["tasks"]:
        board_task = task["board"].get("task") or {}
        binding = (board_task.get("completionDecision") or {}).get("workflowBinding")
        selected = binding.get("workflow_id") if isinstance(binding, dict) else None
        profile = (board_task.get("packageRevisionBinding") or {}).get("id")
        bindings.append(
            {"task_id": task["task_id"], "profile": profile, "workflow_binding": binding}
        )
        if profile != PROFILE:
            violations.append(f"profile_mismatch:{task['task_id']}:{profile}")
        if not isinstance(binding, dict) or binding.get("kind") != "virtual_workflow" or selected != WORKFLOW:
            violations.append(f"workflow_mismatch:{task['task_id']}:{selected}")
    return {"passed": not violations, "bindings": bindings, "violations": violations}


def seal_manifest(root: Path) -> None:
    files = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.name == "evidence-manifest.json":
            continue
        data = path.read_bytes()
        files.append(
            {
                "path": path.relative_to(root).as_posix(),
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            }
        )
    write_json(root / "evidence-manifest.json", {"schema_version": 1, "files": files})


def credential_leak_audit() -> dict[str, Any]:
    auth_path = HOME / "data" / "auth.json"
    if not auth_path.is_file():
        return {"passed": False, "violations": ["auth_projection_missing"]}
    auth = json.loads(auth_path.read_text(encoding="utf-8"))
    secrets: list[bytes] = []

    def collect(value: Any) -> None:
        if isinstance(value, dict):
            for item in value.values():
                collect(item)
        elif isinstance(value, list):
            for item in value:
                collect(item)
        elif isinstance(value, str) and len(value) >= 12:
            secrets.append(value.encode())

    collect(auth)
    violations: list[str] = []
    for path in sorted(LOGS.rglob("*")):
        if not path.is_file() or path.suffix in {".db", ".wal", ".shm"}:
            continue
        data = path.read_bytes()
        if any(secret in data for secret in secrets):
            violations.append(f"credential_bytes_present:{path.relative_to(LOGS).as_posix()}")
    return {"passed": not violations, "checked_secret_count": len(secrets), "violations": violations}


def finalize_host_cancelled() -> int:
    rows = capture_runtime_database()
    write_json(LOGS / "provider-usage-audit.json", provider_usage_audit(rows))
    disposition_path = LOGS / "attempt-disposition.json"
    disposition = read_json_file(disposition_path) if disposition_path.is_file() else {}
    if disposition.get("status") not in {"runtime_settled", "agent_settled"}:
        write_json(
            AGENT_SETTLEMENT_REVOKED,
            {"schema_version": 1, "status": "revoked", "reason": "host_cancelled_before_agent_settlement"},
        )
        write_json(
            disposition_path,
            {
                "schema_version": 1,
                "status": "invalid_bug",
                "score_eligible": False,
                "reason": "host_cancelled_before_agent_settlement",
            },
        )
    credential_audit = credential_leak_audit()
    write_json(LOGS / "credential-leak-audit.json", credential_audit)
    seal_manifest(LOGS)
    return 0 if credential_audit["passed"] else 2


def finalize_agent_settled() -> int:
    disposition_path = LOGS / "attempt-disposition.json"
    disposition = read_json_file(disposition_path) if disposition_path.is_file() else {}
    if disposition.get("status") != "runtime_settled":
        raise RuntimeError(
            f"Agent settlement requires runtime_settled disposition, observed {disposition.get('status', 'missing')}"
        )
    cleanup = read_json_file(LOGS / "process-cleanup-audit.json")
    credential = read_json_file(LOGS / "credential-leak-audit.json")
    if cleanup.get("survivors") or credential.get("passed") is not True:
        raise RuntimeError("Agent settlement audits are incomplete")
    disposition_bytes = disposition_path.read_bytes()
    write_json(
        AGENT_SETTLEMENT,
        {
            "schema_version": 1,
            "status": "agent_settled",
            "runtime_disposition_sha256": hashlib.sha256(disposition_bytes).hexdigest(),
        },
    )
    return 0


def revoke_agent_settlement() -> int:
    write_json(
        AGENT_SETTLEMENT_REVOKED,
        {"schema_version": 1, "status": "revoked", "reason": "agent_settlement_publication_uncertain"},
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--instruction-file")
    parser.add_argument("--cleanup-owned-processes", action="store_true")
    parser.add_argument("--finalize-host-cancelled", action="store_true")
    parser.add_argument("--finalize-agent-settled", action="store_true")
    parser.add_argument("--revoke-agent-settlement", action="store_true")
    args = parser.parse_args()
    if args.cleanup_owned_processes:
        return cleanup_owned_processes()
    if args.finalize_host_cancelled:
        return finalize_host_cancelled()
    if args.finalize_agent_settled:
        return finalize_agent_settled()
    if args.revoke_agent_settlement:
        return revoke_agent_settlement()
    if not args.instruction_file:
        parser.error("--instruction-file is required for a trial run")
    instruction = Path(args.instruction_file).read_text(encoding="utf-8")
    write_json(
        LOGS / "attempt-disposition.json",
        {"schema_version": 1, "status": "running", "score_eligible": False},
    )
    source_receipt = Path("/run/evidence/source-receipt.json")
    if source_receipt.is_file():
        (LOGS / "source-receipt.json").write_bytes(source_receipt.read_bytes())
    capture_process_baseline()
    os.environ["OPENCORVUS_SERVER_USERNAME"] = "opencorvus"
    os.environ["OPENCORVUS_SERVER_PASSWORD"] = secrets.token_urlsafe(32)
    server_log = (LOGS / "opencorvus-server.log").open("w", encoding="utf-8")
    server = subprocess.Popen(
        [
            os.environ["OPENCORVUS_BIN"],
            "serve",
            "--project-dir",
            str(PROJECT),
            "--hostname",
            "127.0.0.1",
            "--port",
            "7878",
            "--print-logs",
        ],
        cwd=PROJECT,
        env=os.environ.copy(),
        stdout=server_log,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    (LOGS / "opencorvus-server.pid").write_text(f"{server.pid}\n", encoding="ascii")
    started_at = time.time()
    observation = None
    rows: list[dict[str, Any]] = []
    try:
        health = wait_for_server()
        write_json(LOGS / "server-health.json", health)
        preflight = request_json(
            "/global/providers/openai/test",
            method="POST",
            body={"modelID": MODEL.split("/", 1)[1]},
            project_scoped=False,
            timeout=180,
        )
        write_json(LOGS / "provider-preflight.json", preflight)
        if not preflight.get("ok") or preflight.get("status") != "connected":
            raise RuntimeError("Exact Luna Provider preflight failed")
        matrix, projection = mount_skill()
        write_json(LOGS / "skill-mount-matrix.json", matrix)
        write_json(LOGS / "skill-projection-audit.json", projection)
        mission_boundary = audit_mission_capability_boundary(request_json("/agent"))
        write_json(LOGS / "mission-capability-boundary.json", mission_boundary)
        if not mission_boundary["passed"]:
            raise RuntimeError(
                f"Mission capability boundary failed: {mission_boundary['missing_denials']}"
            )
        notice = (
            "\n\n[OpenCorvus harness notice]\n"
            "This is an official AutomationBench API-mode task. The project-local client is the "
            "only benchmark tool surface. Load the exact mounted automationbench-api Skill before "
            "any owner-specific benchmark operation and follow it. Complete the requested simulated "
            "business workflow; Harbor invokes the official scorer after this Agent settles."
        )
        wake_request = {
            "text": base_harness_request(instruction) + notice,
            "model": MODEL,
            "productPillar": "work",
            "expertSquadIDs": [PROFILE],
        }
        write_json(LOGS / "mission-wake-request.json", wake_request)
        wake = request_json("/mission/wake", method="POST", body=wake_request)
        write_json(LOGS / "mission-wake-response.json", wake)
        if not wake.get("created") or wake.get("productPillar") != "work":
            raise RuntimeError("Mission wake did not create the expected Work Mission")
        observation = wait_for_terminal(wake["missionID"], wake["sessionID"])
        write_json(LOGS / "mission-status.json", observation["mission_status"])
        write_json(LOGS / "mission-record.json", observation["mission_record"])
        write_json(LOGS / "mission-transcript.json", public_messages(observation["mission_transcript"]))
        write_json(
            LOGS / "task-evidence.json",
            [
                {
                    "task_id": task["task_id"],
                    "board": task["board"],
                    "transcript": public_messages(task["transcript"]),
                }
                for task in observation["tasks"]
            ],
        )
        write_json(LOGS / "opencorvus-transcript.json", public_messages(observation["all_transcript"]))
        occurrence_agents = [
            str(row.get("agent"))
            for row in observation["durable_settlement"].get("occurrences") or []
            if row.get("agent")
        ]
        load_audit = audit_skill_load_order(observation["all_transcript"], occurrence_agents)
        binding_audit = workflow_audit(observation)
        write_json(LOGS / "skill-load-order-audit.json", load_audit)
        write_json(LOGS / "workflow-binding-audit.json", binding_audit)
        write_json(LOGS / "physical-settlement-audit.json", observation["durable_settlement"])
    finally:
        if server.poll() is None:
            os.killpg(server.pid, signal.SIGTERM)
            try:
                server.wait(timeout=20)
            except subprocess.TimeoutExpired:
                os.killpg(server.pid, signal.SIGKILL)
                server.wait(timeout=10)
        server_log.close()
        rows = capture_runtime_database()

    tokens = token_summary(rows)
    usage_audit = provider_usage_audit(rows)
    write_json(LOGS / "provider-usage-audit.json", usage_audit)
    if not usage_audit["passed"]:
        raise RuntimeError(f"Provider usage identity failed: {usage_audit['violations']}")
    summary = {
        "schema_version": 1,
        "status": "settled",
        "model": MODEL,
        "profile": PROFILE,
        "workflow": WORKFLOW,
        "mission_id": observation["mission_record"].get("missionID"),
        "mission_session_id": observation["mission_record"].get("sessionID"),
        "task_ids": observation["task_ids"],
        "task_lifecycle": [
            {
                "task_id": task["task_id"],
                "status": (task["board"].get("task") or {}).get("status"),
            }
            for task in observation["tasks"]
        ],
        "started_at": started_at,
        "finished_at": time.time(),
        "tokens": tokens,
    }
    write_json(LOGS / "terminal-summary.json", summary)
    credential_audit = credential_leak_audit()
    write_json(LOGS / "credential-leak-audit.json", credential_audit)
    if not credential_audit["passed"]:
        raise RuntimeError(f"Credential leak audit failed: {credential_audit['violations']}")
    write_json(
        LOGS / "attempt-disposition.json",
        {
            "schema_version": 1,
            "status": "runtime_settled",
            "score_eligible": False,
            "agent_cleanup": "pending",
        },
    )
    seal_manifest(LOGS)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        try:
            write_json(LOGS / "credential-leak-audit.json", credential_leak_audit())
        except Exception as audit_error:
            write_json(
                LOGS / "credential-leak-audit.json",
                {"passed": False, "violations": [f"audit_failed:{type(audit_error).__name__}"]},
            )
        write_json(
            LOGS / "adapter-failure.json",
            {"schema_version": 1, "error_type": type(error).__name__, "message": str(error)},
        )
        write_json(
            LOGS / "attempt-disposition.json",
            {
                "schema_version": 1,
                "status": "invalid_bug",
                "score_eligible": False,
                "reason": f"adapter:{type(error).__name__}",
            },
        )
        seal_manifest(LOGS)
        print(f"OpenCorvus AutomationBench adapter failed: {error}", file=sys.stderr, flush=True)
        raise
