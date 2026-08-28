"""Import registered Inspect components when the extension is discovered."""

from . import scorer as scorer
from . import solver as solver
from . import task as task
from .benchmark import scoring as benchmark_scoring
from .benchmark import task as benchmark_task

__all__ = ["benchmark_scoring", "benchmark_task", "scorer", "solver", "task"]
