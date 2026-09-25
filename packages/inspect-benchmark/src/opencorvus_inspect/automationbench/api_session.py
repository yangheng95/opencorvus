"""One simulated API state/event owner, independent of benchmark grading."""

from __future__ import annotations

import copy
from datetime import datetime
from typing import Any


def snapshot_clock(snapshot: dict[str, Any]) -> datetime:
    world = snapshot.get("world")
    meta = world.get("meta") if isinstance(world, dict) else None
    clock = meta.get("current_time") if isinstance(meta, dict) else None
    if not isinstance(clock, str):
        raise ValueError("AutomationBench snapshot has no effective business clock")
    try:
        return datetime.fromisoformat(clock.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("AutomationBench snapshot has an invalid business clock") from error


def restore_world_state(snapshot: dict[str, Any]) -> Any:
    """Restore a complete exported state; never reinterpret expanded fields as seed grants."""
    from automationbench.schema.world import WorldState

    snapshot_clock(snapshot)
    raw = snapshot["world"]
    if set(raw) != set(WorldState.model_fields):
        raise ValueError("AutomationBench snapshot requires a complete world")
    allowed = raw["meta"].get("allowed_services")
    if (
        not isinstance(allowed, list)
        or any(not isinstance(name, str) or name not in raw or name == "meta" for name in allowed)
        or len(set(allowed)) != len(allowed)
    ):
        raise ValueError("AutomationBench snapshot requires explicit connected services")
    updated = snapshot.get("google_sheets_updated_row_keys")
    if (
        not isinstance(updated, list)
        or any(not isinstance(key, str) for key in updated)
        or len(set(updated)) != len(updated)
    ):
        raise ValueError("AutomationBench snapshot has invalid row-write tracking")
    world = WorldState.model_validate(copy.deepcopy(raw))
    if world.model_dump(mode="json") != raw:
        raise ValueError("AutomationBench snapshot is not a complete serialized world")
    object.__setattr__(world.google_sheets, "_updated_row_keys", set(updated))
    return world


class ApiSession:
    """Fresh API occurrence; restored business records do not restore participant events."""

    def __init__(self, world: Any) -> None:
        self.world = world
        self.events: list[dict[str, Any]] = []
        self.sealed = False

    @staticmethod
    def restore(snapshot: dict[str, Any]) -> ApiSession:
        return ApiSession(restore_world_state(snapshot))

    def call(self, tool: str, arguments: dict[str, Any]) -> str:
        from automationbench.tools.api import api_fetch, api_search, base64_encode

        if self.sealed:
            raise RuntimeError("automationbench_world_sealed")
        event: dict[str, Any] = {
            "sequence": len(self.events) + 1,
            "tool": tool,
            "arguments": copy.deepcopy(arguments),
        }
        try:
            if tool == "api_search":
                result = api_search(**arguments)
            elif tool == "api_fetch":
                result = api_fetch(self.world, **arguments)
            elif tool == "base64_encode":
                result = base64_encode(**arguments)
            else:
                raise ValueError(f"unknown official tool: {tool}")
        except Exception as error:
            event["error_type"] = type(error).__name__
            raise
        else:
            event["output"] = result
            return str(result)
        finally:
            self.events.append(event)

    def state_snapshot(self) -> dict[str, Any]:
        return {
            "world": self.world.model_dump(mode="json"),
            "google_sheets_updated_row_keys": sorted(self.world.google_sheets._updated_row_keys),
        }
