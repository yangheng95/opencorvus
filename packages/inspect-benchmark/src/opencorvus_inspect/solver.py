"""Inspect solver that delegates one Sample to one OpenCorvus Task."""

from __future__ import annotations

from typing import Any, cast

from inspect_ai.model import ModelOutput
from inspect_ai.solver import Generate, Solver, TaskState, solver

from .adapter import AdapterConfig, OpenCorvusClient


def _sample_title(metadata: dict[str, Any], sample_id: int | str) -> str:
    candidate = metadata.get("opencorvus_title")
    if candidate is None:
        return f"Inspect sample {sample_id}"
    if not isinstance(candidate, str) or not candidate.strip():
        raise ValueError("Sample metadata opencorvus_title must be a non-empty string")
    return candidate.strip()


@solver
def opencorvus_task(
    *,
    base_url: str | None = None,
    project_dir: str | None = None,
    model: str | None = None,
    prompt_profile: str | None = None,
    product_pillar: str | None = None,
    timeout_seconds: float | str | None = None,
    poll_seconds: float | str | None = None,
    init_git: bool | str | None = None,
) -> Solver:
    """Create a solver backed by the public OpenCorvus Task lifecycle."""

    config = AdapterConfig.resolve(
        base_url=base_url,
        project_dir=project_dir,
        model=model,
        prompt_profile=prompt_profile,
        product_pillar=product_pillar,
        timeout_seconds=timeout_seconds,
        poll_seconds=poll_seconds,
        init_git=init_git,
    )

    async def solve(state: TaskState, _generate: Generate) -> TaskState:
        request_id = f"inspect:{state.uuid}"
        async with OpenCorvusClient(config) as client:
            result = await client.run_task(
                request=state.input_text,
                request_id=request_id,
                title=_sample_title(state.metadata, state.sample_id),
                sample_id=str(state.sample_id),
                sample_uuid=state.uuid,
                epoch=state.epoch,
            )
        state.metadata["opencorvus_result"] = result.metadata()
        output = ModelOutput.from_content(model="opencorvus/task", content=result.completion)
        state.output = output
        state.messages.append(output.message)
        state.completed = True
        return state

    return cast(Solver, solve)
