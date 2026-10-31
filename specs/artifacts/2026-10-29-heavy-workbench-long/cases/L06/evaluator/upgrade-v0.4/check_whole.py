"""Single current whole-case evaluator for the active-inspection assignment."""
from pathlib import Path
from fractions import Fraction as F
import argparse,json,csv,shutil,sys,uuid,zipfile,datetime
HERE=Path(__file__).parent;sys.path.insert(0,str(HERE/'public'))
from model import load,canonical,require,ContractError,packet,posterior,exact,advance
from audit import analyze,normalize,read_rows

class FacilityInvalid(ValueError):pass
def facility(ok,code):
    if not ok:raise FacilityInvalid(code)
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,x):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
def same_capsule(path,folder):
    with zipfile.ZipFile(path) as z:
        for n in z.namelist():
            p=(folder/n).resolve();facility(p.is_relative_to(folder.resolve()) and p.is_file(),'captured_object_member')
            require(p.read_bytes()==z.read(n),'captured_object_identity')

def paths_for(delivery,layout):
    slots={'programme','report','ledger','summary','source_map','reproduce','requirements','figures'}
    facility(layout.get('format')=='l06-inspection-layout/1' and type(layout.get('paths')) is dict and set(layout['paths'])==slots,'delivery_layout_contract')
    def locate(n):
        facility(type(n) is str and n and not Path(n).is_absolute() and '..' not in Path(n).parts,'delivery_relative_locator')
        p=(delivery/n).resolve();facility(p.is_relative_to(delivery.resolve()),'delivery_locator_scope');return p
    p={k:locate(v) for k,v in layout['paths'].items() if k!='figures'}
    facility(type(layout['paths']['figures']) is list and layout['paths']['figures'],'actual_figure_locators');p['figures']=[locate(x) for x in layout['paths']['figures']];return p

def numeric_fraction(value,code):
    require(type(value) in (int,float,str),code)
    return F(value)

def ar_records(value):
    require(type(value) is list,'claimed_stage_AR_array')
    for item in value:
        require(type(item) is dict and set(item)=={'receipt_id','amount','due_week'},'claimed_stage_AR_shape')
        require(type(item['receipt_id']) is str and type(item['amount']) is int and type(item['due_week']) is int,'claimed_stage_AR_types')
    return sorted(value,key=lambda item:item['receipt_id'])

