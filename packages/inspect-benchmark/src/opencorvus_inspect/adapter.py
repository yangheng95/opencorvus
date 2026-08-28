"""Thin asynchronous client for the public OpenCorvus Task lifecycle."""

from __future__ import annotations

import asyncio
import os
import time
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from typing import Any, Literal, TypeVar, cast
from urllib.parse import urlsplit

import httpx

LifecycleStatus = Literal["active", "completed", "failed", "cancelled"]
ProductPillar = Literal["code", "work"]
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
    """The adapter observation window ended before Task terminal state."""

    def __init__(self, task_id: str, timeout_seconds: float, last_status: str) -> None:
        super().__init__(
            f"OpenCorvus Task {task_id} did not reach terminal state within "
            f"{timeout_seconds:g}s; last lifecycle={last_status}"
        )
        self.task_id = task_id
        self.timeout_seconds = timeout_seconds
        self.last_status = last_status


def _environment(name: str) -> str | None:
    value = os.environ.get(name)
    return value.strip() if value and value.strip() else None


def _positive_float(value: float | str | None, *, name: str, default: float) -> float:
    resolved = default if value is None else float(value)
    if resolved <= 0:
        raise ValueError(f"{name} must be greater than zero")
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


def _visible_text(message: Mapping[str, Any]) -> str:
    parts = message.get("parts")
    if not isinstance(parts, list):
        return ""
    texts: list[str] = []
    for part in parts:
        if not isinstance(part, Mapping) or part.get("type") != "text":
            continue
        text = part.get("text")
        if isinstance(text, str) and text.strip():
            texts.append(text.strip())
    return "\n\n".join(texts)


def _message_identity(message: Mapping[str, Any]) -> str | None:
    info = message.get("info")
    return _optional_string(info.get("id")) if isinstance(info, Mapping) else None


def _assistant_messages(conversation: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    transcript = conversation.get("transcript")
    if not isinstance(transcript, list):
        raise OpenCorvusProtocolError("OpenCorvus conversation transcript must be an array")
    result: list[Mapping[str, Any]] = []
    for raw in transcript:
        if not isinstance(raw, Mapping):
            continue
        info = raw.get("info")
        if isinstance(info, Mapping) and info.get("role") == "assistant" and _visible_text(raw):
            result.append(cast(Mapping[str, Any], raw))
    return result


def extract_completion(
    task: Mapping[str, Any], conversation: Mapping[str, Any]
) -> tuple[str, str | None]:
    """Resolve the canonical completed Message, with a terminal-failure fallback."""

    lifecycle = _required_string(task.get("status"), label="task.status")
    assistants = _assistant_messages(conversation)
    decision = task.get("completionDecision")
    if lifecycle == "completed":
        decision_map = _mapping(decision, label="task.completionDecision")
        message_id = _required_string(
            decision_map.get("orchestratorMessageID"),
            label="task.completionDecision.orchestratorMessageID",
        )
        for message in assistants:
            if _message_identity(message) == message_id:
                text = _visible_text(message)
                if text:
                    return text, message_id
        raise OpenCorvusProtocolError(
            f"OpenCorvus Completion Decision Message {message_id} "
            "has no visible text in conversation"
        )

    root_session_id = _optional_string(task.get("sessionID"))
    preferred: list[Mapping[str, Any]] = []
    if root_session_id:
        for message in assistants:
            info = message.get("info")
            if isinstance(info, Mapping) and info.get("sessionID") == root_session_id:
                preferred.append(message)
    selected = (preferred or assistants)[-1] if preferred or assistants else None
    if selected is not None:
        return _visible_text(selected), _message_identity(selected)
    fallback = _optional_string(task.get("error")) or _optional_string(task.get("terminalReason"))
    return fallback or f"OpenCorvus Task ended with lifecycle {lifecycle}", None


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


class OpenCorvusClient:
    """Call OpenCorvus through its public project-scoped Task API."""

    def __init__(
        self,
        config: AdapterConfig,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.config = config
        password = _environment("OPENCORVUS_SERVER_PASSWORD")
        username = _environment("OPENCORVUS_SERVER_USERNAME") or "opencorvus"
        auth = httpx.BasicAuth(username, password) if password else None
        self._client = httpx.AsyncClient(
            base_url=config.base_url,
            auth=auth,
            transport=transport,
            timeout=httpx.Timeout(30, connect=10),
        )

    async def __aenter__(self) -> OpenCorvusClient:
        return self

    async def __aexit__(self, *_error: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        await self._client.aclose()

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
        return _mapping(payload, label=f"{method} {path} response")

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

    async def conversation(self, task_id: str) -> Mapping[str, Any]:
        return await self._request_json(
            "GET",
            f"/task/{task_id}/conversation",
            params={"directory": self.config.project_dir, "tail_limit": "200"},
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
        terminal_status = await self.wait_for_terminal(task_id, deadline=deadline)
        observed_lifecycle = _required_string(
            terminal_status.get("lifecycleStatus"), label="task.status.lifecycleStatus"
        )
        task, conversation = await self._within_task_deadline(
            task_id=task_id,
            deadline=deadline,
            last_status=observed_lifecycle,
            operation=lambda: asyncio.gather(self.task(task_id), self.conversation(task_id)),
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

        completion, completion_message_id = extract_completion(task, conversation)
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
