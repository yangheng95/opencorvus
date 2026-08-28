from __future__ import annotations

import json
from dataclasses import replace
from typing import Any, cast

import pytest
from inspect_ai.model import GenerateConfig, ModelOutput, get_model

from opencorvus_inspect.benchmark.apodex import BROWSECOMP
from opencorvus_inspect.benchmark.judge import InspectModelJudge, JudgeUnavailableError


def test_frozen_judge_route_wins_over_service_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("JUDGE_API_KEY", "test-only-placeholder")
    monkeypatch.setenv("JUDGE_BASE_URL", "https://override.invalid/v1")

    model = get_model(
        BROWSECOMP.judge.model,
        required=True,
        base_url="https://api.openai.com/v1",
        stream=True,
    )

    api = cast(Any, model.api)
    assert api.base_url == "https://api.openai.com/v1"
    assert api.stream is True


def test_judge_provenance_hashes_transport_values_and_rejects_credential_urls() -> None:
    metadata = BROWSECOMP.judge.metadata()

    assert metadata["transport"] == BROWSECOMP.judge.transport_metadata()
    assert "https://api.openai.com/v1" not in json.dumps(metadata)
    with pytest.raises(ValueError, match="credential-free"):
        replace(
            BROWSECOMP.judge,
            model_args=(("base_url", "https://user:secret@example.invalid/v1?token=value"),),
        )


@pytest.mark.asyncio
async def test_inspect_judge_forces_declared_streaming_transport(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    class Model:
        async def generate(self, prompt: str, *, config: GenerateConfig) -> ModelOutput:
            captured["prompt"] = prompt
            captured["config"] = config
            return ModelOutput.from_content(model="judge", content="correct: yes")

    def get_model(model: str, **kwargs: Any) -> Model:
        captured["model"] = model
        captured["model_kwargs"] = kwargs
        return Model()

    monkeypatch.setattr("opencorvus_inspect.benchmark.judge.get_model", get_model)

    result = await InspectModelJudge().complete("grade this", BROWSECOMP.judge)

    assert result.text == "correct: yes"
    assert result.model == BROWSECOMP.judge.model
    assert captured["model"] == "openai-api/judge/gpt-4.1-2025-04-14"
    assert captured["model_kwargs"] == {
        "required": True,
        "base_url": "https://api.openai.com/v1",
        "stream": True,
    }
    config = captured["config"]
    assert config.max_retries == 0
    assert config.fallback_models == []


@pytest.mark.asyncio
async def test_inspect_judge_maps_generation_failure_to_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class Model:
        async def generate(self, _prompt: str, *, config: GenerateConfig) -> ModelOutput:
            del config
            raise RuntimeError("transport failed")

    monkeypatch.setattr(
        "opencorvus_inspect.benchmark.judge.get_model",
        lambda *_args, **_kwargs: Model(),
    )

    with pytest.raises(JudgeUnavailableError, match="failed with RuntimeError"):
        await InspectModelJudge().complete("grade this", BROWSECOMP.judge)
