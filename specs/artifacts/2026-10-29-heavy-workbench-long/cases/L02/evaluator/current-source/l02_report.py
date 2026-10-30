"""One report-side provenance projection from original verified numeric objects."""
import json
from pathlib import PurePosixPath

from l02_execution import (ExecutionError, archived_json, json_bytes, prepared_members,
    read_archive, safe_relative, bound_execution)
from material_contract import parse_json, same_json_value


def identity_key(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False)


def project_argv(argv, source_files):
    result = []
    for index, value in enumerate(argv):
        if index == 0:
            basename = PurePosixPath(value).name
            safe = '\\' not in value and ':' not in value and basename not in ('', '.', '..')
            result.append({'position': index, 'kind': 'executable_basename' if safe else 'opaque', 'value': basename if safe else None})
        elif value in source_files:
            result.append({'position': index, 'kind': 'declared_source', 'value': value})
        else:
            path = PurePosixPath(value)
            sandbox = path.is_absolute() and len(path.parts) > 1 and path.parts[1] in ('project', 'input', 'output', 'tmp')
            canonical = str(path) == value and not any(p == '..' or ':' in p or '\\' in p for p in path.parts)
            if sandbox and canonical:
                result.append({'position': index, 'kind': 'sandbox_path', 'value': value})
            else:
                result.append({'position': index, 'kind': 'opaque', 'value': None})
    return result


def numeric_records(root, rows, run_id, image, manifest, submitted_source, expected):
    selected = [];keys = set();expected_keys = {identity_key(i) for i in expected}
    for cell in rows:
        identity = json.loads(cell['identity'])
        if identity == {'kind': 'report'}:
            continue
        key = identity_key(identity)
        if key not in expected_keys or key in keys:
            raise ExecutionError('facility_numeric_assignment_invalid', 'unknown or repeated numeric cell')
        keys.add(key)
        if cell['phase'] != 'verified':
            raise ExecutionError('facility_report_sources_incomplete', 'numeric cell is not verified: ' + str(cell['id']))
        declaration = manifest['programs'][identity['kind']]
        source = {name: submitted_source[name] for name in declaration['files']}
        job = root / 'cells' / str(cell['id'])
        objects = {name: read_archive(job / (name + '.zip')) for name in ('prepared', 'terminal', 'accepted')}
        record = bound_execution({**cell, 'objects': objects}, identity, declaration, source, image, run_id)
        selected.append(record)
    if keys != expected_keys:
        raise ExecutionError('facility_report_sources_incomplete', 'all assigned numeric objects required')
    return selected


def report_inputs(numerical, records):
    inputs = {'results.json': json_bytes(numerical)};entries = []
    for record in records:
        cell_id = record['cell']['id'];native = record['native'];program = record['program']
        artifacts = []
        for name, value in record['accepted'].items():
            if not name.startswith('output/'):
                continue
            member = name[7:];safe_relative(member)
            relative = 'provenance/files/' + str(cell_id) + '/' + member
            inputs[relative] = value
            artifacts.append({'output_member': member, 'input_path': relative, 'bytes': len(value),
                              'origin': 'candidate_program_output_not_independently_verified_claim'})
        entries.append({'cell_id': cell_id, 'identity': record['identity'],
            'execution': {'argv_projection': project_argv([native['Path'], *native['Args']], program['files']),
                          'declared_source_files': program['files'],
                          'started_at': native['State']['StartedAt'], 'finished_at': native['State']['FinishedAt'],
                          'status': native['State']['Status'], 'exit_code': native['State']['ExitCode']},
            'artifacts': sorted(artifacts, key=lambda a: a['output_member'])})
    inputs['provenance/manifest.json'] = json_bytes({'format': 'l02-report-provenance/1', 'cells': entries,
        'scope': 'original numeric program outputs and narrow native execution facts; file existence is not proof of training or scientific correctness'})
    return inputs


def provenance_coverage(report, expected_inputs):
    """Observe actual captured report input; never add data to a historical report."""
    files = {name[6:]: value for name, value in report.items() if name.startswith('input/')}
    if 'results.json' not in files or not same_json_value(parse_json(files['results.json'].decode('utf-8'), decimal_numbers=True), parse_json(expected_inputs['results.json'].decode('utf-8'), decimal_numbers=True)):
        raise ExecutionError('facility_report_results_binding_invalid', 'report saw different numerical results')
    if 'provenance/manifest.json' not in files:
        if set(files) != {'results.json'}:
            raise ExecutionError('facility_report_provenance_binding_invalid', 'unregistered historical report input objects')
        return {'status': 'not_delivered', 'scientific_review': 'unassessed',
                'scope': 'actual historical report input did not include provenance; no backfill or candidate failure inferred'}
    actual_members = {n: v for n, v in files.items() if n not in ('results.json', 'provenance/manifest.json')}
    expected_members = {n: v for n, v in expected_inputs.items() if n not in ('results.json', 'provenance/manifest.json')}
    if actual_members != expected_members or not same_json_value(parse_json(files['provenance/manifest.json'].decode('utf-8')), parse_json(expected_inputs['provenance/manifest.json'].decode('utf-8'))):
        raise ExecutionError('facility_report_provenance_binding_invalid', 'report provenance differs from its numeric originals')
    value = archived_json({'manifest': files['provenance/manifest.json']}, 'manifest')
    return {'status': 'delivered', 'numeric_cells': len(value['cells']),
            'candidate_artifacts': sum(len(row['artifacts']) for row in value['cells']),
            'scientific_review': 'unassessed', 'scope': 'provided data only; use/truth require actual independent review'}
