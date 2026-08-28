from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import pytest
from inspect_ai import eval

from opencorvus_inspect.adapter import TaskResult
from opencorvus_inspect.benchmark.apodex import BROWSECOMP
from opencorvus_inspect.benchmark.definition import JudgePolicy
from opencorvus_inspect.benchmark.judge import JudgeCompletion, JudgeUnavailableError
from opencorvus_inspect.benchmark.task import opencorvus_suite


class DeterministicClient:
    def __init__(self, _config: object) -> None:
        pass

    async def __aenter__(self) -> DeterministicClient:
        return self

    async def __aexit__(self, *_error: object) -> None:
        return None

    async def run_task(self, **kwargs: Any) -> TaskResult:
        return TaskResult(
            task_id="task-suite-eval",
            project_id="project-suite-eval",
            directory="D:/bench",
            request_id=kwargs["request_id"],
            lifecycle_status="completed",
            terminal_reason="completed",
            error=None,
            completion="The named item",
            completion_message_id="message-suite-eval",
            completion_decision_artifact={"artifact_id": "artifact-suite-eval"},
            accepted_delivery_slice_revision_ids=("goal-suite-eval",),
            package_revision_binding={"manifest_id": "builtin/base@1"},
        )


def test_inspect_eval_runs_registered_suite_and_both_scorers(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    async def complete(_self: object, prompt: str, policy: JudgePolicy) -> JudgeCompletion:
        assert "The named item" in prompt
        assert policy == BROWSECOMP.judge
        return JudgeCompletion(
            text="extracted_final_answer: The named item\ncorrect: yes",
            model=policy.model,
        )

    monkeypatch.setattr("opencorvus_inspect.solver.OpenCorvusClient", DeterministicClient)
    monkeypatch.setattr(
        "opencorvus_inspect.benchmark.judge.InspectModelJudge.complete",
        complete,
    )
    dataset = tmp_path / "browsecomp.jsonl"
    dataset.write_text(
        json.dumps(
            {
                "task_id": "browse-eval-1",
                "task_question": "Identify the named item.",
                "ground_truth": "The named item",
                "category": "Art",
            }
        )
        + "\n",
        encoding="utf-8",
    )

    logs = eval(
        opencorvus_suite(
            BROWSECOMP.id,
            str(dataset),
            base_url="http://localhost:7878",
            project_dir="D:/bench",
        ),
        model=None,
        log_dir=str(tmp_path / "logs"),
    )

    assert len(logs) == 1
    assert logs[0].status == "success"
    assert logs[0].samples is not None and len(logs[0].samples) == 1
    sample = logs[0].samples[0]
    assert sample.scores is not None
    assert sample.scores["task_completed"].value == "C"
    assert sample.scores["benchmark_quality"].value == "C"
    assert sample.scores["benchmark_quality"].metadata is not None
    assert sample.scores["benchmark_quality"].metadata["benchmark_id"] == BROWSECOMP.id


def test_inspect_eval_preserves_unavailable_judge_as_unscored(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    async def unavailable(
        _self: object,
        _prompt: str,
        _policy: JudgePolicy,
    ) -> JudgeCompletion:
        raise JudgeUnavailableError("judge transport unavailable")

    monkeypatch.setattr("opencorvus_inspect.solver.OpenCorvusClient", DeterministicClient)
    monkeypatch.setattr(
        "opencorvus_inspect.benchmark.judge.InspectModelJudge.complete",
        unavailable,
    )
    dataset = tmp_path / "browsecomp.jsonl"
    dataset.write_text(
        '{"task_id":"browse-eval-1","task_question":"Identify it.",'
        '"ground_truth":"The named item"}\n',
        encoding="utf-8",
    )

    logs = eval(
        opencorvus_suite(
            BROWSECOMP.id,
            str(dataset),
            project_dir="D:/bench",
        ),
        model=None,
        log_dir=str(tmp_path / "unavailable-logs"),
    )

    assert len(logs) == 1
    assert logs[0].status == "success"
    assert logs[0].samples is not None and len(logs[0].samples) == 1
    assert logs[0].samples[0].scores is not None
    score = logs[0].samples[0].scores["benchmark_quality"]
    assert isinstance(score.value, float) and math.isnan(score.value)
    assert score.metadata is not None
    assert score.metadata["scoring_status"] == "unavailable"
    assert score.metadata["reason_code"] == "judge_unavailable"
    assert logs[0].results is not None
    quality = next(
        result for result in logs[0].results.scores if result.name == "benchmark_quality"
    )
    assert quality.scored_samples == 0
    assert quality.unscored_samples == 1
    assert math.isnan(quality.metrics["accuracy"].value)
