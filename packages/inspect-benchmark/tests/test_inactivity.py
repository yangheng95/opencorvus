from __future__ import annotations

import asyncio
import time

import httpx
import pytest

from opencorvus_inspect.adapter import (
    AdapterConfig,
    OpenCorvusClient,
    OpenCorvusProtocolError,
    OpenCorvusTaskTimeout,
    extract_completion,
)


@pytest.mark.asyncio
@pytest.mark.parametrize("restart", [False, True])
async def test_live_streaming_cursor_extends_the_inactivity_window(restart: bool) -> None:
    polls = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal polls
        if request.url.path.endswith("/status"):
            polls += 1
            await asyncio.sleep(0.02)
            return httpx.Response(
                200,
                json={
                    "lifecycleStatus": "completed" if polls == 10 else "active",
                    "sessionInvocationTopology": {
                        "taskID": "task-progress",
                        "rootSessionID": "session-root",
                    },
                },
            )
        assert request.url.path == "/task/task-progress/conversation/session/session-root"
        previous_poll = polls - 1
        if previous_poll:
            assert request.url.params["after_live_epoch"] == str(
                2 if restart and previous_poll >= 5 else 1
            )
            assert request.url.params["after_live_sequence"] == str(
                previous_poll - 5 if restart and previous_poll >= 5 else previous_poll
            )
        return httpx.Response(
            200,
            json={
                "transcript": [],
                "liveEpoch": 2 if restart and polls >= 5 else 1,
                "lastLiveSequence": polls - 5 if restart and polls >= 5 else polls,
            },
        )

    config = AdapterConfig.resolve(project_dir="D:/bench", timeout_seconds=0.15, poll_seconds=0.01)
    started = time.monotonic()
    async with OpenCorvusClient(config, transport=httpx.MockTransport(handler)) as client:
        status = await client.wait_for_terminal("task-progress")
    assert status["lifecycleStatus"] == "completed"
    assert polls == 10
    assert time.monotonic() - started > config.timeout_seconds


@pytest.mark.asyncio
@pytest.mark.parametrize("root_session_id", [None, "session-root"])
async def test_observer_clock_with_unchanged_facts_reaches_typed_idle_timeout(
    root_session_id: str | None,
) -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        payload = {
            "lifecycleStatus": "active",
            "generatedAt": time.time(),
            "sessionInvocationTopology": {
                "taskID": "task-stalled",
                "rootSessionID": root_session_id,
            },
        }
        if request.url.path.endswith("/conversation/session/session-root"):
            payload = {
                "transcript": [],
                "liveEpoch": 1,
                "lastLiveSequence": 7,
                "generatedAt": time.time(),
            }
        return httpx.Response(200, json=payload)

    config = AdapterConfig.resolve(project_dir="D:/bench", timeout_seconds=0.05, poll_seconds=0.01)
    async with OpenCorvusClient(config, transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(OpenCorvusTaskTimeout) as caught:
            await client.wait_for_terminal("task-stalled")
    assert (caught.value.task_id, caught.value.last_status) == ("task-stalled", "active")


@pytest.mark.parametrize("value", [float("nan"), float("inf"), 0, -1])
def test_invalid_timeout_has_explicit_configuration_error(value: float) -> None:
    with pytest.raises(ValueError, match="finite and greater than zero"):
        AdapterConfig.resolve(project_dir="D:/bench", timeout_seconds=value)


def test_failed_task_has_empty_accepted_completion_contract() -> None:
    result = extract_completion(
        {"status": "failed", "error": "business criterion unresolved"},
        None,
    )
    assert result == ("", None)


@pytest.mark.parametrize("poll", [0.05, 0.1])
def test_poll_window_conflict_is_an_explicit_configuration_error(poll: float) -> None:
    with pytest.raises(ValueError, match="poll_seconds must be less than timeout_seconds"):
        AdapterConfig.resolve(project_dir="D:/bench", timeout_seconds=0.05, poll_seconds=poll)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "cursor",
    [
        {},
        {"liveEpoch": 0, "lastLiveSequence": 1},
        {"liveEpoch": 1, "lastLiveSequence": -1},
        {"liveEpoch": True, "lastLiveSequence": 0},
        {"liveEpoch": 1, "lastLiveSequence": "1"},
    ],
)
async def test_malformed_live_cursor_is_an_explicit_protocol_error(cursor: dict) -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=cursor)

    config = AdapterConfig.resolve(project_dir="D:/bench")
    async with OpenCorvusClient(config, transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(OpenCorvusProtocolError, match="Task live cursor requires"):
            await client.task_live_cursor("task-thinking", "session-root", None)


@pytest.mark.asyncio
async def test_terminal_boundary_cursor_reset_is_a_valid_observation() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"liveEpoch": 1, "lastLiveSequence": 0})

    config = AdapterConfig.resolve(project_dir="D:/bench")
    async with OpenCorvusClient(config, transport=httpx.MockTransport(handler)) as client:
        assert await client.task_live_cursor("task-thinking", "session-root", (1, 5)) == (1, 0)


def test_raw_completion_preserves_long_summary_and_validates_exact_identity() -> None:
    task = {
        "status": "completed",
        "completionDecision": {
            "orchestratorSessionID": "session-1",
            "orchestratorMessageID": "message-1",
            "toolPartID": "part-1",
            "toolCallID": "call-1",
        },
    }
    summary = "complete business evidence " * 2000
    part = {
        "id": "part-1",
        "type": "tool",
        "messageID": "message-1",
        "sessionID": "session-1",
        "callID": "call-1",
        "state": {"status": "completed", "input": {"summary": summary}},
    }
    assert extract_completion(task, part) == (summary.strip(), "message-1")
    with pytest.raises(OpenCorvusProtocolError, match="Tool identity disagrees"):
        extract_completion(task, {**part, "sessionID": "other-session"})
