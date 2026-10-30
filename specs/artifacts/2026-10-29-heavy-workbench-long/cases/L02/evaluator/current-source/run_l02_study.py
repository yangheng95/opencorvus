"""Run a sealed candidate numerical submission, or resume its original ledger."""
import argparse
import json
import sqlite3
from pathlib import Path
import tempfile

from asof_input import InputError
from l02_execution import (ExecutionError, Executor, Ledger, archived_json, atomic_bytes,
    json_bytes, regular_bytes, resolve_image, run_lock, safe_relative, timestamp,
    read_archive, zip_bytes)
from l02_scoring import ProtocolError, load_study
from l02_study_data import StudySource, validate_pool, validate_assignment, numeric_assignment, extract_data
from l02_pipeline import assemble, forecast_inputs, assess_forecast, assess_selector, assess_report
from l02_report import numeric_records, report_inputs, provenance_coverage
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
                formal = validate_assignment(data, registration)

                def program(kind):
                    declaration = manifest['programs'][kind]
                    return declaration, {name: sealed['submission/' + name] for name in declaration['files']}

                def predict(identity, method):
                    declaration, source = program('predict')
                    return executor.invoke(identity, declaration, source,
                        lambda: forecast_inputs(data, identity['origin_id'], method),
                        lambda files: assess_forecast(files, data, identity['origin_id'], method, study))

                def select(identity, payload):
                    declaration, source = program('select')
                    return executor.invoke(identity, declaration, source,
                        lambda: {'inner.json': json_bytes(payload), 'study.json': sealed['study.json']},
                        lambda files: assess_selector(files, payload, study))

                numerical = assemble(data, registration, pool, methods, study, predict, select)
                rows = [dict(row) for row in ledger.db.execute('SELECT * FROM cell ORDER BY id')]
                records = numeric_records(root, rows, ledger.run_id, registration['image_id'], manifest,
                    {n[11:]: v for n, v in sealed.items() if n.startswith('submission/')},
                    numeric_assignment(data, pool, registration['outer_ids']))
                expected_report_inputs = report_inputs(numerical, records)
                declaration, source = program('report')
                reported = executor.invoke({'kind': 'report'}, declaration, source,
                    lambda: expected_report_inputs, lambda files: assess_report(files, registration['outer_ids']))
                assess_report(reported, registration['outer_ids'])
                coverage = provenance_coverage(reported, expected_report_inputs)
                result = {'status': 'requested_execution_complete', 'complete_assignment': numerical['complete_assignment'],
                    'formal_full_assignment': formal, 'report_provenance': coverage,
                    'requested_outer_ids': registration['outer_ids'], 'aggregate_exact': numerical['aggregate_exact'],
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