def evaluate(run,delivery,layout):
    rubric=read(HERE/'rubric.draft.json');registered=read(HERE/'registered.json');paths=paths_for(delivery,layout)
    leaves={v['id']:{'status':'blocked' if v['id'].startswith('M') else 'unassessed','evidence':[],'reason':'complete native/independent content evidence required'} for v in rubric['leaves']}
    def check(ident,fn):
        try:reason=fn();leaves[ident]={'status':'verified_pass','evidence':[str(run)],'reason':str(reason)}
        except FacilityInvalid:raise
        except Exception as e:leaves[ident]={'status':'verified_fail','evidence':[str(run)],'reason':getattr(e,'code',str(e))}
    facility((run/'public/instances').is_dir() and (run/'pre-execution-project.zip').is_file(),'actual_captured_execution_required')
    actual_ids={p.name for p in (run/'public/instances').iterdir() if p.is_dir()};facility(actual_ids==set(registered['facts']),'registered_instance_set')
    for ident in actual_ids:facility(canonical(normalize(load(run/'public/instances'/ident)))==canonical(registered['facts'][ident]),'registered_original_law')
    def sources():
        same_capsule(run/'pre-execution-project.zip',run/'sealed-project');same_capsule(run/'pre-execution-project.zip',paths['programme']);same_capsule(run/'pre-execution-controller.zip',run/'controller-source');same_capsule(run/'public-originals.zip',run/'public')
        return 'Actual immutable captured programme/controller/public and delivered programme bytes bound; identity alone is not the physical or optimality proof'
    check('M07',sources)
    if not (run/'owner-terminal.json').exists():
        # Prove local genuine programme failures from original wire/SQL, not a title or self-score.
        for wire in run.glob('discovery-*/wire.jsonl'):
            ident=wire.parent.name.removeprefix('discovery-');data=load(run/'public/instances'/ident)
            for line in wire.read_text(encoding='utf-8').splitlines():
                record=json.loads(line);current=record['packet'];response=record['response'];packet(data,current['committed'])
                try:require(set(response['belief'])==set(data['modes']) and all(exact(response['belief'][m])==v for m,v in posterior(data,current['committed']).items()),'bayesian_original_observations')
                except ContractError as error:leaves['M03']={'status':'verified_fail','evidence':[str(wire)],'reason':error.code}
                action=response['action']
                observations=['good','reject'] if current['state']['phase']=='laboratory' and not (type(action) is dict and action.get('test') is None) else [None]
                for observation in observations:
                    try:advance(data,current['state'],action,observation)
                    except ContractError as error:leaves['M02' if error.code!='settled_cash_floor' else 'M06']={'status':'verified_fail','evidence':[str(wire)],'reason':error.code}
        for failure in run.glob('episode-*/*/failure.json'):
            original=read(failure);code=original.get('code')
            if code=='original_request_identity_after_process_loss':
                folder=failure.parent;_,stored=read_rows(folder.parent/'journal.sqlite3');wire=read_first(folder/'worker/wire.jsonl');seq=wire['packet']['seq'];row=stored[seq]
                require(wire['response']['request_id']!=row[1],'actual_changed_replay_key')
                leaves['M09']={'status':'verified_fail','evidence':[str(failure),str(folder/'worker/wire.jsonl')],'reason':'original_request_identity_after_process_loss; actual new-process response key differs from existing original SQL row'}
        return leaves,None
    facts=analyze(run)
    for ident,reason in [('M01','Every actual terminal logical path unique, all child outcome support complete, exact mass1'),('M02','All actual laboratory/material/pack/order/demand transitions reconciled from original raw facts'),('M03','Every real response belief is the exact posterior from its full actual selected-test history'),('M06','Every actual payment/settled cash/absolute arrival and AR reconciled, all floors and terminal conditions pass'),('M09','Actual order commit73, new process original packet/key/payload/receipt and all original SQL values retained'),('M10','Actual paid-lab commit73, old observation and key recovered in new process, original SQL/wire values retained'),('M11','Separate actual row-order control has same original input semantics and complete business history')]:leaves[ident]={'status':'verified_pass','evidence':[str(run)],'reason':reason}
    def quality():
        for ident,value in facts['instances'].items():require(F(value['expected_cost_exact'])<=F(registered['quality_ratio_exact'])*F(registered['optima'][ident]),'same_information_quality:'+ident)
        return 'All three exact actual expected costs within the prospectively registered101/100 of independently physically verified Bellman root values'
    check('M04',quality)
    def numeric():
        summary=read(paths['summary']);require(summary['format']=='l06-inspection-summary/1' and set(summary['instances'])==set(facts['instances']),'summary_instance_set')
        for ident,expected in facts['instances'].items():
            claimed=summary['instances'][ident]
            for key,value in expected.items():
                if key=='components_exact':require(set(claimed[key])==set(value) and all(numeric_fraction(claimed[key][k],'claimed_component_numeric_type')==F(v) for k,v in value.items()),'all_claimed_components')
                elif key.endswith('_exact'):require(exact(claimed[key])==F(value),'claimed_exact:'+key)
                else:require(canonical(claimed[key])==canonical(value),'claimed_actual:'+key)
        with paths['ledger'].open(encoding='utf-8-sig',newline='') as f:rows=list(csv.DictReader(f))
        index={(r['instance'],r['path'],int(r['seq'])):r for r in rows};require(len(index)==len(rows)==len(facts['ledger']),'complete_claimed_stage_rows')
        integer_fields={'seq','week','certified_units','good_before','good_after','raw_peak','cash_before','cash_after','closing_cash','cumulative_cost'}
        for expected in facts['ledger']:
            row=index[(expected['instance'],expected['path'],expected['seq'])]
            for k,v in expected.items():
                if k in {'episode','request_id'}:require(type(row[k]) is str and row[k],'original_producer_locator:'+k)
                elif k in integer_fields:require(int(row[k])==v,'claimed_stage:'+k)
                elif k in {'probability_exact','node_probability_exact'}:require(F(row[k])==F(v),'claimed_probability')
                elif k=='belief_json':
                    a,b=json.loads(row[k]),json.loads(v);require(set(a)==set(b) and all(exact(a[m])==F(b[m]) for m in b),'claimed_stage_belief')
                elif k=='receivables_json':require(ar_records(json.loads(row[k]))==ar_records(json.loads(v)),'claimed_stage_AR')
                else:require(row[k]==str(v),'claimed_stage:'+k)
        return 'All original claimed numerical rows/strict probabilities/beliefs/cost/cash/absolute AR equal actual private facts by instance+observable path+seq; deployment episode/key naming is not forced'
    check('M05',numeric)
    def processes():
        terminal=read(run/'owner-terminal.json');commands=read(run/'actual-commands.json');count=sum(v['terminal_histories'] for v in facts['instances'].values())
        require(terminal['native_exit']==0 and len(commands)==count+3,'complete_actual_native_commands')
        require(sum(v['native_exit']==73 for v in commands)==2 and all(v['native_exit'] in (0,73) for v in commands),'actual_two_cut_exit_codes')
        for started in run.glob('episode-*/*/worker/worker-started.json'):
            worker=read(started);ended=read(started.with_name('worker-terminal.json'));require(worker['pid']==ended['pid'] and ended['native_exit']==0,'actual_worker_terminal')
        return 'Actual complete source actor/controller commands and SQLite/wire/worker EOF0; two controller73 then same original row continuation, no claim of worker kill/power loss'
    check('M08',processes)
    def complete():
        for name,path in paths.items():
            if name=='figures':
                for p in path:require(p.is_file() and p.stat().st_size>0,'required_actual_figure')
            elif name=='programme':require(path.is_dir() and (path/'submission.json').is_file(),'required_source_programme')
            else:require(path.is_file() and path.stat().st_size>0,'required_delivery:'+name)
        return 'Original source/policy programme, full numeric ledger/summary/map, handoff/rebuild, declared dependencies, actual report and figures present; content judged independently'
    check('M12',complete)
    return leaves,facts

