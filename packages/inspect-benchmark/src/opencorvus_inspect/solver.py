"""Inspect solver that delegates one Sample to one OpenCorvus Task."""

from __future__ import annotations

import hashlib
from dataclasses import replace
from importlib.metadata import version
from pathlib import Path
from typing import Any, Literal, cast

from inspect_ai.model import ModelOutput
from inspect_ai.solver import Generate, Solver, TaskState, solver

from .adapter import AdapterConfig, OpenCorvusClient

ProjectIsolation = Literal["shared", "sample_epoch"]


def _identity_digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _project_config(
    config: AdapterConfig,
    *,
    isolation: ProjectIsolation,
    sample_uuid: str,
    epoch: int,
    attempt: int,
) -> AdapterConfig:
    if isolation == "shared":
        return config
    occurrence = _identity_digest(sample_uuid)[:20]
    directory = (
        Path(config.project_dir).resolve()
        / f"sample-{occurrence}"
        / f"epoch-{epoch}"
        / f"attempt-{attempt}"
    )
    return replace(config, project_dir=str(directory), init_git=True)


def opencorvus_system_metadata(
    config: AdapterConfig,
    *,
    project_isolation: ProjectIsolation,
) -> dict[str, object]:
    """Return the exact non-secret system configuration used by a Solver."""

    return {
        "adapter": "opencorvus-task-api",
        "adapter_schema_version": 1,
        "adapter_distribution": {
            "name": "opencorvus-inspect",
            "version": version("opencorvus-inspect"),
        },
        "endpoint_sha256": _identity_digest(config.base_url),
        "model": config.model,
        "prompt_profile": config.prompt_profile,
        "product_pillar": config.product_pillar,
        "timeout_seconds": config.timeout_seconds,
        "poll_seconds": config.poll_seconds,
        "project": {
            "root_sha256": _identity_digest(str(Path(config.project_dir).resolve())),
            "isolation": project_isolation,
            "init_git": True if project_isolation == "sample_epoch" else config.init_git,
        },
    }


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
    project_isolation: ProjectIsolation = "shared",
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

    return build_opencorvus_solver(config, project_isolation=project_isolation)


def build_opencorvus_solver(
    config: AdapterConfig,
    *,
    project_isolation: ProjectIsolation,
) -> Solver:
    """Build the one OpenCorvus Solver from an already-resolved configuration."""

    if project_isolation not in {"shared", "sample_epoch"}:
        raise ValueError("project_isolation must be shared or sample_epoch")
    attempts: dict[str, int] = {}

    async def solve(state: TaskState, _generate: Generate) -> TaskState:
        request_id = f"inspect:{state.uuid}"
        attempt = attempts.get(state.uuid, 0) + 1
        attempts[state.uuid] = attempt
        sample_config = _project_config(
            config,
            isolation=project_isolation,
            sample_uuid=state.uuid,
            epoch=state.epoch,
            attempt=attempt,
        )
        state.metadata["opencorvus_project"] = {
            "directory_sha256": _identity_digest(sample_config.project_dir),
            "isolation": project_isolation,
            "init_git": sample_config.init_git,
            "attempt": attempt,
        }
        async with OpenCorvusClient(sample_config) as client:
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
