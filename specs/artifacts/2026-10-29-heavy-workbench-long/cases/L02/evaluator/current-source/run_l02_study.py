"""Run a sealed candidate numerical submission, or resume its original ledger."""
import argparse
from fractions import Fraction
import json
import sqlite3
from pathlib import Path
import tempfile

from asof_input import InputError
from l02_execution import (ExecutionError, Executor, Ledger, archived_json, atomic_bytes,
    json_bytes, regular_bytes, resolve_image, run_lock, safe_relative, timestamp,
    read_archive, zip_bytes)
from l02_scoring import ProtocolError, aggregate_study_metrics, load_study, score
from l02_selection import assess_selection
from l02_study_data import StudySource, validate_pool
from material_contract import read_json


def validate_submission(root):
    manifest = read_json(root / 'submission.json', decimal_numbers=True)
    if type(manifest) is not dict or set(manifest) != {'format', 'pool', 'programs'} or manifest['format'] != 'l02-numerical-submission/1':
        raise ExecutionError('submission_manifest_invalid', 'format, pool and programs required')
    pool, methods = validate_pool(manifest['pool'])
    if set(pool['outer_ids']) != set(methods) or not {'baseline', 'extension', 'ablation'} <= {m['role'] for m in methods.values()}:
        raise ExecutionError('submission_pool_invalid', 'every declared method is mandatory; baseline, extension and ablation required')
    if any(m['role'] not in {'baseline', 'extension', 'ablation'} for m in methods.values()):
        raise ExecutionError('submission_pool_invalid', 'unknown method role')
    if not {'baseline', 'extension'} <= {methods[m]['role'] for m in pool['selection_ids']}:
        raise ExecutionError('submission_pool_invalid', 'selection must compare baseline and extension')
    programs = manifest['programs']
    if type(programs) is not dict or set(programs) != {'predict', 'select', 'report'}:
        raise ExecutionError('submission_program_invalid', 'predict/select/report required')
    all_files = {'submission.json': (root / 'submission.json').read_bytes()}
    for program in programs.values():
        if type(program) is not dict or set(program) != {'files', 'argv'}:
            raise ExecutionError('submission_program_invalid', 'files and argv required')
        files, argv = program['files'], program['argv']
        if type(files) is not list or not files or any(type(n) is not str for n in files) or len(set(files)) != len(files):
            raise ExecutionError('submission_program_invalid', 'unique declared files required')
        if type(argv) is not list or not argv or any(type(s) is not str or not s or '\x00' in s for s in argv):
            raise ExecutionError('submission_program_invalid', 'nonempty argument vector required')
        all_files.update(regular_bytes(root, files))
    return manifest, all_files


def initialize(args):
    try:
        args.out.mkdir(parents=True, exist_ok=False)
    except OSError as e:
        raise ExecutionError('output_directory_unavailable', str(e)) from e
    with run_lock(args.out):
        manifest, submitted = validate_submission(args.submission)
        study = load_study(args.study)
        data = StudySource(args.raw, args.material_contract, study)
        all_outer = [g['origin_id'] for g in data.grid['origins'] if g['role'] == 'outer']
        requested = args.outer_id or all_outer
        if len(set(requested)) != len(requested) or not set(requested) <= set(all_outer):
            raise ExecutionError('registered_outer_identity', 'unique registered outer IDs required')
        image = resolve_image(args.image, args.out / 'image-preflight.json')
        registration = {'format': 'l02-execution-registration/1', 'created_at': timestamp(),
            'outer_ids': requested, 'all_outer_ids': all_outer, 'image_id': image,
            'assignment_kind': 'private_author_diagnostic' if args.outer_id else 'formal_full_assignment',
            'execution_profile': {'cpus': 1, 'network': 'none', 'readonly_root': True},
            'candidate_score': None, 'scope': 'numerical execution protocol; full L02 quality and rubric remain unqualified'}
        files = {**{'submission/' + n: v for n, v in submitted.items()},
                 **{'raw/' + n: v for n, v in regular_bytes(args.raw).items()},
                 'material-contract.json': args.material_contract.read_bytes(),
                 'study.json': args.study.read_bytes(), 'registration.json': json_bytes(registration)}
        atomic_bytes(args.out / 'registration.zip', zip_bytes(files))
        ledger = Ledger(args.out, create=True)
        ledger.close()
    return args.out


