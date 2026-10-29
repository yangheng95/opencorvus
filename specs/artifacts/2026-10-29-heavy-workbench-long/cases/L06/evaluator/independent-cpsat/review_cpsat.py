"""Independent standard-library audit of completed fixed-model CP-SAT/cross-seed research."""
import ast
from datetime import datetime,timezone
from fractions import Fraction
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import time
sys.dont_write_bytecode=True

ROOT=Path(__file__).resolve().parent
BASE=Path('D:/opencorvus-benchmark-runs/l06-procurement-qualification-20261029')
DIAG=BASE/'v2/root-node-diagnostic-20261029'
REPO=Path('D:/myhexin-local/opencorvus')
OLD=Path('D:/opencorvus-benchmark-runs/l06-native-integer-independent-review-20261029')
PREFIX=Path('D:/opencorvus-benchmark-runs/l06-cheap-v2-independent-review-20261029')
PYTHON='C:/Python314/python.exe'

def save(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')

def load(path):return json.loads(path.read_text(encoding='utf-8'))

def command(argv,label):
    start=time.perf_counter();stamp=datetime.now(timezone.utc).isoformat()
    p=subprocess.run(argv,cwd=ROOT,capture_output=True,text=True,encoding='utf-8')
    dest=ROOT/'commands'/label;dest.parent.mkdir(parents=True,exist_ok=True)
    dest.with_suffix('.stdout.txt').write_text(p.stdout,encoding='utf-8');dest.with_suffix('.stderr.txt').write_text(p.stderr,encoding='utf-8')
    receipt={'argv':argv,'cwd':str(ROOT),'started_utc':stamp,'seconds':time.perf_counter()-start,'exit_code':p.returncode}
    save(dest.with_suffix('.json'),receipt)
    if p.returncode:raise RuntimeError(receipt)
    return receipt

def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def ast_function(path,name):
    tree=ast.parse(path.read_text(encoding='utf-8'))
    return ast.dump(next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name==name),include_attributes=False)

def exact_map(data,plan,ledger,model):
    T=data['weeks'];M=len(data['raw_materials']);J=len(data['products']);P=len(data['plants']);S=len(data['suppliers'])
    values={};checks=[]
    for scenario in data['scenarios']:
        sid=scenario['id'];r=plan['decisions'][sid]
        for t in range(T):
            for k in range(S):
                for m in range(M):values[('q',sid,t,k,m)]=r['order_lots'][t][k][m]
                values[('truck',sid,t,k)]=r['truck_on'][t][k]
            for p in range(P):
                for j in range(J):values[('produce',sid,t,p,j)]=r['production'][t][p][j]
            # Derive inventories using independent cumulative sums, not reported or solver coordinates.
            for m in range(M):
                incoming=sum(r['order_lots'][u][k][m]*data['suppliers'][k]['pack_units'][m]
                    for u in range(T) for k in range(S) if u+data['suppliers'][k]['lead_weeks']<=t)
                consumption=sum(r['production'][u][p][j]*data['bom'][j][m] for u in range(t+1) for p in range(P) for j in range(J))
                values[('raw',sid,t,m)]=data['initial_raw'][m]+incoming-consumption
            for j in range(J):
                produced=sum(r['production'][u][p][j] for u in range(t+1) for p in range(P))
                values[('fg',sid,t,j)]=data['initial_products'][j]+produced-sum(scenario['demand'][u][j] for u in range(t+1))
    keys=[tuple(k) for k in model['variable_keys']];vector=[values[k] for k in keys]
    box=[{'column':i,'key':keys[i],'value':v,'lower':lo,'upper':hi} for i,(v,lo,hi) in enumerate(zip(vector,model['variable_lower'],model['variable_upper'])) if type(v) is not int or not lo<=v<=hi]
    rows=[]
    for i,row in enumerate(model['rows']):
        activity=sum(c*vector[j] for j,c in row['terms'])
        if row['lower'] is not None and activity<row['lower'] or row['upper'] is not None and activity>row['upper']:
            rows.append({'row':i,'activity':activity,'required':[row['lower'],row['upper']]})
    objective=Fraction(sum(c*v for c,v in zip(model['objective_numerators'],vector)),model['objective_denominator'])
    expected=Fraction(**ledger['expected_cost_exact'])
    return {'variable_keys':model['variable_keys'],'values':vector,'columns':len(vector),'rows_checked':len(model['rows']),
      'box_errors':box,'row_errors':rows,'objective_exact':str(objective),'business_objective_exact':str(expected),
      'all_passed':not box and not rows and objective==expected}

