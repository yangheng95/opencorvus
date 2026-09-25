from __future__ import annotations

import asyncio
import copy
import json
import shutil
from dataclasses import replace
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import httpx
import pytest
from inspect_ai import eval
from inspect_ai.model import ChatMessageUser
from inspect_ai.scorer import Target
from inspect_ai.solver import TaskState

from opencorvus_inspect.adapter import AdapterConfig
from opencorvus_inspect.automationbench.check import automationbench_local_check
from opencorvus_inspect.automationbench.mcp import world_server
from opencorvus_inspect.automationbench.task import (
    automationbench_score,
    opencorvus_automationbench,
    sample_environment,
)
from opencorvus_inspect.automationbench.world import (
    BENCHMARK,
    CASE_CONTEXT_POLICY,
    OfficialWorld,
    load_cases,
    official_case,
    rescore,
)

PACKAGE = Path(__file__).parents[1]
MANIFEST = PACKAGE / "src/opencorvus_inspect/examples/automationbench-smoke.json"
SQUAD = PACKAGE.parents[1] / "expert-squads/builtin/automationbench"

pytest.importorskip("automationbench", reason="AutomationBench checks require the automation extra")


def state_for(case: Any) -> TaskState:
    return TaskState(
        model="none",  # type: ignore[arg-type]
        sample_id=case.task,
        epoch=1,
        input=case.request,
        messages=[ChatMessageUser(content=case.request)],
        metadata={"automationbench_case": case.task, "automationbench_example_id": case.example_id},
    )


def test_manifest_binds_official_case_membership_order_and_original_request() -> None:
    cases = load_cases(MANIFEST)
    assert [(case.task, case.example_id) for case in cases] == [
        ("finance.wave_freelance_invoice", 4014),
        ("sales.multi_hop_lookup", 501),
        ("marketing.social_engagement_response", 1003),
    ]
    assert cases[0].prompt[1]["content"] in cases[0].request
    task = opencorvus_automationbench(
        str(MANIFEST),
        str(SQUAD),
        "D:/bench/isolated-inspect",
        "provider/model",
    )
    assert task.metadata["system"]["prompt_profile"] == "automationbench"
    assert task.dataset[0].input == cases[0].request
    assert task.metadata["case_context_policy"] == CASE_CONTEXT_POLICY
    assert task.metadata["cases"][0] == {
        "domain": cases[0].domain,
        "task": cases[0].task,
        "example_id": cases[0].example_id,
    }
    assert task.dataset[0].metadata["automationbench_current_time"] == cases[0].current_time


def test_request_carries_exact_simulated_clock_and_original_prompt() -> None:
    case = official_case("sales.unreliable_label_account_review", 1203)
    assert case.current_time == "2026-02-26T10:00:00"
    context, original = case.request.split("\n\n", 1)
    assert context.splitlines()[1] == "Simulated business current_time: 2026-02-26T10:00:00"
    assert original == "\n\n".join(
        f"{part['role'].upper()}:\n{part['content']}" for part in case.prompt
    )
    assert OfficialWorld(case).world.meta.current_time.isoformat() == case.current_time


def test_distinct_samples_project_their_own_clock() -> None:
    left = official_case("sales.unreliable_label_account_review", 1203)
    right_info = copy.deepcopy(left.info)
    right_info["initial_state"]["meta"]["current_time"] = "2026-04-01T15:30:00+08:00"
    right = replace(left, info=right_info)
    assert [case.request.splitlines()[1] for case in (left, right)] == [
        "Simulated business current_time: 2026-02-26T10:00:00",
        "Simulated business current_time: 2026-04-01T15:30:00+08:00",
    ]


def test_optional_world_clock_is_explicitly_unspecified() -> None:
    for case in (
        official_case("operations.sheets_asana_approved_request", 1223),
        official_case("sales.create_new_opportunity", 9),
    ):
        assert case.current_time is None
        assert case.request.splitlines()[1] == (
            "Simulated business current_time: unspecified in the official sample."
        )


@pytest.mark.parametrize("value", ["", "yesterday", 42])
def test_invalid_world_clock_has_an_explicit_input_error(value: Any) -> None:
    case = load_cases(MANIFEST)[0]
    info = copy.deepcopy(case.info)
    info["initial_state"]["meta"]["current_time"] = value
    with pytest.raises(ValueError, match="ISO 8601"):
        _ = replace(case, info=info).request


def test_duplicate_case_has_explicit_manifest_error(tmp_path: Path) -> None:
    payload = json.loads(MANIFEST.read_text(encoding="utf-8"))
    payload["cases"] = [payload["cases"][0], payload["cases"][0]]
    manifest = tmp_path / "duplicate.json"
    manifest.write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(ValueError, match="duplicate manifest case"):
        load_cases(manifest)


