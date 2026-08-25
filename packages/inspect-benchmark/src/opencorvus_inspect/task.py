"""Reusable Inspect Task for JSON and JSON Lines benchmark datasets."""

from __future__ import annotations

from inspect_ai import Task, task
from inspect_ai.dataset import json_dataset
from inspect_ai.scorer import Scorer, includes, match

from .scorer import task_completed
from .solver import opencorvus_task


def _scorers(name: str) -> Scorer | list[Scorer]:
    if name == "task_completed":
        return task_completed()
    if name == "includes":
        return [task_completed(), includes()]
    if name == "exact":
        return [task_completed(), match(location="exact", ignore_case=False)]
    raise ValueError("scorer must be task_completed, includes, or exact")


@task
def opencorvus_benchmark(
    dataset: str,
    *,
    scorer: str = "task_completed",
    base_url: str | None = None,
    project_dir: str | None = None,
    model: str | None = None,
    prompt_profile: str | None = None,
    product_pillar: str | None = None,
    timeout_seconds: float | str | None = None,
    poll_seconds: float | str | None = None,
    init_git: bool | str | None = None,
) -> Task:
    """Build an Inspect Task that evaluates OpenCorvus as the agent system."""

    return Task(
        dataset=json_dataset(dataset),
        solver=opencorvus_task(
            base_url=base_url,
            project_dir=project_dir,
            model=model,
            prompt_profile=prompt_profile,
            product_pillar=product_pillar,
            timeout_seconds=timeout_seconds,
            poll_seconds=poll_seconds,
            init_git=init_git,
        ),
        scorer=_scorers(scorer),
        model=None,
        metadata={"adapter": "opencorvus-task-api", "adapter_schema_version": 1},
    )
