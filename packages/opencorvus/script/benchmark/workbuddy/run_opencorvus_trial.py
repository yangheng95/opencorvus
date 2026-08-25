#!/usr/bin/env python3
"""Execute one WorkBuddy Code instruction through OpenCorvus Mission/Base."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
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
HOME = Path(os.environ.get("OPENCORVUS_HOME", "/tmp/opencorvus-workbuddy-home"))
SERVER = "http://127.0.0.1:7878"
SKILL_NAME = "workbuddybench-code"
SKILL_REF = f"default/skill/{SKILL_NAME}"
PROFILE = os.environ.get("OPENCORVUS_PROFILE", "base")
MODEL = os.environ.get("OPENCORVUS_MODEL", "openai/gpt-5.6-luna")
WORKFLOW = os.environ.get("OPENCORVUS_WORKFLOW", "planner-execution-verification")
OWNERS = ("orchestrator", "base-planner", "base-developer", "base-tester")


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)


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
        raise RuntimeError("OpenCorvus process baseline is missing")
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


def audit_skill_load_order(
    messages: list[dict[str, Any]], occurrence_agents: list[str] | None = None
) -> dict[str, Any]:
    owner_sessions: dict[tuple[str, str], list[tuple[int, dict[str, Any]]]] = {}
    dispatched: set[str] = set()
    for message_index, message in enumerate(canonical_messages(messages)):
        info = message.get("info") or {}
        agent = info.get("agent")
        if isinstance(agent, str) and agent:
            dispatched.add(agent)
        if info.get("role") != "assistant" or agent not in OWNERS:
            continue
        current_session = session_id(message)
        if current_session:
            owner_sessions.setdefault((agent, current_session), []).append((message_index, message))

    loads: list[dict[str, Any]] = []
    violations: list[str] = []
    for (agent, current_session), session_messages in sorted(owner_sessions.items()):
        tools: list[tuple[int, int, dict[str, Any]]] = []
        for message_index, message in session_messages:
            for part_index, part in enumerate(message.get("parts") or []):
                if part.get("type") == "tool":
                    tools.append((message_index, part_index, part))
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
        first_tool = tools[0] if tools else None
        if not first_tool or first_tool[:2] != exact_load[:2]:
            violations.append(f"action_before_skill_load:{agent}:{current_session}")
        loads.append(
            {
                "agent_id": agent,
                "session_id": current_session,
                "message_index": exact_load[0],
                "part_index": exact_load[1],
            }
        )
    dispatched.update(occurrence_agents or [])
    unexpected = sorted(agent for agent in dispatched if agent not in OWNERS)
    violations.extend(f"unexpected_dispatched_agent:{agent}" for agent in unexpected)
    return {
        "passed": not violations,
        "owners_with_assistant_messages": [
            {"agent_id": agent, "session_id": current_session}
            for agent, current_session in sorted(owner_sessions)
        ],
        "successful_skill_loads": loads,
        "dispatched_agents": sorted(dispatched),
        "unexpected_dispatched_agents": unexpected,
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
        active_wakes: list[dict[str, Any]] = []
        if task_ids:
            placeholders = ",".join("?" for _ in task_ids)
            active_wakes = read_rows(
                connection,
                f"""SELECT automation.id, automation.task_id, automation.due_at
                    FROM automation
                    WHERE automation.status='active'
                      AND automation.kind='delay'
                      AND automation.task_id IN ({placeholders})
                      AND NOT EXISTS (
                        SELECT 1 FROM automation_definition_tombstone tombstone
                        WHERE tombstone.definition_id=automation.definition_id
                          AND tombstone.revision >= automation.revision
                      ) ORDER BY automation.due_at, automation.id""",
                tuple(task_ids),
            )
        occurrences = read_rows(
            connection,
            """SELECT occurrence.task_id, occurrence.workflow_id,
                      occurrence.workflow_node_id, occurrence.child_session_id,
                      (SELECT descriptor.agent FROM worker_turn_descriptor descriptor
                       WHERE descriptor.session_id=occurrence.child_session_id
                       ORDER BY descriptor.time_created DESC, descriptor.id DESC LIMIT 1) AS agent
               FROM engine_workflow_node_occurrence occurrence
               ORDER BY occurrence.task_id, occurrence.workflow_id, occurrence.workflow_node_id""",
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
    if active_wakes:
        violations.append(f"active_scheduled_wakes:{len(active_wakes)}")
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
        "active_scheduled_wakes": active_wakes,
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
    compact = {
        "mission_status": observation["mission_status"],
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
        observation["mission_record"].get("completion")
        and status.get("status") == "inactive"
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
        write_json(LOGS / "last-public-observation.json", observation)
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
            write_json(LOGS / "last-public-observation.json", confirmed)
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
    evidence_data = LOGS / "opencorvus-data"
    evidence_data.mkdir(parents=True, exist_ok=True)
    target = evidence_data / "opencorvus.db"
    if source.is_file():
        source_connection = sqlite3.connect(f"file:{source}?mode=ro", uri=True)
        target_connection = sqlite3.connect(target)
        try:
            source_connection.backup(target_connection)
        finally:
            target_connection.close()
            source_connection.close()
    rows = usage_rows(target)
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
    if disposition.get("status") != "agent_settled":
        write_json(
            disposition_path,
            {
                "schema_version": 1,
                "status": "invalid_bug",
                "score_eligible": False,
                "reason": "host_cancelled_before_agent_settlement",
            },
        )
    write_json(LOGS / "credential-leak-audit.json", credential_leak_audit())
    seal_manifest(LOGS)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--instruction-file")
    parser.add_argument("--cleanup-owned-processes", action="store_true")
    parser.add_argument("--finalize-host-cancelled", action="store_true")
    args = parser.parse_args()
    if args.cleanup_owned_processes:
        return cleanup_owned_processes()
    if args.finalize_host_cancelled:
        return finalize_host_cancelled()
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
        notice = (
            "\n\n[OpenCorvus harness notice]\n"
            "This is an official WorkBuddy Bench Code sandbox. The mutable task repository is "
            "/workspace. Load the exact mounted workbuddybench-code Skill before any owner-specific "
            "material action and follow it. Complete the requested repository change; the official "
            "verifier will grade the final workspace."
        )
        wake_request = {
            "text": instruction + notice,
            "model": MODEL,
            "productPillar": "code",
            "expertSquadIDs": [PROFILE],
        }
        write_json(LOGS / "mission-wake-request.json", wake_request)
        wake = request_json("/mission/wake", method="POST", body=wake_request)
        write_json(LOGS / "mission-wake-response.json", wake)
        if not wake.get("created") or wake.get("productPillar") != "code":
            raise RuntimeError("Mission wake did not create the expected Code Mission")
        observation = wait_for_terminal(wake["missionID"], wake["sessionID"])
        write_json(LOGS / "mission-status.json", observation["mission_status"])
        write_json(LOGS / "mission-record.json", observation["mission_record"])
        write_json(LOGS / "mission-transcript.json", observation["mission_transcript"])
        write_json(LOGS / "task-evidence.json", observation["tasks"])
        write_json(LOGS / "opencorvus-transcript.json", observation["all_transcript"])
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
        if not load_audit["passed"]:
            raise RuntimeError(f"Runtime Skill adherence failed: {load_audit['violations']}")
        if not binding_audit["passed"]:
            raise RuntimeError(f"Mission/Base workflow binding failed: {binding_audit['violations']}")
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
        "status": "completed",
        "model": MODEL,
        "profile": PROFILE,
        "workflow": WORKFLOW,
        "mission_id": observation["mission_record"].get("missionID"),
        "mission_session_id": observation["mission_record"].get("sessionID"),
        "task_ids": observation["task_ids"],
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
            "status": "agent_settled",
            "score_eligible": False,
            "official_verifier": "pending",
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
        print(f"OpenCorvus WorkBuddy adapter failed: {error}", file=sys.stderr, flush=True)
        raise
