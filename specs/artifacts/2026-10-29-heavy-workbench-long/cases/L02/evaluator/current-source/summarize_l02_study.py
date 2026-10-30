"""CLI for the single read-only sealed execution reader."""
import argparse
import json
from pathlib import Path
import sqlite3
from asof_input import InputError
from l02_execution import ExecutionError
from l02_scoring import ProtocolError
from l02_sealed import read_completed
from l02_study_data import write_json


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--run', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    a = p.parse_args()
    try:
        value, _ = read_completed(a.run.resolve())
        a.out.mkdir(parents=True, exist_ok=False)
        write_json(a.out / 'assessment.json', value)
        print(json.dumps(value), flush=True)
    except (ExecutionError, InputError, ProtocolError, OSError, ValueError, KeyError, TypeError, sqlite3.Error) as e:
        print(json.dumps({'status': 'run_invalid', 'error': getattr(e, 'code', 'sealed_matrix_invalid'), 'detail': str(e), 'candidate_score': None}), flush=True)
        raise SystemExit(3)
