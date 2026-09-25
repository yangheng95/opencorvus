"""Registered model-free driver inputs; real MCP/API outputs, never participant fixtures."""

from __future__ import annotations

import asyncio
import copy
import json
import socket
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx
import pytest
from automationbench.schema.world import WorldState
from inspect_ai import eval
from inspect_ai.log import read_eval_log
from inspect_ai.model import ChatMessageUser
from inspect_ai.solver import TaskState
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

from opencorvus_inspect.adapter import AdapterConfig
from opencorvus_inspect.automationbench.api_session import ApiSession
from opencorvus_inspect.automationbench.development import (
    FIXTURE_KIND,
    DevelopmentFixture,
    development_environment,
    load_development_fixture,
)
from opencorvus_inspect.automationbench.development_task import opencorvus_business_repair
from opencorvus_inspect.automationbench.mcp import world_server
from opencorvus_inspect.automationbench.task import opencorvus_automationbench

PACKAGE = Path(__file__).parents[1]
SQUAD = PACKAGE.parents[1] / "expert-squads/builtin/automationbench"
ALLOWED = ["gmail", "google_drive", "google_sheets", "salesforce"]
RECORD = "https://test.salesforce.com/services/data/v61.0/sobjects/Opportunity/checker-opportunity"


def driver_input() -> dict[str, Any]:
    # A new, explicitly authored test object. No archived business world is loaded.
    world = WorldState.model_validate(
        {
            "meta": {"current_time": "2026-01-15T09:00:00Z", "allowed_services": ALLOWED},
            "salesforce": {
                "opportunities": [
                    {
                        "id": "checker-opportunity",
                        "name": "Checker Opportunity",
                        "amount": 20,
                        "description": "checker starting explanation",
                        "stage_name": "On Hold",
                    },
                    {"id": "preserved-opportunity", "name": "Preserved", "amount": 9},
                ],
            },
            "google_sheets": {
                "spreadsheets": [
                    {
                        "id": "checker-sheet",
                        "title": "Checker",
                        "worksheets": [
                            {
                                "id": "checker-tab",
                                "title": "Values",
                                "rows": [
                                    {"row_id": 2, "cells": {"A": "original"}},
                                ],
                            }
                        ],
                    }
                ]
            },
        }
    )
    return {
        "schema_version": 1,
        "kind": FIXTURE_KIND,
        "id": "local-checker",
        "request": "Review and correct the existing checker record using available sources.",
        "source": {
            "author": "test-driver",
            "reference": "G17 local checker",
            "description": "Synthetic transport/state input; not an agent decision.",
        },
        "state": {"world": world.model_dump(mode="json"), "google_sheets_updated_row_keys": []},
    }


def load_input(tmp_path: Path, payload: dict[str, Any]) -> DevelopmentFixture:
    path = tmp_path / "input.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return load_development_fixture(path)


def state_for(fixture: DevelopmentFixture) -> TaskState:
    return TaskState(
        model="none",  # type: ignore[arg-type]
        sample_id=fixture.identifier,
        epoch=1,
        input=fixture.request,
        messages=[ChatMessageUser(content=fixture.request)],
        metadata={},
    )


