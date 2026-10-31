"""Shared imports: unchanged public parser and exact business recurrence."""
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'programme'))
from tree_business import (load_data, histories, canonical, event, action_at,
                           audit_policy, contingency, advance, replay, append, packet, BusinessError)
from l06_physics import initial_state, begin_week, propose_week
