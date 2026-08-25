"""Import registered Inspect components when the extension is discovered."""

from . import scorer as scorer
from . import solver as solver
from . import task as task

__all__ = ["scorer", "solver", "task"]
