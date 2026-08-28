from __future__ import annotations

from pathlib import Path
from typing import Any, cast

import pytest
from inspect_ai.model import ChatMessageUser
from inspect_ai.scorer import Target
from inspect_ai.solver import TaskState

from opencorvus_inspect.adapter import AdapterConfig, TaskResult
from opencorvus_inspect.solver import opencorvus_task


@pytest.mark.asyncio
async def test_solver_projects_terminal_result_into_inspect_state(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    class Client:
        def __init__(self, config: object) -> None:
            captured.setdefault("configs", []).append(config)

        async def __aenter__(self) -> Client:
            return self

        async def __aexit__(self, *_error: object) -> None:
            return None

        async def run_task(self, **kwargs: Any) -> TaskResult:
            captured["request"] = kwargs
            return TaskResult(
                task_id="task-1",
                project_id="project-1",
                directory="D:/bench",
                request_id=kwargs["request_id"],
                lifecycle_status="completed",
                terminal_reason="completed",
                error=None,
                completion="final accepted answer",
                completion_message_id="message-1",
                completion_decision_artifact={"artifact_id": "artifact-1"},
                accepted_delivery_slice_revision_ids=("goal-1",),
                package_revision_binding={"manifest_id": "builtin/base@1"},
            )

    monkeypatch.setattr("opencorvus_inspect.solver.OpenCorvusClient", Client)
    state = TaskState(
        model="none",  # type: ignore[arg-type]
        sample_id="sample-1",
        epoch=2,
        input="solve this",
        messages=[ChatMessageUser(content="solve this")],
        target=Target("final accepted answer"),
        metadata={"opencorvus_title": "Custom title"},
        sample_uuid="sample-uuid",
    )
    solve = opencorvus_task(
        base_url="http://localhost:7878",
        project_dir="D:/bench",
        project_isolation="sample_epoch",
    )
    result = await solve(state, None)  # type: ignore[arg-type]

    assert result is state
    assert captured["request"] == {
        "request": "solve this",
        "request_id": "inspect:sample-uuid",
        "title": "Custom title",
        "sample_id": "sample-1",
        "sample_uuid": "sample-uuid",
        "epoch": 2,
    }
    assert state.completed is True
    assert state.output.model == "opencorvus/task"
    assert state.output.completion == "final accepted answer"
    assert state.messages[-1].text == "final accepted answer"
    assert state.metadata["opencorvus_result"]["task_id"] == "task-1"
    sample_config = cast(list[AdapterConfig], captured["configs"])[0]
    assert sample_config.init_git is True
    assert Path(sample_config.project_dir).name == "attempt-1"
    assert Path(sample_config.project_dir).parent.name == "epoch-2"
    assert Path(sample_config.project_dir).parent.parent.name.startswith("sample-")
    assert state.metadata["opencorvus_project"] == {
        "directory_sha256": state.metadata["opencorvus_project"]["directory_sha256"],
        "isolation": "sample_epoch",
        "init_git": True,
        "attempt": 1,
    }

    await solve(state, None)  # type: ignore[arg-type]
    retry_config = cast(list[AdapterConfig], captured["configs"])[1]
    assert Path(retry_config.project_dir).name == "attempt-2"
    assert state.metadata["opencorvus_project"]["attempt"] == 2
