"""Run only inside a disposable container/PID namespace."""

from __future__ import annotations

import importlib.util
import json
import subprocess
import tempfile
import time
from pathlib import Path


MODULE_PATH = (
    Path(__file__).resolve().parents[2]
    / "script"
    / "benchmark"
    / "workbuddy"
    / "run_opencorvus_trial.py"
)
SPEC = importlib.util.spec_from_file_location("run_opencorvus_trial", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def main() -> int:
    with tempfile.TemporaryDirectory() as temporary:
        logs = Path(temporary) / "logs"
        logs.mkdir()
        MODULE.LOGS = logs
        MODULE.capture_process_baseline()
        child = subprocess.Popen(["setsid", "sh", "-c", "sleep 60 & wait"])
        try:
            time.sleep(0.2)
            assert MODULE.cleanup_owned_processes() == 0
            child.wait(timeout=5)
            audit = json.loads((logs / "process-cleanup-audit.json").read_text())
            assert audit["passed"] is True
            assert audit["targeted_processes"]
            assert audit["survivors"] == []
        finally:
            if child.poll() is None:
                child.kill()
                child.wait(timeout=5)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
