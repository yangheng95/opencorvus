"""Official simulated state and rubric; no model, runner, or alternative scoring."""

from __future__ import annotations

import copy
import json
import math
from dataclasses import dataclass
from importlib.metadata import distribution
from pathlib import Path
from typing import Any

UPSTREAM_REVISION = "4a8e1061254004d9dac807054eed33fad7d1ff14"
BENCHMARK = f"zapier/automationbench@{UPSTREAM_REVISION[:7]}"


def require_official_distribution() -> None:
    """Verify the installed immutable source identity, not a mutable tree digest."""
    installed = distribution("automation-bench")
    direct = json.loads(installed.read_text("direct_url.json") or "{}")
    if (
        installed.version != "1.0.6"
        or direct.get("url") != "https://github.com/zapier/AutomationBench"
        or direct.get("vcs_info", {}).get("commit_id") != UPSTREAM_REVISION
    ):
        raise ValueError("Install the pinned AutomationBench source with the automation extra")


@dataclass(frozen=True)
class Case:
    domain: str
    task: str
    example_id: int | str
    prompt: list[dict[str, str]]
    info: dict[str, Any]

    @property
    def request(self) -> str:
        return "\n\n".join(f"{part['role'].upper()}:\n{part['content']}" for part in self.prompt)


def _domain_cases(domain: str) -> dict[str, Case]:
    from automationbench.domains import get_domain_dataset

    loaded: dict[str, Case] = {}
    for row in get_domain_dataset(domain):
        raw_info = row["info"]
        info = json.loads(raw_info) if isinstance(raw_info, str) else raw_info
        name = info["task_name"]
        if name in loaded:
            raise ValueError(f"duplicate upstream case: {name}")
        loaded[name] = Case(domain, name, row["example_id"], row["prompt"], info)
    return loaded


def official_case(task: str, example_id: int | str) -> Case:
    require_official_distribution()
    case = _domain_cases(task.split(".", 1)[0]).get(task)
    if case is None or case.example_id != example_id:
        raise ValueError(f"case identity does not match the official dataset: {task}")
    return case


def load_cases(manifest: str | Path) -> list[Case]:
    require_official_distribution()
    payload = json.loads(Path(manifest).read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or set(payload) != {"schema_version", "benchmark", "cases"}:
        raise ValueError("manifest requires schema_version, benchmark and cases")
    if payload["schema_version"] != 1 or payload["benchmark"] != BENCHMARK:
        raise ValueError("manifest must bind the supported AutomationBench revision")
    if not isinstance(payload["cases"], list) or not payload["cases"]:
        raise ValueError("manifest cases must be a non-empty array")
    domains: dict[str, dict[str, Case]] = {}
    selected: dict[str, Case] = {}
    for item in payload["cases"]:
        if not isinstance(item, dict) or set(item) != {"domain", "task", "example_id"}:
            raise ValueError("each case requires domain, task and example_id")
        domain, task = item["domain"], item["task"]
        if not isinstance(domain, str) or not isinstance(task, str):
            raise ValueError("case domain and task must be strings")
        if task in selected:
            raise ValueError(f"duplicate manifest case: {task}")
        if domain not in domains:
            domains[domain] = _domain_cases(domain)
        case = domains[domain].get(task)
        if case is None or case.example_id != item["example_id"]:
            raise ValueError(f"manifest case identity does not match the official dataset: {task}")
        selected[task] = case
    return list(selected.values())


class OfficialWorld:
    """One sample occurrence, with ordered official API events and a sealed rubric result."""

    def __init__(self, case: Case) -> None:
        from automationbench.runner import compute_allowed_services, strip_none_values
        from automationbench.schema.world import WorldState

        self.case = case
        self.info = copy.deepcopy(case.info)
        self.initial = strip_none_values(copy.deepcopy(self.info["initial_state"]))
        self.info["assertions"] = [strip_none_values(a) for a in self.info["assertions"]]
        self.world = WorldState(**copy.deepcopy(self.initial))
        # Upstream creates this marker on the first row update and treats absence as empty.
        object.__setattr__(self.world.google_sheets, "_updated_row_keys", set())
        self.world.meta.allowed_services = compute_allowed_services(
            self.initial, self.info["assertions"], self.info.get("zapier_tools", [])
        )
        self.events: list[dict[str, Any]] = []
        self.sealed = False

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

    def seal(self) -> dict[str, Any]:
        from automationbench.rubric import partial_credit, task_completed_correctly

        if self.sealed:
            raise RuntimeError("automationbench_world_sealed")
        self.sealed = True
        state: dict[str, Any] = {
            "info": self.info,
            "world": self.world,
            "initial_state": self.initial,
        }
        partial = float(partial_credit(state))
        strict = float(task_completed_correctly(state))
        if strict not in {0.0, 1.0} or not math.isfinite(partial) or not 0 <= partial <= 1:
            raise ValueError("official rubric returned an invalid score")
        return {
            "schema_version": 1,
            "benchmark": BENCHMARK,
            "task": self.case.task,
            "example_id": self.case.example_id,
            "strict": strict,
            "partial": partial,
            "assertion_results": state.get("_assertion_results", []),
            "tool_calls": len(self.events),
        }

    def snapshot(self) -> dict[str, Any]:
        return {
            "schema_version": 1,
            "benchmark": BENCHMARK,
            "task": self.case.task,
            "example_id": self.case.example_id,
            "world": self.world.model_dump(mode="json"),
            "google_sheets_updated_row_keys": sorted(self.world.google_sheets._updated_row_keys),
        }


def rescore(case: Case, snapshot: dict[str, Any], tool_calls: int) -> dict[str, Any]:
    """Recompute from the settled official state, preserving transient assertion inputs."""
    from automationbench.schema.world import WorldState

    if (
        snapshot.get("schema_version") != 1
        or snapshot.get("benchmark") != BENCHMARK
        or snapshot.get("task") != case.task
        or snapshot.get("example_id") != case.example_id
    ):
        raise ValueError("AutomationBench snapshot identity does not match the case")
    updated = snapshot["google_sheets_updated_row_keys"]
    if not isinstance(updated, list) or any(not isinstance(key, str) for key in updated):
        raise ValueError("AutomationBench snapshot has invalid row-write tracking")
    world = OfficialWorld(case)
    world.world = WorldState.model_validate(snapshot["world"])
    object.__setattr__(world.world.google_sheets, "_updated_row_keys", set(updated))
    result = world.seal()
    result["tool_calls"] = tool_calls
    return result
