"""Version-one numerical-program executor. SQLite owns lifecycle; Docker owns work.

This module never routes LLM messages and never trusts a program's self-rating.
Accepted ZIPs are immutable execution objects, not source-quality checksum gates.
"""
from contextlib import contextmanager
from datetime import datetime, timezone
from decimal import Decimal
import io
import json
import os
from pathlib import Path, PurePosixPath
import sqlite3
import subprocess
import time
import uuid
import zipfile
import zlib

from material_contract import parse_json, same_json_value


class ExecutionError(RuntimeError):
    def __init__(self, code, detail, *, candidate=False):
        self.code = code
        self.detail = detail
        self.candidate = candidate
        super().__init__(code + ':' + detail)


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def json_bytes(value):
    # Preserve candidate JSON decimals when building selector/report inputs.
    def emit(item):
        if isinstance(item, Decimal):
            if not item.is_finite():
                raise ValueError('nonfinite JSON decimal')
            return str(item)
        if type(item) is dict:
            if any(type(key) is not str for key in item):
                raise TypeError('JSON object keys must be strings')
            return '{' + ','.join(json.dumps(k) + ':' + emit(v) for k, v in item.items()) + '}'
        if type(item) in (list, tuple):
            return '[' + ','.join(emit(v) for v in item) + ']'
        return json.dumps(item, allow_nan=False, ensure_ascii=False)
    return emit(value).encode('utf-8')


