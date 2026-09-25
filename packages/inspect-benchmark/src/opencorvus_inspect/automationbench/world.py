"""Official simulated state and rubric; no model, runner, or alternative scoring."""

from __future__ import annotations

import copy
import json
import math
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from importlib.metadata import distribution
from pathlib import Path
from typing import Any

from .api_session import ApiSession, restore_world_state, snapshot_clock

UPSTREAM_REVISION = "4a8e1061254004d9dac807054eed33fad7d1ff14"
BENCHMARK = f"zapier/automationbench@{UPSTREAM_REVISION[:7]}"
SCORING_POLICY = "official-strict-assertions-v1"
CASE_CONTEXT_POLICY = "official-world-clock-v2"


def require_strict_assertions() -> None:
    from automationbench.rubric import registry

    if registry.STRICT_MODE is not True:
        raise ValueError("AutomationBench requires AUTOMATIONBENCH_STRICT_ASSERTIONS=1 at import")


def require_official_distribution() -> None:
    """Verify the installed immutable source identity, not a mutable tree digest."""
    require_strict_assertions()
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
    def current_time(self) -> str | None:
        meta = self.info.get("initial_state", {}).get("meta")
        if meta is None:
            return None
        value = meta.get("current_time")
        if value is None:
            return None
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"Official case current_time must be ISO 8601: {self.task}")
        try:
            datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as error:
            raise ValueError(f"Official case current_time must be ISO 8601: {self.task}") from error
        return value

    @property
    def request(self) -> str:
        original = "\n\n".join(
            f"{part['role'].upper()}:\n{part['content']}" for part in self.prompt
        )
        context = "Benchmark environment supplied by Inspect from the official sample:\n"
        current_time = self.current_time
        if current_time is None:
            context += "Simulated business current_time: unspecified in the official sample."
        else:
            context += (
                f"Simulated business current_time: {current_time}\n"
                "Use this simulated time for today's date, relative dates, deadlines and activity "
                "windows in the business request. The computer's execution date describes runtime "
                "wall time and does not change the simulated business date."
            )
        return f"{context}\n\n{original}"


def freeze_missing_case_clock(case: Case, clock: datetime) -> Case:
    """Give one originally undated sample a visible, replayable business clock."""
    if case.current_time is not None:
        return case
    if clock.tzinfo is None or clock.utcoffset() is None:
        raise ValueError("Frozen AutomationBench clock must include a timezone")
    info = copy.deepcopy(case.info)
    info["initial_state"].setdefault("meta", {})["current_time"] = clock.astimezone(
        timezone.utc
    ).isoformat()
    return replace(case, info=info)


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


class OfficialWorld(ApiSession):
    """One sample occurrence, with ordered official API events and a sealed rubric result."""

    def __init__(self, case: Case) -> None:
        from automationbench.runner import compute_allowed_services, strip_none_values
        from automationbench.schema.world import WorldState

        self.case = case
        self.info = copy.deepcopy(case.info)
        self.initial = strip_none_values(copy.deepcopy(self.info["initial_state"]))
        self.info["assertions"] = [strip_none_values(a) for a in self.info["assertions"]]
        super().__init__(WorldState(**copy.deepcopy(self.initial)))
        self.initial.setdefault("meta", {})["current_time"] = (
            self.world.meta.current_time.isoformat()
        )
        # Upstream creates this marker on the first row update and treats absence as empty.
        object.__setattr__(self.world.google_sheets, "_updated_row_keys", set())
        self.world.meta.allowed_services = compute_allowed_services(
            self.initial, self.info["assertions"], self.info.get("zapier_tools", [])
        )

    def seal(self) -> dict[str, Any]:
        from automationbench.rubric import partial_credit, task_completed_correctly

        require_strict_assertions()

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
            **self.state_snapshot(),
        }


def rescore(case: Case, snapshot: dict[str, Any], tool_calls: int) -> dict[str, Any]:
    """Recompute from the settled official state, preserving transient assertion inputs."""
    if (
        snapshot.get("schema_version") != 1
        or snapshot.get("benchmark") != BENCHMARK
        or snapshot.get("task") != case.task
        or snapshot.get("example_id") != case.example_id
    ):
        raise ValueError("AutomationBench snapshot identity does not match the case")
    snapshot_clock_value = snapshot_clock(snapshot)
    if case.current_time is not None:
        source_clock = datetime.fromisoformat(case.current_time.replace("Z", "+00:00"))
        if snapshot_clock_value != source_clock:
            raise ValueError("AutomationBench snapshot clock differs from the official case")
    else:
        case = freeze_missing_case_clock(case, snapshot_clock_value)
    world = OfficialWorld(case)
    world.world = restore_world_state(snapshot)
    result = world.seal()
    result["tool_calls"] = tool_calls
    return result
