"""Apodex-derived text benchmark definitions and Inspect scorers.

Adapted from ApodexAI/FrontierAgent commit
3364b7a51b5b235d6de10f692160980bfb7544e9 under Apache-2.0. OpenCorvus
changes the execution boundary to Inspect AI and does not import FrontierAgent's
runner, Agent runtime, sandbox, result store, or Provider client.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal, cast

from inspect_ai.scorer import (
    CORRECT,
    INCORRECT,
    Score,
    Scorer,
    Target,
)
from inspect_ai.solver import TaskState

from .definition import (
    BenchmarkDefinition,
    DatasetSchema,
    JudgePolicy,
    SourceProvenance,
)
from .judge import InspectModelJudge, Judge, JudgeUnavailableError

APODEX_REVISION = "3364b7a51b5b235d6de10f692160980bfb7544e9"
APODEX_SHORT_REVISION = APODEX_REVISION[:7]

JUDGE_PROMPT_FRONTIER_SCIENCE_RESEARCH = """You are grading a science exam. You will be given the problem, attempted answer, and a rubric to grade the answer. The rubric will total up to 10 points. Evaluate the attempted answer against the provided rubric. Pay close attention to detail and grade it strictly, but fairly. Only evaluate against the rubric, as you yourself should not make any judgements (e.g., even if you think the answer is correct but rubric is wrong, you should treat the rubric as the gold standard). Return the absolute total number of points earned (it can be a decimal based on the rubric). First, think step-by-step about each rubric item. Explain your reasoning for each rubric item. Then, tally the points up and write VERDICT: {{total_points}} in the last line of your response, no other text. For example, VERDICT: 2.5 or VERDICT: 8.

Problem:
{question}

Rubric:
{rubric}

Attempted Answer:
{answer}""".strip()

JUDGE_PROMPT_FRONTIER_SCIENCE_OLYMPIAD = (
    "You are grading an attempted answer to a science olympiad problem. "
    "You will be given the problem, attempted answer, and reference answer. "
    "Evaluate the solution against the provided reference solution, ensuring "
    "it is complete and matches the reference solution. Pay close attention "
    "to detail and grade it strictly, but fairly.\n\n"
    "The reference answer is either a single number or expression in latex "
    "formatting, a chemical formula, a compound name, or a phrase referring "
    "to a specific name, entity, or method.\n\n"
    "Mark the attempted answer as correct if it fully matches the reference "
    "answer or is otherwise equivalent (e.g., an equivalent algebraic "
    "expression, a numerical number within 1 decimal place rounding of the "
    "reference answer (e.g., 6.69 ≈ 6.7), an equivalent name for a "
    "compound/formula, equivalent when accounting for units, etc.). Mark it "
    "as incorrect if it is not equivalent to the reference answer.\n"
    "***\n"
    "The problem: {question}\n"
    "***\n"
    "The reference answer: {target}\n"
    "***\n"
    "The attempted answer: {answer}\n"
    "***\n"
    "First, think step-by-step about whether the attempted answer matches "
    "the reference answer. If the attempted answer is correct, write "
    '"VERDICT: CORRECT" in the last line of your response, with no other '
    'text or formatting. If it is incorrect, write "VERDICT: INCORRECT".'
)

JUDGE_PROMPT_BROWSECOMP = """Judge whether the following [response] to [question] is correct or not based on the precise and unambiguous [correct_answer] below.

[question]: {question}

[response]: {answer}

Your judgement must be in the format and criteria specified below:

extracted_final_answer: The final exact answer extracted from the [response]. Put the extracted answer as 'None' if there is no exact, final answer to extract from the response.

[correct_answer]: {target}

reasoning: Explain why the extracted_final_answer is correct or incorrect based on [correct_answer], focusing only on if there are meaningful differences between [correct_answer] and the extracted_final_answer. Do not comment on any background to the problem, do not attempt to solve the problem, do not argue for any answer different than [correct_answer], focus only on whether the answers match.

correct: Answer 'yes' if extracted_final_answer matches the [correct_answer] given above, or is within a small margin of error for numerical problems. Answer 'no' otherwise, i.e. if there if there is any inconsistency, ambiguity, non-equivalency, or if the extracted answer is incorrect.

