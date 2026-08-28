from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from opencorvus_inspect.adapter import (
    AdapterConfig,
    OpenCorvusAPIError,
    OpenCorvusClient,
    OpenCorvusTaskTimeout,
)


@pytest.mark.asyncio
async def test_public_task_lifecycle_returns_exact_completion_decision_message() -> None:
    status_calls = 0
    seen_create: dict[str, object] = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal status_calls
        if request.method == "POST" and request.url.path == "/task":
            seen_create["query"] = dict(request.url.params)
            seen_create["body"] = json.loads(request.content)
            seen_create["request_id"] = request.headers["x-opencorvus-request-id"]
            seen_create["read_timeout"] = request.extensions["timeout"]["read"]
            return httpx.Response(
                202,
                headers={"x-opencorvus-request-id": "server-request"},
                json={"task_id": "task-1", "project_id": "project-1", "directory": "D:/bench"},
            )
        if request.method == "GET" and request.url.path == "/task/task-1/status":
            status_calls += 1
            lifecycle = "active" if status_calls == 1 else "completed"
            return httpx.Response(200, json={"lifecycleStatus": lifecycle})
        if request.method == "GET" and request.url.path == "/task/task-1":
            return httpx.Response(
                200,
                json={
                    "id": "task-1",
                    "sessionID": "session-root",
                    "status": "completed",
                    "terminalReason": "completed",
                    "completionDecision": {
                        "orchestratorMessageID": "message-accepted",
                        "artifactLocator": {
                            "source": "engine_artifact",
                            "artifact_id": "artifact-1",
                            "catalog_revision": 1,
                            "expected_sha256": "a" * 64,
                        },
                        "acceptedDeliverySliceRevisionIDs": ["goal-1"],
                    },
                    "packageRevisionBinding": {
                        "manifest_id": "builtin/base@1",
                        "manifest_digest": "b" * 64,
                    },
                },
            )
        if request.method == "GET" and request.url.path == "/task/task-1/conversation":
            return httpx.Response(
                200,
                json={
                    "transcript": [
                        {
                            "info": {
                                "id": "message-accepted",
                                "sessionID": "session-root",
                                "role": "assistant",
                                "time": {"created": 10},
                            },
                            "parts": [{"type": "text", "text": "accepted answer"}],
                        },
                        {
                            "info": {
                                "id": "message-later",
                                "sessionID": "session-agent",
                                "role": "assistant",
                                "time": {"created": 11},
                            },
                            "parts": [{"type": "text", "text": "later unrelated text"}],
                        },
                    ]
                },
            )
        raise AssertionError(f"unexpected request: {request.method} {request.url}")

    config = AdapterConfig.resolve(
        base_url="http://opencorvus.test",
        project_dir="D:/bench",
        model="openai/model-a",
        prompt_profile="base",
        poll_seconds=0.001,
        timeout_seconds=1,
    )
    async with OpenCorvusClient(config, transport=httpx.MockTransport(handler)) as client:
        result = await client.run_task(
            request="solve this",
            request_id="inspect:sample-uuid",
            title="Inspect sample sample-1",
            sample_id="sample-1",
            sample_uuid="sample-uuid",
            epoch=1,
        )

    read_timeout = seen_create.pop("read_timeout")
    assert isinstance(read_timeout, float)
    assert 0 < read_timeout <= config.timeout_seconds
    assert read_timeout == pytest.approx(config.timeout_seconds, abs=0.1)
    assert seen_create == {
        "query": {"directory": "D:/bench", "init-git": "false"},
        "body": {
            "request": "solve this",
            "requestID": "inspect:sample-uuid",
            "source": "inspect-ai",
            "productPillar": "code",
            "title": "Inspect sample sample-1",
            "metadata": {
                "inspect": {
                    "sample_id": "sample-1",
                    "sample_uuid": "sample-uuid",
                    "epoch": 1,
                }
            },
            "model": "openai/model-a",
            "promptProfile": "base",
        },
        "request_id": "inspect:sample-uuid",
    }
    assert status_calls == 2
    assert result.lifecycle_status == "completed"
    assert result.completion == "accepted answer"
    assert result.completion_message_id == "message-accepted"
    assert result.accepted_delivery_slice_revision_ids == ("goal-1",)
    assert result.metadata()["completion_decision_artifact"] == {
        "source": "engine_artifact",
        "artifact_id": "artifact-1",
        "catalog_revision": 1,
        "expected_sha256": "a" * 64,
    }


@pytest.mark.asyncio
async def test_task_creation_deadline_returns_typed_api_observation_failure() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == "/task"
        await asyncio.sleep(1)
        return httpx.Response(
            202,
            json={
                "task_id": "task-too-late",
                "project_id": "project-too-late",
                "directory": "D:/bench",
            },
        )

    config = AdapterConfig.resolve(
        base_url="http://opencorvus.test",
        project_dir="D:/bench",
        timeout_seconds=0.01,
    )
    async with OpenCorvusClient(config, transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(OpenCorvusAPIError) as raised:
            await client.run_task(
                request="create within the observation budget",
                request_id="inspect:create-timeout",
                title="Inspect creation timeout sample",
                sample_id="create-timeout",
                sample_uuid="create-timeout",
                epoch=1,
            )

    assert raised.value.method == "POST"
    assert raised.value.path == "/task"
    assert raised.value.status_code is None
    assert raised.value.request_id == "inspect:create-timeout"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("hanging_stage", "expected_last_status"),
    [("status", "unobserved"), ("terminal_projection", "completed")],
)
async def test_task_observation_deadline_returns_typed_timeout(
    hanging_stage: str, expected_last_status: str
) -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST" and request.url.path == "/task":
            return httpx.Response(
                202,
                json={
                    "task_id": "task-timeout",
                    "project_id": "project-timeout",
                    "directory": "D:/bench",
                },
            )
        if request.method == "GET" and request.url.path == "/task/task-timeout/status":
            if hanging_stage == "status":
                await asyncio.sleep(1)
            return httpx.Response(200, json={"lifecycleStatus": "completed"})
        if request.method == "GET" and request.url.path in {
            "/task/task-timeout",
            "/task/task-timeout/conversation",
        }:
            await asyncio.sleep(1)
            raise AssertionError("deadline should cancel the terminal projection request")
        raise AssertionError(f"unexpected request: {request.method} {request.url}")

    config = AdapterConfig.resolve(
        base_url="http://opencorvus.test",
        project_dir="D:/bench",
        poll_seconds=0.001,
        timeout_seconds=0.01,
    )
    async with OpenCorvusClient(config, transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(OpenCorvusTaskTimeout) as raised:
            await client.run_task(
                request="wait forever",
                request_id="inspect:timeout-sample",
                title="Inspect timeout sample",
                sample_id="timeout-sample",
                sample_uuid="timeout-sample",
                epoch=1,
            )

    assert raised.value.task_id == "task-timeout"
    assert raised.value.timeout_seconds == 0.01
    assert raised.value.last_status == expected_last_status