@pytest.mark.asyncio
async def test_real_mcp_patch_readback_permissions_and_snapshot_restore(tmp_path: Path) -> None:
    payload = driver_input()
    fixture = load_input(tmp_path, payload)
    session = ApiSession.restore(fixture.state)
    original = copy.deepcopy(fixture.state)
    assert session.state_snapshot() == original
    assert len(original["world"]) - 1 == 48
    assert session.world.meta.allowed_services == ALLOWED
    async with world_server(session) as url:
        async with (
            httpx.AsyncClient(trust_env=False) as http,
            streamable_http_client(url, http_client=http) as (read, write, _),
            ClientSession(read, write) as client,
        ):
            await client.initialize()
            assert sorted(tool.name for tool in (await client.list_tools()).tools) == [
                "api_catalog",
                "api_fetch",
                "api_search",
                "base64_encode",
            ]

            async def fetch(method: str, target: str, **kwargs: Any) -> Any:
                result = await client.call_tool(
                    "api_fetch", {"method": method, "url": target, **kwargs}
                )
                assert result.isError is False
                return json.loads("\n".join(c.text for c in result.content if c.type == "text"))

            before = await fetch("GET", RECORD)
            assert before["Amount"] == 20
            assert (
                await fetch(
                    "PATCH",
                    RECORD,
                    body={
                        "Amount": 42,
                        "Description": "checker corrected explanation",
                    },
                )
                == {}
            )
            after = await fetch("GET", RECORD)
            assert (after["Id"], after["Amount"], after["Description"], after["StageName"]) == (
                "checker-opportunity",
                42,
                "checker corrected explanation",
                "On Hold",
            )
            denied = await fetch("GET", "https://slack.com/api/conversations.list")
            assert denied["error"] == {
                "code": 401,
                "message": "No slack account is connected to this workspace "
                "(no credentials configured for this service).",
            }
            updated = await fetch(
                "PUT",
                "https://sheets.googleapis.com/v4/spreadsheets/checker-sheet/values/Values!A2",
                params={"valueInputOption": "RAW"},
                body={"values": [["changed"]]},
            )
            assert updated["updatedCells"] == 1
    snapshot = session.state_snapshot()
    assert snapshot["world"]["meta"] == original["world"]["meta"]
    assert (
        snapshot["world"]["salesforce"]["opportunities"][1]
        == (original["world"]["salesforce"]["opportunities"][1])
    )
    assert snapshot["google_sheets_updated_row_keys"] == ["checker-sheet:checker-tab:2"]
    restored = ApiSession.restore(json.loads(json.dumps(snapshot)))
    assert restored.state_snapshot() == snapshot
    assert [event["sequence"] for event in session.events] == [1, 2, 3, 4, 5]
    assert json.loads(session.events[1]["arguments"]["body"])["Amount"] == 42
    restored.call("base64_encode", {"text": "new occurrence"})
    assert restored.events == [
        {
            "sequence": 1,
            "tool": "base64_encode",
            "arguments": {"text": "new occurrence"},
            "output": "bmV3IG9jY3VycmVuY2U=",
        }
    ]
    assert ApiSession.restore(fixture.state).state_snapshot() == original
    session.sealed = True
    with pytest.raises(RuntimeError, match="^automationbench_world_sealed$"):
        session.call("base64_encode", {"text": "closed"})


@pytest.mark.parametrize(
    ("field", "value", "error"),
    [
        ("kind", "official", "operator-derived-business-repair identity"),
        ("request", "", "non-empty id and request"),
        ("source", {}, "explicit author, reference and description"),
    ],
)
def test_fixture_identity_errors(
    tmp_path: Path,
    field: str,
    value: Any,
    error: str,
) -> None:
    payload = driver_input()
    payload[field] = value
    with pytest.raises(ValueError, match=error):
        load_input(tmp_path, payload)


@pytest.mark.parametrize(
    ("path", "value", "error"),
    [
        (("world", "meta", "current_time"), None, "no effective business clock"),
        (("world", "meta", "current_time"), "bad clock", "invalid business clock"),
        (("world", "meta", "allowed_services"), None, "explicit connected services"),
        (("world", "meta", "allowed_services"), ["unknown"], "explicit connected services"),
        (("google_sheets_updated_row_keys",), [False], "invalid row-write tracking"),
    ],
)
def test_state_integrity_errors(
    tmp_path: Path,
    path: tuple[str, ...],
    value: Any,
    error: str,
) -> None:
    payload = driver_input()
    target = payload["state"]
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = value
    with pytest.raises(ValueError, match=error):
        load_input(tmp_path, payload)


def test_incomplete_world_has_explicit_error(tmp_path: Path) -> None:
    payload = driver_input()
    del payload["state"]["world"]["slack"]
    with pytest.raises(ValueError, match="requires a complete world"):
        load_input(tmp_path, payload)


