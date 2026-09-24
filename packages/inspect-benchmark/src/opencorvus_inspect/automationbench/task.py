"""Inspect owns execution and scoring; OpenCorvus owns all agent behavior."""

from __future__ import annotations

import asyncio
import json
import math
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, cast
from urllib.parse import urlsplit

from inspect_ai import Task, task
from inspect_ai.dataset import Sample
from inspect_ai.scorer import Score, Scorer, Target, mean, scorer, stderr
from inspect_ai.solver import Solver, TaskState, solver

from ..adapter import AdapterConfig, EntryPoint
from ..scorer import mission_completed, task_completed
from ..solver import SampleSetup, build_opencorvus_solver, opencorvus_system_metadata
from .world import (
    BENCHMARK,
    CASE_CONTEXT_POLICY,
    SCORING_POLICY,
    Case,
    OfficialWorld,
    load_cases,
    official_case,
    rescore,
)


def sample_environment(
    cases: list[Case], squad: Path, entrypoint: EntryPoint = "task"
) -> SampleSetup:
    """Provision only a fresh project; never rewrite an existing project or user's service."""
    by_id = {case.task: case for case in cases}
    files = tuple(
        (file.relative_to(squad), file.read_bytes())
        for file in sorted(squad.rglob("*"))
        if file.is_file()
    )

    @asynccontextmanager
    async def setup(state: TaskState, config: AdapterConfig) -> AsyncIterator[None]:
        from .mcp import world_server

        case = by_id[str(state.sample_id)]
        world = OfficialWorld(case)
        project = Path(config.project_dir)
        state.metadata["automationbench_execution"] = {"status": "preparing"}
        try:
            await asyncio.to_thread(project.mkdir, parents=True, exist_ok=False)
            async with world_server(world) as url:

                def prepare_project() -> None:
                    target = (
                        project / ".opencorvus" / "expert-squads" / "builtin" / "automationbench"
                    )
                    for relative, content in files:
                        destination = target / relative
                        destination.parent.mkdir(parents=True, exist_ok=True)
                        destination.write_bytes(content)
                    (project / ".opencorvus" / "opencorvus.jsonc").write_text(
                        json.dumps(
                            {
                                "mcp": {
                                    "automationbench": {
                                        "type": "remote",
                                        "url": url,
                                        "transport": "streamable-http",
                                        "enabled": True,
                                        "oauth": False,
                                    }
                                },
                            },
                            indent=2,
                        )
                        + "\n",
                        encoding="utf-8",
                    )

                await asyncio.to_thread(prepare_project)
                state.metadata["automationbench_execution"] = {"status": "running"}
                yield
            result = state.metadata.get("opencorvus_result", {})
            lifecycle = result.get("lifecycle_status")
            mission_settled = bool(
                result.get("mission_completion_message_id")
                or result.get("mission_blockage_message_id")
            )
            if (entrypoint == "task" and lifecycle in {"completed", "failed"}) or (
                entrypoint == "mission" and mission_settled
            ):
                score = world.seal()
                snapshot = world.snapshot()
                state.metadata["automationbench_snapshot"] = snapshot
                reproduced = rescore(case, snapshot, len(world.events))
                if reproduced != score:
                    raise ValueError("AutomationBench snapshot rubric diverged")
                state.metadata["automationbench_score"] = score
                state.metadata["automationbench_execution"] = {"status": "scored"}
            else:
                world.sealed = True
                state.metadata["automationbench_execution"] = {"status": "unscored"}
        except BaseException as error:
            world.sealed = True
            state.metadata["automationbench_execution"] = {
                "status": "error",
                "error_type": type(error).__name__,
            }
            raise
        finally:
            state.metadata["automationbench_events"] = world.events
            state.metadata["automationbench_snapshot"] = world.snapshot()

    return setup


def automationbench_score(metric: str = "strict") -> Scorer:
    """Score sealed official evidence, including on Inspect offline re-scoring."""
    if metric not in {"strict", "partial"}:
        raise ValueError("metric must be strict or partial")

    async def score(state: TaskState, _target: Target) -> Score:
        result = state.metadata.get("automationbench_score")
        disposition = state.metadata.get("automationbench_execution", {}).get("status")
        if disposition != "scored" or not isinstance(result, dict):
            return Score.unscored(explanation=f"AutomationBench execution is {disposition}")
        if (
            result.get("schema_version") != 1
            or result.get("benchmark") != BENCHMARK
            or result.get("task") != state.metadata.get("automationbench_case")
            or result.get("example_id") != state.metadata.get("automationbench_example_id")
        ):
            raise ValueError("AutomationBench score identity does not match the sample")
        events = state.metadata["automationbench_events"]
        if [event["sequence"] for event in events] != list(range(1, len(events) + 1)):
            raise ValueError("AutomationBench event sequence is incomplete")
        restored = rescore(
            official_case(result["task"], result["example_id"]),
            state.metadata["automationbench_snapshot"],
            len(events),
        )
        if restored != result:
            raise ValueError(
                "AutomationBench stored score differs from the official snapshot rubric"
            )
        value = result[metric]
        if not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 1:
            raise ValueError("AutomationBench score is outside its numeric contract")
        return Score(
            value=float(value),
            explanation=f"Official AutomationBench {metric} rubric",
            metadata=result,
        )

    return cast(Scorer, score)