def atomic_bytes(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.new-' + uuid.uuid4().hex)
    with temporary.open('xb') as f:
        f.write(value)
        f.flush()
        os.fsync(f.fileno())
    os.replace(temporary, path)


def safe_relative(value):
    if type(value) is not str or not value or '\\' in value:
        raise ExecutionError('submission_path_invalid', str(value))
    path = PurePosixPath(value)
    if not path.parts or path.is_absolute() or str(path) != value or any(p in ('.', '..') or ':' in p for p in path.parts):
        raise ExecutionError('submission_path_invalid', value)
    return path


def regular_bytes(root, names=None):
    """Read regular files only; never follow an output or submission symlink."""
    result = {}
    paths = list(root.rglob('*')) if names is None else [root / safe_relative(n) for n in names]
    for path in paths:
        relative = path.relative_to(root).as_posix()
        safe_relative(relative)
        if path.is_symlink() or any(p.is_symlink() for p in path.parents if p != root.parent):
            raise ExecutionError('program_file_invalid', relative)
        if path.is_dir() and names is None:
            continue
        if not path.is_file() or not path.resolve().is_relative_to(root.resolve()):
            raise ExecutionError('program_file_invalid', relative)
        result[relative] = path.read_bytes()
    return result


def zip_bytes(files):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, value in sorted(files.items()):
            safe_relative(name)
            z.writestr(name, value)
    return buffer.getvalue()


def unzip_bytes(value):
    try:
        with zipfile.ZipFile(io.BytesIO(value)) as z:
            names = z.namelist()
            if len(set(names)) != len(names):
                raise ExecutionError('facility_archive_invalid', 'duplicate member')
            for name in names:
                try:
                    safe_relative(name)
                except ExecutionError as e:
                    raise ExecutionError('facility_archive_invalid', 'invalid member path') from e
            return {name: z.read(name) for name in names}
    except (zipfile.BadZipFile, zlib.error, RuntimeError, OSError, ValueError) as e:
        raise ExecutionError('facility_archive_invalid', str(e)) from e


def read_archive(path):
    try:
        return unzip_bytes(path.read_bytes())
    except OSError as e:
        raise ExecutionError('facility_archive_unavailable', str(path)) from e


def archived_json(files, name, precise=False):
    return parse_json(files[name].decode('utf-8'), decimal_numbers=precise)


def candidate_text(files, name):
    """Only this declared candidate-output boundary assigns parse errors to it."""
    try:
        return files[name].decode('utf-8')
    except KeyError as e:
        raise ExecutionError('candidate_output_missing', 'required output: ' + name, candidate=True) from e
    except UnicodeError as e:
        raise ExecutionError('candidate_output_invalid', 'required UTF-8 output: ' + name, candidate=True) from e


def candidate_json(files, name, precise=False):
    try:
        return parse_json(candidate_text(files, name), decimal_numbers=precise)
    except ValueError as e:
        raise ExecutionError('candidate_output_invalid', 'invalid JSON output: ' + name, candidate=True) from e


@contextmanager
def run_lock(root):
    """An OS lock, released by the kernel on abrupt evaluator termination."""
    path = root / 'owner.lock'
    with path.open('a+b') as f:
        if path.stat().st_size == 0:
            f.write(b'0')
            f.flush()
        f.seek(0)
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(f.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as e:
            raise ExecutionError('run_busy', 'another evaluator owns this run') from e
        try:
            yield
        finally:
            f.seek(0)
            if os.name == 'nt':
                msvcrt.locking(f.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)


class Ledger:
    def __init__(self, root, create=False):
        self.root = root
        path = root / 'runs.sqlite3'
        if not create and not path.is_file():
            raise ExecutionError('run_format_invalid', 'version-one SQLite ledger required')
        self.db = sqlite3.connect(path)
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA synchronous=FULL')
        if create:
            self.db.executescript('''
                PRAGMA user_version=1;
                CREATE TABLE run(id TEXT PRIMARY KEY, created TEXT NOT NULL);
                CREATE TABLE cell(id INTEGER PRIMARY KEY, identity TEXT NOT NULL UNIQUE,
                  name TEXT NOT NULL UNIQUE, phase TEXT NOT NULL, cid TEXT,
                  exitcode INTEGER, failure TEXT);
                CREATE TABLE event(id INTEGER PRIMARY KEY, at TEXT NOT NULL,
                  cell_id INTEGER, kind TEXT NOT NULL, facts TEXT NOT NULL);
            ''')
            self.db.execute('INSERT INTO run VALUES(?,?)', (uuid.uuid4().hex, timestamp()))
            self.db.commit()
        if self.db.execute('PRAGMA user_version').fetchone()[0] != 1:
            raise ExecutionError('run_format_invalid', 'unknown ledger schema')
        self.run_id = self.db.execute('SELECT id FROM run').fetchone()[0]

    def close(self):
        self.db.close()

    def event(self, cell, kind, facts):
        self.db.execute('INSERT INTO event(at,cell_id,kind,facts) VALUES(?,?,?,?)',
                        (timestamp(), cell, kind, json.dumps(facts)))

    def allocate(self, identity):
        key = json.dumps(identity, sort_keys=True, ensure_ascii=False)
        row = self.db.execute('SELECT * FROM cell WHERE identity=?', (key,)).fetchone()
        if row:
            return dict(row)
        name = 'oc-l02-cell-' + uuid.uuid4().hex
        with self.db:
            cursor = self.db.execute('INSERT INTO cell(identity,name,phase) VALUES(?,?,?)', (key, name, 'planned'))
            self.event(cursor.lastrowid, 'cell_planned', identity)
        return dict(self.db.execute('SELECT * FROM cell WHERE id=?', (cursor.lastrowid,)).fetchone())

    def update(self, cell, **values):
        if not set(values) <= {'phase', 'cid', 'exitcode', 'failure'}:
            raise ValueError('unknown lifecycle field')
        with self.db:
            self.db.execute('UPDATE cell SET ' + ','.join(k + '=?' for k in values) + ' WHERE id=?', [*values.values(), cell['id']])
            self.event(cell['id'], 'lifecycle', values)
        cell.update(values)


def docker(argv, receipt):
    start = time.perf_counter()
    p = subprocess.run(['docker', *argv], capture_output=True, text=True, encoding='utf-8')
    atomic_bytes(receipt, json_bytes({'argv': ['docker', *argv], 'exitcode': p.returncode,
                 'stdout': p.stdout, 'stderr': p.stderr, 'wall_seconds': time.perf_counter() - start}))
    return p


def resolve_image(image, receipt):
    p = docker(['image', 'inspect', image], receipt)
    if p.returncode:
        raise ExecutionError('facility_image_unavailable', p.stderr)
    value = json.loads(p.stdout)
    if len(value) != 1:
        raise ExecutionError('facility_image_invalid', 'exactly one prepared image required')
    return value[0]['Id']


def validate_capsule(capsule, program, source):
    try:
        actual = archived_json(capsule, 'program.json', True)
        if not same_json_value(actual, program) or {n[8:]: v for n, v in capsule.items() if n.startswith('project/')} != source:
            raise ExecutionError('facility_program_identity_changed', 'capsule differs from frozen program/source')
    except (KeyError, ValueError, TypeError) as e:
        raise ExecutionError('facility_program_identity_changed', str(e)) from e


def prepared_members(capsule):
    return {name: value for name, value in capsule.items() if name == 'program.json' or name.startswith(('project/', 'input/'))}


def sandbox_valid(native):
    try:
        host = native['HostConfig'];config = native['Config']
        mounts = {(m['Destination'], m['RW']) for m in native['Mounts'] if m['Type'] == 'bind'}
        required_env = {'PYTHONDONTWRITEBYTECODE=1', 'OPENBLAS_NUM_THREADS=1', 'OMP_NUM_THREADS=1', 'MPLCONFIGDIR=/tmp/matplotlib'}
        return all([host['NetworkMode'] == 'none', host['NanoCpus'] == 10**9,
            host['ReadonlyRootfs'] is True, host['Privileged'] is False,
            host['RestartPolicy']['Name'] == 'no', type(native['RestartCount']) is int, native['RestartCount'] == 0,
            set(host['CapDrop']) == {'ALL'}, 'no-new-privileges' in host['SecurityOpt'],
            set(host['Tmpfs']) == {'/tmp'}, len(native['Mounts']) == 3,
            mounts == {('/project', False), ('/input', False), ('/output', True)},
            config['WorkingDir'] == '/project', required_env <= set(config['Env'])])
    except (KeyError, TypeError):
        return False


def validate_terminal(native, cell, program, image, run_id, *, require_success=True):
    try:
        labels = native['Config'].get('Labels') or {}
        checks = [native['Id'] == cell['cid'], native['Name'] == '/' + cell['name'], native['Image'] == image,
                  native['Path'] == program['argv'][0], native['Args'] == program['argv'][1:],
                  labels.get('oc.l02.run') == run_id, labels.get('oc.l02.cell') == str(cell['id']),
                  native['State']['Status'] == 'exited', type(native['State']['ExitCode']) is int,
                  type(cell['exitcode']) is int, native['State']['ExitCode'] == cell['exitcode'],
                  sandbox_valid(native)]
        if require_success:
            checks.append(native['State']['ExitCode'] == 0)
        if not all(checks):
            raise ExecutionError('facility_terminal_identity_changed', str(cell['id']))
    except (KeyError, ValueError, TypeError) as e:
        raise ExecutionError('facility_terminal_identity_changed', str(e)) from e


def validate_native_termination(native):
    state = native['State']
    if state.get('OOMKilled') is not False or state.get('Error'):
        raise ExecutionError('facility_native_termination_unresolved', 'OOM or runtime error requires facility investigation')
    if state['ExitCode'] >= 128:
        raise ExecutionError('facility_native_termination_unresolved', 'possible signal-style exit lacks qualified termination provenance')


def bound_execution(row, identity, declaration, source, image, run_id):
    objects = row['objects'];prepared = objects.get('prepared')
    if row['phase'] != 'failed' and row['failure'] is not None:
        raise ExecutionError('facility_cell_state_invalid', 'failure record disagrees with lifecycle')
    if row['phase'] in ('planned','prepared') and (row['cid'] is not None or row['exitcode'] is not None):
        raise ExecutionError('facility_cell_state_invalid', 'uncreated cell carries a terminal identity')
    if row['phase'] in ('created','running','terminal','verified','failed') and (type(row['cid']) is not str or not row['cid']):
        raise ExecutionError('facility_cell_state_invalid', 'created cell requires its original CID')
    if prepared is None:
        if row['phase'] != 'planned' or objects:
            raise ExecutionError('facility_archive_unavailable', 'original prepared cell '+str(row['id']))
        return None
    validate_capsule(prepared, declaration, source)
    if prepared_members(prepared) != prepared:
        raise ExecutionError('facility_prepared_identity_changed', str(row['id']))
    for name in ('terminal','accepted'):
        if name in objects:
            validate_capsule(objects[name], declaration, source)
            if prepared_members(objects[name]) != prepared:
                raise ExecutionError('facility_accepted_identity_changed', str(row['id'])+':'+name)
    terminal = objects.get('terminal');accepted = objects.get('accepted')
    if accepted is not None and (terminal is None or {k:v for k,v in accepted.items() if k!='assessment.json'} != terminal):
        raise ExecutionError('facility_accepted_identity_changed', 'accepted does not close its original terminal')
    if row['phase'] in ('verified','failed') and terminal is None:
        raise ExecutionError('facility_archive_unavailable', 'original terminal cell '+str(row['id']))
    if row['phase']=='verified' and accepted is None or row['phase']=='failed' and accepted is not None:
        raise ExecutionError('facility_cell_state_invalid', 'final phase disagrees with accepted object')
    if terminal is None:
        return None
    if row['phase'] not in ('terminal','verified','failed'):
        raise ExecutionError('facility_cell_state_invalid', 'terminal object disagrees with original lifecycle')
    native = archived_json(terminal,'terminal-inspect.json')
    validate_terminal(native,row,declaration,image,run_id,require_success=row['phase']=='verified')
    validate_native_termination(native)
    return {'cell':row, 'identity':identity, 'program':declaration, 'native':native,
            'terminal':terminal, 'accepted':accepted}


class Executor:
    def __init__(self, ledger, image, observer=None):
        self.ledger = ledger
        self.root = ledger.root
        self.image = image
        self.observer = observer or (lambda stage, cell: None)

    def invoke(self, identity, program, files, input_factory, validate):
        if not callable(input_factory):
            raise ExecutionError('facility_input_factory_invalid', 'one prepare-once callable required')
        cell = self.ledger.allocate(identity)
        job = self.root / 'cells' / str(cell['id'])
        job.mkdir(parents=True, exist_ok=True)
        archive = job / 'prepared.zip'
        source = {'project/' + name: value for name, value in files.items()}
        if archive.exists():
            prepared = read_archive(archive)
            validate_capsule(prepared, program, files)
            if prepared_members(prepared) != prepared:
                raise ExecutionError('facility_prepared_identity_changed', 'unknown prepared member')
        else:
            if cell['phase'] != 'planned':
                raise ExecutionError('facility_archive_unavailable', str(archive))
            inputs = input_factory()
            if type(inputs) is not dict or any(type(n) is not str or type(v) is not bytes for n, v in inputs.items()):
                raise ExecutionError('facility_input_factory_invalid', 'relative filename to original bytes required')
            for name in inputs:
                safe_relative(name)
            prepared = {**source, **{'input/' + name: value for name, value in inputs.items()},
                        'program.json': json_bytes(program)}
            self.observer('before_prepared_publish', dict(cell))
            atomic_bytes(archive, zip_bytes(prepared))
            self.observer('prepared_published', dict(cell))
        if cell['phase'] == 'failed':
            self.cleanup(cell, job)
            failure = json.loads(cell['failure'])
            raise ExecutionError(failure['code'], failure['detail'], candidate=True)
        if cell['phase'] == 'verified':
            accepted = read_archive(job / 'accepted.zip')
            validate_capsule(accepted, program, files)
            if prepared_members(accepted) != prepared:
                raise ExecutionError('facility_accepted_identity_changed', str(cell['id']))
            validate_terminal(archived_json(accepted, 'terminal-inspect.json'), cell, program, self.image, self.ledger.run_id)
            self.cleanup(cell, job)
            return accepted
        work = job / 'work'
        if not work.exists():
            stage = job / ('materialize-' + uuid.uuid4().hex)
            for name, value in prepared.items():
                if name == 'program.json':
                    continue
                target = stage / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(value)
            (stage / 'output').mkdir()
            os.replace(stage, work)
        for prefix in ('project', 'input'):
            actual = regular_bytes(work / prefix)
            expected = {n[len(prefix) + 1:]: v for n, v in prepared.items() if n.startswith(prefix + '/')}
            if actual != expected:
                raise ExecutionError('facility_materialization_changed', prefix)
        if cell['phase'] == 'planned':
            self.ledger.update(cell, phase='prepared')
        receipt = lambda name: job / (name + '-' + uuid.uuid4().hex[:8] + '.json')
        if cell['cid'] is None:
            listed = docker(['container', 'ls', '-a', '--filter', 'name=^/' + cell['name'] + '$', '--format', '{{.ID}}'], receipt('discover'))
            if listed.returncode:
                raise ExecutionError('facility_executor_unavailable', listed.stderr)
            if not listed.stdout.strip():
                argv = ['create', '--name', cell['name'], '--label', 'oc.l02.run=' + self.ledger.run_id,
                        '--label', 'oc.l02.cell=' + str(cell['id']), '--network', 'none', '--cpus', '1',
                        '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
                        '--tmpfs', '/tmp:rw,nosuid,nodev,size=512m', '--workdir', '/project',
                        '--env', 'PYTHONDONTWRITEBYTECODE=1', '--env', 'OPENBLAS_NUM_THREADS=1',
                        '--env', 'OMP_NUM_THREADS=1', '--env', 'MPLCONFIGDIR=/tmp/matplotlib']
                for prefix in ('project', 'input', 'output'):
                    argv += ['--mount', 'type=bind,source=' + str((work / prefix).resolve()) + ',target=/' + prefix + (',readonly' if prefix != 'output' else '')]
                argv += ['--entrypoint', program['argv'][0], self.image, *program['argv'][1:]]
                created = docker(argv, receipt('create'))
                if created.returncode:
                    raise ExecutionError('facility_executor_create_failed', created.stderr)
                self.observer('create_returned', dict(cell))
            native = self.inspect(cell['name'], receipt('adopt'))
            self.bind(native, cell, work, program)
            self.ledger.update(cell, cid=native['Id'], phase='created')
            self.observer('created', dict(cell))
        native = self.inspect(cell['cid'], receipt('inspect'))
        self.bind(native, cell, work, program)
        status = native['State']['Status']
        if status == 'created':
            started = docker(['start', cell['cid']], receipt('start'))
            if started.returncode:
                raise ExecutionError('facility_executor_start_failed', started.stderr)
            self.observer('start_returned', dict(cell))
            self.ledger.update(cell, phase='running')
            self.observer('running', dict(cell))
            status = 'running'
        if status == 'running':
            waited = docker(['wait', cell['cid']], receipt('wait'))
            if waited.returncode:
                raise ExecutionError('facility_executor_wait_failed', waited.stderr)
            native = self.inspect(cell['cid'], receipt('terminal-inspect'))
            self.bind(native, cell, work, program)
            status = native['State']['Status']
        if status != 'exited':
            raise ExecutionError('facility_executor_state_unresolved', status)
        self.ledger.update(cell, phase='terminal', exitcode=native['State']['ExitCode'])
        terminal = job / 'terminal.zip'
        if not terminal.exists():
            logged = docker(['logs', cell['cid']], receipt('logs'))
            if logged.returncode:
                raise ExecutionError('facility_executor_logs_failed', logged.stderr)
            invalid_output = None
            try:
                output = regular_bytes(work / 'output')
            except ExecutionError as e:
                output = {}
                invalid_output = {'code': 'candidate_output_invalid', 'detail': e.detail,
                    'inventory': [{'path': p.relative_to(work / 'output').as_posix(), 'symlink': p.is_symlink()} for p in (work / 'output').rglob('*')]}
            sealed = {**prepared, **{'output/' + n: v for n, v in output.items()},
                      'terminal-inspect.json': json_bytes(native),
                      'stdout.txt': logged.stdout.encode('utf-8'), 'stderr.txt': logged.stderr.encode('utf-8')}
            if invalid_output:
                sealed['invalid-output.json'] = json_bytes(invalid_output)
            atomic_bytes(terminal, zip_bytes(sealed))
            self.observer('terminal_sealed', dict(cell))
        sealed = read_archive(terminal)
        if 'invalid-output.json' in sealed:
            self.fail(cell, 'candidate_output_invalid', archived_json(sealed, 'invalid-output.json')['detail'])
        validate_native_termination(archived_json(sealed, 'terminal-inspect.json'))
        if cell['exitcode'] != 0:
            self.fail(cell, 'candidate_program_failed', 'native exit ' + str(cell['exitcode']) + '; self-reported status is not facility evidence')
        try:
            assessment = validate(sealed)
        except ExecutionError as e:
            if e.candidate:
                self.fail(cell, e.code, e.detail)
            raise
        except Exception as e:
            # Unknown host failures retain the original terminal object for repair.
            # A candidate's stdout/status never supplies this classification.
            raise ExecutionError('facility_validator_failed', type(e).__name__ + ': ' + str(e)) from e
        accepted = {**sealed, 'assessment.json': json_bytes(assessment)}
        if (job / 'accepted.zip').exists():
            if read_archive(job / 'accepted.zip') != accepted:
                raise ExecutionError('facility_accepted_identity_changed', str(cell['id']))
        else:
            atomic_bytes(job / 'accepted.zip', zip_bytes(accepted))
            self.observer('accepted_sealed', dict(cell))
        self.ledger.update(cell, phase='verified')
        self.observer('verified', dict(cell))
        self.cleanup(cell, job)
        return accepted

    def fail(self, cell, code, detail):
        failure = {'code': code, 'detail': detail}
        self.ledger.update(cell, phase='failed', failure=json.dumps(failure))
        job = self.root / 'cells' / str(cell['id'])
        if (job / 'terminal.zip').is_file():
            self.cleanup(cell, job)
        raise ExecutionError(code, detail, candidate=True)

    def inspect(self, identity, receipt):
        p = docker(['inspect', identity], receipt)
        if p.returncode:
            raise ExecutionError('facility_original_container_unresolved', identity + ':' + p.stderr)
        objects = json.loads(p.stdout)
        if len(objects) != 1:
            raise ExecutionError('facility_original_container_unresolved', identity)
        return objects[0]

    def bind(self, native, cell, work, program):
        config = native['Config']
        labels = config.get('Labels') or {}
        expected_mounts = {('/' + key, os.path.normcase(str((work / key).resolve())), key == 'output') for key in ('project', 'input', 'output')}
        mounts = {(m['Destination'], os.path.normcase(m['Source']), m['RW']) for m in native['Mounts'] if m['Type'] == 'bind'}
        checks = [native['Name'] == '/' + cell['name'], native['Image'] == self.image,
                  labels.get('oc.l02.run') == self.ledger.run_id, labels.get('oc.l02.cell') == str(cell['id']),
                  native['Path'] == program['argv'][0], native['Args'] == program['argv'][1:],
                  sandbox_valid(native), mounts == expected_mounts]
        if cell['cid']:
            checks.append(native['Id'] == cell['cid'])
        if not all(checks):
            raise ExecutionError('facility_container_identity_mismatch', cell['name'])

    def cleanup(self, cell, job):
        if not cell['cid']:
            return
        listed = docker(['container', 'ls', '-a', '--filter', 'id=' + cell['cid'], '--format', '{{.ID}}'], job / ('cleanup-discover-' + uuid.uuid4().hex[:8] + '.json'))
        if listed.returncode:
            raise ExecutionError('facility_executor_cleanup_failed', listed.stderr)
        if listed.stdout.strip():
            native = self.inspect(cell['cid'], job / ('cleanup-inspect-' + uuid.uuid4().hex[:8] + '.json'))
            if native['Id'] != cell['cid'] or native['State']['Status'] != 'exited' or (native['Config'].get('Labels') or {}).get('oc.l02.run') != self.ledger.run_id:
                raise ExecutionError('facility_executor_cleanup_identity', cell['cid'])
            p = docker(['rm', cell['cid']], job / ('cleanup-' + uuid.uuid4().hex[:8] + '.json'))
            if p.returncode:
                raise ExecutionError('facility_executor_cleanup_failed', p.stderr)
        with self.ledger.db:
            self.ledger.event(cell['id'], 'cleanup_confirmed', {'container_id': cell['cid']})
