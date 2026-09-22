from __future__ import annotations

import asyncio
import time

import httpx
import pytest

from opencorvus_inspect.adapter import (
    AdapterConfig,
    OpenCorvusClient,
    OpenCorvusTaskTimeout,
    extract_completion,
)


@pytest.mark.asyncio
async def test_streaming_progress_extends_the_inactivity_window() -> None:
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
                },
            )
        return httpx.Response(
            200,
            json={
                "transcript": [{"parts": [{"type": "text", "text": "token " * polls}]}],
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
async def test_observer_clock_with_unchanged_facts_reaches_typed_idle_timeout() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        payload = {"lifecycleStatus": "active", "generatedAt": time.time()}
        if request.url.path.endswith("/conversation"):
            payload = {"transcript": [], "generatedAt": time.time()}
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
        {
            "transcript": [
                {
                    "info": {"role": "assistant", "id": "worker-claim"},
                    "parts": [{"type": "text", "text": "I think it is complete"}],
                }
            ]
        },
    )
    assert result == ("", None)
