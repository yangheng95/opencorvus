"""Inspect scorers for durable OpenCorvus Task outcomes."""

from __future__ import annotations

from typing import Any, cast

from inspect_ai.scorer import (
    CORRECT,
    INCORRECT,
    Score,
    Scorer,
    Target,
    accuracy,
    scorer,
    stderr,
)
from inspect_ai.solver import TaskState


@scorer(metrics=[accuracy(), stderr()])
def task_completed() -> Scorer:
    """Score the positive durable Task completion contract."""

    async def score(state: TaskState, _target: Target) -> Score:
        raw = state.metadata.get("opencorvus_result")
        result: dict[str, Any] = raw if isinstance(raw, dict) else {}
        lifecycle = result.get("lifecycle_status")
        task_id = result.get("task_id", "unknown")
        message_id = result.get("completion_message_id")
        artifact = result.get("completion_decision_artifact")
        completed = lifecycle == "completed" and bool(message_id) and isinstance(artifact, dict)
        explanation = (
            f"OpenCorvus Task {task_id} completed with Completion Decision Message {message_id}."
            if completed
            else f"OpenCorvus Task {task_id} ended with lifecycle {lifecycle}."
        )
        return Score(
            value=CORRECT if completed else INCORRECT,
            answer=state.output.completion,
            explanation=explanation,
            metadata={
                "task_id": task_id,
                "lifecycle_status": lifecycle,
                "completion_message_id": message_id,
            },
        )

    return cast(Scorer, score)