def main():
    resume='--resume' in sys.argv
    snap=ROOT/'source-snapshot';snap.mkdir(exist_ok=resume);inventory=[]
    def copy(src,dst):
        dst.parent.mkdir(parents=True,exist_ok=True)
        if resume and dst.is_file():
            if src.read_bytes()!=dst.read_bytes():raise RuntimeError('source_changed_since_capture:'+str(src))
        else:shutil.copy2(src,dst)
        inventory.append({'source':str(src),'copy':str(dst.relative_to(ROOT)),'bytes':dst.stat().st_size,'byte_identity_at_copy':src.read_bytes()==dst.read_bytes()})
    (ROOT/'Recall.md').write_text('''# Recall\n\n单层独立只读资格审查：已完成 CP-SAT30秒8worker固定seed20261029与60秒HiGHS交叉seed。只做标准库实际业务checker和独立前缀/向量/目标核算；不运行任何求解器、Provider、GPU、容器或用户服务，不恢复六个暂停容器，不再次委托。\n\n核对同一冻结整数model/目标分母10、原51263 hint、CP向量到公共plan与唯一l06_plan、原生状态/参数日志、交叉seed真实计划；严格46220.3与两种数值界和可行UB分别保留。不认可1%/小时级/重型冻结或候选成绩。\n''',encoding='utf-8')
    copy(REPO/'specs/records/2026-10/2026-10-29-heavy-workbench-l06-qualification.md',ROOT/'Recall-source.md')
    if not resume:command(['git','-C',str(REPO),'status','--short'],'git-status-start')
    for folder in ('executed-source-cpsat','executed-source-cross-seed'):
        for p in (DIAG/folder).glob('*.py'):copy(p,snap/folder/p.name)
    for folder in ('cpsat-input','cpsat-full','cross-seed','cpsat-known','projection-known'):
        for p in (DIAG/folder).rglob('*'):
            if p.is_file() and p.suffix in ('.json','.txt'):copy(p,snap/folder/p.relative_to(DIAG/folder))
    for name in ('cpsat-full-command.json','cpsat-known-command.json','cross-seed-command.json',
        'cpsat-full-container.cid','cpsat-known-container.cid','cross-seed-container.cid',
        'cpsat-full-output.log','cross-seed-output.log','requirements-cpsat-observed.txt','Dockerfile.cpsat'):
        copy(DIAG/name,snap/'execution'/name)
    copy(BASE/'v2/inputs/full.json',snap/'frozen-input.json')
    copy(OLD/'source-snapshot/exact-lp/model.json',snap/'previous-audited-model.json')
    for name in ('independent_checks.py','prepare_and_replay.py'):copy(PREFIX/name,snap/'reviewer-tools'/name)
    save(ROOT/'source-inventory.json',inventory)
    checks=[]
    def test(name,condition,detail=None):checks.append({'contract':name,'passed':bool(condition),'detail':detail})
    model=load(snap/'cpsat-input/full-model.json');data=load(snap/'frozen-input.json');oldmodel=load(snap/'previous-audited-model.json')
    test('same_complete_previously_audited_integer_model',model==oldmodel)
    test('same_build_model_semantic_ast',ast_function(snap/'executed-source-cross-seed/qualify_l06.py','build_model')==ast_function(OLD/'source-snapshot/executed-source-warm/qualify_l06.py','build_model'))
    test('shared_projection_source_same_in_both_snapshots',(snap/'executed-source-cpsat/l06_plan.py').read_bytes()==(snap/'executed-source-cross-seed/l06_plan.py').read_bytes())
    denominator=model['objective_denominator'];hint=load(snap/'cpsat-input/hint.json')
    def audit_vector(record):
        if record['variable_keys']!=model['variable_keys'] or len(record['values'])!=len(model['variable_keys']):return False,None
        v=record['values']
        box=all(type(x) is int and lo<=x<=hi for x,lo,hi in zip(v,model['variable_lower'],model['variable_upper']))
        for row in model['rows']:
            a=sum(c*v[k] for k,c in row['terms'])
            if row['lower'] is not None and a<row['lower'] or row['upper'] is not None and a>row['upper']:box=False
        return box,Fraction(sum(c*x for c,x in zip(model['objective_numerators'],v)),denominator)
    hint_ok,hintcost=audit_vector(hint);test('hint_exact_integer_box_rows_and_objective',hint_ok and hintcost==51263,{'objective':str(hintcost)})
    cpvalues=load(snap/'cpsat-full/values.json');cpok,cpcost=audit_vector(cpvalues)
    test('cp_saved_vector_exact_integer_box_rows_objective',cpok and cpcost==Fraction(490329,10),{'objective':str(cpcost)})
    projector=module('owned_serialization',snap/'executed-source-cpsat/l06_plan.py')
    projected=projector.plan_from_vector(data,cpvalues['variable_keys'],cpvalues['values'])
    test('actual_shared_projection_of_saved_cp_vector_matches_plan',projected==load(snap/'cpsat-full/plan.json'))
    # Execute only our audited pure function, not old runner initialization or its historical input imports.
    prefix={'Fraction':Fraction,'time':time,'save':save,'load':load}
    own_tree=ast.parse((snap/'reviewer-tools/independent_checks.py').read_text(encoding='utf-8'))
    own_function=next(n for n in own_tree.body if isinstance(n,ast.FunctionDef) and n.name=='audit_full')
    exec(compile(ast.Module(body=[own_function],type_ignores=[]),'owned_independent_prefix_function','exec'),prefix)
    branches={}
    for label in ('cpsat-full','cross-seed'):
        branch=ROOT/label;source=snap/('executed-source-cpsat' if label=='cpsat-full' else 'executed-source-cross-seed')
        plan=load(snap/label/'plan.json')
        receipt=command([PYTHON,'-B',str(source/'check_l06.py'),'--input',str(snap/'frozen-input.json'),
            '--plan',str(snap/label/'plan.json'),'--out',str(branch/'business-check.json')],label+'-business-check')
        ledger=load(branch/'business-check.json')
        for path,value in [(branch/'prefix/snapshot/v2/inputs/full.json',data),(branch/'prefix/snapshot/v2/full-witness/plan.json',plan),
            (branch/'prefix/replay/v2/full-business-contracts/complete-feasible-credit-witness/result.json',ledger)]:save(path,value)
        prefix['ROOT']=branch/'prefix';prefix['SNAP']=branch/'prefix/snapshot';independent=prefix['audit_full']()
        vector=exact_map(data,plan,ledger,model);save(branch/'independent-exact-vector.json',vector)
        test(label+'.independent_prefix_business',independent['all_checks_passed'])
        test(label+'.independent_key_vector_box_all_rows_and_cost',vector['all_passed'] and vector['objective_exact']=='490329/10')
        if label=='cpsat-full':test('saved_cp_vector_matches_independently_derived_complete_vector',vector['values']==cpvalues['values'])
        branches[label]={'actual_checker_receipt':receipt,'independent_prefix':independent,
            'mapped_columns':vector['columns'],'mapped_rows':vector['rows_checked'],'objective_exact':vector['objective_exact']}
    cp=load(snap/'cpsat-full/solver.json');cross=load(snap/'cross-seed/solver.json')
    test('CP_integer_denominator_and_status',[cp['native_status_code'],cp['status'],cp['has_feasible_incumbent'],cp['objective_denominator']]==[2,'FEASIBLE',True,10])
    test('CP_report_objective_matches_exact_vector',Fraction(cp['objective_exact'])==cpcost and cp['native_objective_scaled']==490329)
    test('CP_numeric_bound_scaling',cp['native_best_bound_scaled']==472303 and cp['native_numeric_bound_minor']==47230.3)
    test('CP_declared_parameters',[cp['workers'],cp['requested_seconds'],cp['random_seed']]==[8,30.0,20261029])
    log=(snap/'execution/cpsat-full-output.log').read_text(encoding='utf-8')
    test('actual_native_CP_parameter_log','Parameters: random_seed: 20261029 max_time_in_seconds: 30 log_search_progress: true num_search_workers: 8' in log)
    response=(snap/'cpsat-full/response-stats.txt').read_text(encoding='utf-8')
    test('CP_native_response_corresponds_to_result',all(x in response for x in ('status: FEASIBLE','objective: 490329','best_bound: 472303')))
    test('cross_seed_limited_feasible_status',[cross['native_status_code'],cross['termination'],cross['has_feasible_incumbent']]==[13,'limited',True])
    test('cross_seed_requested_options',cross['solver_options']=={'mip_rel_gap':.002,'output_flag':True,'time_limit':60.0})
    test('cross_seed_objective_and_numeric_bound',cross['objective']==49032.9 and cross['dual_bound']==47275.9)
    test('cross_seed_warm_projected_1488',cross['warm_start']['variables_projected']==1488 and cross['warm_start']['native_readback_matches'] and cross['warm_start']['business_expected_cost_minor']==49032.9)
    cpplan=load(snap/'cpsat-full/plan.json');crossplan=load(snap/'cross-seed/plan.json')
    same_actions=all(cpplan['decisions'][s['id']][f]==crossplan['decisions'][s['id']][f]
        for s in data['scenarios'] for f in ('order_lots','truck_on','production'))
    upper=Fraction(490329,10);strict=Fraction(462203,10)
    bounds={'strict_lp_objective_lattice_lower_exact':str(strict),'strict_reference':'previously independently certified exact LP proof plus integral objective lattice; not a new solve',
      'CP_numeric_bound':cp['native_numeric_bound_minor'],'cross_HiGHS_numeric_bound':cross['dual_bound'],
      'previous_HiGHS_numeric_bound':47281,'native_bounds_are_exact_certificates':False,
      'new_independent_business_upper_exact':str(upper),'previous_upper':51263,'upper_improvement_exact':str(Fraction(51263)-upper),
      'strict_gap_over_lower_percent':float((upper-strict)/strict*100),'strict_gap_over_upper_percent':float((upper-strict)/upper*100),
      'CP_numeric_gap_over_upper_percent':float((upper-Fraction(str(cp['native_numeric_bound_minor'])))/upper*100),
      'cross_numeric_gap_over_upper_percent':cross['solver_gap_scaled_by_primal']*100,
      'one_percent_certified':upper<=Fraction(101,100)*strict,'true_integer_optimum_known':False,
      'cross_seed_actions_equal_CP':same_actions,'cross_seed_upper_improved':cross['objective']<cp['objective_minor']}
    save(ROOT/'local-checks.json',checks);save(ROOT/'bound-comparison.json',bounds)
    result={'result':'local_qualification_passed' if all(c['passed'] for c in checks) else 'review_failed',
      'scope':'fixed-model CP-SAT/cross-seed oracle research qualification only','substantive_blockers_in_reviewed_scope':[],
      'checks':len(checks),'all_checks_passed':all(c['passed'] for c in checks),'branches':branches,'bounds':bounds,
      'CP_native_seconds':cp['seconds'],'CP_workers':cp['workers'],'cross_HiGHS_native_seconds':cross['seconds'],'cross_HiGHS_nodes':cross['nodes'],
      'solver_calls_by_reviewer':0,'Provider_calls':0,'GPU_work':False,'containers_started_or_resumed':False,'delegations':0,
      'heavy_freeze_approved':False,'hours_validated':False,'candidate_score_issued':False}
    save(ROOT/'stage-assessment.json',result)
    command(['git','-C',str(REPO),'status','--short'],'git-status-end')
    print(json.dumps(result,ensure_ascii=False,indent=2))
    if not result['all_checks_passed']:raise SystemExit(1)

if __name__=='__main__':main()
