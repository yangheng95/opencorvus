"""One read-only inspection for complete, pending and failed execution objects."""
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import tempfile

from l02_execution import (ExecutionError, archived_json, json_bytes, regular_bytes,
    unzip_bytes, run_lock, candidate_json, bound_execution)
from l02_pipeline import (assemble, assess_report, assess_forecast, assess_selector,
    verify_forecast_inputs, verify_selector_inputs, selection_packet)
from l02_report import identity_key, report_inputs, provenance_coverage
from l02_scoring import load_study
from l02_study_data import StudySource, validate_pool, validate_assignment, numeric_assignment, extract_data
from material_contract import parse_json, same_json_value

PHASES = {'planned', 'prepared', 'created', 'running', 'terminal', 'verified', 'failed'}


def capture(root):
    """Hold the existing owner lock only while collecting canonical original facts."""
    originals = {}
    def original(name):
        value = regular_bytes(root, [name])[name]
        originals[name] = value
        return unzip_bytes(value)
    with run_lock(root):
        with closing(sqlite3.connect((root/'runs.sqlite3').as_uri()+'?mode=ro', uri=True)) as db:
            db.row_factory = sqlite3.Row;db.execute('BEGIN')
            if db.execute('PRAGMA user_version').fetchone()[0] != 1:
                raise ExecutionError('run_format_invalid', 'version-one ledger required')
            runs = db.execute('SELECT * FROM run').fetchall()
            if len(runs) != 1:
                raise ExecutionError('run_format_invalid', 'one original run required')
            run_id = runs[0]['id']
            rows = [dict(row) for row in db.execute('SELECT * FROM cell ORDER BY id')]
            events = [dict(row) for row in db.execute('SELECT * FROM event ORDER BY id')]
        # This is an immutable observation of SQLite's existing facts, not new state.
        originals['ledger-snapshot.json'] = json_bytes({'format':'l02-ledger-snapshot/1',
            'run_id':run_id,'run':dict(runs[0]),'cells':rows,'events':events})
        sealed = original('registration.zip')
        for row in rows:
            if type(row['id']) is not int or row['id'] <= 0 or row['phase'] not in PHASES:
                raise ExecutionError('facility_cell_state_invalid', str(row['id']))
            row['objects'] = {}
            for name in ('prepared', 'terminal', 'accepted'):
                relative = 'cells/'+str(row['id'])+'/'+name+'.zip'
                if (root/relative).exists():
                    row['objects'][name] = original(relative)
    return sealed, run_id, rows, events, originals


