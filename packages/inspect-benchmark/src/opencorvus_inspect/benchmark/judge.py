"""One Inspect-owned model-judge boundary with no model fallback."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from inspect_ai.model import GenerateConfig, get_model

from .definition import JudgePolicy


class JudgeUnavailableError(RuntimeError):
    """The frozen judge could not produce a scoreable observation."""


@dataclass(frozen=True)
class JudgeCompletion:
    text: str
    model: str


class Judge(Protocol):
    async def complete(self, prompt: str, policy: JudgePolicy) -> JudgeCompletion: ...


class InspectModelJudge:
    """Execute one explicit judge model through Inspect's recorded model API."""

    async def complete(self, prompt: str, policy: JudgePolicy) -> JudgeCompletion:
        try:
            model_args: dict[str, Any] = policy.model_kwargs()
            model = get_model(policy.model, required=True, **model_args)
            output = await model.generate(
                prompt,
                config=GenerateConfig(
                    max_tokens=policy.max_tokens,
                    max_retries=0,
                    fallback_models=[],
                    reasoning_effort=policy.reasoning_effort,
                ),
            )
            completion = output.completion.strip()
            if not completion:
                raise JudgeUnavailableError(f"Judge {policy.model!r} returned an empty completion")
            return JudgeCompletion(text=completion, model=policy.model)
        except JudgeUnavailableError:
            raise
        except Exception as error:
            raise JudgeUnavailableError(
                f"Judge {policy.model!r} failed with {type(error).__name__}"
            ) from error
