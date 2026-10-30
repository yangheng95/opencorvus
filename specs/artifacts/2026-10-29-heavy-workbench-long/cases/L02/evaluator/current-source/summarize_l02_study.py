"""Read-only recomputation from version-one accepted execution objects."""
import argparse
from fractions import Fraction
import json
from pathlib import Path
import sqlite3
import tempfile
from l02_execution import ExecutionError, archived_json, read_archive
from l02_scoring import aggregate_study_metrics, load_study, score
from l02_selection import assess_selection
from l02_study_data import StudySource, validate_pool, write_json
from run_l02_study import extract_data


def summarize(root):
    with sqlite3.connect((root / 'runs.sqlite3').as_uri() + '?mode=ro', uri=True) as db:
        if db.execute('PRAGMA user_version').fetchone()[0] != 1:
            raise ValueError('run_format_invalid')
        rows = db.execute('SELECT id,identity,phase FROM cell ORDER BY id').fetchall()
    if any(phase != 'verified' for _, _, phase in rows):
        raise ValueError('requested_execution_incomplete')
    sealed = read_archive(root / 'registration.zip')
    reg = archived_json(sealed, 'registration.json')
    manifest = archived_json(sealed, 'submission/submission.json', True)
    pool, methods = validate_pool(manifest['pool'])
    objects = [(json.loads(identity), read_archive(root / 'cells' / str(i) / 'accepted.zip')) for i, identity, _ in rows]
    metrics, choices, count = {}, {}, 0
    with tempfile.TemporaryDirectory(prefix='l02-summary-') as tmp:
        extract_data(sealed, Path(tmp))
        study = load_study(Path(tmp) / 'study.json')
        data = StudySource(Path(tmp) / 'raw', Path(tmp) / 'material-contract.json', study)
        expected = set()
        for outer in reg['outer_ids']:
            inner = [g['origin_id'] for g in data.grid['origins'] if g['role'] == 'inner' and g['outer_id'] == outer]
            expected |= {('predict', outer, origin, method) for origin in inner for method in pool['selection_ids']}
            expected |= {('predict', outer, outer, method) for method in pool['outer_ids']}
            expected.add(('select', outer, '', ''))
        expected.add(('report', '', '', ''))
        seen = set()
        for identity, files in objects:
            key = tuple(identity.get(k, '') for k in ('kind', 'outer_id', 'origin_id', 'method_id'))
            if key in seen or key not in expected:
                raise ValueError('cell_assignment_invalid')
            seen.add(key)
            kind = identity['kind']
            declaration = manifest['programs'][{'predict': 'predict', 'select': 'select', 'report': 'report'}[kind]]
            if archived_json(files, 'program.json') != declaration:
                raise ValueError('program_identity_invalid')
            if {n[8:]: v for n, v in files.items() if n.startswith('project/')} != {n: sealed['submission/' + n] for n in declaration['files']}:
                raise ValueError('program_files_invalid')
            if kind == 'predict':
                method, origin = identity['method_id'], identity['origin_id']
                if archived_json(files, 'input/method.json', True) != {k: methods[method][k] for k in ('method_id', 'configuration')}:
                    raise ValueError('method_configuration_invalid')
                context, labels, _ = data.context_and_labels(origin)
                value = score(archived_json(files, 'output/result/forecast.json', True), context, labels, method, study)
                if value != archived_json(files, 'assessment.json')['metric']:
                    raise ValueError('metric_assessment_invalid')
                if origin == identity['outer_id']:
                    metrics[identity['outer_id'], method] = value['metrics_exact']
                count += 1
            elif kind == 'select':
                payload = archived_json(files, 'input/inner.json', True)
                expected_inner = [g['origin_id'] for g in data.grid['origins'] if g['role'] == 'inner' and g['outer_id'] == identity['outer_id']]
                if payload['inner_ids'] != expected_inner or payload['selection_ids'] != pool['selection_ids'] or payload['outer_origin_tick'] != data.origins[identity['outer_id']]['origin_tick']:
                    raise ValueError('selection_assignment_invalid')
                for frame in payload['frames']:
                    context, labels, released = data.context_and_labels(frame['origin_id'])
                    if (frame['context'], frame['labels'], frame['labels_released_at']) != (context, labels, released):
                        raise ValueError('selection_facts_invalid')
                    for method in pool['selection_ids']:
                        original = next(v for ident, v in objects if ident.get('kind') == 'predict' and ident.get('outer_id') == identity['outer_id'] and ident.get('origin_id') == frame['origin_id'] and ident.get('method_id') == method)
                        if frame['forecasts'][method] != archived_json(original, 'output/result/forecast.json', True):
                            raise ValueError('selection_prediction_binding_invalid')
                selection = archived_json(files, 'output/result/selection.json')
                assess_selection(selection, payload, study)
                choices[identity['outer_id']] = selection['selected_method_id']
            else:
                reported = archived_json(files, 'output/result/report.json')
                if reported['outer_ids'] != reg['outer_ids'] or not files['output/result/report.md'].strip():
                    raise ValueError('report_binding_invalid')
        if seen != expected:
            raise ValueError('requested_execution_incomplete')
        aggregate = aggregate_study_metrics(metrics, choices, pool['outer_ids'])
        return {'status': 'sealed_requested_matrix_recomputed', 'outer_ids': reg['outer_ids'],
                'complete_assignment': set(reg['outer_ids']) == set(reg['all_outer_ids']), 'forecast_cells': count,
                'verified_cells': len(rows), 'selected_methods': choices, 'aggregate_exact': aggregate,
                'study_complete': None, 'quality_success': None, 'candidate_score': None}


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--run', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    a = p.parse_args()
    try:
        value = summarize(a.run.resolve())
        a.out.mkdir(parents=True, exist_ok=False)
        write_json(a.out / 'assessment.json', value)
        print(json.dumps(value), flush=True)
    except (ExecutionError, OSError, ValueError, KeyError, TypeError, sqlite3.Error) as e:
        print(json.dumps({'status': 'run_invalid', 'error': 'sealed_matrix_invalid', 'detail': str(e), 'candidate_score': None}), flush=True)
        raise SystemExit(3)
