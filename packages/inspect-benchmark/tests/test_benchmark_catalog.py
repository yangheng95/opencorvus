from __future__ import annotations

from dataclasses import replace

import pytest

from opencorvus_inspect.benchmark import catalog
from opencorvus_inspect.benchmark.apodex import APODEX_REVISION, BROWSECOMP
from opencorvus_inspect.benchmark.catalog import (
    BENCHMARKS,
    BenchmarkRegistry,
    register_benchmark,
)
from opencorvus_inspect.benchmark.scoring import SCORERS, BenchmarkScorerRegistry


def test_builtin_catalog_resolves_frozen_apodex_definitions() -> None:
    assert BENCHMARKS.ids() == (
        "apodex/browsecomp@3364b7a",
        "apodex/frontier-science-olympiad@3364b7a",
        "apodex/frontier-science-research@3364b7a",
    )
    definition = BENCHMARKS.resolve("apodex/browsecomp@3364b7a")
    assert definition.provenance.revision == APODEX_REVISION
    assert definition.provenance.code_license == "Apache-2.0"
    assert definition.judge.model == "openai-api/judge/gpt-4.1-2025-04-14"
    assert definition.judge.official_model == "gpt-4.1-2025-04-14"
    assert definition.judge.model_kwargs()["stream"] is True
    assert SCORERS.resolve(definition.scorer_key) is not None


def test_registry_accepts_a_new_unique_definition() -> None:
    registry = BenchmarkRegistry(scorer_keys=SCORERS.keys)
    registry.register(BROWSECOMP)

    assert registry.resolve(BROWSECOMP.id) is BROWSECOMP


def test_registry_validates_scorer_reference_integrity() -> None:
    registry = BenchmarkRegistry((BROWSECOMP,), scorer_keys=SCORERS.keys)

    registry.validate_scorer_references((BROWSECOMP.scorer_key,))

    with pytest.raises(ValueError, match="references unregistered scorer 'missing'"):
        BenchmarkRegistry(
            (replace(BROWSECOMP, id="custom/dangling@1", scorer_key="missing"),),
            scorer_keys=SCORERS.keys,
        )


def test_public_registration_commits_a_closed_definition_scorer_pair(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    local_scorers = BenchmarkScorerRegistry()
    local_benchmarks = BenchmarkRegistry(scorer_keys=local_scorers.keys)
    monkeypatch.setattr(catalog, "SCORERS", local_scorers)
    monkeypatch.setattr(catalog, "BENCHMARKS", local_benchmarks)
    definition = replace(BROWSECOMP, id="custom/paired@1", scorer_key="custom/paired")
    factory = SCORERS.resolve(BROWSECOMP.scorer_key)

    register_benchmark(definition, factory)

    assert local_benchmarks.resolve(definition.id) is definition
    assert local_scorers.resolve(definition.scorer_key) is factory