def inputs_for_forecast(data, origin_id, method):
    with tempfile.TemporaryDirectory(prefix='l02-authorized-packet-') as tmp:
        packet = Path(tmp) / 'packet'
        verification = data.packet(origin_id, packet)
        inputs = {'packet/' + n: v for n, v in regular_bytes(packet).items()}
    inputs['method.json'] = json_bytes({k: method[k] for k in ('method_id', 'configuration')})
    return inputs, verification


def extract_data(files, root):
    for name, value in files.items():
        if name.startswith('raw/') or name in ('material-contract.json', 'study.json'):
            target = root / safe_relative(name)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(value)


def execute(root, observer=None):
    with run_lock(root):
        ledger = Ledger(root)
        try:
            sealed = read_archive(root / 'registration.zip')
            registration = archived_json(sealed, 'registration.json')
            if registration.get('format') != 'l02-execution-registration/1':
                raise ExecutionError('run_format_invalid', 'unknown registration')
            manifest = archived_json(sealed, 'submission/submission.json', True)
            pool, methods = validate_pool(manifest['pool'])
            executor = Executor(ledger, registration['image_id'], observer)
            with tempfile.TemporaryDirectory(prefix='l02-evaluator-registration-') as tmp:
                extracted = Path(tmp)
                extract_data(sealed, extracted)
                study = load_study(extracted / 'study.json')
                data = StudySource(extracted / 'raw', extracted / 'material-contract.json', study)
                completed = []

                def program(kind):
                    declaration = manifest['programs'][kind]
                    return declaration, {name: sealed['submission/' + name] for name in declaration['files']}

                def predict(outer_id, origin_id, method_id, level):
                    inputs, packet_receipt = inputs_for_forecast(data, origin_id, methods[method_id])
                    context, labels, _ = data.context_and_labels(origin_id)
                    declaration, source = program('predict')
                    def validate(files):
                        return {'metric': score(archived_json(files, 'output/result/forecast.json', True), context, labels, method_id, study),
                                'packet_verification': packet_receipt}
                    accepted = executor.invoke({'kind': 'predict', 'outer_id': outer_id, 'origin_id': origin_id,
                                                'method_id': method_id, 'level': level}, declaration, source, inputs, validate)
                    return archived_json(accepted, 'output/result/forecast.json', True), archived_json(accepted, 'assessment.json')['metric']

                for outer_id in registration['outer_ids']:
                    outer = data.origins[outer_id]
                    inner = [g for g in data.grid['origins'] if g['role'] == 'inner' and g['outer_id'] == outer_id]
                    if len(inner) != len(data.contract['schedule']['inner_days_before']) or outer['origin_tick'] < data.scale_release_tick:
                        raise ExecutionError('facility_inner_registration_invalid', outer_id)
                    frames = []
                    for origin in inner:
                        context, labels, released = data.context_and_labels(origin['origin_id'])
                        if released > outer['origin_tick']:
                            raise ExecutionError('facility_inner_label_unpublished', origin['origin_id'])
                        forecasts = {method: predict(outer_id, origin['origin_id'], method, 'inner')[0] for method in pool['selection_ids']}
                        frames.append({'origin_id': origin['origin_id'], 'context': context, 'labels': labels,
                                       'labels_released_at': released, 'forecasts': forecasts})
                    payload = {'format': 'l02-inner-selection-packet/1', 'outer_origin_tick': outer['origin_tick'],
                               'inner_ids': [g['origin_id'] for g in inner], 'selection_ids': pool['selection_ids'], 'frames': frames}
                    declaration, source = program('select')
                    inputs = {'inner.json': json_bytes(payload), 'study.json': sealed['study.json']}
                    selected = executor.invoke({'kind': 'select', 'outer_id': outer_id}, declaration, source, inputs,
                        lambda files: assess_selection(archived_json(files, 'output/result/selection.json'),
                                                       archived_json(files, 'input/inner.json', True), study))
                    selection = archived_json(selected, 'output/result/selection.json')
                    metrics, forecasts = {}, {}
                    for method in pool['outer_ids']:
                        forecasts[method], metrics[method] = predict(outer_id, outer_id, method, 'outer')
                    context, labels, released = data.context_and_labels(outer_id)
                    completed.append({'outer_id': outer_id, 'selected_method_id': selection['selected_method_id'],
                        'inner_selection': archived_json(selected, 'assessment.json'), 'metrics': metrics,
                        'forecasts': forecasts, 'context': context, 'labels': labels, 'label_release_tick': released})
                aggregate = aggregate_study_metrics(
                    {(row['outer_id'], method): row['metrics'][method]['metrics_exact'] for row in completed for method in pool['outer_ids']},
                    {row['outer_id']: row['selected_method_id'] for row in completed}, pool['outer_ids'])
                numerical = {'format': 'l02-completed-numerical-results/1', 'outer_ids': registration['outer_ids'],
                    'all_outer_ids': registration['all_outer_ids'], 'complete_assignment': set(registration['outer_ids']) == set(registration['all_outer_ids']),
                    'pool': pool, 'aggregate_exact': aggregate, 'outer_results': completed, 'candidate_score': None,
                    'quality_floor': study['quality_floor']}
                declaration, source = program('report')
                def validate_report(files):
                    receipt = archived_json(files, 'output/result/report.json')
                    report = files['output/result/report.md'].decode('utf-8')
                    if type(receipt) is not dict or receipt.get('format') != 'l02-report-receipt/1' or receipt.get('outer_ids') != registration['outer_ids'] or not report.strip():
                        raise ExecutionError('report_delivery_invalid', 'nonempty report and exact requested-origin receipt required')
                    return {'status': 'report_protocol_verified', 'scientific_review': 'unassessed', 'candidate_score': None}
                executor.invoke({'kind': 'report'}, declaration, source, {'results.json': json_bytes(numerical)}, validate_report)
                result = {'status': 'requested_execution_complete', 'complete_assignment': numerical['complete_assignment'],
                    'requested_outer_ids': registration['outer_ids'], 'aggregate_exact': aggregate,
                    'verified_cells': ledger.db.execute("SELECT count(*) FROM cell WHERE phase='verified'").fetchone()[0],
                    'study_complete': None, 'quality_success': None, 'candidate_score': None,
                    'scope': 'sealed numerical execution/report transport; full scientific/operational review and frozen rubric pending'}
                with ledger.db:
                    ledger.event(None, 'requested_execution_complete', result)
                return result
        except Exception as e:
            with ledger.db:
                ledger.event(None, 'execution_interrupted', {'code': getattr(e, 'code', 'facility_execution_invalid'), 'detail': str(e)})
            raise
        finally:
            ledger.close()


