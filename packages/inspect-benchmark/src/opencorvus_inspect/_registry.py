"""Import registered Inspect components when the extension is discovered."""

from . import scorer as scorer
from . import solver as solver
from . import task as task
from .automationbench import check as automationbench_check
from .automationbench import development_task as automationbench_development
from .automationbench import task as automationbench_task
from .benchmark import scoring as benchmark_scoring
from .benchmark import task as benchmark_task

__all__ = [
    "automationbench_check",
    "automationbench_development",
    "automationbench_task",
    "benchmark_scoring",
    "benchmark_task",
    "scorer",
    "solver",
    "task",
]