@pytest.mark.asyncio
async def test_development_setup_freezes_inputs_and_isolates_projects(tmp_path: Path) -> None:
    fixture = load_input(tmp_path, driver_input())
    setup = development_environment(fixture, SQUAD)
    request = fixture.request
    # The setup owns its frozen input; later caller edits are not another state authority.
    fixture.state["world"]["salesforce"]["opportunities"][0]["amount"] = 999

    async def occurrence(index: int) -> TaskState:
        state = state_for(fixture)
        config = AdapterConfig.resolve(project_dir=str(tmp_path / f"project-{index}"))
        async with setup(state, config):
            settings = json.loads(
                (Path(config.project_dir) / ".opencorvus/opencorvus.jsonc").read_text()
            )
            assert settings["mcp"]["automationbench"]["transport"] == "streamable-http"
            assert state.metadata["development_execution"] == {"status": "running"}
            assert state.input_text == request
        return state

    states = await asyncio.gather(occurrence(1), occurrence(2))
    for state in states:
        assert state.metadata["development_execution"] == {"status": "closed"}
        result = state.metadata["development_snapshot"]
        assert result["assessment"] == "not_evaluated"
        assert result["kind"] == FIXTURE_KIND
        assert result["source"]["author"] == "test-driver"
        assert result["state"]["world"]["salesforce"]["opportunities"][0]["amount"] == 20
        assert sorted(state.metadata) == [
            "development_events",
            "development_execution",
            "development_fixture",
            "development_snapshot",
        ]


@pytest.mark.asyncio
async def test_development_cancellation_retains_explicit_unassessed_state(tmp_path: Path) -> None:
    fixture = load_input(tmp_path, driver_input())
    setup = development_environment(fixture, SQUAD)
    state = state_for(fixture)
    ready = asyncio.Event()
    endpoint = ""

    async def occurrence() -> None:
        nonlocal endpoint
        config = AdapterConfig.resolve(project_dir=str(tmp_path / "cancelled"))
        async with setup(state, config):
            settings = json.loads(
                (Path(config.project_dir) / ".opencorvus/opencorvus.jsonc").read_text()
            )
            endpoint = settings["mcp"]["automationbench"]["url"]
            ready.set()
            await asyncio.Future()

    pending = asyncio.create_task(occurrence())
    await asyncio.wait_for(ready.wait(), timeout=10)
    pending.cancel()
    with pytest.raises(asyncio.CancelledError):
        await pending
    assert state.metadata["development_execution"] == {
        "status": "error",
        "error_type": "CancelledError",
    }
    assert state.metadata["development_snapshot"]["state"] == fixture.state
    async with httpx.AsyncClient(trust_env=False) as client:
        with pytest.raises(httpx.ConnectError):
            await client.get(endpoint)


@pytest.mark.asyncio
@pytest.mark.parametrize("change", ["request", "identity"])
async def test_development_ingress_requires_registered_input(tmp_path: Path, change: str) -> None:
    fixture = load_input(tmp_path, driver_input())
    if change == "request":
        request = "Different request"
        identifier = fixture.identifier
        error = "input differs from its frozen fixture request"
    else:
        request = fixture.request
        identifier = "different-fixture"
        error = "identity differs from its frozen fixture"
    state = TaskState(
        model="none",  # type: ignore[arg-type]
        sample_id=identifier,
        epoch=1,
        input=request,
        messages=[ChatMessageUser(content=request)],
        metadata={},
    )
    config = AdapterConfig.resolve(project_dir=str(tmp_path / "mismatch"))
    with pytest.raises(ValueError, match=error):
        async with development_environment(fixture, SQUAD)(state, config):
            raise AssertionError("mismatched fixture was admitted")


