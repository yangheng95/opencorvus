"""Load the authorized public implementation without copying its equations."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
sys.path[:0] = [
    str(PUBLIC / "exercise-tools/upgrade-v0.3/source"),
    str(PUBLIC / "exercise-tools/qualification/current-source"),
]
from tree_business import (
    load_data,
    event,
    canonical,
    audit_policy,
    contingency,
    advance,
)
from l06_physics import initial_state


def save(path, value):
    import json

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )
