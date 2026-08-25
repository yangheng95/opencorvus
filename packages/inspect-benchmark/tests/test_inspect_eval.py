from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from inspect_ai import eval

from opencorvus_inspect.adapter import TaskResult
from opencorvus_inspect.task import opencorvus_benchmark


def test_inspect_eval_records_task_score_and_trace_metadata(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    class Client:
        def __init__(self, _config: object) -> None:
            pass

        async def __aenter__(self) -> Client:
            return self

        async def __aexit__(self, *_error: object) -> None:
            return None

        async def run_task(self, **kwargs: Any) -> TaskResult:
            return TaskResult(
                task_id="task-inspect-eval",
                project_id="project-inspect-eval",
                directory="D:/bench",
                request_id=kwargs["request_id"],
                lifecycle_status="completed",
                terminal_reason="completed",
                error=None,
                completion="OPENCORVUS_INSPECT_OK",
                completion_message_id="message-inspect-eval",
                completion_decision_artifact={"artifact_id": "artifact-inspect-eval"},
                accepted_delivery_slice_revision_ids=("goal-inspect-eval",),
                package_revision_binding={"manifest_id": "builtin/base@1"},
            )

    monkeypatch.setattr("opencorvus_inspect.solver.OpenCorvusClient", Client)
    dataset = tmp_path / "cases.jsonl"
    dataset.write_text(
        json.dumps(
            {
                "id": "inspect-eval-1",
                "input": "Return OPENCORVUS_INSPECT_OK",
                "target": "OPENCORVUS_INSPECT_OK",
            }
        )
        + "\n",
        encoding="utf-8",
    )

    logs = eval(
        opencorvus_benchmark(
            str(dataset),
            scorer="includes",
            base_url="http://localhost:7878",
            project_dir="D:/bench",
        ),
        model=None,
        log_dir=str(tmp_path / "logs"),
    )

    assert len(logs) == 1
    log = logs[0]
    assert log.status == "success"
    assert log.samples is not None and len(log.samples) == 1
    sample = log.samples[0]
    assert sample.output.completion == "OPENCORVUS_INSPECT_OK"
    assert sample.metadata["opencorvus_result"]["task_id"] == "task-inspect-eval"
    assert sample.scores is not None
    assert sample.scores["task_completed"].value == "C"
    assert sample.scores["includes"].value == "C"
