"""L06/0.3 closed-object whole-case prepare/grade. No solver or actor runs here."""
from pathlib import Path
from fractions import Fraction
import argparse,csv,datetime,json,math,shutil,sqlite3,sys,uuid,zipfile
HERE=Path(__file__).resolve().parent;CORE=HERE.parent/'qualification/current-source'
sys.path[:0]=[str(HERE/'source'),str(CORE)]
from tree_business import load_data,audit_policy,contingency,packet,replay,event,action_at,canonical,BusinessError
from check_tree import assess
from check_l06 import PlanError
from l06_input import InputError

def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,x):p.write_text(json.dumps(x,indent=2,allow_nan=False)+'\n',encoding='utf-8')
def require(condition,code):
    if not condition:raise ValueError(code)
class Facility(ValueError):pass
def facility(condition,code):
    if not condition:raise Facility(code)
def exact(x):
    require(type(x) in (str,int,float),'monetary_scalar_type')
    require(type(x) is not float or math.isfinite(x),'monetary_scalar_finite')
    try:return Fraction(str(x))
    except (ValueError,ZeroDivisionError,OverflowError) as e:raise ValueError('monetary_scalar_invalid') from e
def bind_archive(folder,archive):
    with zipfile.ZipFile(archive) as z:
        names=[i.filename for i in z.infolist() if not i.is_dir()]
        require(len(names)==len(set(names)),'source_capsule_members')
        require(set(names)=={v.relative_to(folder).as_posix() for v in folder.rglob('*') if v.is_file()},'complete_source_capsule_identity')
        for name in names:
            target=folder/name
            require(target.resolve().is_relative_to(folder.resolve()) and target.is_file() and target.read_bytes()==z.read(name),'source_capsule_identity:'+name)
    return len(names)
def rows(db):
    with sqlite3.connect('file:'+db.as_posix()+'?mode=ro',uri=True) as con:
        require(con.execute('PRAGMA user_version').fetchone()[0]==2,'native_schema')
        values=con.execute('SELECT week,request_id,item_json FROM commits ORDER BY week').fetchall()
    return [{'week':w,'request_id':k,'item':json.loads(j)} for w,k,j in values]
def business(values):return [{'week':v['week'],'event':v['event'],'action':v['action'],'receipt':{k:x for k,x in v['receipt'].items() if k!='request_id'}} for v in values]