confidence: The extracted confidence score between 0|\\%| and 100|\\%| from [response]. Put 100 if there is no confidence score available."""

Verdict = Literal["CORRECT", "INCORRECT"]


@dataclass(frozen=True)
class ParsedJudgeResult:
    verdict: Verdict
    raw_points: float | None = None


def parse_frontier_science_research(output: str) -> ParsedJudgeResult:
    """Parse Apodex's rubric verdict and apply its 7/10 pass threshold."""

    match = re.search(r"VERDICT:\s*(\d+(?:\.\d+)?)", output)
    if match is None:
        raise JudgeUnavailableError("FrontierScience Research judge output has no numeric VERDICT")
    points = float(match.group(1))
    return ParsedJudgeResult("CORRECT" if points >= 7.0 else "INCORRECT", points)


def parse_frontier_science_olympiad(output: str) -> ParsedJudgeResult:
    """Parse the final Apodex Olympiad verdict line."""

    for line in reversed(output.splitlines()):
        normalized = line.strip().upper()
        if "VERDICT" not in normalized:
            continue
        if "INCORRECT" in normalized:
            return ParsedJudgeResult("INCORRECT")
        if "CORRECT" in normalized:
            return ParsedJudgeResult("CORRECT")
    raise JudgeUnavailableError("FrontierScience Olympiad judge output has no verdict")


def parse_browsecomp(output: str) -> ParsedJudgeResult:
    """Parse the published BrowseComp `correct: yes|no` field."""

    match = re.search(r"correct\s*:\s*(yes|no)\b", output, re.IGNORECASE)
    if match is None:
        raise JudgeUnavailableError("BrowseComp judge output has no correct: yes|no field")
    return ParsedJudgeResult("CORRECT" if match.group(1).lower() == "yes" else "INCORRECT")


ResultParser = Callable[[str], ParsedJudgeResult]


def _quality_scorer(
    *,
    definition: BenchmarkDefinition,
    prompt_template: str,
    parser: ResultParser,
    judge_model: str | None,
    judge: Judge | None,
) -> Scorer:
    selected_policy = definition.judge.select(judge_model)
    selected_judge = judge or InspectModelJudge()

    async def score(state: TaskState, target: Target) -> Score:
        predicted = state.output.completion.strip()
        judge_metadata = definition.judge.metadata(model_override=judge_model)
        common_metadata: dict[str, object] = {
            "benchmark_id": definition.id,
            "scorer_revision": definition.scorer_revision,
            "judge_model": selected_policy.model,
            "official_judge_model": definition.judge.official_model,
            "official_model_pin_match": judge_metadata["official_model_pin_match"],
            "official_route_pin_match": judge_metadata["official_route_pin_match"],
            "upstream_execution_policy_match": judge_metadata["upstream_execution_policy_match"],
            "official_protocol_match": judge_metadata["official_protocol_match"],
            "execution_policy_revision": selected_policy.execution_policy_revision,
            "source_revision": definition.provenance.revision,
            "scoring_status": "scored",
        }
        if not predicted:
            if definition.id.startswith("apodex/frontier-science-research"):
                common_metadata["raw_points"] = 0.0
            return Score(
                value=INCORRECT,
                answer=predicted,
                explanation="The system under test returned no final answer.",
                metadata=common_metadata,
            )

        prompt = prompt_template.format(
            question=state.input_text,
            rubric=target.text,
            target=target.text,
            answer=predicted,
        )
        try:
            completion = await selected_judge.complete(prompt, selected_policy)
            parsed = parser(completion.text)
        except JudgeUnavailableError as error:
            common_metadata["scoring_status"] = "unavailable"
            common_metadata["reason_code"] = "judge_unavailable"
            return Score.unscored(
                answer=predicted,
                explanation=str(error),
                metadata=common_metadata,
            )
        if parsed.raw_points is not None:
            common_metadata["raw_points"] = parsed.raw_points
        return Score(
            value=CORRECT if parsed.verdict == "CORRECT" else INCORRECT,
            answer=predicted,
            explanation=(
                f"{definition.name} judge returned {parsed.verdict} using {completion.model}."
            ),
            metadata=common_metadata,
        )

    return cast(Scorer, score)


def _research_factory(
    *,
    definition: BenchmarkDefinition,
    judge_model: str | None = None,
    judge: Judge | None = None,
) -> Scorer:
    return _quality_scorer(
        definition=definition,
        prompt_template=JUDGE_PROMPT_FRONTIER_SCIENCE_RESEARCH,
        parser=parse_frontier_science_research,
        judge_model=judge_model,
        judge=judge,
    )


def _olympiad_factory(
    *,
    definition: BenchmarkDefinition,
    judge_model: str | None = None,
    judge: Judge | None = None,
) -> Scorer:
    return _quality_scorer(
        definition=definition,
        prompt_template=JUDGE_PROMPT_FRONTIER_SCIENCE_OLYMPIAD,
        parser=parse_frontier_science_olympiad,
        judge_model=judge_model,
        judge=judge,
    )