def test_real_inspect_mcp_official_rubric_and_snapshot_contracts(tmp_path: Path) -> None:
    logs = eval(
        automationbench_local_check(),
        model="none",
        log_dir=str(tmp_path / "logs"),
        display="none",
        max_samples=3,
        ctl_server=False,
    )
    assert logs[0].status == "success"
    samples = {sample.id: sample for sample in logs[0].samples}
    assert len(samples) == 3
    for name, expected in {
        "empty": (0.0, 0.0),
        "partial": (0.0, 0.5),
        "complete": (1.0, 1.0),
    }.items():
        sample = samples[name]
        assert sample.metadata["execution_mode"] == "local-checker-validation"
        score = sample.metadata["automationbench_score"]
        assert (score["strict"], score["partial"]) == expected
        assert sample.scores["checker_contract"].value == "C"
        assert sample.metadata["automationbench_snapshot"]["benchmark"] == BENCHMARK


@pytest.mark.asyncio
async def test_real_mcp_catalog_exposes_official_service_and_operation_metadata() -> None:
    from mcp import ClientSession
    from mcp.client.streamable_http import streamable_http_client

    world = OfficialWorld(load_cases(MANIFEST)[0])
    async with world_server(world) as url:
        async with (
            httpx.AsyncClient(trust_env=False) as http_client,
            streamable_http_client(url, http_client=http_client) as (read, write, _session_id),
            ClientSession(read, write) as client,
        ):
            await client.initialize()
            services_result = await client.call_tool("api_catalog", {})
            services = json.loads(services_result.content[0].text)["services"]
            assert next(entry for entry in services if entry["name"] == "gmail")[
                "endpoint_count"
            ] > 0
            gmail_result = await client.call_tool("api_catalog", {"service": "gmail"})
            gmail = json.loads(gmail_result.content[0].text)
            assert gmail["service"] == "gmail"
            assert next(
                operation["method"]
                for operation in gmail["operations"]
                if operation["id"] == "gmail.users.messages.list"
            ) == "GET"


@pytest.mark.asyncio
async def test_sample_setup_settles_separate_worlds_and_releases_owned_endpoints(
    tmp_path: Path,
) -> None:
    cases = load_cases(MANIFEST)[:1]
    setup = sample_environment(cases, SQUAD)

    async def occurrence(index: int) -> tuple[str, TaskState]:
        state = state_for(cases[0])
        config = AdapterConfig.resolve(project_dir=str(tmp_path / str(index)))
        async with setup(state, config):
            settings = json.loads(
                (Path(config.project_dir) / ".opencorvus/opencorvus.jsonc").read_text()
            )
            url = settings["mcp"]["automationbench"]["url"]
            state.metadata["opencorvus_result"] = {"lifecycle_status": "failed"}
        return url, state

    results = await asyncio.gather(occurrence(1), occurrence(2))
    assert len({url for url, _ in results}) == 2
    for url, state in results:
        assert state.metadata["automationbench_execution"] == {"status": "scored"}
        assert state.metadata["automationbench_score"]["partial"] == 0.0
        async with httpx.AsyncClient(trust_env=False) as client:
            with pytest.raises(httpx.ConnectError):
                await client.get(url)


@pytest.mark.asyncio
async def test_mission_world_seals_after_accepted_or_blocked_business_outcome(
    tmp_path: Path,
) -> None:
    case = load_cases(MANIFEST)[0]
    config = AdapterConfig.resolve(project_dir=str(tmp_path / "mission"))
    setup = sample_environment([case], SQUAD, entrypoint="mission")
    state = state_for(case)
    async with setup(state, config):
        state.metadata["opencorvus_result"] = {
            "entrypoint": "mission",
            "task_id": "task-first-completed",
            "lifecycle_status": "completed",
        }
    assert state.metadata["automationbench_execution"] == {"status": "unscored"}

    accepted = state_for(case)
    accepted_config = AdapterConfig.resolve(project_dir=str(tmp_path / "accepted"))
    async with setup(accepted, accepted_config):
        accepted.metadata["opencorvus_result"] = {
            "entrypoint": "mission",
            "mission_id": "mission-accepted",
            "mission_completion_message_id": "message-accepted",
        }
    assert accepted.metadata["automationbench_execution"] == {"status": "scored"}
    assert accepted.metadata["automationbench_score"]["strict"] == 0.0

    blocked = state_for(case)
    blocked_config = AdapterConfig.resolve(project_dir=str(tmp_path / "blocked"))
    async with setup(blocked, blocked_config):
        blocked.metadata["opencorvus_result"] = {
            "entrypoint": "mission",
            "mission_id": "mission-blocked",
            "mission_outcome_kind": "blocked",
            "mission_completion_message_id": None,
            "mission_blockage_message_id": "message-blocked",
        }
    assert blocked.metadata["automationbench_execution"] == {"status": "scored"}
    assert blocked.metadata["automationbench_score"]["strict"] == 0.0


