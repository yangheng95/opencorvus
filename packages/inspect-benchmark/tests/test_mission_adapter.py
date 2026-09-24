from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from opencorvus_inspect.adapter import (
    AdapterConfig,
    MissionResult,
    OpenCorvusClient,
    OpenCorvusMissionTimeout,
    OpenCorvusProtocolError,
)


@pytest.mark.asyncio
async def test_real_mission_endpoint_waits_past_first_child_completion() -> None:
    mission_reads = 0
    activities = 0
    wake: dict[str, Any] = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal mission_reads, activities
        if request.method == "POST" and request.url.path == "/mission/wake":
            wake.update(json.loads(request.content))
            return httpx.Response(200, json={"missionID": "mission-1", "sessionID": "session-1"})
        if request.method == "GET" and request.url.path in {"/mission", "/mission/"}:
            mission_reads += 1
            return httpx.Response(
                200,
                json=[
                    {
                        "missionID": "mission-1",
                        "sessionID": "session-1",
                        "directory": "D:/bench",
                        "boardLane": "review" if mission_reads < 3 else "completed",
                        "interruptible": mission_reads < 3,
                        "tasks": [
                            {
                                "id": "task-1",
                                "source": "mission",
                                "lifecycleStatus": "completed",
                            }
                        ],
                        "completion": (
                            None
                            if mission_reads < 3
                            else {
                                "messageID": "message-accepted",
                                "summary": "Mission accepted result",
                            }
                        ),
                    }
                ],
            )
        if request.method == "GET" and request.url.path == "/mission/mission-1/activity-cursor":
            activities += 1
            return httpx.Response(
                200,
                json={
                    "mission_id": "mission-1",
                    "session_id": "session-1",
                    "activity_sha256": f"activity-{activities}",
                },
            )
        if request.method == "GET" and request.url.path == "/task/task-1":
            return httpx.Response(
                200,
                json={"packageRevisionBinding": {"manifest_id": "builtin/automationbench@1"}},
            )
        raise AssertionError(f"unexpected request: {request.method} {request.url}")

    config = AdapterConfig.resolve(
        base_url="http://opencorvus.test",
        project_dir="D:/bench",
        model="openai/gpt-5.6-luna",
        prompt_profile="automationbench",
        product_pillar="work",
        timeout_seconds=1,
        poll_seconds=0.001,
    )
    async with OpenCorvusClient(config, transport=httpx.MockTransport(handler)) as client:
        result = await client.run_mission(
            request="Complete the original case",
            request_id="trial-mission-1",
            title="Case",
            sample_id="sample-1",
            sample_uuid="uuid-1",
            epoch=1,
        )
    assert isinstance(result, MissionResult)
    assert mission_reads == 3
    assert activities == 2
    assert result.metadata() == {
        "schema_version": 1,
        "entrypoint": "mission",
        "mission_id": "mission-1",
        "mission_session_id": "session-1",
        "task_id": "task-1",
        "request_id": "trial-mission-1",
        "mission_completion_message_id": "message-accepted",
        "package_revision_binding": {"manifest_id": "builtin/automationbench@1"},
    }
    assert wake == {
        "requestID": "trial-mission-1",
        "productPillar": "work",
        "text": (
            "Complete the original case\n\n"
            "Use the held Expert Squad for one initial business Task. Inspect its result against "
            "this original request; if it is incomplete, use the existing Mission acceptance "
            "and same-Task repair flow. Report only the actually accepted outcome."
        ),
        "model": "openai/gpt-5.6-luna",
        "expertSquadIDs": ["automationbench"],
    }


@pytest.mark.asyncio
async def test_mission_completion_with_two_business_tasks_is_a_protocol_error() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            return httpx.Response(200, json={"missionID": "mission-2", "sessionID": "session-2"})
        return httpx.Response(
            200,
            json=[
                {
                    "missionID": "mission-2",
                    "sessionID": "session-2",
                    "directory": "D:/bench",
                    "boardLane": "completed",
                    "interruptible": False,
                    "tasks": [{"id": "task-1"}, {"id": "task-2"}],
                    "completion": {"messageID": "message-2", "summary": "Two Tasks"},
                }
            ],
        )

    config = AdapterConfig.resolve(
        base_url="http://opencorvus.test",
        project_dir="D:/bench",
        model="openai/gpt-5.6-luna",
        prompt_profile="automationbench",
    )
    async with OpenCorvusClient(config, transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(OpenCorvusProtocolError, match="observed 2"):
            await client.run_mission(
                request="Complete the case",
                request_id="trial-mission-2",
                title="Case",
                sample_id="sample-2",
                sample_uuid="uuid-2",
                epoch=1,
            )


@pytest.mark.asyncio
async def test_stalled_mission_retains_the_exact_accepted_identity() -> None:
    abort: dict[str, Any] = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST" and request.url.path == "/mission/wake":
            return httpx.Response(200, json={"missionID": "mission-3", "sessionID": "session-3"})
        if request.method == "POST" and request.url.path == "/mission/mission-3/abort":
            abort.update(json.loads(request.content))
            abort["request_id"] = request.headers["x-opencorvus-request-id"]
            return httpx.Response(200, json={"accepted": True})
        if request.url.path in {"/mission", "/mission/"}:
            return httpx.Response(
                200,
                json=[
                    {
                        "missionID": "mission-3",
                        "sessionID": "session-3",
                        "directory": "D:/bench",
                        "boardLane": "review",
                        "interruptible": False,
                        "tasks": [],
                        "completion": None,
                    }
                ],
            )
        return httpx.Response(
            200,
            json={
                "mission_id": "mission-3",
                "session_id": "session-3",
                "activity_sha256": "constant-activity",
            },
        )

    config = AdapterConfig.resolve(
        base_url="http://opencorvus.test",
        project_dir="D:/bench",
        model="openai/gpt-5.6-luna",
        prompt_profile="automationbench",
        timeout_seconds=0.02,
        poll_seconds=0.002,
    )
    async with OpenCorvusClient(config, transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(OpenCorvusMissionTimeout) as failure:
            await client.run_mission(
                request="Complete the case",
                request_id="trial-mission-3",
                title="Case",
                sample_id="sample-3",
                sample_uuid="uuid-3",
                epoch=1,
            )
        assert client.accepted_task == {
            "mission_id": "mission-3",
            "session_id": "session-3",
            "request_id": "trial-mission-3",
            "cleanup": "mission_abort_accepted",
        }
    assert failure.value.mission_id == "mission-3"
    assert failure.value.last_lane == "review"
    assert abort == {
        "surface": "api",
        "reason": "Inspect Mission observation ended before accepted completion",
        "request_id": "trial-mission-3:observation-cleanup",
    }
