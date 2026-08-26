"""Compose registered benchmark definitions with the OpenCorvus Solver."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any, cast

from inspect_ai import Task, task
from inspect_ai.scorer import Scorer
from inspect_ai.solver import Solver

from ..adapter import AdapterConfig
from ..scorer import task_completed
from ..solver import ProjectIsolation, opencorvus_system_metadata, opencorvus_task
from .catalog import BENCHMARKS
from .dataset import load_benchmark_dataset
from .scoring import benchmark_quality


def build_benchmark_task(
    benchmark: str,
    dataset: str,
    *,
    solver: Solver,
    adapter: str,
    adapter_schema_version: int,
    system_metadata: Mapping[str, object],
    lifecycle_scorers: Sequence[Scorer] = (),
    manifest: str | None = None,
    judge_model: str | None = None,
    run_metadata: Mapping[str, object] | None = None,
) -> Task:
    """Compose a registered dataset/scorer with one explicit system Solver."""

    definition = BENCHMARKS.resolve(benchmark)
    loaded = load_benchmark_dataset(
        definition,
        dataset,
        manifest=manifest,
        judge_model=judge_model,
    )
    selected_run_metadata = dict(run_metadata or {})
    for sample in loaded.dataset:
        metadata = cast(dict[str, Any], sample.metadata)
        metadata["system"] = dict(system_metadata)
        metadata["run"] = selected_run_metadata
    return Task(
        dataset=loaded.dataset,
        solver=solver,
        scorer=[
            *lifecycle_scorers,
            benchmark_quality(benchmark=definition.id, judge_model=judge_model),
        ],
        model=None,
        metadata={
            "adapter": adapter,
            "adapter_schema_version": adapter_schema_version,
            "benchmark": definition.metadata(judge_model=judge_model),
            "dataset": loaded.evidence.metadata(),
            "system": dict(system_metadata),
            "run": selected_run_metadata,
        },
    )


def _boolean(value: bool | str | None, *, name: str, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    normalized = value.strip().lower()
    if normalized in {"true", "false"}:
        return normalized == "true"
    raise ValueError(f"{name} must be true or false")


def _validate_comparable_run(
    *,
    config: AdapterConfig,
    dataset: str,
    manifest: str | None,
    project_isolation: ProjectIsolation,
) -> None:
    missing: list[str] = []
    if config.model is None:
        missing.append("model")
    if config.prompt_profile is None:
        missing.append("prompt_profile")
    if manifest is None:
        missing.append("manifest")
    if project_isolation != "sample_epoch":
        missing.append("project_isolation=sample_epoch")
    if missing:
        raise ValueError("comparable run requires: " + ", ".join(missing))

    project_root = Path(config.project_dir).resolve()
    protected_inputs = [Path(dataset).resolve()]
    if manifest is not None:
        protected_inputs.append(Path(manifest).resolve())
    inside_project = [str(path) for path in protected_inputs if path.is_relative_to(project_root)]
    if inside_project:
        raise ValueError(
            "comparable run requires dataset and manifest outside the project root: "
            + ", ".join(inside_project)
        )


@task
def opencorvus_suite(
    benchmark: str,
    dataset: str,
    *,
    manifest: str | None = None,
    judge_model: str | None = None,
    base_url: str | None = None,
    project_dir: str | None = None,
    model: str | None = None,
    prompt_profile: str | None = None,
    product_pillar: str | None = None,
    timeout_seconds: float | str | None = None,
    poll_seconds: float | str | None = None,
    init_git: bool | str | None = None,
    project_isolation: ProjectIsolation = "shared",
    comparable: bool | str | None = None,
) -> Task:
    """Build a provenance-complete Inspect Task for one registered benchmark."""

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
    comparable_mode = _boolean(comparable, name="comparable", default=False)
    if comparable_mode:
        _validate_comparable_run(
            config=config,
            dataset=dataset,
            manifest=manifest,
            project_isolation=project_isolation,
        )
    system_metadata = opencorvus_system_metadata(
        config,
        project_isolation=project_isolation,
    )
    return build_benchmark_task(
        benchmark,
        dataset,
        solver=opencorvus_task(
            base_url=config.base_url,
            project_dir=config.project_dir,
            model=config.model,
            prompt_profile=config.prompt_profile,
            product_pillar=config.product_pillar,
            timeout_seconds=config.timeout_seconds,
            poll_seconds=config.poll_seconds,
            init_git=config.init_git,
            project_isolation=project_isolation,
        ),
        adapter="opencorvus-task-api",
        adapter_schema_version=1,
        system_metadata=system_metadata,
        lifecycle_scorers=(task_completed(),),
        manifest=manifest,
        judge_model=judge_model,
        run_metadata={"comparable_mode": comparable_mode},
    )


__all__ = ["build_benchmark_task", "opencorvus_suite"]
