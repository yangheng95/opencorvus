"""Thin asynchronous client for the public OpenCorvus Task lifecycle."""

from __future__ import annotations

import asyncio
import math
import os
import time
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from functools import partial
from typing import Any, Literal, TypeVar, cast
from urllib.parse import quote, urlsplit

import httpx

LifecycleStatus = Literal["active", "completed", "failed", "cancelled"]
ProductPillar = Literal["code", "work"]
EntryPoint = Literal["task", "mission"]
TERMINAL_LIFECYCLES = frozenset({"completed", "failed", "cancelled"})
T = TypeVar("T")


class OpenCorvusAdapterError(RuntimeError):
    """Base class for adapter failures."""


class OpenCorvusAPIError(OpenCorvusAdapterError):
    """The OpenCorvus HTTP API rejected or failed a request."""

    def __init__(
        self,
        *,
        method: str,
        path: str,
        status_code: int | None,
        request_id: str | None,
    ) -> None:
        status = str(status_code) if status_code is not None else "unavailable"
        correlation = f"; request_id={request_id}" if request_id else ""
        super().__init__(f"OpenCorvus {method} {path} failed with status {status}{correlation}")
        self.method = method
        self.path = path
        self.status_code = status_code
        self.request_id = request_id


class OpenCorvusProtocolError(OpenCorvusAdapterError):
    """A successful API response did not satisfy the public Task contract."""


class OpenCorvusTaskTimeout(OpenCorvusAdapterError):
    """No observable Task progress occurred within the inactivity window."""

    def __init__(self, task_id: str, timeout_seconds: float, last_status: str) -> None:
        super().__init__(
            f"OpenCorvus Task {task_id} observation stalled for "
            f"{timeout_seconds:g}s; last lifecycle={last_status}"
        )
        self.task_id = task_id
        self.timeout_seconds = timeout_seconds
        self.last_status = last_status


class OpenCorvusMissionTimeout(OpenCorvusAdapterError):
    """No observable Mission-tree progress occurred within the inactivity window."""

    def __init__(self, mission_id: str, timeout_seconds: float, last_lane: str) -> None:
        super().__init__(
            f"OpenCorvus Mission {mission_id} observation stalled for "
            f"{timeout_seconds:g}s; last board lane={last_lane}"
        )
        self.mission_id = mission_id
        self.timeout_seconds = timeout_seconds
        self.last_lane = last_lane


def _environment(name: str) -> str | None:
    value = os.environ.get(name)
    return value.strip() if value and value.strip() else None


def _positive_float(value: float | str | None, *, name: str, default: float) -> float:
    resolved = default if value is None else float(value)
    if not math.isfinite(resolved) or resolved <= 0:
        raise ValueError(f"{name} must be finite and greater than zero")
    return resolved


