"""Scorer implementation registry and the Inspect-registered quality scorer."""

from __future__ import annotations

from collections.abc import Iterable

from inspect_ai.scorer import Scorer, accuracy, scorer, stderr

from .definition import BenchmarkDefinition, BenchmarkScorerFactory
from .judge import Judge


class BenchmarkScorerRegistry:
    """Map stable scorer keys to their single current implementation."""

    def __init__(
        self,
        implementations: Iterable[tuple[str, BenchmarkScorerFactory]] = (),
    ) -> None:
        self._implementations: dict[str, BenchmarkScorerFactory] = {}
        for key, implementation in implementations:
            self.register(key, implementation)

    def register(self, key: str, implementation: BenchmarkScorerFactory) -> None:
        if key in self._implementations:
            raise ValueError(f"Benchmark scorer {key!r} is already registered")
        self._implementations[key] = implementation

    def resolve(self, key: str) -> BenchmarkScorerFactory:
        implementation = self._implementations.get(key)
        if implementation is None:
            available = ", ".join(self.keys())
            raise ValueError(f"Unknown benchmark scorer {key!r}. Available: {available}")
        return implementation

    def keys(self) -> tuple[str, ...]:
        return tuple(sorted(self._implementations))


from .apodex import APODEX_SCORERS  # noqa: E402

SCORERS = BenchmarkScorerRegistry(APODEX_SCORERS)


def build_benchmark_scorer(
    definition: BenchmarkDefinition,
    *,
    judge_model: str | None = None,
    judge: Judge | None = None,
) -> Scorer:
    implementation = SCORERS.resolve(definition.scorer_key)
    return implementation(
        definition=definition,
        judge_model=judge_model,
        judge=judge,
    )


@scorer(metrics=[accuracy(), stderr()])
def benchmark_quality(benchmark: str, judge_model: str | None = None) -> Scorer:
    """Resolve one versioned benchmark and run its registered quality scorer."""

    from .catalog import BENCHMARKS

    definition = BENCHMARKS.resolve(benchmark)
    return build_benchmark_scorer(definition, judge_model=judge_model)


__all__ = [
    "SCORERS",
    "BenchmarkScorerRegistry",
    "benchmark_quality",
    "build_benchmark_scorer",
]
