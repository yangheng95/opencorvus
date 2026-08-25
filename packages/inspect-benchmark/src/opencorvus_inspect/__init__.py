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
from .scorer import task_completed
from .solver import opencorvus_task
from .task import opencorvus_benchmark

__all__ = [
    "AdapterConfig",
    "OpenCorvusAPIError",
    "OpenCorvusAdapterError",
    "OpenCorvusClient",
    "OpenCorvusProtocolError",
    "OpenCorvusTaskTimeout",
    "TaskResult",
    "opencorvus_benchmark",
    "opencorvus_task",
    "task_completed",
]
