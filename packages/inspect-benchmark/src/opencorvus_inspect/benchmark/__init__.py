"""Versioned benchmark definitions for the OpenCorvus Inspect integration."""

from .catalog import BENCHMARKS, BenchmarkRegistry, register_benchmark
from .dataset import BenchmarkDataError, LoadedBenchmarkDataset, load_benchmark_dataset
from .definition import (
    BenchmarkDefinition,
    DatasetSchema,
    JudgePolicy,
    SourceProvenance,
)
from .judge import InspectModelJudge, Judge, JudgeCompletion, JudgeUnavailableError
from .scoring import (
    SCORERS,
    BenchmarkScorerRegistry,
    benchmark_quality,
    build_benchmark_scorer,
)
from .task import build_benchmark_task, opencorvus_suite

BENCHMARKS.validate_scorer_references(SCORERS.keys())

__all__ = [
    "BENCHMARKS",
    "SCORERS",
    "BenchmarkDataError",
    "BenchmarkDefinition",
    "BenchmarkRegistry",
    "BenchmarkScorerRegistry",
    "DatasetSchema",
    "InspectModelJudge",
    "Judge",
    "JudgeCompletion",
    "JudgePolicy",
    "JudgeUnavailableError",
    "LoadedBenchmarkDataset",
    "SourceProvenance",
    "benchmark_quality",
    "build_benchmark_task",
    "build_benchmark_scorer",
    "load_benchmark_dataset",
    "opencorvus_suite",
    "register_benchmark",
]