def inspect_run(root):
    root = root.resolve()
    sealed, run_id, rows, events, originals = capture(root)
    reg = archived_json(sealed,'registration.json')
    if reg.get('format')!='l02-execution-registration/1':
        raise ExecutionError('run_format_invalid','original registration required')
    manifest = archived_json(sealed,'submission/submission.json',True)
    pool, methods = validate_pool(manifest['pool'])
    source = {n[11:]:v for n,v in sealed.items() if n.startswith('submission/')}
    with tempfile.TemporaryDirectory(prefix='l02-sealed-reader-') as tmp:
        extract_data(sealed,Path(tmp));study=load_study(Path(tmp)/'study.json')
        data=StudySource(Path(tmp)/'raw',Path(tmp)/'material-contract.json',study)
        formal=validate_assignment(data,reg)
        numeric=numeric_assignment(data,pool,reg['outer_ids']);expected=[*numeric,{'kind':'report'}]
        expected_keys={identity_key(i) for i in expected};rowmap={}
        for row in rows:
            identity=parse_json(row['identity']);key=identity_key(identity)
            if key not in expected_keys or key in rowmap:
                raise ExecutionError('facility_cell_assignment_invalid','unknown or repeated original identity')
            rowmap[key]=row
        outcomes={};records={};facilities=[]
        def outcome(identity,status,reason,**details):
            key=identity_key(identity);row=rowmap.get(key)
            value={'identity':identity,'outcome':status,'reason':reason,'dependencies':[],
                   'cell_id':None if row is None else row['id'], 'phase':None if row is None else row['phase'],**details}
            outcomes[key]=value
            if status=='facility_error':facilities.append(value)
            return value
        # Binding is shared by success/failure and precedes all candidate checks.
        for identity in expected:
            key=identity_key(identity);row=rowmap.get(key)
            if row is None:continue
            declaration=manifest['programs'][identity['kind']]
            programme_source={name:source[name] for name in declaration['files']}
            try:
                record=bound_execution(row,identity,declaration,programme_source,reg['image_id'],run_id)
                if record is not None:records[key]=record
            except ExecutionError as e:
                outcome(identity,'facility_error',e.code,detail=e.detail)
        def dependencies(identity):
            if identity['kind']=='report':return numeric
            if identity['kind']=='select':return [i for i in numeric if i['kind']=='predict' and i['outer_id']==identity['outer_id'] and i['level']=='inner']
            return []
        def assess(identity,check,input_check):
            key=identity_key(identity)
            if key in outcomes:return
            row=rowmap.get(key);record=records.get(key)
            deps=dependencies(identity)
            roots=[outcomes[identity_key(i)] for i in deps if outcomes[identity_key(i)]['outcome'] in ('candidate_failed','blocked_candidate')]
            ready=all(outcomes[identity_key(i)]['outcome']=='verified' for i in deps)
            if not ready:
                if record is not None:
                    outcome(identity,'facility_error','facility_dependency_execution_invalid',detail='executed before all required original inputs were verified');return
                if roots:
                    outcome(identity,'blocked_candidate','candidate_dependency_failed',dependencies=[r['identity'] for r in roots]);return
                outcome(identity,'unassessed','required_inputs_not_yet_verified',dependencies=[i for i in deps if outcomes[identity_key(i)]['outcome']!='verified']);return
            if row is None or record is None:
                outcome(identity,'unassessed','not_scheduled' if row is None else 'native_or_capture_pending');return
            terminal=record['terminal'];native=record['native']
            try:
                input_check(terminal)
                if row['phase'] not in ('verified','failed'):
                    outcome(identity,'unassessed','terminal_awaiting_host_assessment',native_exit=native['State']['ExitCode']);return
                failure = parse_json(row['failure']) if row['failure'] is not None else None
                if row['phase']=='failed' and (type(failure) is not dict or set(failure)!={'code','detail'} or any(type(failure[k]) is not str for k in failure)):
                    raise ExecutionError('facility_failure_record_invalid','original typed error record required')
                if native['State']['ExitCode'] != 0:
                    if row['phase']!='failed' or failure['code']!='candidate_program_failed':
                        raise ExecutionError('facility_failed_outcome_contradiction','native exit and host classification disagree')
                    outcome(identity,'candidate_failed','candidate_program_failed',candidate_state='verified_fail',native_exit=native['State']['ExitCode']);return
                if row['phase']=='failed' and failure['code']=='candidate_program_failed':
                    raise ExecutionError('facility_failed_outcome_contradiction','reported nonzero program exit but original native exit is zero')
                if 'invalid-output.json' in terminal:
                    if row['phase']!='failed' or failure['code']!='candidate_output_invalid':
                        raise ExecutionError('facility_failed_outcome_contradiction','invalid filesystem output and original failure reason disagree')
                    outcome(identity,'candidate_failed','candidate_output_invalid',candidate_state='verified_fail',native_exit=0);return
                try:value=check(terminal)
                except ExecutionError as e:
                    if not e.candidate:raise
                    if row['phase']!='failed':raise ExecutionError('facility_verified_output_contradiction',e.code) from e
                    if failure['code']!=e.code:
                        raise ExecutionError('facility_failed_outcome_contradiction','original typed failure differs from actual output checker: '+e.code) from e
                    outcome(identity,'candidate_failed',e.code,candidate_state='candidate_incomplete' if e.code=='candidate_output_missing' else 'verified_fail',native_exit=0);return
                if row['phase']=='failed':
                    raise ExecutionError('facility_failed_outcome_contradiction','original failed label but actual source/input/output check passes')
                if not same_json_value(value,archived_json(record['accepted'],'assessment.json')):
                    raise ExecutionError('facility_metric_assessment_invalid','original accepted assessment differs from recomputation')
                outcome(identity,'verified','original_execution_and_checker_closed',native_exit=0)
            except ExecutionError as e:
                outcome(identity,'facility_error',e.code,detail=e.detail)
            except Exception as e:
                outcome(identity,'facility_error','facility_validator_failed',detail=type(e).__name__+': '+str(e))
        # Independent forecast inputs do not depend on selector or other forecasts.
        for identity in numeric:
            if identity['kind']!='predict':continue
            method=methods[identity['method_id']];origin=identity['origin_id']
            assess(identity,lambda files,m=method,o=origin:assess_forecast(files,data,o,m,study),
                   lambda files,m=method,o=origin:verify_forecast_inputs(files,data,o,m))
        def selector_packet(identity):
            return selection_packet(data,identity['outer_id'],pool,
                lambda origin,method:candidate_json(records[identity_key({'kind':'predict','outer_id':identity['outer_id'],'origin_id':origin,'method_id':method,'level':'inner'})]['accepted'],'output/result/forecast.json',True))
        for identity in numeric:
            if identity['kind']!='select':continue
            assess(identity,lambda files,i=identity:assess_selector(files,selector_packet(i),study),
                   lambda files,i=identity:verify_selector_inputs(files,selector_packet(i),study))
        complete_numeric=all(outcomes[identity_key(i)]['outcome']=='verified' for i in numeric)
        numerical=None;coverage=None;report_identity={'kind':'report'}
        if complete_numeric:
            numerical=assemble(data,reg,pool,methods,study,
                lambda identity,method:records[identity_key(identity)]['accepted'],
                lambda identity,payload:records[identity_key(identity)]['accepted'])
            expected_report_inputs=report_inputs(numerical,[records[identity_key(i)] for i in numeric])
            assess(report_identity,lambda files:assess_report(files,reg['outer_ids']),
                   lambda files:provenance_coverage(files,expected_report_inputs))
            if outcomes[identity_key(report_identity)]['outcome']=='verified':
                coverage=provenance_coverage(records[identity_key(report_identity)]['accepted'],expected_report_inputs)
        else:
            assess(report_identity,lambda _:None,lambda _:None)
        complete=all(v['outcome']=='verified' for v in outcomes.values())
        # A known host interruption is active only while its original run remains open.
        if not complete:
            interruptions=[e for e in events if e['kind'] in ('execution_interrupted','requested_execution_complete')]
            if interruptions and interruptions[-1]['kind']=='execution_interrupted':
                fact=parse_json(interruptions[-1]['facts']);code=fact.get('code')
                if type(code) is str and code.startswith('facility_'):
                    facilities.append({'reason':code,'event_id':interruptions[-1]['id'],'scope':'active host interruption'})
        cells=[outcomes[identity_key(i)] for i in expected]
        summary={'status':'run_invalid' if facilities else 'sealed_requested_matrix_recomputed' if complete else 'assessment_incomplete',
            'outer_ids':reg['outer_ids'],'complete_assignment':set(reg['outer_ids'])==set(reg['all_outer_ids']),
            'formal_full_assignment':formal,'expected_cells':len(expected),'observed_cells':len(rows),
            'counts':{s:sum(v['outcome']==s for v in cells) for s in ('verified','candidate_failed','blocked_candidate','unassessed','facility_error')},
            'cells':cells,'facility_findings':facilities,'forecast_cells':sum(i['kind']=='predict' and outcomes[identity_key(i)]['outcome']=='verified' for i in numeric),
            'verified_cells':sum(v['outcome']=='verified' for v in cells),'report_provenance':coverage,
            'selected_methods':None if numerical is None else {r['outer_id']:r['selected_method_id'] for r in numerical['outer_results']},
            'aggregate_exact':None if numerical is None else numerical['aggregate_exact'],
            'study_complete':None,'quality_success':None,'candidate_score':None,
            'scope':'original expected assignments and source/native/checker facts; unexecuted independent cells remain unassessed; full grader pending'}
        return {'summary':summary,'numerical':numerical,'records':records,'originals':originals,
                'registration':reg,'manifest':manifest,'data':data,'study':study,'run_id':run_id}


def read_completed(root):
    result=inspect_run(root);summary=result['summary']
    if summary['status']=='run_invalid':
        raise ExecutionError('facility_sealed_run_invalid',str(summary['facility_findings']))
    if summary['status']!='sealed_requested_matrix_recomputed':
        raise ExecutionError('assessment_incomplete','original requested execution is not fully verified')
    return summary,result['numerical']
