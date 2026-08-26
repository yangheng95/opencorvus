"""Inspect AI integration for the OpenCorvus Task API."""

from .adapter import (
    AdapterConfig,
    OpenCorvusAdapterError,
    OpenCorvusAPIError,
    OpenCorvusClient,
    OpenCorvusProtocolError,
    OpenCorvusTaskTimeout,
    TaskResult,
)
from .benchmark import (
    BENCHMARKS,
    SCORERS,
    BenchmarkDataError,
    BenchmarkDefinition,
    BenchmarkRegistry,
    BenchmarkScorerRegistry,
    DatasetSchema,
    JudgePolicy,
    SourceProvenance,
    build_benchmark_task,
    load_benchmark_dataset,
    opencorvus_suite,
    register_benchmark,
)
from .scorer import task_completed
from .solver import opencorvus_task
from .task import opencorvus_benchmark

__all__ = [
    "AdapterConfig",
    "BENCHMARKS",
    "SCORERS",
    "BenchmarkDataError",
    "BenchmarkDefinition",
    "BenchmarkRegistry",
    "BenchmarkScorerRegistry",
    "DatasetSchema",
    "JudgePolicy",
    "OpenCorvusAPIError",
    "OpenCorvusAdapterError",
    "OpenCorvusClient",
    "OpenCorvusProtocolError",
    "OpenCorvusTaskTimeout",
    "TaskResult",
    "SourceProvenance",
    "build_benchmark_task",
    "load_benchmark_dataset",
    "opencorvus_benchmark",
    "opencorvus_suite",
    "opencorvus_task",
    "register_benchmark",
    "task_completed",
]