def main(argv=None, observer=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('--resume', type=Path)
    for name in ('out', 'submission', 'raw', 'material-contract', 'study'):
        parser.add_argument('--' + name, type=Path)
    parser.add_argument('--image')
    parser.add_argument('--author-diagnostic-outer-id', dest='outer_id', action='append')
    args = parser.parse_args(argv)
    fresh = ('out', 'submission', 'raw', 'material_contract', 'study', 'image')
    try:
        if args.resume:
            if any(getattr(args, name) is not None for name in fresh) or args.outer_id:
                raise ExecutionError('resume_arguments_invalid', 'resume accepts only its original run root')
            if not args.resume.is_dir():
                raise ExecutionError('run_format_invalid', 'original run directory required')
            root = args.resume
        else:
            if any(getattr(args, name) is None for name in fresh):
                raise ExecutionError('fresh_arguments_invalid', 'all fresh registration arguments required')
            root = initialize(args)
        result = execute(root, observer)
        print(json.dumps(result, ensure_ascii=False), flush=True)
        return 0
    except (ExecutionError, InputError, ProtocolError, OSError, ValueError, KeyError, TypeError, sqlite3.Error) as e:
        code = getattr(e, 'code', 'facility_storage_invalid' if isinstance(e, sqlite3.Error) else 'facility_execution_invalid')
        candidate = getattr(e, 'candidate', False) or isinstance(e, ProtocolError) and not code.startswith('facility_')
        print(json.dumps({'status': 'candidate_execution_failed' if candidate else 'run_invalid', 'error': code,
                          'detail': str(e), 'candidate_score': None}, ensure_ascii=False), flush=True)
        return 2 if candidate else 3


if __name__ == '__main__':
    raise SystemExit(main())
