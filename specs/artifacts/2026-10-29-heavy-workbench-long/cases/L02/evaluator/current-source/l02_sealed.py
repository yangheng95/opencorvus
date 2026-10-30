"""Read-only reconstruction of the original language-neutral execution objects."""
import json
from pathlib import Path
import sqlite3
import tempfile

from l02_execution import (ExecutionError, archived_json, read_archive, validate_capsule,
                           validate_terminal, prepared_members)
from l02_pipeline import assemble, assess_report
from l02_report import identity_key, numeric_records, report_inputs, provenance_coverage
from l02_scoring import load_study
from l02_study_data import StudySource, validate_pool, validate_assignment, numeric_assignment, extract_data


def read_completed(root):
    root = root.resolve()
    with sqlite3.connect((root / 'runs.sqlite3').as_uri() + '?mode=ro', uri=True) as db:
        db.row_factory = sqlite3.Row
        db.execute('BEGIN')
        if db.execute('PRAGMA user_version').fetchone()[0] != 1:
            raise ExecutionError('run_format_invalid', 'version-one ledger required')
        runs = db.execute('SELECT id FROM run').fetchall()
        if len(runs) != 1:
            raise ExecutionError('run_format_invalid', 'one original run required')
        run_id = runs[0]['id']
        rows = [dict(row) for row in db.execute('SELECT * FROM cell ORDER BY id')]
    sealed = read_archive(root / 'registration.zip')
    reg = archived_json(sealed, 'registration.json')
    if reg.get('format') != 'l02-execution-registration/1':
        raise ExecutionError('run_format_invalid', 'original registration required')
    manifest = archived_json(sealed, 'submission/submission.json', True)
    pool, methods = validate_pool(manifest['pool'])
    source = {n[11:]: v for n, v in sealed.items() if n.startswith('submission/')}
    with tempfile.TemporaryDirectory(prefix='l02-sealed-reader-') as tmp:
        extract_data(sealed, Path(tmp))
        study = load_study(Path(tmp) / 'study.json')
        data = StudySource(Path(tmp) / 'raw', Path(tmp) / 'material-contract.json', study)
        formal = validate_assignment(data, reg)
        records = numeric_records(root, rows, run_id, reg['image_id'], manifest, source,
                                  numeric_assignment(data, pool, reg['outer_ids']))
        by_identity = {identity_key(r['identity']): r['accepted'] for r in records}
        numerical = assemble(data, reg, pool, methods, study,
            lambda identity, method: by_identity[identity_key(identity)],
            lambda identity, payload: by_identity[identity_key(identity)])
        reports = [row for row in rows if json.loads(row['identity']) == {'kind': 'report'}]
        if len(reports) != 1 or reports[0]['phase'] != 'verified':
            raise ExecutionError('facility_report_sources_incomplete', 'original verified report required')
        row = reports[0];job = root / 'cells' / str(row['id'])
        prepared = read_archive(job / 'prepared.zip');accepted = read_archive(job / 'accepted.zip')
        declaration = manifest['programs']['report']
        reporter_source = {name: source[name] for name in declaration['files']}
        validate_capsule(prepared, declaration, reporter_source);validate_capsule(accepted, declaration, reporter_source)
        if prepared_members(prepared) != prepared or prepared_members(accepted) != prepared:
            raise ExecutionError('facility_accepted_identity_changed', 'report input/source differs from original')
        validate_terminal(archived_json(accepted, 'terminal-inspect.json'), row, declaration, reg['image_id'], run_id)
        assess_report(accepted, reg['outer_ids'])
        coverage = provenance_coverage(accepted, report_inputs(numerical, records))
        summary = {'status': 'sealed_requested_matrix_recomputed', 'outer_ids': reg['outer_ids'],
            'complete_assignment': numerical['complete_assignment'], 'formal_full_assignment': formal,
            'forecast_cells': sum(r['identity']['kind'] == 'predict' for r in records), 'verified_cells': len(rows),
            'selected_methods': {r['outer_id']: r['selected_method_id'] for r in numerical['outer_results']},
            'aggregate_exact': numerical['aggregate_exact'], 'report_provenance': coverage,
            'study_complete': None, 'quality_success': None, 'candidate_score': None,
            'scope': 'original captured inputs, native executions and numerical recomputation; independent scientific review and full grader pending'}
        return summary, numerical
