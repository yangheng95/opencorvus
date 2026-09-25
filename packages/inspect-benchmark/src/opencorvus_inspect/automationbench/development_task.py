"""One explicitly attributed development input through the existing Mission solver."""

from __future__ import annotations

from inspect_ai import Task, task
from inspect_ai.dataset import Sample

from ..solver import build_opencorvus_solver, opencorvus_system_metadata
from .development import development_environment, load_development_fixture
from .environment import sample_settings


@task
def opencorvus_business_repair(
    fixture: str,
    squad: str,
    project_dir: str,
    model: str,
    *,
    base_url: str = "http://127.0.0.1:7878",
    timeout_seconds: float = 300,
    poll_seconds: float = 2,
) -> Task:
    """Retain real repair evidence for external review; never apply an official create rubric."""
    config, squad_path, manifest = sample_settings(
        fixture, squad, project_dir, model, base_url, timeout_seconds, poll_seconds
    )
    material = load_development_fixture(fixture)
    metadata = {
        "development_fixture": material.identity(),
        "execution_mode": "opencorvus-mission-api",
        "assessment": "not_evaluated",
        "comparable": False,
        "isolation": "local-sample-project-and-mcp-world",
        "system": opencorvus_system_metadata(
            config, project_isolation="sample_epoch", entrypoint="mission"
        ),
        "squad_version": manifest["version"],
    }
    return Task(
        dataset=[Sample(id=material.identifier, input=material.request, metadata=metadata)],
        solver=build_opencorvus_solver(
            config,
            project_isolation="sample_epoch",
            sample_setup=development_environment(material, squad_path),
            entrypoint="mission",
        ),
        scorer=None,
        model=None,
        metadata=metadata,
    )
