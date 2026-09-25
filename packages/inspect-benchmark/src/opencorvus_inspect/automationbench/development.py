"""Explicit development fixture input/setup, without official grading or a model runner."""

from __future__ import annotations

import copy
import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from inspect_ai.solver import TaskState

from ..adapter import AdapterConfig
from ..solver import SampleSetup
from .api_session import ApiSession, restore_world_state, snapshot_clock
from .environment import freeze_squad_files, project_environment
from .world import require_official_distribution

FIXTURE_KIND = "operator-derived-business-repair"


@dataclass(frozen=True)
class DevelopmentFixture:
    identifier: str
    business_request: str
    source: dict[str, str]
    state: dict[str, Any]

    @property
    def request(self) -> str:
        return (
            "This is an operator-prepared development copy of simulated business state.\n"
            "Existing records are seeded material, not effects of this Task.\n"
            f"Simulated business current_time: {snapshot_clock(self.state).isoformat()}\n"
            "Use this business time for relative dates; runtime wall time does not change it.\n\n"
            f"{self.business_request}"
        )

    def identity(self) -> dict[str, Any]:
        return {
            "schema_version": 1,
            "kind": FIXTURE_KIND,
            "fixture_id": self.identifier,
            "source": copy.deepcopy(self.source),
            "comparable": False,
            "assessment": "not_evaluated",
        }


def load_development_fixture(path: str | Path) -> DevelopmentFixture:
    require_official_distribution()
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    fields = {"schema_version", "kind", "id", "request", "source", "state"}
    if not isinstance(raw, dict) or set(raw) != fields:
        raise ValueError(
            "Development fixture requires schema_version, kind, id, request, source, state"
        )
    if raw["schema_version"] != 1 or raw["kind"] != FIXTURE_KIND:
        raise ValueError(
            "Development fixture requires the operator-derived-business-repair identity"
        )
    if any(not isinstance(raw[key], str) or not raw[key].strip() for key in ("id", "request")):
        raise ValueError("Development fixture requires non-empty id and request")
    source = raw["source"]
    if (
        not isinstance(source, dict)
        or set(source) != {"author", "reference", "description"}
        or any(not isinstance(value, str) or not value.strip() for value in source.values())
    ):
        raise ValueError("Development fixture requires explicit author, reference and description")
    state = raw["state"]
    if not isinstance(state, dict) or set(state) != {"world", "google_sheets_updated_row_keys"}:
        raise ValueError("Development fixture requires world and row-write tracking state")
    restore_world_state(state)
    return DevelopmentFixture(raw["id"], raw["request"], source, state)


def development_environment(fixture: DevelopmentFixture, squad: Path) -> SampleSetup:
    """Compose with the existing solver only after a separate behavior-run registration."""
    frozen = copy.deepcopy(fixture)
    files = freeze_squad_files(squad)

    @asynccontextmanager
    async def setup(state: TaskState, config: AdapterConfig) -> AsyncIterator[None]:
        if state.input_text != frozen.request:
            raise ValueError("Development sample input differs from its frozen fixture request")
        if str(state.sample_id) != frozen.identifier:
            raise ValueError("Development sample identity differs from its frozen fixture")
        session = ApiSession.restore(frozen.state)
        state.metadata["development_fixture"] = frozen.identity()
        state.metadata["development_execution"] = {"status": "preparing"}
        try:
            async with project_environment(config, files, session):
                state.metadata["development_execution"] = {"status": "running"}
                yield
            # Environment closure is not a Task/Mission success or a business assessment.
            state.metadata["development_execution"] = {"status": "closed"}
        except BaseException as error:
            state.metadata["development_execution"] = {
                "status": "error",
                "error_type": type(error).__name__,
            }
            raise
        finally:
            session.sealed = True
            state.metadata["development_events"] = session.events
            state.metadata["development_snapshot"] = {
                **frozen.identity(),
                "state": session.state_snapshot(),
            }

    return setup
