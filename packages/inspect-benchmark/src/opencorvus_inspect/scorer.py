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


@scorer(metrics=[accuracy(), stderr()])
def mission_completed() -> Scorer:
    """Score the actual Mission completion fact, separate from the official rubric."""

    async def score(state: TaskState, _target: Target) -> Score:
        raw = state.metadata.get("opencorvus_result")
        result: dict[str, Any] = raw if isinstance(raw, dict) else {}
        mission_id = result.get("mission_id", "unknown")
        message_id = result.get("mission_completion_message_id")
        completed = isinstance(message_id, str) and bool(message_id)
        return Score(
            value=CORRECT if completed else INCORRECT,
            answer=state.output.completion,
            explanation=(
                f"OpenCorvus Mission {mission_id} completed with Message {message_id}."
                if completed
                else f"OpenCorvus Mission {mission_id} has no accepted completion fact."
            ),
            metadata={"mission_id": mission_id, "mission_completion_message_id": message_id},
        )

    return cast(Scorer, score)