@pytest.mark.asyncio
async def test_setup_error_retains_unscored_evidence_and_releases_endpoint(tmp_path: Path) -> None:
    case = load_cases(MANIFEST)[0]
    state = state_for(case)
    config = AdapterConfig.resolve(project_dir=str(tmp_path / "failed"))
    with pytest.raises(RuntimeError, match="injected observation error"):
        async with sample_environment([case], SQUAD)(state, config):
            settings = json.loads(
                (Path(config.project_dir) / ".opencorvus/opencorvus.jsonc").read_text()
            )
            endpoint = urlsplit(settings["mcp"]["automationbench"]["url"])
            raise RuntimeError("injected observation error")
    assert state.metadata["automationbench_execution"] == {
        "status": "error",
        "error_type": "RuntimeError",
    }
    result = await automationbench_score()(state, Target(""))
    assert result.explanation == "AutomationBench execution is error"
    with pytest.raises(OSError):
        await asyncio.open_connection(endpoint.hostname, endpoint.port)


def test_sheet_write_tracking_survives_official_snapshot_restoration() -> None:
    case = load_cases(MANIFEST)[0]
    world = OfficialWorld(case)
    result = json.loads(
        world.call(
            "api_fetch",
            {
                "method": "PUT",
                "url": "https://sheets.googleapis.com/v4/spreadsheets/ss_projects/values/January%202026!C2",
                "params": json.dumps({"valueInputOption": "RAW"}),
                "body": json.dumps({"values": [["33"]]}),
            },
        )
    )
    assert result["updatedCells"] == 1
    snapshot = world.snapshot()
    assert snapshot["google_sheets_updated_row_keys"] == ["ss_projects:ws_jan_proj:2"]
    assert rescore(case, snapshot, len(world.events)) == world.seal()


def test_disabled_official_strict_policy_is_an_explicit_scoring_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from automationbench.rubric import registry

    case = load_cases(MANIFEST)[0]
    world = OfficialWorld(case)
    monkeypatch.setattr(registry, "STRICT_MODE", False)
    with pytest.raises(ValueError, match="requires AUTOMATIONBENCH_STRICT_ASSERTIONS=1"):
        load_cases(MANIFEST)
    with pytest.raises(ValueError, match="requires AUTOMATIONBENCH_STRICT_ASSERTIONS=1"):
        world.seal()


@pytest.mark.asyncio
async def test_solver_retains_exact_squad_input_when_operator_edits_source(tmp_path: Path) -> None:
    source = tmp_path / "source"
    shutil.copytree(SQUAD, source)
    case = load_cases(MANIFEST)[0]
    original = (source / "agents/automationbench-executor/system.md").read_bytes()
    setup = sample_environment([case], source)
    (source / "agents/automationbench-executor/system.md").write_text(
        "changed after solver construction"
    )
    config = AdapterConfig.resolve(project_dir=str(tmp_path / "sample"))
    state = state_for(case)
    async with setup(state, config):
        installed = Path(config.project_dir) / ".opencorvus/expert-squads/builtin/automationbench"
        assert (installed / "agents/automationbench-executor/system.md").read_bytes() == original


@pytest.mark.asyncio
async def test_cancellation_closes_owned_mcp_and_preserves_sample_evidence(tmp_path: Path) -> None:
    case = load_cases(MANIFEST)[0]
    state = state_for(case)
    config = AdapterConfig.resolve(project_dir=str(tmp_path / "cancelled"))
    ready = asyncio.Event()
    endpoint = ""

    async def occurrence() -> None:
        nonlocal endpoint
        async with sample_environment([case], SQUAD)(state, config):
            settings = json.loads(
                (Path(config.project_dir) / ".opencorvus/opencorvus.jsonc").read_text()
            )
            endpoint = settings["mcp"]["automationbench"]["url"]
            ready.set()
            await asyncio.Future()

    operation = asyncio.create_task(occurrence())
    await asyncio.wait_for(ready.wait(), timeout=10)
    operation.cancel()
    with pytest.raises(asyncio.CancelledError):
        await operation
    assert state.metadata["automationbench_execution"] == {
        "status": "error",
        "error_type": "CancelledError",
    }
    assert state.metadata["automationbench_snapshot"]["task"] == case.task
    async with httpx.AsyncClient(trust_env=False) as client:
        with pytest.raises(httpx.ConnectError):
            await client.get(endpoint)
