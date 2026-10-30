"""L01 case-only assessment of closed source/native objects; never executes candidate code.

Archive identities bind an independent review to immutable captured objects. They
are not scientific, source-style, newline or functional correctness tests.
"""
from pathlib import Path,PurePosixPath
import argparse,hashlib,json,math,sys,zipfile
import numpy as np
from review_anchors import anchors as review_anchors,VERSION as ANCHOR_VERSION

def shared_tools():
    here=Path(__file__).resolve()
    for parent in here.parents:
        target=parent/'script/benchmark/pinn_submission_check.py'
        if target.is_file():sys.path.insert(0,str(target.parent));break
    import pinn_submission_check as reader
    return reader
reader=shared_tools()
from pinn_numeric_check import canonical_data

class Facility(ValueError):pass
class TraceContract(ValueError):pass
STATES={'verified_pass','verified_fail','blocked','unassessed'}
COSTS=('closure_calls','gradient_calls','hvp_calls','lbfgs_native_iterations')
def ensure(condition,code):
    if not condition:raise Facility(code)
def trace_require(condition,code):
    if not condition:raise TraceContract(code)
def integer(v):return type(v) is int and v>=0
def number(v):return type(v) in (int,float) and math.isfinite(v)
def json_value(x):return json.dumps(x,sort_keys=True,ensure_ascii=False,allow_nan=False,separators=(',',':'))
def load(p):return reader.read_json(Path(p))
def save(p,x):Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
def maximum(policy,leaf):return policy['targets'][leaf['id'].split('-')[2]][leaf['metric']]
def closed_identity(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as stream:
        for b in iter(lambda:stream.read(1024*1024),b''):h.update(b)
    return {'sha256':h.hexdigest(),'bytes':Path(path).stat().st_size,'meaning':'identity of the entire closed evidence object, not correctness of mutable source'}
def copy_members(archive,destination,prefix=None,exclude_prefix=None,opaque=None):
    seen=set()
    try:
        with zipfile.ZipFile(archive) as z:
            for info in z.infolist():
                name=info.filename;part=PurePosixPath(name)
                ensure(name and '\\' not in name and ':' not in name and not part.is_absolute() and '..' not in part.parts and all(ord(c)>=32 for c in name),'facility_capsule_member')
                ensure(name not in seen,'facility_capsule_duplicate_member');seen.add(name)
                if exclude_prefix is not None and name.startswith(exclude_prefix):continue
                if prefix is not None:
                    if not name.startswith(prefix):continue
                    part=PurePosixPath(name[len(prefix):])
                if not part.parts or info.is_dir():continue
                if part.suffix=='.pt':
                    if opaque is not None:opaque.append({'member':name,'bytes':info.file_size,'scope':'opaque candidate state preserved in original closed capsule; never unpickled or copied as an executable by this evaluator'})
                    continue
                target=(destination/part).resolve();ensure(target.is_relative_to(destination.resolve()),'facility_capsule_scope')
                target.parent.mkdir(parents=True,exist_ok=True)
                # Always materialize regular bytes; never preserve a ZIP symlink/device mode.
                with z.open(info) as source,target.open('wb') as output:
                    import shutil
                    shutil.copyfileobj(source,output)
    except (OSError,ValueError,zipfile.BadZipFile,RuntimeError) as e:
        if isinstance(e,Facility):raise
        raise Facility('facility_capsule_read:'+str(e)) from e

def authorities(profile,rubric,policy):
    ensure(profile.get('case')=='L01' and rubric.get('case')=='L01','facility_contract_identity')
    base=profile.get('base_configurations');cont=profile.get('continuations')
    ensure(type(base) is list and type(cont) is list and len(base)==19 and len(cont)==5,'facility_registered_matrix')
    ids=[v.get('id') for v in base+cont];ensure(all(type(v) is str and v for v in ids) and len(set(ids))==len(ids),'facility_registered_ids')
    for spec in base:
        ensure(spec.get('problem') in ('convection','reaction','wave') and spec.get('method') in ('adam','lbfgs','hybrid') and integer(spec.get('seed')) and spec['seed']>0 and integer(spec.get('max_updates')) and spec['max_updates']>0,'facility_base_configuration')
        ensure((number(spec.get('adam_learning_rate')) and spec['adam_learning_rate']>0) if spec['method']!='lbfgs' else spec.get('adam_learning_rate') is None,'facility_adam_parameter')
        ensure((integer(spec.get('adam_updates_before_switch')) and 0<spec['adam_updates_before_switch']<spec['max_updates']) if spec['method']=='hybrid' else spec.get('adam_updates_before_switch') is None,'facility_hybrid_parameter')
    for spec in cont:ensure(spec.get('method') in ('gd','nncg') and integer(spec.get('updates')) and spec['updates']>0 and number(spec.get('value')) and spec['value']>0,'facility_continuation_configuration')
    leaves=rubric.get('leaves');ensure(type(leaves) is list and leaves,'facility_rubric_shape')
    ids=[v.get('id') for v in leaves];ensure(all(type(i) is str and i for i in ids) and len(set(ids))==len(ids),'facility_rubric_ids')
    ensure(all(number(v.get('weight')) and v['weight']>0 and type(v.get('critical')) is bool and type(v.get('requirement')) is str for v in leaves),'facility_rubric_leaf')
    ensure({v.get('group') for v in leaves}=={'A','B','C','D','R','E'},'facility_rubric_groups')
    ensure(abs(math.fsum(v['weight'] for v in leaves)-100)<=1e-9,'facility_fixed_denominator')
    quality=[v for v in leaves if v.get('group')=='R' and 'metric' in v]
    ensure(len(quality)==14 and all(v['critical'] for v in quality),'facility_quality_leaves')
    ensure(policy.get('format')=='l01-quality-targets/1' and policy.get('case')=='L01','facility_quality_policy')
    targets=policy.get('targets');ensure(type(targets) is dict and set(targets)=={'convection','reaction','wave'} and policy.get('comparison')=='<=','facility_quality_coverage')
    for problem in targets:
        expected={v['metric'] for v in quality if v['id'].split('-')[2]==problem}
        ensure(type(targets[problem]) is dict and set(targets[problem])==expected,'facility_quality_coverage')
    for leaf in quality:
        t=maximum(policy,leaf);ensure(number(t) and t>=0,'facility_quality_target')
    outcomes=rubric.get('outcome_contract');ensure(type(outcomes) is dict and number(outcomes.get('minimum_score')) and 0<=outcomes['minimum_score']<=100 and type(outcomes.get('independent_review_count')) is int and outcomes['independent_review_count']==1,'facility_outcome_contract')
    delivery={v['id'] for v in leaves if v['group']=='R' and v['id'] not in {q['id'] for q in quality}}
    ensure(type(outcomes.get('study_delivery_ids')) is list and set(outcomes['study_delivery_ids'])==delivery,'facility_delivery_contract')
    ensure(len(review_anchors(leaves,profile))==len(leaves),'facility_anchor_coverage')
    semantic={'profile':{k:profile[k] for k in ('benchmark','case','base_configurations','continuations','selection','solution_selection')},'leaves':[{k:v[k] for k in ('id','group','weight','critical','requirement')} for v in sorted(leaves,key=lambda v:v['id'])],'quality_targets':targets,'outcome_contract':outcomes,'anchor_contract_version':ANCHOR_VERSION}
    json_value(semantic)
    return leaves,quality,semantic

def native_context(folder):
    captured=load(folder/'inspect.json');ensure(type(captured.get('exit_code')) is int and captured['exit_code']==0,'facility_native_capture')
    values=json.loads(captured['stdout']);ensure(type(values) is list and len(values)==1,'facility_native_inspect_shape')
    inspect=values[0];state=inspect['State']
    ensure(state.get('Running') is False and state.get('Paused') is False and state.get('Status')=='exited' and type(state.get('ExitCode')) is int,'facility_native_not_terminal')
    ensure(type(state.get('StartedAt')) is str and not state['StartedAt'].startswith('0001-') and type(state.get('FinishedAt')) is str and not state['FinishedAt'].startswith('0001-'),'facility_native_unstarted')
    source_mount=[m for m in inspect['Mounts'] if m['Destination']=='/project'];ensure(len(source_mount)==1 and source_mount[0]['RW'] is False,'facility_source_mount')
    ensure(inspect['HostConfig']['NetworkMode']=='none','facility_network_contract')
    cmd=inspect['Config']['Cmd'];ensure(type(cmd) is list and all(type(v) is str for v in cmd),'facility_native_command')
    return inspect,source_mount[0]['Source']

def trace_facts(root,record,spec):
    trace_path=reader.artifact(root,record['trace'],'actual attempt trace')
    count={p:{'attempts':0,'accepted_updates':0,'terminal_checks':0,'zero_or_failed_attempts':0} for p in record['phases']}
    last_cost=None;closed=set();active=None;last_rows={};line_count=0;sequence=[]
    expected_order=['adam','lbfgs'] if spec['method']=='hybrid' else [spec['method']]
    with trace_path.open(encoding='utf-8') as stream:
        for index,line in enumerate(stream,1):
            if not line.strip():continue
            try:
                row=json.loads(line,parse_constant=lambda x:(_ for _ in ()).throw(TraceContract('trace_nonfinite_json')))
                trace_require(type(row) is dict,'trace_row_type')
                phase=row.get('phase');trace_require(phase in count,'trace_phase')
                if active!=phase:
                    trace_require(phase not in closed,'trace_phase_reentry')
                    if active:closed.add(active)
                    sequence.append(phase);trace_require(sequence==expected_order[:len(sequence)],'trace_phase_order');active=phase
                state=count[phase];terminal=row.get('terminal_check',False);trace_require(type(terminal) is bool,'trace_terminal_check_type')
                trace_require(phase not in closed,'trace_after_terminal')
                trace_require(integer(row.get('attempt')) and integer(row.get('accepted_after')),'trace_counter_type')
                if terminal:
                    trace_require(state['terminal_checks']==0 and row['attempt']==state['attempts'] and row['accepted_after']==state['accepted_updates'],'trace_terminal_check_counts')
                    trace_require(number(row.get('step_inf')) and row['step_inf']==0 and number(row.get('gradient_inf_after')),'trace_terminal_check_values')
                    bound=1e-9 if phase=='lbfgs' else 0.
                    trace_require(row['gradient_inf_after']<=bound,'trace_terminal_gradient')
                    state['terminal_checks']+=1;closed.add(phase);last_rows[phase]=row;line_count+=1;continue
                trace_require(state['terminal_checks']==0 and row['attempt']==state['attempts']+1,'trace_attempt_sequence')
                trace_require(integer(row.get('accepted_before')) and row['accepted_before']==state['accepted_updates'],'trace_accepted_before')
                trace_require(number(row.get('step_inf')) and row['step_inf']>=0,'trace_step_value')
                status=row.get('status');trace_require(status in ('max_updates','gradient_converged','finite_plateau','optimizer_stalled','numerical_failure','algorithm_failure'),'trace_status')
                accepted=row['step_inf']>0 and status not in ('numerical_failure','algorithm_failure')
                trace_require(row['accepted_after']==state['accepted_updates']+int(accepted),'trace_actual_update_count')
                state['attempts']+=1;state['accepted_updates']=row['accepted_after']
                if not accepted:state['zero_or_failed_attempts']+=1
                trace_require(state['zero_or_failed_attempts']<=1,'trace_repeated_failed_attempt')
                if state['zero_or_failed_attempts']:closed.add(phase)
                for field in ('loss_before','loss_after','gradient_inf_before'):
                    trace_require(number(row.get(field)) or (row.get(field) is None and status=='numerical_failure'),'trace_numeric_field:'+field)
                    trace_require(row.get(field) is None or row[field]>=0,'trace_nonnegative_norm_or_loss:'+field)
                if not accepted and number(row.get('loss_before')) and number(row.get('loss_after')):
                    trace_require(math.isclose(row['loss_before'],row['loss_after'],rel_tol=1e-9,abs_tol=1e-10),'trace_no_update_loss')
                tiny=accepted and row['step_inf']<=1e-12 and abs(row['loss_after']-row['loss_before'])<=1e-14*max(1,abs(row['loss_before']))
                state['plateau_count']=state.get('plateau_count',0)+1 if tiny else 0
                if status=='finite_plateau':trace_require(phase=='lbfgs' and state['plateau_count']>=25,'trace_plateau_evidence')
                if status=='gradient_converged':trace_require(number(row.get('gradient_inf_after')) and row['gradient_inf_after']<=(1e-9 if phase=='lbfgs' else 0),'trace_terminal_gradient')
                if status in ('gradient_converged','finite_plateau','optimizer_stalled','numerical_failure','algorithm_failure'):closed.add(phase)
                total=row.get('costs_total');delta=row.get('costs_increment');trace_require(type(total) is dict and type(delta) is dict,'trace_cost_shape')
                trace_require(all(integer(total.get(k)) and integer(delta.get(k)) for k in COSTS),'trace_cost_type')
                baseline=last_cost or dict.fromkeys(COSTS,0)
                trace_require(all(total[k]>=baseline[k] and total[k]-baseline[k]==delta[k] for k in COSTS),'trace_cost_recurrence')
                if phase=='lbfgs':
                    trials=row.get('closures');trace_require(type(trials) is list and len(trials)==delta['closure_calls'],'trace_closure_count')
                    trace_require(all(type(v) is dict and v.get('trial')==i and number(v.get('loss')) for i,v in enumerate(trials)),'trace_closure_trials')
                else:trace_require(delta['closure_calls']==0 and delta['lbfgs_native_iterations']==0,'trace_non_lbfgs_cost')
                if phase=='gd' and accepted:trace_require(number(row.get('step_size')) and row['step_size']==spec['value'],'trace_gd_learning_rate')
                if phase=='nncg' and accepted:
                    pcg=row.get('pcg');trace_require(type(pcg) is dict and pcg.get('status')=='converged' and number(pcg.get('explicit_relative_residual')) and pcg['explicit_relative_residual']<=1e-8,'trace_pcg_explicit_residual')
                    trace_require(number(row.get('gtd')) and row['gtd']<0,'trace_descent_direction')
                    trials=row.get('armijo_trials');trace_require(type(trials) is list and trials,'trace_armijo_trials')
                    for trial in trials:
                        trace_require(type(trial) is dict and number(trial.get('alpha')) and trial['alpha']>0 and number(trial.get('loss')) and number(trial.get('bound')),'trace_armijo_value')
                        expected=row['loss_before']+.1*trial['alpha']*row['gtd']
                        trace_require(math.isclose(trial['bound'],expected,rel_tol=1e-12,abs_tol=1e-14),'trace_armijo_bound')
                    trace_require(trials[-1]['loss']<=trials[-1]['bound'] and math.isclose(trials[-1]['loss'],row['loss_after'],rel_tol=1e-9,abs_tol=1e-10),'trace_armijo_accepted')
                last_cost=total;last_rows[phase]=row;line_count+=1
            except (ValueError,TypeError,KeyError) as e:
                raise TraceContract(f'line{index}:'+str(e)) from e
    for phase,value in count.items():
        trace_require({k:value[k] for k in ('attempts','accepted_updates')}==record['phases'][phase],'trace_manifest_counts:'+phase)
    trace_require(last_cost is not None or all(v['attempts']==0 for v in count.values()),'trace_cost_missing')
    if last_cost is not None:
        # An explicit no-update gradient terminal check adds one gradient evaluation,
        # not an optimizer attempt; the old engine deliberately emits that check separately.
        extra=sum(v['terminal_checks'] for v in count.values())
        trace_require(all(record['costs'][k]==last_cost[k]+(extra if k=='gradient_calls' else 0) for k in COSTS),'trace_manifest_costs')
    return {'status':'verified','line_count':line_count,'phases':count,'last_rows':last_rows,'costs':record['costs'],'scope':'necessary self-consistency; source/actual method remains independently reviewed'}

def collect(a,out):
    # Validate independent facility contracts before any candidate parse/qualification.
    try:profile=load(a.profile);rubric=load(a.rubric);policy=load(a.targets);leaves,quality,semantic=authorities(profile,rubric,policy)
    except (reader.ContractError,KeyError,TypeError,ValueError) as e:raise Facility('facility_contract_invalid:'+str(e)) from e
    binding={'format':'l01-review-binding/1','subject_id':a.subject_id,'subject_role':a.role,'source_object':closed_identity(a.source),'execution_object':closed_identity(a.execution),'previous_execution_objects':[closed_identity(p) for p in a.previous_execution],'contract':semantic,'output_root':a.output_root,'expected_scope':a.scope}
    opaque=[]
    root=out/'subject-project';root.mkdir();copy_members(a.source,root,opaque=opaque)
    native=out/'native';native.mkdir();copy_members(a.execution,native,exclude_prefix='results/')
    output=root/PurePosixPath(a.output_root);input_root=(root/PurePosixPath(a.input_root)).resolve()
    ensure(output.resolve().is_relative_to(root.resolve()) and output.resolve()!=root.resolve(),'facility_output_scope')
    ensure(not output.resolve().is_relative_to(input_root) and not input_root.is_relative_to(output.resolve()),'facility_output_input_overlap')
    ensure(not output.exists(),'facility_source_contains_prior_output')
    try:
        inspect,source_location=native_context(native);state=inspect['State'];cmd=inspect['Config']['Cmd']
        if a.scope=='full':ensure(not any(v=='--only' or v.startswith('--only=') for v in cmd),'facility_partial_execution_requested_as_full')
        previous=[];seen={inspect['Id']}
        for i,capsule in enumerate(a.previous_execution):
            folder=out/f'previous-native-{i}';folder.mkdir();copy_members(capsule,folder,exclude_prefix='results/')
            old,location=native_context(folder)
            ensure(location.lower().replace('\\','/')==source_location.lower().replace('\\','/') and old['Id'] not in seen,'facility_execution_segment_binding');seen.add(old['Id'])
            previous.append({'cid':old['Id'],'exit_code':old['State']['ExitCode'],'started_at':old['State']['StartedAt'],'finished_at':old['State']['FinishedAt'],'cmd':old['Config']['Cmd']})
        if '--continue-study' in cmd:ensure(previous,'facility_missing_execution_segment')
        captured_profile=load(root/a.input_root/'profile.json')
        ensure(json_value({k:captured_profile[k] for k in semantic['profile']})==json_value(semantic['profile']),'facility_input_registration_drift')
        for problem in ('convection','reaction','wave'):
            with np.load(root/a.input_root/'data'/f'{problem}.npz',allow_pickle=False) as actual:
                expected=canonical_data(problem)
                ensure(set(actual.files)==set(expected),'facility_input_data_keys')
                ensure(all(actual[k].dtype==np.float64 and np.array_equal(actual[k],v) for k,v in expected.items()),'facility_input_data_identity')
    except (OSError,ValueError,TypeError,KeyError,zipfile.BadZipFile) as e:
        if isinstance(e,Facility):raise
        raise Facility('facility_captured_context:'+str(e)) from e
    # Only now overlay terminal outputs, after authoritative source inputs were checked.
    output.mkdir(parents=True,exist_ok=False);copy_members(a.execution,output,'results/',opaque=opaque)
    save(out/'opaque-original-members.json',opaque)
    facts={'native':{'cid':inspect['Id'],'exit_code':state['ExitCode'],'started_at':state['StartedAt'],'finished_at':state['FinishedAt'],'cmd':cmd,'scope':a.scope},'previous_native':previous,'artifact':None,'trace':{},'quality':{},'prerequisites':{},'source_training_attestation':'requires the single independent whole-case review; self traces alone do not attest optimization'}
    prerequisites=facts['prerequisites'];base=profile['base_configurations'];continuations=profile['continuations'];specs={s['id']:s for s in base+continuations}
    def gate(key,state,detail):prerequisites[key]={'status':state,'detail':detail}
    try:
        result=reader.check_submission(root,profile,(PurePosixPath(a.output_root)/'manifest.json').as_posix());facts['artifact']=result
        manifest=load(output/'manifest.json');records={r['config_id']:r for r in manifest['runs']};all_terminal=all(r['status']!='incomplete' for r in records.values());all_traces=True
        for key,record in records.items():
            targets=[v['id'] for v in leaves if v['id'].startswith('L01-B-'+key+'-') or v['id'].startswith('L01-C-'+key+'-')]
            if record['status'] in ('incomplete','dependency_incomplete'):
                for target in targets:gate(target,'blocked','configuration or original parent not executed')
                facts['trace'][key]={'status':'blocked','reason':record['status']};continue
            try:
                trace=trace_facts(root,record,specs[key]);facts['trace'][key]=trace
                ordered=['adam','lbfgs'] if specs[key]['method']=='hybrid' else [specs[key]['method']]
                final=next((trace['last_rows'][phase] for phase in reversed(ordered) if phase in trace['last_rows']),None)
                if final and number(final.get('loss_after')):
                    measured=result['observations'][key]['metrics']['total_loss']
                    if not math.isclose(final['loss_after'],measured,rel_tol=1e-9,abs_tol=1e-10):
                        raise TraceContract('trace_final_export_loss_mismatch')
            except (TraceContract,reader.ContractError,OSError) as e:
                all_traces=False;facts['trace'][key]={'status':'verified_fail','error':str(e)}
                gate('L01-B-'+key+'-terminal-state-and-counts','verified_fail',str(e))
        gate('L01-E-full-clean-retraining','verified_fail' if state['ExitCode']!=0 or not all_traces else 'ready_for_review' if all_terminal and a.scope=='full' else 'blocked','original native, full registry and trace consistency; actual algorithms require independent source review')
        for leaf in quality:
            problem=leaf['id'].split('-')[2];candidates=[s['id'] for s in base if s['problem']==problem and s['seed']==profile['solution_selection']['seed']]
            if problem=='convection':candidates += [s['id'] for s in continuations]
            pending=any(records[k]['status']=='incomplete' for k in candidates)
            key=result['solution_checkpoints'][problem]
            if pending:
                facts['quality'][leaf['id']]={'status':'blocked','reason':'final selection dependency not terminal','selected_id':key};continue
            if key is None:
                facts['quality'][leaf['id']]={'status':'verified_fail','reason':'all registered candidates terminal without an eligible finite solution','selected_id':None};continue
            metric=result['observations'][key]['metrics']
            for part in leaf['metric'].split('.'):metric=metric[part]
            bound=maximum(policy,leaf)
            facts['quality'][leaf['id']]={'status':'verified_pass' if metric<=bound else 'verified_fail','selected_id':key,'metric':leaf['metric'],'observed':metric,'maximum':bound,'comparison':'<=','checkpoint':records[key]['checkpoints']['final']}
    except reader.ContractError as e:
        facts['artifact_error']={'code':e.code,'detail':str(e),'scope':'first observed contract error, other unassessed facts are not fabricated passes/failures'}
        gate('L01-E-full-clean-retraining','verified_fail','actual captured source output has an invalid mandatory artifact contract')
        for leaf in quality:facts['quality'][leaf['id']]={'status':'blocked','reason':'candidate artifact prerequisite invalid'}
    gate('L01-A-authoritative-grid','ready_for_review','captured public data independently matches exact registered arrays; candidate data use still needs source review')
    return binding,facts,leaves,quality,rubric,policy

def assess(a,out,binding,facts,leaves,quality,rubric,policy):
    qids={v['id'] for v in quality};manual_ids={v['id'] for v in leaves}-qids
    findings={v['id']:{'id':v['id'],'status':'unassessed','evidence':[],'reason':'independent whole-case review not supplied'} for v in leaves}
    if a.review:
        try:
            review=load(a.review);ensure(json_value(review.get('binding'))==json_value(binding),'facility_review_object_mismatch')
            ratings=review.get('ratings');ensure(type(ratings) is dict and set(ratings)==manual_ids,'facility_review_leaf_coverage')
            for key,v in ratings.items():
                ensure(type(v) is dict and v.get('status') in STATES and type(v.get('evidence')) is list and all(type(s) is str and s for s in v['evidence']),'facility_review_rating')
                ensure(v['status'] in ('blocked','unassessed') or bool(v['evidence']),'facility_review_evidence')
                findings[key]={'id':key,**v}
        except (reader.ContractError,KeyError,TypeError) as e:raise Facility('facility_review_invalid:'+str(e)) from e
    for key,value in facts['prerequisites'].items():
        if key in findings and value['status'] in ('verified_fail','blocked'):
            if value['status']=='verified_fail' or findings[key]['status']!='verified_fail':findings[key].update(status=value['status'],reason=value['detail'],evidence=['captured native and independently read actual trace'])
    for key,v in facts['quality'].items():findings[key]={'id':key,**v,'evidence':['same independent selected numeric export, evaluator-owned canonical points and target policy']}
    unresolved=[k for k,v in findings.items() if v['status'] in ('blocked','unassessed')];failed=[k for k,v in findings.items() if v['status']=='verified_fail'];critical=[v['id'] for v in leaves if v['critical']]
    critical_failed=[k for k in critical if findings[k]['status']=='verified_fail'];critical_unresolved=[k for k in critical if findings[k]['status'] in ('blocked','unassessed')]
    qfail=any(findings[k]['status']=='verified_fail' for k in qids);qunknown=any(findings[k]['status'] in ('blocked','unassessed') for k in qids)
    legal_critical=[k for k in critical if k not in qids]
    qualified=all(findings[k]['status']=='verified_pass' for k in legal_critical)
    solution=False if qfail or any(findings[k]['status']=='verified_fail' for k in legal_critical) else None if qunknown or not qualified else True
    delivery=[v['id'] for v in leaves if v['group']=='R' and v['id'] not in qids]
    study_dependencies=legal_critical+delivery
    study=False if any(findings[k]['status']=='verified_fail' for k in study_dependencies) else None if any(findings[k]['status'] in ('blocked','unassessed') for k in study_dependencies) else True
    frozen=False;minimum=rubric['outcome_contract']['minimum_score']
    if a.freeze:
        freeze=load(a.freeze);ensure(freeze.get('case_id')=='L01' and freeze.get('status')=='development_pilot_frozen','facility_freeze_invalid')
        ensure(json_value(freeze.get('contract'))==json_value(binding['contract']),'facility_freeze_contract_mismatch')
        ensure(freeze['good_rule']['minimum_score']==minimum and freeze['good_rule'].get('all_critical')=='verified_pass','facility_good_rule')
        ensure(all(v.get('threshold')==maximum(policy,v) for v in quality),'facility_unclosed_quality_thresholds')
        frozen=True
    total=round(math.fsum(v['weight'] for v in leaves if findings[v['id']]['status']=='verified_pass'),12) if frozen and not unresolved else None
    good=False if critical_failed or solution is False or study is False else None if total is None else bool(total>=minimum and solution is True and study is True)
    status='graded' if total is not None else 'assessment_incomplete' if unresolved else 'development_assessed_unfrozen'
    result={'status':status,'subject_role':a.role,'binding':binding,'fixed_denominator':100,'total':total,'study_complete':study,'solution_reproduced':solution,'good':good,'critical_failed':critical_failed,'critical_unresolved':critical_unresolved,'failed':failed,'unresolved':unresolved,'findings':[findings[v['id']] for v in leaves],'limits':'single familiar nonblind AI review when supplied; no professional/statistical/hour certification; capsule identity is not functional correctness'}
    save(out/'assessment.json',result);return result

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('mode',choices=['prepare','grade'])
    for name in ('source','execution','profile','rubric','targets','out'):p.add_argument('--'+name,type=Path,required=True)
    p.add_argument('--subject-id',required=True);p.add_argument('--role',choices=['author_reference','candidate','error_control'],required=True);p.add_argument('--scope',choices=['partial','full'],required=True)
    p.add_argument('--output-root',default='work/results');p.add_argument('--input-root',default='inputs');p.add_argument('--review',type=Path);p.add_argument('--freeze',type=Path);p.add_argument('--previous-execution',type=Path,action='append',default=[])
    a=p.parse_args()
    try:a.out.mkdir(parents=True,exist_ok=False)
    except OSError as e:
        print(json.dumps({'status':'run_invalid','total':None,'good':None,'error':'output_directory_unavailable','detail':str(e),'scope':'original output preserved'}));return 3
    try:
        ensure(a.mode!='prepare' or (a.review is None and a.freeze is None),'facility_prepare_arguments')
        ensure(type(a.subject_id) is str and a.subject_id.strip() and all(ord(c)>=32 for c in a.subject_id),'facility_subject_identity')
        for value in (a.output_root,a.input_root):
            part=PurePosixPath(value);ensure(not part.is_absolute() and '..' not in part.parts and '\\' not in value and ':' not in value,'facility_root_argument')
        binding,facts,leaves,quality,rubric,policy=collect(a,a.out)
        save(a.out/'binding.json',binding);save(a.out/'actual-facts.json',facts)
        assignment={'binding':binding,'required_review_ids':[v['id'] for v in leaves if v['id'] not in {q['id'] for q in quality}],'rubric':leaves,'anchors':review_anchors(leaves,binding['contract']['profile']),'facts':facts,'instructions':'Review the captured actual source, all original traces/documents/figures and methods once. Machine quality cannot be overwritten. Preserve real failures; unexecuted dependencies remain blocked. No new training or delegation. This assignment is not itself a score.'}
        save(a.out/'assignment.json',assignment)
        result=assess(a,a.out,binding,facts,leaves,quality,rubric,policy)
        print(json.dumps({k:result[k] for k in ('status','subject_role','fixed_denominator','total','study_complete','solution_reproduced','good','critical_failed')},ensure_ascii=False))
        return 0 if result['status']=='graded' and result['good'] else 2 if result['status']=='graded' else 4
    except (Facility,OSError,KeyError,TypeError,ValueError,zipfile.BadZipFile) as e:
        result={'status':'run_invalid','total':None,'good':None,'subject_role':a.role,'error':str(e),'scope':'facility/contract/review-object error; not a candidate zero'};save(a.out/'assessment.json',result);print(json.dumps(result));return 3
if __name__=='__main__':raise SystemExit(main())