@scorer(metrics=[mean(), stderr()])
def automationbench_strict() -> Scorer:
    return automationbench_score("strict")


@scorer(metrics=[mean(), stderr()])
def automationbench_partial() -> Scorer:
    return automationbench_score("partial")


def _settings(
    manifest: str,
    squad: str,
    project_dir: str,
    model: str,
    base_url: str,
    timeout_seconds: float,
    poll_seconds: float,
) -> tuple[AdapterConfig, Path, dict[str, Any]]:
    import json5

    if not model.strip():
        raise ValueError("AutomationBench requires an explicit provider/model")
    squad_path = Path(squad).resolve(strict=True)
    squad_manifest = json5.loads((squad_path / "expert-squad.jsonc").read_text(encoding="utf-8"))
    if (squad_manifest.get("namespace"), squad_manifest.get("id")) != (
        "builtin",
        "automationbench",
    ):
        raise ValueError("squad must identify the canonical builtin/automationbench package")
    config = AdapterConfig.resolve(
        base_url=base_url,
        project_dir=project_dir,
        model=model,
        prompt_profile="automationbench",
        product_pillar="work",
        init_git=True,
        timeout_seconds=timeout_seconds,
        poll_seconds=poll_seconds,
    )
    if urlsplit(config.base_url).hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise ValueError("AutomationBench requires a co-located loopback OpenCorvus service")
    root = Path(project_dir).resolve()
    if Path(manifest).resolve().is_relative_to(root) or squad_path.is_relative_to(root):
        raise ValueError("manifest and squad source must remain outside the sample project root")
    return config, squad_path, squad_manifest


@solver
def automationbench_task_solver(
    manifest: str,
    squad: str,
    project_dir: str,
    model: str,
    base_url: str,
    timeout_seconds: float,
    poll_seconds: float,
    entrypoint: EntryPoint = "task",
) -> Solver:
    config, squad_path, _squad_manifest = _settings(
        manifest,
        squad,
        project_dir,
        model,
        base_url,
        timeout_seconds,
        poll_seconds,
    )
    return build_opencorvus_solver(
        config,
        project_isolation="sample_epoch",
        sample_setup=sample_environment(load_cases(manifest), squad_path, entrypoint),
        entrypoint=entrypoint,
    )


@task
def opencorvus_automationbench(
    manifest: str,
    squad: str,
    project_dir: str,
    model: str,
    *,
    base_url: str = "http://127.0.0.1:7878",
    timeout_seconds: float = 300,
    poll_seconds: float = 2,
    entrypoint: EntryPoint = "task",
) -> Task:
    """Run a frozen public case set against a co-located, separately started OpenCorvus service."""
    cases = load_cases(manifest)
    if entrypoint not in {"task", "mission"}:
        raise ValueError("entrypoint must be task or mission")
    config, squad_path, squad_manifest = _settings(
        manifest,
        squad,
        project_dir,
        model,
        base_url,
        timeout_seconds,
        poll_seconds,
    )
    metadata: dict[str, Any] = {
        "benchmark": BENCHMARK,
        "scoring_policy": SCORING_POLICY,
        "case_context_policy": CASE_CONTEXT_POLICY,
        "execution_mode": f"opencorvus-{entrypoint}-api",
        "comparable": False,
        "isolation": "local-sample-project-and-mcp-world",
        "system": opencorvus_system_metadata(
            config, project_isolation="sample_epoch", entrypoint=entrypoint
        ),
        "squad_version": squad_manifest["version"],
        "cases": [{"domain": c.domain, "task": c.task, "example_id": c.example_id} for c in cases],
    }
    return Task(
        dataset=[
            Sample(
                id=case.task,
                input=case.request,
                metadata={
                    **metadata,
                    "automationbench_example_id": case.example_id,
                    "automationbench_case": case.task,
                    "automationbench_current_time": case.current_time,
                },
            )
            for case in cases
        ],
        solver=automationbench_task_solver(
            manifest=manifest,
            squad=str(squad_path),
            project_dir=config.project_dir,
            model=model,
            base_url=config.base_url,
            timeout_seconds=config.timeout_seconds,
            poll_seconds=config.poll_seconds,
            entrypoint=entrypoint,
        ),
        scorer=[
            task_completed() if entrypoint == "task" else mission_completed(),
            automationbench_strict(),
            automationbench_partial(),
        ],
        model=None,
        metadata=metadata,
    )
