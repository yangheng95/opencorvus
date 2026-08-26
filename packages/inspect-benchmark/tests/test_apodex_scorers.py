from __future__ import annotations

from dataclasses import dataclass, field

import pytest
from inspect_ai.model import ChatMessageUser, ModelOutput
from inspect_ai.scorer import Target
from inspect_ai.solver import TaskState

from opencorvus_inspect.benchmark.apodex import (
    BROWSECOMP,
    FRONTIER_SCIENCE_OLYMPIAD,
    FRONTIER_SCIENCE_RESEARCH,
    parse_browsecomp,
    parse_frontier_science_olympiad,
    parse_frontier_science_research,
)
from opencorvus_inspect.benchmark.definition import BenchmarkDefinition, JudgePolicy
from opencorvus_inspect.benchmark.judge import JudgeCompletion
from opencorvus_inspect.benchmark.scoring import build_benchmark_scorer


@dataclass
class StaticJudge:
    response: str
    prompts: list[str] = field(default_factory=list)
    policies: list[JudgePolicy] = field(default_factory=list)

    async def complete(self, prompt: str, policy: JudgePolicy) -> JudgeCompletion:
        self.prompts.append(prompt)
        self.policies.append(policy)
        return JudgeCompletion(text=self.response, model=policy.model)


def _state(answer: str) -> TaskState:
    state = TaskState(
        model="none",  # type: ignore[arg-type]
        sample_id="sample-1",
        epoch=1,
        input="What is the supported conclusion?",
        messages=[ChatMessageUser(content="What is the supported conclusion?")],
        target=Target("The reference or rubric."),
        sample_uuid="sample-uuid",
    )
    state.output = ModelOutput.from_content(model="opencorvus/task", content=answer)
    return state


def test_apodex_parsers_accept_published_output_contracts() -> None:
    assert parse_frontier_science_research("analysis\nVERDICT: 8.5").raw_points == 8.5
    assert parse_frontier_science_olympiad("analysis\nVERDICT: CORRECT").verdict == "CORRECT"
    assert parse_browsecomp("extracted_final_answer: X\ncorrect: no").verdict == "INCORRECT"


@pytest.mark.asyncio
async def test_frontier_science_scorer_preserves_points_and_provenance() -> None:
    judge = StaticJudge("rubric analysis\nVERDICT: 7.5")
    score_fn = build_benchmark_scorer(
        FRONTIER_SCIENCE_RESEARCH,
        judge=judge,
    )

    result = await score_fn(_state("A supported answer."), Target("Ten-point rubric."))

    assert result is not None
    assert result.value == "C"
    assert result.metadata == {
        "benchmark_id": FRONTIER_SCIENCE_RESEARCH.id,
        "scorer_revision": FRONTIER_SCIENCE_RESEARCH.scorer_revision,
        "judge_model": "openai-api/judge/gpt-5",
        "official_judge_model": "openai/gpt-5",
        "official_model_pin_match": True,
        "official_route_pin_match": True,
        "upstream_execution_policy_match": False,
        "official_protocol_match": False,
        "execution_policy_revision": "opencorvus-inspect/judge-no-retry-v1",
        "source_revision": FRONTIER_SCIENCE_RESEARCH.provenance.revision,
        "scoring_status": "scored",
        "raw_points": 7.5,
    }
    assert "Ten-point rubric." in judge.prompts[0]
    assert judge.policies == [FRONTIER_SCIENCE_RESEARCH.judge]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("definition", "judge_output", "target", "expected"),
    [
        (
            FRONTIER_SCIENCE_OLYMPIAD,
            "comparison\nVERDICT: CORRECT",
            "Equivalent expression",
            "C",
        ),
        (BROWSECOMP, "extracted_final_answer: item\ncorrect: no", "gold item", "I"),
    ],
)
async def test_binary_apodex_scorers_emit_inspect_quality_scores(
    definition: BenchmarkDefinition,
    judge_output: str,
    target: str,
    expected: str,
) -> None:
    judge = StaticJudge(judge_output)
    score_fn = build_benchmark_scorer(definition, judge=judge)

    result = await score_fn(_state("Agent answer"), Target(target))

    assert result is not None
    assert result.metadata is not None
    assert result.value == expected
    assert result.metadata["benchmark_id"] == definition.id
