"""Immutable benchmark definition contracts."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, replace
from typing import TYPE_CHECKING, Literal, Protocol, TypeAlias
from urllib.parse import urlsplit

from inspect_ai.scorer import Scorer

if TYPE_CHECKING:
    from .judge import Judge

SourceFormat = Literal["json", "jsonl"]
ReasoningEffort = Literal["none", "minimal", "low", "medium", "high", "xhigh", "max"]
StreamingArgument = Literal["stream", "streaming"]
ModelArgumentValue: TypeAlias = str | int | float | bool


@dataclass(frozen=True)
class SourceProvenance:
    """Exact upstream source identity for a benchmark definition."""

    project: str
    revision: str
    path: str
    code_license: str

    def metadata(self) -> dict[str, str]:
        return {
            "project": self.project,
            "revision": self.revision,
            "path": self.path,
            "code_license": self.code_license,
        }


@dataclass(frozen=True)
class DatasetSchema:
    """JSON field mapping and public metadata projection for one dataset family."""

    id_field: str
    input_field: str
    target_field: str
    metadata_fields: tuple[str, ...] = ()
    source_formats: frozenset[SourceFormat] = frozenset(("json", "jsonl"))
    allow_empty_target: bool = False


@dataclass(frozen=True)
class JudgePolicy:
    """One frozen streaming judge configuration with no fallback model."""

    model: str
    official_model: str
    max_tokens: int
    streaming_argument: StreamingArgument
    reasoning_effort: ReasoningEffort | None = None
    model_args: tuple[tuple[str, ModelArgumentValue], ...] = ()
    official_base_url: str | None = None
    execution_policy_revision: str = "opencorvus-inspect/judge-no-retry-v1"
    upstream_execution_policy_match: bool = False

    def __post_init__(self) -> None:
        if not self.model.strip() or not self.official_model.strip():
            raise ValueError("judge model identities must not be empty")
        if self.max_tokens <= 0:
            raise ValueError("judge max_tokens must be greater than zero")
        sensitive_fragments = ("api_key", "authorization", "password", "secret", "token")
        keys = [key for key, _value in self.model_args]
        if len(keys) != len(set(keys)):
            raise ValueError("judge model argument keys must be unique")
        for key, _value in self.model_args:
            if any(fragment in key.lower() for fragment in sensitive_fragments):
                raise ValueError(f"judge model argument {key!r} must not contain credentials")
        for key, value in self.model_args:
            if key.lower() not in {"base_url", "service_base_url"}:
                continue
            if not isinstance(value, str):
                raise ValueError(f"judge model argument {key!r} must be an absolute HTTP(S) URL")
            parsed = urlsplit(value)
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.netloc
                or parsed.username is not None
                or parsed.password is not None
                or parsed.query
                or parsed.fragment
            ):
                raise ValueError(
                    f"judge model argument {key!r} must be an absolute credential-free "
                    "HTTP(S) URL without query or fragment"
                )

    def model_kwargs(self) -> dict[str, ModelArgumentValue]:
        return dict(self.model_args) | {self.streaming_argument: True}

    def transport_metadata(self) -> dict[str, object]:
        """Return a secret-safe identity for persisted transport provenance."""

        model_args = self.model_kwargs()
        base_url = model_args.get("base_url") or model_args.get("service_base_url")
        return {
            "argument_keys": tuple(sorted(model_args)),
            "base_url_sha256": (
                hashlib.sha256(base_url.encode("utf-8")).hexdigest()
                if isinstance(base_url, str)
                else None
            ),
        }

    def select(self, model_override: str | None) -> JudgePolicy:
        if model_override is None:
            return self
        route_prefix = self.model.rpartition("/")[0] + "/"
        if not model_override.startswith(route_prefix):
            raise ValueError(
                f"judge_model override must use the frozen {route_prefix!r} transport; "
                "register a new benchmark definition for another Provider or service"
            )
        return replace(self, model=model_override)

    def metadata(self, *, model_override: str | None = None) -> dict[str, object]:
        selected = self.select(model_override)
        model_pin_match = selected.model == self.model
        route_pin_match = selected.model_kwargs().get("base_url") == self.official_base_url
        return {
            "model": selected.model,
            "official_model": self.official_model,
            "official_model_pin_match": model_pin_match,
            "official_route_pin_match": route_pin_match,
            "upstream_execution_policy_match": self.upstream_execution_policy_match,
            "official_protocol_match": (
                model_pin_match and route_pin_match and self.upstream_execution_policy_match
            ),
            "execution_policy_revision": self.execution_policy_revision,
            "max_tokens": selected.max_tokens,
            "reasoning_effort": selected.reasoning_effort,
            "streaming": True,
            "transport": selected.transport_metadata(),
        }


class BenchmarkScorerFactory(Protocol):
    """Construct the quality scorer declared by a benchmark definition."""

    def __call__(
        self,
        *,
        definition: BenchmarkDefinition,
        judge_model: str | None = None,
        judge: Judge | None = None,
    ) -> Scorer: ...


@dataclass(frozen=True)
class BenchmarkDefinition:
    """The complete immutable meaning of one benchmark revision."""

    id: str
    name: str
    schema_version: int
    scorer_revision: str
    provenance: SourceProvenance
    dataset: DatasetSchema
    judge: JudgePolicy
    scorer_key: str

    def metadata(self, *, judge_model: str | None = None) -> dict[str, object]:
        return {
            "id": self.id,
            "name": self.name,
            "schema_version": self.schema_version,
            "scorer_key": self.scorer_key,
            "scorer_revision": self.scorer_revision,
            "source": self.provenance.metadata(),
            "judge": self.judge.metadata(model_override=judge_model),
        }