def _browsecomp_factory(
    *,
    definition: BenchmarkDefinition,
    judge_model: str | None = None,
    judge: Judge | None = None,
) -> Scorer:
    return _quality_scorer(
        definition=definition,
        prompt_template=JUDGE_PROMPT_BROWSECOMP,
        parser=parse_browsecomp,
        judge_model=judge_model,
        judge=judge,
    )


_STANDARD_DATASET = DatasetSchema(
    id_field="task_id",
    input_field="task_question",
    target_field="ground_truth",
    metadata_fields=("subject", "category"),
)


def _source(path: str) -> SourceProvenance:
    return SourceProvenance(
        project="ApodexAI/FrontierAgent",
        revision=APODEX_REVISION,
        path=path,
        code_license="Apache-2.0",
    )


FRONTIER_SCIENCE_RESEARCH = BenchmarkDefinition(
    id=f"apodex/frontier-science-research@{APODEX_SHORT_REVISION}",
    name="FrontierScience Research",
    schema_version=1,
    scorer_revision=(f"opencorvus-inspect:v1:apodex:{APODEX_REVISION}:frontier-science-research"),
    provenance=_source("benchmarks/public/judges/frontier_science.py"),
    dataset=_STANDARD_DATASET,
    judge=JudgePolicy(
        model="openai-api/judge/gpt-5",
        official_model="openai/gpt-5",
        max_tokens=65536,
        streaming_argument="stream",
        reasoning_effort="high",
        model_args=(("base_url", "https://api.openai.com/v1"),),
        official_base_url="https://api.openai.com/v1",
    ),
    scorer_key="apodex/frontier-science-research",
)

FRONTIER_SCIENCE_OLYMPIAD = BenchmarkDefinition(
    id=f"apodex/frontier-science-olympiad@{APODEX_SHORT_REVISION}",
    name="FrontierScience Olympiad",
    schema_version=1,
    scorer_revision=(f"opencorvus-inspect:v1:apodex:{APODEX_REVISION}:frontier-science-olympiad"),
    provenance=_source("benchmarks/public/judges/frontier_science.py"),
    dataset=_STANDARD_DATASET,
    judge=JudgePolicy(
        model="openai-api/judge/gpt-5",
        official_model="openai/gpt-5",
        max_tokens=32768,
        streaming_argument="stream",
        reasoning_effort="high",
        model_args=(("base_url", "https://api.openai.com/v1"),),
        official_base_url="https://api.openai.com/v1",
    ),
    scorer_key="apodex/frontier-science-olympiad",
)

BROWSECOMP = BenchmarkDefinition(
    id=f"apodex/browsecomp@{APODEX_SHORT_REVISION}",
    name="BrowseComp",
    schema_version=1,
    scorer_revision=f"opencorvus-inspect:v1:apodex:{APODEX_REVISION}:browsecomp",
    provenance=_source("benchmarks/public/judges/browsecomp.py"),
    dataset=_STANDARD_DATASET,
    judge=JudgePolicy(
        model="openai-api/judge/gpt-4.1-2025-04-14",
        official_model="gpt-4.1-2025-04-14",
        max_tokens=16384,
        streaming_argument="stream",
        model_args=(("base_url", "https://api.openai.com/v1"),),
        official_base_url="https://api.openai.com/v1",
    ),
    scorer_key="apodex/browsecomp",
)

APODEX_BENCHMARKS = (
    FRONTIER_SCIENCE_RESEARCH,
    FRONTIER_SCIENCE_OLYMPIAD,
    BROWSECOMP,
)

APODEX_SCORERS = (
    ("apodex/frontier-science-research", _research_factory),
    ("apodex/frontier-science-olympiad", _olympiad_factory),
    ("apodex/browsecomp", _browsecomp_factory),
)


__all__ = [
    "APODEX_REVISION",
    "APODEX_BENCHMARKS",
    "APODEX_SCORERS",
    "BROWSECOMP",
    "FRONTIER_SCIENCE_OLYMPIAD",
    "FRONTIER_SCIENCE_RESEARCH",
    "JUDGE_PROMPT_BROWSECOMP",
    "JUDGE_PROMPT_FRONTIER_SCIENCE_OLYMPIAD",
    "JUDGE_PROMPT_FRONTIER_SCIENCE_RESEARCH",
    "ParsedJudgeResult",
    "parse_browsecomp",
    "parse_frontier_science_olympiad",
    "parse_frontier_science_research",
]
