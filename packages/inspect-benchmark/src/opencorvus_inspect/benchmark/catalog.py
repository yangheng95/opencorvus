"""Single registry authority for versioned benchmark definitions."""

from __future__ import annotations

from collections.abc import Callable, Iterable

from .definition import BenchmarkDefinition, BenchmarkScorerFactory


class BenchmarkRegistry:
    """Register immutable definitions and reject ambiguous benchmark identities."""

    def __init__(
        self,
        definitions: Iterable[BenchmarkDefinition] = (),
        *,
        scorer_keys: Callable[[], Iterable[str]],
    ) -> None:
        self._definitions: dict[str, BenchmarkDefinition] = {}
        self._scorer_keys = scorer_keys
        for definition in definitions:
            self.register(definition)

    def register(self, definition: BenchmarkDefinition) -> None:
        if definition.id in self._definitions:
            raise ValueError(f"Benchmark {definition.id!r} is already registered")
        if definition.scorer_key not in frozenset(self._scorer_keys()):
            raise ValueError(
                f"Benchmark {definition.id!r} references unregistered scorer "
                f"{definition.scorer_key!r}"
            )
        self._definitions[definition.id] = definition

    def resolve(self, benchmark_id: str) -> BenchmarkDefinition:
        definition = self._definitions.get(benchmark_id)
        if definition is None:
            available = ", ".join(self.ids())
            raise ValueError(f"Unknown benchmark {benchmark_id!r}. Available: {available}")
        return definition

    def ids(self) -> tuple[str, ...]:
        return tuple(sorted(self._definitions))

    def definitions(self) -> tuple[BenchmarkDefinition, ...]:
        return tuple(self._definitions[key] for key in self.ids())

    def validate_scorer_references(
        self,
        scorer_keys: Iterable[str],
    ) -> None:
        registered = frozenset(scorer_keys)
        missing = sorted(
            definition.scorer_key
            for definition in self.definitions()
            if definition.scorer_key not in registered
        )
        if missing:
            raise ValueError(
                "Benchmark catalog has unregistered scorer keys: " + ", ".join(missing)
            )


from .apodex import APODEX_BENCHMARKS  # noqa: E402
from .scoring import SCORERS  # noqa: E402

BENCHMARKS = BenchmarkRegistry(APODEX_BENCHMARKS, scorer_keys=SCORERS.keys)


def register_benchmark(
    definition: BenchmarkDefinition,
    scorer_factory: BenchmarkScorerFactory,
) -> None:
    """Register one closed definition/scorer pair through the public mutation API."""

    if definition.id in BENCHMARKS.ids():
        raise ValueError(f"Benchmark {definition.id!r} is already registered")
    if definition.scorer_key in SCORERS.keys():
        raise ValueError(f"Benchmark scorer {definition.scorer_key!r} is already registered")
    SCORERS.register(definition.scorer_key, scorer_factory)
    BENCHMARKS.register(definition)


__all__ = ["BENCHMARKS", "BenchmarkRegistry", "register_benchmark"]