def _boolean(value: bool | str | None, *, name: str, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    normalized = value.strip().lower()
    if normalized == "true":
        return True
    if normalized == "false":
        return False
    raise ValueError(f"{name} must be true or false")


@dataclass(frozen=True, slots=True)
class AdapterConfig:
    """Resolved operator configuration for one solver instance."""

    base_url: str
    project_dir: str
    model: str | None
    prompt_profile: str | None
    product_pillar: ProductPillar
    timeout_seconds: float
    poll_seconds: float
    init_git: bool

    def __post_init__(self) -> None:
        if self.poll_seconds >= self.timeout_seconds:
            raise ValueError("poll_seconds must be less than timeout_seconds")

    @classmethod
    def resolve(
        cls,
        *,
        base_url: str | None = None,
        project_dir: str | None = None,
        model: str | None = None,
        prompt_profile: str | None = None,
        product_pillar: str | None = None,
        timeout_seconds: float | str | None = None,
        poll_seconds: float | str | None = None,
        init_git: bool | str | None = None,
    ) -> AdapterConfig:
        resolved_url = (
            base_url or _environment("OPENCORVUS_INSPECT_BASE_URL") or "http://127.0.0.1:7878"
        ).rstrip("/")
        parsed_url = urlsplit(resolved_url)
        if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
            raise ValueError("base_url must be an absolute HTTP(S) URL")
        if parsed_url.username or parsed_url.password or parsed_url.query or parsed_url.fragment:
            raise ValueError("base_url must not contain credentials, query parameters or fragments")

        resolved_dir = (project_dir or _environment("OPENCORVUS_INSPECT_PROJECT_DIR") or "").strip()
        if not resolved_dir:
            raise ValueError(
                "project_dir or OPENCORVUS_INSPECT_PROJECT_DIR must identify the benchmark project"
            )

        resolved_model = (model or _environment("OPENCORVUS_INSPECT_MODEL") or "").strip() or None
        if resolved_model and (resolved_model.startswith("/") or "/" not in resolved_model):
            raise ValueError("model must use provider/model form")

        resolved_profile = (
            prompt_profile or _environment("OPENCORVUS_INSPECT_PROMPT_PROFILE") or ""
        ).strip() or None
        resolved_pillar = (
            product_pillar or _environment("OPENCORVUS_INSPECT_PRODUCT_PILLAR") or "code"
        ).strip()
        if resolved_pillar not in {"code", "work"}:
            raise ValueError("product_pillar must be code or work")

        return cls(
            base_url=resolved_url,
            project_dir=resolved_dir,
            model=resolved_model,
            prompt_profile=resolved_profile,
            product_pillar=cast(ProductPillar, resolved_pillar),
            timeout_seconds=_positive_float(
                timeout_seconds
                if timeout_seconds is not None
                else _environment("OPENCORVUS_INSPECT_TIMEOUT_SECONDS"),
                name="timeout_seconds",
                default=1800,
            ),
            poll_seconds=_positive_float(
                poll_seconds
                if poll_seconds is not None
                else _environment("OPENCORVUS_INSPECT_POLL_SECONDS"),
                name="poll_seconds",
                default=2,
            ),
            init_git=_boolean(
                init_git if init_git is not None else _environment("OPENCORVUS_INSPECT_INIT_GIT"),
                name="init_git",
                default=False,
            ),
        )


def _mapping(value: object, *, label: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise OpenCorvusProtocolError(f"OpenCorvus response field {label} must be an object")
    return cast(Mapping[str, Any], value)


def _required_string(value: object, *, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise OpenCorvusProtocolError(
            f"OpenCorvus response field {label} must be a non-empty string"
        )
    return value


def _optional_string(value: object) -> str | None:
    return value if isinstance(value, str) and value.strip() else None


def _directory_key(value: str) -> str:
    """Compare public and stored project paths without changing their identities."""
    return os.path.normcase(os.path.normpath(value))


def extract_completion(
    task: Mapping[str, Any], part: Mapping[str, Any] | None
) -> tuple[str, str | None]:
    """Resolve the exact accepted completion Tool input; failures have no accepted output."""

    lifecycle = _required_string(task.get("status"), label="task.status")
    decision = task.get("completionDecision")
    if lifecycle == "completed":
        decision_map = _mapping(decision, label="task.completionDecision")
        message_id = _required_string(
            decision_map.get("orchestratorMessageID"),
            label="task.completionDecision.orchestratorMessageID",
        )
        session_id = _required_string(
            decision_map.get("orchestratorSessionID"),
            label="completionDecision.orchestratorSessionID",
        )
        part_id = _required_string(
            decision_map.get("toolPartID"), label="completionDecision.toolPartID"
        )
        call_id = _required_string(
            decision_map.get("toolCallID"), label="completionDecision.toolCallID"
        )
        selected = _mapping(part, label="completion Tool Part")
        expected = {
            "id": part_id,
            "messageID": message_id,
            "sessionID": session_id,
            "callID": call_id,
            "type": "tool",
        }
        if any(selected.get(key) != value for key, value in expected.items()):
            raise OpenCorvusProtocolError("Completion Decision Tool identity disagrees")
        state = _mapping(selected.get("state"), label="completion Tool.state")
        arguments = _mapping(state.get("input"), label="completion Tool.state.input")
        summary = _required_string(arguments.get("summary"), label="completion summary")
        return summary.strip(), message_id

    return "", None


@dataclass(frozen=True, slots=True)
class TaskResult:
    """Bounded, serializable projection of one terminal OpenCorvus Task."""

    task_id: str
    project_id: str
    directory: str
    request_id: str
    lifecycle_status: LifecycleStatus
    terminal_reason: str | None
    error: str | None
    completion: str
    completion_message_id: str | None
    completion_decision_artifact: Mapping[str, Any] | None
    accepted_delivery_slice_revision_ids: tuple[str, ...]
    package_revision_binding: Mapping[str, Any] | None

    def metadata(self) -> dict[str, Any]:
        return {
            "schema_version": 1,
            "task_id": self.task_id,
            "project_id": self.project_id,
            "directory": self.directory,
            "request_id": self.request_id,
            "lifecycle_status": self.lifecycle_status,
            "terminal_reason": self.terminal_reason,
            "error": self.error,
            "completion_message_id": self.completion_message_id,
            "completion_decision_artifact": dict(self.completion_decision_artifact)
            if self.completion_decision_artifact
            else None,
            "accepted_delivery_slice_revision_ids": list(self.accepted_delivery_slice_revision_ids),
            "package_revision_binding": dict(self.package_revision_binding)
            if self.package_revision_binding
            else None,
        }


@dataclass(frozen=True, slots=True)
class MissionResult:
    """Exact public Mission business outcome with its one Mission-owned Task."""

    mission_id: str
    session_id: str
    task_id: str
    request_id: str
    completion: str
    outcome_kind: str
    outcome_message_id: str
    package_revision_binding: Mapping[str, Any]

    def metadata(self) -> dict[str, Any]:
        return {
            "schema_version": 1,
            "entrypoint": "mission",
            "mission_id": self.mission_id,
            "mission_session_id": self.session_id,
            "task_id": self.task_id,
            "request_id": self.request_id,
            "mission_outcome_kind": self.outcome_kind,
            "mission_completion_message_id": (
                self.outcome_message_id if self.outcome_kind == "accepted" else None
            ),
            "mission_blockage_message_id": (
                self.outcome_message_id if self.outcome_kind == "blocked" else None
            ),
            "package_revision_binding": dict(self.package_revision_binding),
        }


class OpenCorvusClient:
    """Call OpenCorvus through its public project-scoped Task API."""

    def __init__(
        self,
        config: AdapterConfig,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.config = config
        self.accepted_task: dict[str, str] | None = None
        password = _environment("OPENCORVUS_SERVER_PASSWORD")
        username = _environment("OPENCORVUS_SERVER_USERNAME") or "opencorvus"
        auth = httpx.BasicAuth(username, password) if password else None
        self._client = httpx.AsyncClient(
            base_url=config.base_url,
            auth=auth,
            transport=transport,
            trust_env=urlsplit(config.base_url).hostname not in {"127.0.0.1", "localhost", "::1"},
            timeout=httpx.Timeout(30, connect=10),
        )

    async def __aenter__(self) -> OpenCorvusClient:
        return self

    async def __aexit__(self, *_error: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _request_payload(
        self,
        method: str,
        path: str,
        *,
        params: Mapping[str, str] | None = None,
        json: Mapping[str, Any] | None = None,
        request_id: str | None = None,
        timeout_seconds: float | None = None,
    ) -> object:
        headers = {"x-opencorvus-request-id": request_id} if request_id else None
        request_timeout = (
            self._client.timeout
            if timeout_seconds is None
            else httpx.Timeout(timeout_seconds, connect=min(10, timeout_seconds))
        )
        try:
            response = await self._client.request(
                method,
                path,
                params=params,
                json=json,
                headers=headers,
                timeout=request_timeout,
            )
        except httpx.HTTPError as error:
            raise OpenCorvusAPIError(
                method=method,
                path=path,
                status_code=None,
                request_id=request_id,
            ) from error
        response_request_id = response.headers.get("x-opencorvus-request-id") or request_id
        if not response.is_success:
            raise OpenCorvusAPIError(
                method=method,
                path=path,
                status_code=response.status_code,
                request_id=response_request_id,
            )
        try:
            payload = response.json()
        except ValueError as error:
            raise OpenCorvusProtocolError(
                f"OpenCorvus {method} {path} returned non-JSON success response"
            ) from error
        return payload

    async def _request_json(
        self,
        method: str,
        path: str,
        *,
        params: Mapping[str, str] | None = None,
        json: Mapping[str, Any] | None = None,
        request_id: str | None = None,
        timeout_seconds: float | None = None,
    ) -> Mapping[str, Any]:
        payload = await self._request_payload(
            method,
            path,
            params=params,
            json=json,
            request_id=request_id,
            timeout_seconds=timeout_seconds,
        )
        return _mapping(payload, label=f"{method} {path} response")

    async def _request_list(
        self, method: str, path: str, *, params: Mapping[str, str] | None = None
    ) -> list[Mapping[str, Any]]:
        payload = await self._request_payload(method, path, params=params)
        if not isinstance(payload, list):
            raise OpenCorvusProtocolError(f"OpenCorvus {method} {path} must return an array")
        return [_mapping(item, label=f"{method} {path} item") for item in payload]

    def _project_params(self) -> dict[str, str]:
        return {"directory": self.config.project_dir}

    async def create_task(
        self,
        *,
        request: str,
        request_id: str,
        title: str,
        sample_id: str,
        sample_uuid: str,
        epoch: int,
        deadline: float | None = None,
    ) -> Mapping[str, Any]:
        remaining = self.config.timeout_seconds if deadline is None else deadline - time.monotonic()
        if remaining <= 0:
            raise OpenCorvusAPIError(
                method="POST",
                path="/task",
                status_code=None,
                request_id=request_id,
            )
        body: dict[str, Any] = {
            "request": request,
            "requestID": request_id,
            "source": "inspect-ai",
            "productPillar": self.config.product_pillar,
            "title": title,
            "metadata": {
                "inspect": {
                    "sample_id": sample_id,
                    "sample_uuid": sample_uuid,
                    "epoch": epoch,
                }
            },
        }
        if self.config.model:
            body["model"] = self.config.model
        if self.config.prompt_profile:
            body["promptProfile"] = self.config.prompt_profile
        try:
            return await asyncio.wait_for(
                self._request_json(
                    "POST",
                    "/task",
                    params={
                        "directory": self.config.project_dir,
                        "init-git": "true" if self.config.init_git else "false",
                    },
                    json=body,
                    request_id=request_id,
                    timeout_seconds=remaining,
                ),
                timeout=remaining,
            )
        except asyncio.TimeoutError as error:
            raise OpenCorvusAPIError(
                method="POST",
                path="/task",
                status_code=None,
                request_id=request_id,
            ) from error

    async def task_status(self, task_id: str) -> Mapping[str, Any]:
        return await self._request_json(
            "GET", f"/task/{task_id}/status", params=self._project_params()
        )

    async def task(self, task_id: str) -> Mapping[str, Any]:
        return await self._request_json("GET", f"/task/{task_id}", params=self._project_params())

    async def task_live_cursor(
        self, task_id: str, session_id: str, previous: tuple[int, int] | None
    ) -> tuple[int, int]:
        """Read the Task-wide live clock, including unpersisted descendant deltas."""
        params = self._project_params()
        if previous is not None:
            params.update(after_live_epoch=str(previous[0]), after_live_sequence=str(previous[1]))
        result = await self._request_json(
            "GET",
            f"/task/{quote(task_id, safe='')}/conversation/session/{quote(session_id, safe='')}",
            params=params,
        )
        epoch, sequence = result.get("liveEpoch"), result.get("lastLiveSequence")
        if type(epoch) is not int or epoch <= 0 or type(sequence) is not int or sequence < 0:
            raise OpenCorvusProtocolError(
                "Task live cursor requires a positive epoch and nonnegative sequence"
            )
        # Terminal/reopened Task boundaries also clear the sequence in the same process.
        return epoch, sequence

    async def completion_part(self, task: Mapping[str, Any]) -> Mapping[str, Any]:
        decision = _mapping(task.get("completionDecision"), label="task.completionDecision")
        ids = [
            quote(_required_string(decision.get(key), label=f"completionDecision.{key}"), safe="")
            for key in ("orchestratorSessionID", "orchestratorMessageID", "toolPartID")
        ]
        return await self._request_json(
            "GET",
            f"/session/{ids[0]}/message/{ids[1]}/part/{ids[2]}",
            params=self._project_params(),
        )

    async def _within_task_deadline(
        self,
        *,
        task_id: str,
        deadline: float,
        last_status: str,
        operation: Callable[[], Awaitable[T]],
    ) -> T:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise OpenCorvusTaskTimeout(task_id, self.config.timeout_seconds, last_status)
        try:
            return await asyncio.wait_for(operation(), timeout=remaining)
        except asyncio.TimeoutError as error:
            raise OpenCorvusTaskTimeout(
                task_id, self.config.timeout_seconds, last_status
            ) from error

    async def wait_for_terminal(
        self, task_id: str, *, deadline: float | None = None
    ) -> Mapping[str, Any]:
        if deadline is None:
            deadline = time.monotonic() + self.config.timeout_seconds
        last_status = "unobserved"
        previous_cursor: tuple[int, int] | None = None
        previous_status: object = None
        while True:
            status = await self._within_task_deadline(
                task_id=task_id,
                deadline=deadline,
                last_status=last_status,
                operation=lambda: self.task_status(task_id),
            )
            last_status = _required_string(
                status.get("lifecycleStatus"), label="task.status.lifecycleStatus"
            )
            if last_status in TERMINAL_LIFECYCLES:
                return status
            if last_status != "active":
                raise OpenCorvusProtocolError(
                    f"OpenCorvus Task {task_id} returned unknown lifecycle {last_status}"
                )
            durable_status = {
                key: status.get(key)
                for key in (
                    "lifecycleStatus",
                    "time",
                    "goals",
                    "requirements",
                    "sessionInvocationTopology",
                    "executionProjection",
                )
            }
            if durable_status != previous_status:
                previous_status = durable_status
                deadline = time.monotonic() + self.config.timeout_seconds
            topology = _mapping(
                status.get("sessionInvocationTopology"), label="status.sessionInvocationTopology"
            )
            if topology.get("taskID") != task_id:
                raise OpenCorvusProtocolError("Observed Task topology identity disagrees")
            root_session_id = topology.get("rootSessionID")
            if root_session_id is not None:
                root_session_id = _required_string(root_session_id, label="topology.rootSessionID")
                cursor = await self._within_task_deadline(
                    task_id=task_id,
                    deadline=deadline,
                    last_status=last_status,
                    operation=partial(
                        self.task_live_cursor, task_id, root_session_id, previous_cursor
                    ),
                )
                # The Task clock includes live reasoning/text/Tool deltas before
                # persistence. Poll timestamps, heartbeats and other Tasks do not advance it.
                if cursor != previous_cursor:
                    previous_cursor = cursor
                    deadline = time.monotonic() + self.config.timeout_seconds
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise OpenCorvusTaskTimeout(task_id, self.config.timeout_seconds, last_status)
            await asyncio.sleep(min(self.config.poll_seconds, remaining))

    async def run_task(
        self,
        *,
        request: str,
        request_id: str,
        title: str,
        sample_id: str,
        sample_uuid: str,
        epoch: int,
    ) -> TaskResult:
        deadline = time.monotonic() + self.config.timeout_seconds
        accepted = await self.create_task(
            request=request,
            request_id=request_id,
            title=title,
            sample_id=sample_id,
            sample_uuid=sample_uuid,
            epoch=epoch,
            deadline=deadline,
        )
        task_id = _required_string(accepted.get("task_id"), label="task.create.task_id")
        project_id = _required_string(accepted.get("project_id"), label="task.create.project_id")
        directory = _required_string(accepted.get("directory"), label="task.create.directory")
        self.accepted_task = {
            "task_id": task_id,
            "project_id": project_id,
            "directory": directory,
            "request_id": request_id,
        }
        terminal_status = await self.wait_for_terminal(task_id)
        observed_lifecycle = _required_string(
            terminal_status.get("lifecycleStatus"), label="task.status.lifecycleStatus"
        )
        terminal_deadline = time.monotonic() + self.config.timeout_seconds
        task = await self._within_task_deadline(
            task_id=task_id,
            deadline=terminal_deadline,
            last_status=observed_lifecycle,
            operation=lambda: self.task(task_id),
        )
        returned_task_id = _required_string(task.get("id"), label="task.id")
        if returned_task_id != task_id:
            raise OpenCorvusProtocolError(
                f"OpenCorvus Task identity drifted from {task_id} to {returned_task_id}"
            )
        lifecycle = _required_string(task.get("status"), label="task.status")
        if lifecycle != observed_lifecycle or lifecycle not in TERMINAL_LIFECYCLES:
            raise OpenCorvusProtocolError(
                f"OpenCorvus Task {task_id} terminal projections disagree"
            )

        part = (
            await self._within_task_deadline(
                task_id=task_id,
                deadline=terminal_deadline,
                last_status=observed_lifecycle,
                operation=lambda: self.completion_part(task),
            )
            if lifecycle == "completed"
            else None
        )
        completion, completion_message_id = extract_completion(task, part)
        decision_raw = task.get("completionDecision")
        decision = _mapping(decision_raw, label="task.completionDecision") if decision_raw else None
        artifact = (
            _mapping(
                decision.get("artifactLocator"), label="task.completionDecision.artifactLocator"
            )
            if decision
            else None
        )
        accepted_ids_raw = decision.get("acceptedDeliverySliceRevisionIDs", []) if decision else []
        if not isinstance(accepted_ids_raw, list) or not all(
            isinstance(item, str) for item in accepted_ids_raw
        ):
            raise OpenCorvusProtocolError(
                "OpenCorvus Completion Decision accepted revisions must be strings"
            )
        binding_raw = task.get("packageRevisionBinding")
        binding = (
            _mapping(binding_raw, label="task.packageRevisionBinding") if binding_raw else None
        )
        return TaskResult(
            task_id=task_id,
            project_id=project_id,
            directory=directory,
            request_id=request_id,
            lifecycle_status=cast(LifecycleStatus, lifecycle),
            terminal_reason=_optional_string(task.get("terminalReason")),
            error=_optional_string(task.get("error")),
            completion=completion,
            completion_message_id=completion_message_id,
            completion_decision_artifact=artifact,
            accepted_delivery_slice_revision_ids=tuple(cast(list[str], accepted_ids_raw)),
            package_revision_binding=binding,
        )

    async def run_mission(
        self,
        *,
        request: str,
        request_id: str,
        title: str,
        sample_id: str,
        sample_uuid: str,
        epoch: int,
    ) -> MissionResult:
        """Observe the real Mission decision, including any child Task repair epoch."""
        if not self.config.model or not self.config.prompt_profile:
            raise ValueError("Mission execution requires an explicit model and Expert Squad")
        mission_text = (
            f"{request}\n\n"
            "Use the held Expert Squad for one initial business Task. Inspect its result against "
            "this original request; if it is incomplete, use the existing Mission acceptance "
            "and same-Task repair flow. Report only the actually accepted outcome."
        )
        accepted = await self._request_json(
            "POST",
            "/mission/wake",
            params={
                "directory": self.config.project_dir,
                "init-git": "true" if self.config.init_git else "false",
            },
            json={
                "requestID": request_id,
                "productPillar": self.config.product_pillar,
                "text": mission_text,
                "model": self.config.model,
                "expertSquadIDs": [self.config.prompt_profile],
            },
            request_id=request_id,
        )
        mission_id = _required_string(accepted.get("missionID"), label="mission.wake.missionID")
        session_id = _required_string(accepted.get("sessionID"), label="mission.wake.sessionID")
        self.accepted_task = {
            "mission_id": mission_id,
            "session_id": session_id,
            "request_id": request_id,
        }
        try:
            deadline = time.monotonic() + self.config.timeout_seconds
            last_lane = "unobserved"
            previous_activity: str | None = None
            while True:
                records = await self._request_list("GET", "/mission")
                matching = [item for item in records if item.get("missionID") == mission_id]
                if len(matching) != 1:
                    raise OpenCorvusProtocolError(
                        f"Mission list must identify one current Mission {mission_id}; "
                        f"found {len(matching)}"
                    )
                record = matching[0]
                if record.get("missionID") != mission_id or record.get("sessionID") != session_id:
                    raise OpenCorvusProtocolError("Mission identity changed during observation")
                directory = _required_string(record.get("directory"), label="mission.directory")
                if _directory_key(directory) != _directory_key(self.config.project_dir):
                    raise OpenCorvusProtocolError("Mission directory changed during observation")
                last_lane = _required_string(record.get("boardLane"), label="mission.boardLane")
                tasks = record.get("tasks")
                if not isinstance(tasks, list):
                    raise OpenCorvusProtocolError("Mission tasks must be an array")
                outcome = record.get("outcome")
                if (
                    outcome is not None
                    and last_lane in {"completed", "attention"}
                    and record.get("interruptible") is False
                ):
                    decision = _mapping(outcome, label="mission.outcome")
                    outcome_kind = _required_string(
                        decision.get("kind"), label="mission.outcome.kind"
                    )
                    if outcome_kind not in {"accepted", "blocked"} or last_lane != (
                        "completed" if outcome_kind == "accepted" else "attention"
                    ):
                        raise OpenCorvusProtocolError(
                            "Mission board lane and outcome kind disagree"
                        )
                    if len(tasks) != 1:
                        raise OpenCorvusProtocolError(
                            "Mission trial requires one initial business Task; "
                            f"observed {len(tasks)}"
                        )
                    task_row = _mapping(tasks[0], label="mission.tasks[0]")
                    task_id = _required_string(task_row.get("id"), label="mission.task.id")
                    if (
                        task_row.get("lifecycleStatus")
                        != ("completed" if outcome_kind == "accepted" else "failed")
                        or task_row.get("source") != "mission"
                    ):
                        raise OpenCorvusProtocolError(
                            "Mission outcome lacks its exact terminal Mission-owned Task"
                        )
                    task = await self.task(task_id)
                    binding = _mapping(
                        task.get("packageRevisionBinding"),
                        label="mission.task.packageRevisionBinding",
                    )
                    message_id = _required_string(
                        decision.get("messageID"), label="mission.outcome.messageID"
                    )
                    summary = _required_string(
                        decision.get("summary"), label="mission.outcome.summary"
                    )
                    return MissionResult(
                        mission_id=mission_id,
                        session_id=session_id,
                        task_id=task_id,
                        request_id=request_id,
                        completion=summary,
                        outcome_kind=outcome_kind,
                        outcome_message_id=message_id,
                        package_revision_binding=binding,
                    )
                activity = await self._request_json(
                    "GET",
                    f"/mission/{quote(mission_id, safe='')}/activity-cursor",
                    params=self._project_params(),
                )
                if (
                    activity.get("mission_id") != mission_id
                    or activity.get("session_id") != session_id
                ):
                    raise OpenCorvusProtocolError(
                        "Mission activity scope changed during observation"
                    )
                digest = _required_string(
                    activity.get("activity_sha256"), label="mission.activity_sha256"
                )
                if digest != previous_activity:
                    previous_activity = digest
                    deadline = time.monotonic() + self.config.timeout_seconds
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise OpenCorvusMissionTimeout(
                        mission_id, self.config.timeout_seconds, last_lane
                    )
                await asyncio.sleep(min(self.config.poll_seconds, remaining))
        except BaseException:
            if last_lane != "completed":
                try:
                    await self._request_json(
                        "POST",
                        f"/mission/{quote(mission_id, safe='')}/abort",
                        params=self._project_params(),
                        json={
                            "surface": "api",
                            "reason": (
                                "Inspect Mission observation ended before "
                                "accepted completion"
                            ),
                        },
                        request_id=f"{request_id}:observation-cleanup",
                        timeout_seconds=30,
                    )
                    self.accepted_task["cleanup"] = "mission_abort_accepted"
                except Exception as cleanup_error:
                    self.accepted_task["cleanup"] = type(cleanup_error).__name__
            raise