def prepare(a):
    a.out.mkdir(parents=True,exist_ok=False)
    closed=a.out/'closed';closed.mkdir();shutil.copytree(a.run,closed/'run');shutil.copytree(a.delivery,closed/'delivery')
    run=closed/'run';delivery=closed/'delivery';public=run/'public';policy=None
    layout=read(a.layout);slots={'policy','programme','report','weekly_ledger','commitments','summary','receivables','source_map','reproduce','requirements','figures'}
    facility(type(layout) is dict and layout.get('format')=='l06-delivery-layout/1' and type(layout.get('paths')) is dict and set(layout['paths'])==slots,'facility_delivery_layout')
    def locate(value):
        facility(type(value) is str and value and '\\' not in value,'facility_delivery_layout_path')
        path=Path(value);facility(not path.is_absolute() and '..' not in path.parts,'facility_delivery_layout_path')
        target=(delivery/path).resolve();facility(target.is_relative_to(delivery.resolve()),'facility_delivery_layout_scope');return target
    paths={k:locate(v) for k,v in layout['paths'].items() if k!='figures'}
    facility(type(layout['paths']['figures']) is list and len(layout['paths']['figures'])>0,'facility_delivery_layout_figures')
    figures=[locate(v) for v in layout['paths']['figures']];write(a.out/'delivery-layout.json',layout)
    rubric=read(HERE/'rubric.draft.json');shutil.copy2(HERE/'rubric.draft.json',a.out/'rubric.json')
    leaves={v['id']:{'id':v['id'],'status':'unassessed','evidence':[],'reason':'independent content review pending'} for v in rubric['leaves']}
    def check(key,fn):
        try:
            detail=fn();leaves[key].update(status='verified_pass',evidence=[str(detail)],reason='actual closed-object contract passed')
        except (ValueError,KeyError,TypeError,IndexError,OSError,sqlite3.Error) as e:
            dependency=str(e).endswith('_dependency')
            leaves[key].update(status='blocked_by_dependency' if dependency else 'verified_fail',evidence=[str(e)],reason='known prerequisite unavailable' if dependency else 'named closed-object contract failure')
    data,contract=load_data(public);audit=None;logical=None
    registration=read(HERE/'registered-facts.json')
    facility(canonical(data)==canonical(registration['data']),'facility_registered_raw_drift')
    # Trusted execution captures are checked independently of a mutable ZIP or
    # candidate declaration. A drift is a facility fault, never candidate points.
    episodes_for_meta=read(run/'episodes.json')
    for entry in episodes_for_meta:
        for database in [run/entry['directory']/'journal.sqlite3']+([run/entry['directory']/'after-commit-original.sqlite3'] if entry['has_real_commit_loss'] else []):
            with sqlite3.connect('file:'+database.as_posix()+'?mode=ro',uri=True) as con:stored=con.execute('SELECT public_facts_json FROM meta').fetchall()
            facility(len(stored)==1 and canonical(json.loads(stored[0][0]))==canonical({'contract':contract,'data':data}),'facility_native_public_meta_drift')
    control_capture=read(run/'owner-terminal.json')
    control_data,control_contract=load_data(run/'row-order-public')
    facility(canonical(control_data)==canonical(registration['data']),'facility_control_registered_raw_drift')
    with sqlite3.connect('file:'+(run/control_capture['row_order_control']/'journal.sqlite3').as_posix()+'?mode=ro',uri=True) as con:control_meta=con.execute('SELECT public_facts_json FROM meta').fetchall()
    facility(len(control_meta)==1 and canonical(json.loads(control_meta[0][0]))==canonical({'contract':control_contract,'data':control_data}),'facility_control_public_meta_drift')
    try:
        policy=read(paths['policy'])
        audit=audit_policy(data,policy);logical=assess(data,policy)
        leaves['M01'].update(status='verified_pass',evidence=[str(paths['policy'].relative_to(closed))+': complete strict policy tensors and raw identity'],reason='policy decoded')
    except (BusinessError,PlanError,InputError,KeyError,TypeError,ValueError,OSError) as e:
        leaves['M01'].update(status='verified_fail',evidence=[str(e)],reason='candidate_policy_invalid')
    if audit is not None:
        for key,passed,evidence in [('M02',audit['business_feasible'],audit['physical_violations']),('M03',audit['information_legal'],audit['information_violations']),('M04',logical['quality_target_pass'],{'expected':logical['expected_cost_exact'],'quality_maximum':logical['pre_registered_quality_maximum']})]:
            leaves[key].update(status='verified_pass' if passed else 'verified_fail',evidence=[canonical(evidence)],reason='independent business/information/quality computation')
        if not audit['policy_valid']:leaves['M04'].update(status='blocked_by_dependency',evidence=['M02/M03'],reason='a cost quality score requires a physically feasible causal policy')
    else:
        for key in ('M02','M03','M04'):leaves[key].update(status='blocked_by_dependency',evidence=['M01'],reason='policy shape prevents evaluation')
    write(a.out/'policy-assessment.json',logical if logical else {'audit':audit,'status':'candidate_policy_invalid'})
    valid=audit is not None and audit['policy_valid']
    def ledger():
        require(valid,'policy_valid_dependency');expected={}
        fields={'purchase':'purchase_cost','freight':'freight_cost','production':'production_cost','holding':'holding_cost','cost':'cost','receipts':'receipts','cash':'cash','raw_peak':'raw_stage_peak_volume','finished_peak':'product_stage_peak_volume'}
        for s in data['scenarios']:
            for v in audit['paths'][s['id']]['weeks']:expected[(s['id'],v['week'])]=v
        with paths['weekly_ledger'].open(newline='',encoding='utf-8') as f:actual=list(csv.DictReader(f))
        require(len(actual)==len(expected),'weekly_ledger_coverage');seen=set()
        for v in actual:
            key=(v['path'],int(v['week']));require(key in expected and key not in seen,'weekly_ledger_identity');seen.add(key)
            for out,raw in fields.items():require(exact(v[out])==exact(expected[key][raw]),'weekly_ledger_value:'+out+':'+str(key))
        summary=read(paths['summary']);total=Fraction(audit['expected_cost_exact']['numerator'],audit['expected_cost_exact']['denominator'])
        require(exact(summary['expected_cost_exact'])==total,'report_expected_cost')
        components={key:Fraction() for key in ('purchase_cost','freight_cost','production_cost','holding_cost')}
        for s in data['scenarios']:
            probability=Fraction(s['probability_numerator'],data['probability_denominator'])
            for v in audit['paths'][s['id']]['weeks']:
                for k in components:components[k]+=probability*exact(v[k])
        require(type(summary['components_exact']) is dict and set(summary['components_exact'])==set(components) and all(exact(summary['components_exact'][k])==v for k,v in components.items()) and sum(components.values())==total,'report_components')
        _,base=contingency(data);alternative=Fraction(base['expected_cost_exact']['numerator'],base['expected_cost_exact']['denominator'])
        require(exact(summary['alternative_exact'])==alternative and exact(summary['saving_exact'])==alternative-total,'report_alternative_saving')
        require(exact(summary['minimum_cash'])==min(v['minimum_cash_minor'] for v in audit['paths'].values()),'report_minimum_cash')
        finance=read(paths['receivables']);require(type(finance) is dict and set(finance)=={v['id'] for v in data['scenarios']},'receivables_coverage')
        for s in data['scenarios']:
            state,weeks=replay(data,journals_for_finance(s['id']))
            expected_finance={'final_cash':state['cash'],'minimum_cash':min(v['cash'] for v in weeks),'final_receivable':sum(state['receipts_by_week'][data['weeks']:]),'due_after_horizon':{str(t):amount for t,amount in enumerate(state['receipts_by_week']) if t>=data['weeks'] and amount}}
            actual=finance[s['id']];require(type(actual) is dict and set(actual)==set(expected_finance),'receivables_shape')
            require(all(exact(actual[k])==value for k,value in expected_finance.items() if k!='due_after_horizon'),'receivables_values')
            require(type(actual['due_after_horizon']) is dict and set(actual['due_after_horizon'])==set(expected_finance['due_after_horizon']) and all(exact(actual['due_after_horizon'][k])==v for k,v in expected_finance['due_after_horizon'].items()),'receivables_due_values')
        expected_actions={}
        for s in data['scenarios']:
            for t in range(data['weeks']):
                act=action_at(policy,s['id'],t)
                for k,supplier in enumerate(data['suppliers']):
                    expected_actions[(s['id'],t,'truck',supplier['id'],'')]=act['truck_on'][k]
                    for m,raw in enumerate(data['raw_materials']):expected_actions[(s['id'],t,'order_lots',supplier['id'],raw)]=act['order_lots'][k][m]
                for k,plant in enumerate(data['plants']):
                    for j,product in enumerate(data['products']):expected_actions[(s['id'],t,'production',plant,product)]=act['production'][k][j]
        with paths['commitments'].open(newline='',encoding='utf-8') as f:actual=list(csv.DictReader(f))
        require(len(actual)==len(expected_actions),'commitment_coverage');seen=set()
        for v in actual:
            key=(v['path'],int(v['week']),v['kind'],v['entity'],v['item']);require(key in expected_actions and key not in seen and exact(v['quantity'])==expected_actions[key],'commitment_value');seen.add(key)
        return '128 weekly rows, all action coordinates and exact probability-weighted components independently closed'
    def journals_for_finance(path):
        entry=next(v for v in episodes_for_meta if v['path']==path)
        return [v['item'] for v in rows(run/entry['directory']/'journal.sqlite3')]
    check('M05',ledger)
    episodes=read(run/'episodes.json') if (run/'episodes.json').is_file() else []
    journals={};facts={}
    def actual_journals():
        require(valid,'policy_valid_dependency');require(len(episodes)==len(data['scenarios']),'native_path_coverage');seen=set()
        for episode in episodes:
            path=episode['path'];require(path not in seen,'duplicate_native_path');seen.add(path)
            directory=run/episode['directory'];stored=rows(directory/'journal.sqlite3');committed=[v['item'] for v in stored]
            require(len(stored)==16 and all(v['week']==i and v['request_id']==v['item']['request_id'] for i,v in enumerate(stored)),'native_commits')
            original=read(directory/'completed/journal-export.json');state,weeks=replay(data,committed)
            require(canonical(original)==canonical({'format':'l06-committed-journal/1','committed':committed,'state':state,'weeks':weeks}),'native_export_state')
            journals[path]=committed;facts[path]={'state':state,'weeks':weeks}
        result=assess(data,policy,journals);require(result['journal_replay_complete'] is True,'native_journal_replay')
        require(canonical(journals)==canonical(read(run/'journals.json')),'native_journals_export')
        return 'actual SQLite event/action/receipt/state/cash/queues agree with independent full replay for every path'
    check('M06',actual_journals)
    def source():
        count=bind_archive(run/'sealed-project',run/'pre-execution-project.zip');bind_archive(run/'public',run/'public-originals.zip');bind_archive(run/'controller-source',run/'pre-execution-controller-source.zip')
        actual_files={p.relative_to(run/'sealed-project').as_posix():p for p in (run/'sealed-project').rglob('*') if p.is_file()}
        delivered_files={p.relative_to(paths['programme']).as_posix():p for p in paths['programme'].rglob('*') if p.is_file()}
        require(set(actual_files)==set(delivered_files),'complete_delivery_programme_identity')
        for name,f in actual_files.items():require(delivered_files[name].read_bytes()==f.read_bytes(),'delivery_programme_identity:'+name)
        require(canonical(policy)==canonical(read(run/'declared-policy.json')),'delivery_policy_execution_binding')
        for command in read(run/'actual-commands.json'):
            require(Path(command['argv'][3]).resolve()==(Path(getattr(a,'origin_run',a.run))/'controller-source/source/execute_policy.py').resolve(),'captured_controller_executed')
        require(read(run/'owner-terminal.json')['native_exit']==0,'whole_native_terminal')
        return str(count)+' original programme members bound to the executed and delivered object; source correctness additionally reviewed'
    check('M07',source)
    def wire():
        require(len(journals)==len(data['scenarios']),'native_journal_dependency');commands=read(run/'actual-commands.json');require(len(commands)==10,'actual_phase_count')
        for episode in episodes:
            committed=journals[episode['path']]
            for phase in episode['phases']:
                directory=run/phase['out'];active=read(directory/'active.json');terminal=read(directory/'worker-terminal.json')
                require(type(active['worker_pid']) is int and active['worker_pid']>0 and terminal['pid']==active['worker_pid'] and terminal['native_exit']==0,'actual_worker_terminal')
                original_run=Path(getattr(a,'origin_run',a.run));original_worker=(original_run/phase['out']/'worker').resolve()
                require(active['argv']==terminal['argv'] and original_worker==Path(active['cwd']).resolve(),'worker_identity')
                # Paths identify only fixed source/public and neutral episode. The
                # complete dynamic current packet is recomputed below, not inferred
                # from matching a few prohibited strings.
                require(active['environment'].get('PYTHONPATH')==str((original_run/'sealed-project').resolve()),'worker_public_source_environment')
                submission=read(run/'sealed-project/submission.json');mapped=list(submission['argv'])
                for key,val in {'{python}':phase['argv'][0],'{project}':str((original_run/'sealed-project').resolve()),'{public}':str((original_run/'public').resolve())}.items():mapped=[v.replace(key,val) for v in mapped]
                require(active['argv']==mapped,'actual_declared_argv_binding')
                trace=[json.loads(v) for v in (directory/'visible-exchange.jsonl').read_text().splitlines()]
                require(len(trace)%2==0,'wire_pairing')
                start=0 if directory.name=='before-loss' or not episode['has_real_commit_loss'] else 8
                end=8 if directory.name=='before-loss' else 16
                require(len(trace)==2*(end-start),'wire_week_coverage')
                for i,t in enumerate(range(start,end)):
                    sent,received=trace[i*2:i*2+2];require(sent['direction']=='to_actor' and received['direction']=='from_actor','wire_direction')
                    require(canonical(sent['packet'])==canonical(packet(data,committed[:t],committed[t]['event'])),'current_packet_authority')
                    response=received['response'];require(canonical(response)==canonical({'format':'l06-action-response/1','request_id':committed[t]['request_id'],'action':committed[t]['action']}),'actual_response_commit')
        return 'complete actual current packets, responses and stored commitments agree; original argv/env/source reviewed for native dataflow only'
    check('M08',wire)
    def recovery():
        require(leaves['M07']['status']=='verified_pass','executed_programme_binding_dependency')
        faults=[v for v in episodes if v['has_real_commit_loss']];require(len(faults)==1,'one_actual_cut');e=faults[0];directory=run/e['directory']
        require([v['native_exit'] for v in e['phases']]==[73,0],'fault_resume_native_exits')
        cut=read(directory/'before-loss/crash-after-commit.json');original=rows(directory/'after-commit-original.sqlite3');final=rows(directory/'journal.sqlite3');receipt=read(directory/'completed/resume-receipt.json')
        require(cut['database_commit'] is True and cut['week']==7 and len(original)==8 and cut['next_packet_sent'] is False,'actual_commit_ack_cut')
        require(receipt=={'replayed':True,'receipt':original[-1]['item']['receipt'],'next_week':8,'committed_count':8},'original_receipt_recovery')
        require(final[:8]==original,'original_committed_prefix_retained');return 'actual SQLite commit at week7, controller73, original key/receipt and next_week8 resumed in a new process'
    check('M09',recovery)
    def retention():
        require(leaves['M06']['status']=='verified_pass' and leaves['M09']['status']=='verified_pass','native_fact_dependency')
        for e in episodes:
            if e['has_real_commit_loss']:
                original=read(run/e['directory']/'after-commit-original.json');final=rows(run/e['directory']/'journal.sqlite3')
                require([[v['week'],v['request_id'],canonical(v['item'])] for v in final[:8]]==original,'original_row_and_export_identity')
        return 'original row/key/event/action/receipt values retained across the real restart'
    check('M10',retention)
    def control():
        require(leaves['M07']['status']=='verified_pass' and len(journals)==len(data['scenarios']),'executed_journals_dependency')
        terminal=read(run/'owner-terminal.json');control=run/terminal['row_order_control'];other,_=load_data(run/'row-order-public');require(canonical(other)==canonical(data),'row_control_raw_semantics')
        stored=rows(control/'journal.sqlite3');committed=[v['item'] for v in stored];path=terminal['control_path_after_terminal'];state,weeks=replay(data,committed)
        require(len(committed)==16 and canonical(business(committed))==canonical(business(journals[path])),'row_control_business_result')
        require(read(control/'completed/worker-terminal.json')['native_exit']==0,'row_control_actual_process')
        return 'same sealed deterministic actor on a separately permuted CSV input, full16 actual commits; this is row-order invariance, not arbitrary business perturbation certification'
    check('M11',control)
    def delivery_files():
        for name,path in paths.items():
            if name=='programme':require(path.is_dir(),'delivery_programme_directory')
            else:require(path.is_file() and path.stat().st_size>0,'delivery_file:'+name)
        for path in figures:require(path.is_file() and path.stat().st_size>0,'delivery_figure:'+str(path.relative_to(delivery)))
        return 'complete source/report/ledger/figure/reproduction deliverables present; usability and rendered content judged independently'
    check('M12',delivery_files)
    assignment=getattr(a,'assignment_id',None) or 'l06-whole-'+uuid.uuid4().hex
    result={'format':'l06-whole-assignment/2','assignment_id':assignment,'case_version':rubric['case_version'],'subject_role':a.role,'created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'original_run':str(Path(getattr(a,'origin_run',a.run)).resolve()),'delivery_layout':layout,'leaves':leaves,'fixed_denominator':100,'total':None,'good':False if any(v['status']=='verified_fail' for v in leaves.values()) else None,'scope':'whole native source-bound machine evaluation; independent H review and dev freeze still required'}
    write(a.out/'assignment.json',result);write(a.out/'review-template.json',{'format':'l06-independent-content-review/1','assignment_id':assignment,'case_version':rubric['case_version'],'leaves':[{'id':'H0'+str(i),'status':'unassessed','evidence':[],'reason':''} for i in range(1,6)]})
    print(json.dumps({'assignment_id':assignment,'machine':{k:v['status'] for k,v in leaves.items() if k.startswith('M')},'total':None}));return 0

def grade(a):
    prepared=read(a.assignment/'assignment.json');rubric=read(a.assignment/'rubric.json');review=read(a.review)
    facility(prepared.get('format')=='l06-whole-assignment/2' and canonical(read(a.assignment/'delivery-layout.json'))==canonical(prepared.get('delivery_layout')),'facility_assignment_layout_binding')
    facility(review.get('format')=='l06-independent-content-review/1' and review.get('assignment_id')==prepared['assignment_id'] and review.get('case_version')==prepared['case_version'],'facility_review_binding')
    values=review.get('leaves');facility(type(values) is list and len(values)==5 and all(type(v) is dict for v in values) and {v.get('id') for v in values}=={'H01','H02','H03','H04','H05'},'facility_review_leaf_set')
    facility(rubric['case_version']==read(HERE/'rubric.draft.json')['case_version'] and rubric['leaves']==read(HERE/'rubric.draft.json')['leaves'],'facility_current_contract_binding')
    fresh=a.out.parent/(a.out.stem+'-machine-recomputed')
    prepare(argparse.Namespace(run=a.assignment/'closed/run',delivery=a.assignment/'closed/delivery',layout=a.assignment/'delivery-layout.json',out=fresh,role=prepared['subject_role'],origin_run=Path(prepared['original_run']),assignment_id=prepared['assignment_id']))
    leaves=read(fresh/'assignment.json')['leaves']
    for v in values:
        facility(v.get('status') in ('verified_pass','verified_fail','unassessed','blocked_by_dependency') and type(v.get('evidence')) is list and len(v['evidence'])>0 and all(type(s) is str and s.strip() for s in v['evidence']) and type(v.get('reason')) is str and v['reason'].strip(),'facility_review_record')
        leaves[v['id']]=v
    complete=all(v['status'] in ('verified_pass','verified_fail') for v in leaves.values());allcritical=all(leaves[v['id']]['status']=='verified_pass' for v in rubric['leaves'] if v['critical'])
    points=sum(v['weight'] for v in rubric['leaves'] if leaves[v['id']]['status']=='verified_pass');frozen=read(HERE/'rubric.draft.json')['status']=='development_frozen'
    total=points if complete and frozen else None;good=points>=90 and allcritical if total is not None else False if any(v['status']=='verified_fail' for v in leaves.values()) else None
    result={**prepared,'leaves':leaves,'reviewed_points':points if complete else None,'total':total,'good':good,'all_critical_pass':allcritical,'review_complete':complete,'development_frozen':frozen,'scope':'actual source-bound whole-case grade of the declared subject_role; no effective-hour or maturity certification'}
    write(a.out,result);print(json.dumps({k:result[k] for k in ('assignment_id','reviewed_points','total','good','all_critical_pass','review_complete','development_frozen')}));return 0 if good is True else 2 if good is False else 4

def main():
    p=argparse.ArgumentParser();sub=p.add_subparsers(dest='command',required=True)
    q=sub.add_parser('prepare');q.add_argument('--run',type=Path,required=True);q.add_argument('--delivery',type=Path,required=True);q.add_argument('--layout',type=Path,required=True);q.add_argument('--role',choices=['author_reference','error_programme','candidate'],required=True);q.add_argument('--out',type=Path,required=True)
    q=sub.add_parser('grade');q.add_argument('--assignment',type=Path,required=True);q.add_argument('--review',type=Path,required=True);q.add_argument('--out',type=Path,required=True)
    a=p.parse_args()
    try:return prepare(a) if a.command=='prepare' else grade(a)
    except Facility as e:
        destination=a.out if a.command=='prepare' else a.out.parent
        destination.mkdir(parents=True,exist_ok=True);write(destination/'facility-error.json',{'status':'facility_invalid','error':str(e),'candidate_score':None,'good':None});print(str(e));return 3
if __name__=='__main__':raise SystemExit(main())