def test_development_task_freezes_explicit_mission_input(tmp_path: Path) -> None:
    fixture = load_input(tmp_path, driver_input())
    task = opencorvus_business_repair(
        str(tmp_path / "input.json"),
        str(SQUAD),
        str(tmp_path / "projects"),
        "openai/gpt-5.6-luna",
    )
    sample = task.dataset[0]
    assert (sample.id, sample.input) == (fixture.identifier, fixture.request)
    metadata = task.metadata
    assert isinstance(metadata, dict)
    assert metadata["assessment"] == "not_evaluated"
    assert metadata["system"]["adapter"] == "opencorvus-mission-api"
    assert metadata["system"]["model"] == "openai/gpt-5.6-luna"
    assert metadata["system"]["timeout_seconds"] == 300
    assert metadata["development_fixture"] == fixture.identity()
    assert metadata["comparable"] is False


@pytest.mark.parametrize(
    ("option", "value", "error"),
    [
        ("model", "", "requires an explicit provider/model"),
        ("base_url", "https://example.invalid", "requires a co-located loopback"),
        ("project_dir", ".", "input and squad source must remain outside"),
    ],
)
def test_development_task_configuration_errors(
    tmp_path: Path,
    option: str,
    value: str,
    error: str,
) -> None:
    load_input(tmp_path, driver_input())
    options: dict[str, Any] = {
        "fixture": str(tmp_path / "input.json"),
        "squad": str(SQUAD),
        "project_dir": str(tmp_path / "projects"),
        "model": "openai/gpt-5.6-luna",
    }
    options[option] = str(tmp_path) if option == "project_dir" else value
    with pytest.raises(ValueError, match=error):
        opencorvus_business_repair(**options)


@pytest.mark.parametrize("entry", ["official-task", "official-mission", "development-mission"])
def test_real_inspect_records_native_ingress_error_with_registered_plan(
    tmp_path: Path,
    entry: str,
) -> None:
    # An owned, bound but non-listening port produces a real connection refusal.
    # No product response, participant output, model response, or Tool result is fabricated.
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as endpoint:
        endpoint.bind(("127.0.0.1", 0))
        url = f"http://127.0.0.1:{endpoint.getsockname()[1]}"
        config: dict[str, Any] = {
            "squad": str(SQUAD),
            "project_dir": str(tmp_path / "projects"),
            "model": "openai/gpt-5.6-luna",
            "base_url": url,
        }
        if entry == "development-mission":
            load_input(tmp_path, driver_input())
            task = opencorvus_business_repair(fixture=str(tmp_path / "input.json"), **config)
            expected_solver = "business_repair_solver"
            execution_key = "development_execution"
        else:
            task = opencorvus_automationbench(
                manifest=str(
                    PACKAGE / "src/opencorvus_inspect/examples/automationbench-smoke.json"
                ),
                entrypoint="mission" if entry == "official-mission" else "task",
                unspecified_clock="2026-01-15T09:00:00+00:00",
                **config,
            )
            expected_solver = "automationbench_task_solver"
            execution_key = "automationbench_execution"
        logs = eval(
            task,
            model="none",
            log_dir=str(tmp_path / "logs"),
            display="none",
            ctl_server=False,
            limit=1,
            fail_on_error=False,
        )
    assert len(logs) == 1
    log = read_eval_log(logs[0].location)
    # fail_on_error=False completes the log while preserving each sample's real error.
    assert log.status == "success"
    assert log.plan.steps[0].solver == f"opencorvus_inspect/{expected_solver}"
    assert log.plan.steps[0].params["base_url"] == url
    assert len(log.samples or []) == 1
    sample = (log.samples or [])[0]
    assert sample.metadata["opencorvus_observation"]["error_type"] == "OpenCorvusAPIError"
    assert sample.metadata[execution_key] == {"status": "error", "error_type": "OpenCorvusAPIError"}
    if entry.startswith("official"):
        assert log.plan.steps[0].params["unspecified_clock"] == "2026-01-15T09:00:00+00:00"
        projected = sample.metadata["automationbench_current_time"]
        actual = sample.metadata["automationbench_snapshot"]["world"]["meta"]["current_time"]
        assert datetime.fromisoformat(projected.replace("Z", "+00:00")) == (
            datetime.fromisoformat(actual.replace("Z", "+00:00"))
        )