def read_first(p):return json.loads(p.read_text(encoding='utf-8').splitlines()[0])
def prepare(a):
    facility(not a.out.resolve().is_relative_to(a.delivery.resolve()) and not a.out.resolve().is_relative_to(a.run.resolve()),'assignment_output_overlaps_input')
    a.out.mkdir(parents=True,exist_ok=False);closed=a.out/'closed';closed.mkdir();shutil.copytree(a.run,closed/'run');shutil.copytree(a.delivery,closed/'delivery');layout=read(a.layout)
    leaves,facts=evaluate(closed/'run',closed/'delivery',layout);ident='l06-inspection-'+uuid.uuid4().hex;rubric=read(HERE/'rubric.draft.json')
    assignment={'format':'l06-inspection-assignment/1','assignment_id':ident,'case_version':rubric['case_version'],'subject_role':a.role,'created_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'original_run':str(a.run.resolve()),'delivery_layout':layout,'leaves':leaves,'total':None,'fixed_denominator':100}
    write(a.out/'assignment.json',assignment);write(a.out/'delivery-layout.json',layout);write(a.out/'rubric.json',rubric)
    write(a.out/'review-template.json',{'format':'l06-inspection-content-review/1','assignment_id':ident,'case_version':rubric['case_version'],'leaves':[{'id':v['id'],'status':'unassessed','evidence':[],'reason':''} for v in rubric['leaves'] if v['id'].startswith('H')]})
    if facts:write(a.out/'actual-facts.json',{k:v for k,v in facts.items() if k!='ledger'})
    print(canonical({'assignment_id':ident,'M':{k:v['status'] for k,v in leaves.items() if k.startswith('M')},'total':None}));return 0

def grade(a):
    assignment=read(a.assignment/'assignment.json');facility(assignment['format']=='l06-inspection-assignment/1','assignment_version');layout=read(a.assignment/'delivery-layout.json');facility(canonical(layout)==canonical(assignment['delivery_layout']),'closed_layout_binding')
    leaves,_=evaluate(a.assignment/'closed/run',a.assignment/'closed/delivery',layout);review=read(a.review);rubric=read(HERE/'rubric.draft.json');expected={v['id'] for v in rubric['leaves'] if v['id'].startswith('H')}
    facility(review.get('format')=='l06-inspection-content-review/1' and review.get('assignment_id')==assignment['assignment_id'] and review.get('case_version')==rubric['case_version'],'independent_review_binding')
    facility(type(review.get('leaves')) is list and len(review['leaves'])==len(expected) and {v['id'] for v in review['leaves']}==expected,'human_only_fiveH')
    for item in review['leaves']:
        facility(item['status'] in ['verified_pass','verified_fail','unassessed','blocked'] and isinstance(item.get('evidence'),list) and isinstance(item.get('reason'),str),'review_decision_shape')
        facility(item['status'] not in ['verified_pass','verified_fail'] or bool(item['evidence']) and bool(item['reason'].strip()),'review_concrete_evidence');leaves[item['id']]=item
    complete=all(v['status'] in ['verified_pass','verified_fail'] for v in leaves.values());critical=all(leaves[v['id']]['status']=='verified_pass' for v in rubric['leaves'] if v['critical']);knownfail=any(leaves[v['id']]['status']=='verified_fail' for v in rubric['leaves'] if v['critical'])
    frozen=(HERE/'FREEZE.json').exists() and read(HERE/'FREEZE.json').get('development_frozen') is True
    points=sum(v['weight'] for v in rubric['leaves'] if leaves[v['id']]['status']=='verified_pass');total=points if complete and frozen else None
    result={'format':'l06-inspection-grade/1','assignment_id':assignment['assignment_id'],'case_version':rubric['case_version'],'subject_role':assignment['subject_role'],'reviewed_points':points,'fixed_denominator':100,'total':total,'all_critical_pass':critical,'good':False if knownfail else bool(total is not None and total>=rubric['pass_score'] and critical) if complete and frozen else None,'review_complete':complete,'development_frozen':frozen,'leaves':leaves,'limits':'actual source/native/science/content dev result only; no effective-hour/professional/statistical maturity'};write(a.out,result);print(canonical({k:v for k,v in result.items() if k!='leaves'}));return 0 if result['good'] else 4

def main():
    p=argparse.ArgumentParser();s=p.add_subparsers(dest='command',required=True)
    q=s.add_parser('prepare');q.add_argument('--run',type=Path,required=True);q.add_argument('--delivery',type=Path,required=True);q.add_argument('--layout',type=Path,required=True);q.add_argument('--role',choices=['author_reference','error_programme','candidate'],required=True);q.add_argument('--out',type=Path,required=True)
    q=s.add_parser('grade');q.add_argument('--assignment',type=Path,required=True);q.add_argument('--review',type=Path,required=True);q.add_argument('--out',type=Path,required=True)
    a=p.parse_args()
    try:return prepare(a) if a.command=='prepare' else grade(a)
    except FacilityInvalid as e:print(canonical({'status':'facility_invalid','code':str(e),'total':None}));return 3
if __name__=='__main__':raise SystemExit(main())
