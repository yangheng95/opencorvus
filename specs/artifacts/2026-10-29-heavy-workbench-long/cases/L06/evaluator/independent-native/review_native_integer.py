"""Stdlib-only independent review of already completed native integer diagnostics."""
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
OLD=Path('D:/opencorvus-benchmark-runs/l06-relaxation-independent-review-20261029')
V2REVIEW=Path('D:/opencorvus-benchmark-runs/l06-cheap-v2-independent-review-20261029')
REPO=Path('D:/myhexin-local/opencorvus')
PYTHON='C:/Python314/python.exe'

def save(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,indent=2,ensure_ascii=False,allow_nan=False)+'\n',encoding='utf-8')

def load(path):return json.loads(path.read_text(encoding='utf-8'))

def run(argv,label):
    start=time.perf_counter();stamp=datetime.now(timezone.utc).isoformat()
    p=subprocess.run(argv,cwd=ROOT,capture_output=True,text=True,encoding='utf-8')
    elapsed=time.perf_counter()-start;dest=ROOT/'commands'/label;dest.parent.mkdir(parents=True,exist_ok=True)
    dest.with_suffix('.stdout.txt').write_text(p.stdout,encoding='utf-8')
    dest.with_suffix('.stderr.txt').write_text(p.stderr,encoding='utf-8')
    receipt={'argv':argv,'cwd':str(ROOT),'started_utc':stamp,'seconds':elapsed,'exit_code':p.returncode}
    save(dest.with_suffix('.json'),receipt)
    if p.returncode:raise RuntimeError(receipt)
    return receipt

def import_file(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def function_ast(path,name):
    tree=ast.parse(path.read_text(encoding='utf-8'))
    return ast.dump(next(n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.ClassDef)) and n.name==name),include_attributes=False)

def main():
    resume='--resume' in sys.argv
    snap=ROOT/'source-snapshot';snap.mkdir(exist_ok=resume)
    inventory=[]
    def copy(source,dest):
        dest.parent.mkdir(parents=True,exist_ok=True)
        if resume and dest.is_file():
            if source.read_bytes()!=dest.read_bytes():raise RuntimeError('source_changed_since_initial_snapshot:'+str(source))
        else:shutil.copy2(source,dest)
        inventory.append({'source':str(source),'copy':str(dest.relative_to(ROOT)),
            'byte_equal_at_copy':source.read_bytes()==dest.read_bytes(),'bytes':dest.stat().st_size})
    (ROOT/'Recall.md').write_text('''# Recall\n\n用户要求便宜实验优先。本轮只审已自然完成的 L06 native/warm 整数诊断，不重跑 LP/MIP/小穷举、不调用 Provider/GPU、不恢复六个暂停容器、不再次委托、不访问用户服务。\n\n先审唯一 build_model、native 状态和 options set/readback、warm 业务校验及按 key 映射；快照实际源码/输入/回执。仅标准库实际业务 checker CLI、独立前缀现金/库存/成本与完整向量行界核算。严格有理 LP 证书和目标格点 46220.3、native 数值界、真实可行上界分别记录。无新候选、无题目冻结、无 1% 或小时级认可。\n''',encoding='utf-8')
    copy(REPO/'specs/records/2026-10/2026-10-29-heavy-workbench-l06-qualification.md',ROOT/'Recall-source.md')
    if not resume:run(['git','-C',str(REPO),'status','--short'],'git-status-before')
    for folder in ('executed-source-native','executed-source-warm'):
        for p in sorted((DIAG/folder).glob('*.py')):copy(p,snap/folder/p.name)
    for folder in ('full','native-full','native-known','warm-known','warm-full'):
        for p in sorted((DIAG/folder).rglob('*.json')):copy(p,snap/'evidence'/folder/p.relative_to(DIAG/folder))
    for name in ('Dockerfile.highspy','full-native-output.log','native-full-output.log','warm-full-output.log',
                 'full-command.json','native-full-command.json','warm-known-command.json','warm-full-command.json',
                 'native-full-container.cid','warm-known-container.cid','warm-full-container.cid'):
        if (DIAG/name).is_file():copy(DIAG/name,snap/'evidence'/name)
    for name in ('model.json','certificate.json','certificate_check.json','instance.json'):
        copy(BASE/'v2/continuous-relaxation-qualification/full'/name,snap/'exact-lp'/name)
    copy(BASE/'v2/inputs/full.json',snap/'frozen-input.json')
    copy(BASE/'v2/full-witness/plan.json',snap/'warm-start-plan.json')
    # Pure independent audit tools from prior review, no solver module imported.
    copy(OLD/'review_bound.py',snap/'reviewer-tools/review_bound.py')
    copy(V2REVIEW/'independent_checks.py',snap/'reviewer-tools/independent_checks.py')
    save(ROOT/'source-inventory.json',inventory)
    source=snap/'executed-source-warm'
    input_path=snap/'evidence/warm-full/instance.json';plan_path=snap/'evidence/warm-full/plan.json'
    if resume:checker_receipt=load(ROOT/'commands/native-final-business-check.json')
    else:checker_receipt=run([PYTHON,'-B',str(source/'check_l06.py'),'--input',str(input_path),'--plan',str(plan_path),
        '--out',str(ROOT/'business-check/result.json')],'native-final-business-check')
    ledger=load(ROOT/'business-check/result.json');data=load(input_path);plan=load(plan_path)
    checks=[]
    def need(label,actual,expected):checks.append({'contract':label,'actual':actual,'expected':expected,'passed':actual==expected})
    need('same_frozen_v2_input',data,load(snap/'frozen-input.json'))
    need('same_model_input_as_strict_lp',data,load(snap/'exact-lp/instance.json'))
    old_source=OLD/'source-snapshot/executed-source-repair/qualify_l06.py'
    need('build_model_semantics_match_previously_exactly_audited_model',function_ast(source/'qualify_l06.py','build_model'),function_ast(old_source,'build_model'))
    # Build separate owned adapter paths to run the prior independent prefix arithmetic on this new plan.
    workspace=ROOT/'prefix-review'
    for path,value in [(workspace/'snapshot/v2/inputs/full.json',data),(workspace/'snapshot/v2/full-witness/plan.json',plan),
        (workspace/'replay/v2/full-business-contracts/complete-feasible-credit-witness/result.json',ledger)]:save(path,value)
    sys.path.insert(0,str(V2REVIEW))
    prefix=import_file('owned_prefix_audit',snap/'reviewer-tools/independent_checks.py')
    prefix.ROOT=workspace;prefix.SNAP=workspace/'snapshot';prefix_result=prefix.audit_full()
    need('independent_prefix_physical_financial_all_passed',prefix_result['all_checks_passed'],True)
    # Independently map both returned plan and warm start; raw/FG from exact recurrence, never candidate declarations.
    model=load(snap/'exact-lp/model.json')
    mapping=import_file('owned_model_mapping',snap/'reviewer-tools/review_bound.py')
    mappings={}
    for label,actual_plan in [('native-final',plan),('warm-start',load(snap/'warm-start-plan.json'))]:
        branch=ROOT/'mapping'/label;mapping.ROOT=branch
        if label=='native-final':current_ledger=ledger
        else:
            warm_check=run([PYTHON,'-B',str(source/'check_l06.py'),'--input',str(input_path),'--plan',str(snap/'warm-start-plan.json'),
                '--out',str(branch/'warm-business-result.json')],'warm-start-business-check')
            current_ledger=load(branch/'warm-business-result.json')
        save(branch/'witness/input.json',data);save(branch/'witness/plan.json',actual_plan);save(branch/'witness/result.json',current_ledger)
        result=mapping.witness_mapping(data,model);mappings[label]=result
        need(label+'.exact_key_vector_box_and_all_rows',result['all_passed'],True)
    warm=load(snap/'evidence/warm-full/solver.json');native=load(snap/'evidence/native-full/solver.json')
    old=load(snap/'evidence/full/solver.json');known=load(snap/'evidence/warm-known/solver.json')
    need('native_root_status16_limited_no_incumbent',
      [native['native_status_code'],native['termination'],native['has_feasible_incumbent'],native['objective'],native['nodes']],
      [16,'limited',False,None,1])
    need('native_root_retains_numeric_dual',native['dual_bound'],47039.5)
    need('native_root_projects_options',native['solver_options'],{'mip_rel_gap':.002,'output_flag':True,'mip_max_nodes':1,'time_limit':30.0})
    need('warm_final_status13_limited_with_incumbent',
      [warm['native_status_code'],warm['termination'],warm['has_feasible_incumbent'],warm['native_primal_solution_status']],
      [13,'limited',True,2])
    need('warm_final_options',warm['solver_options'],{'mip_rel_gap':.002,'output_flag':True,'time_limit':30.0})
    need('warm_final_objective_matches_independent_exact',Fraction(warm['objective']),Fraction(ledger['expected_cost_exact']['numerator'],ledger['expected_cost_exact']['denominator']))
    # JSON encode rational comparisons as text, retain equality result.
    checks[-1]['actual']=str(checks[-1]['actual']);checks[-1]['expected']=str(checks[-1]['expected'])
    need('known_native_warm_actual_projection',known['warm_start'],{'business_feasible':True,'business_expected_cost_minor':6.0,'model_objective':6.0,'variables_projected':5,'native_readback_matches':True})
    need('warm_full_actual_projection_report',warm['warm_start'],{'business_feasible':True,'business_expected_cost_minor':51263.0,'model_objective':51263.0,'variables_projected':1488,'native_readback_matches':True})
    need('warm_solver_gap_arithmetic',warm['solver_gap_scaled_by_primal'],(warm['objective']-warm['dual_bound'])/abs(warm['objective']))
    need('old_scipy_adapter_loss_is_preserved',[old['status'],old['objective'],old['dual_bound'],old['nodes']],[4,None,None,None])
    log=(snap/'evidence/warm-full-output.log').read_text(encoding='utf-8')
    # These source receipts corroborate execution; numeric business correctness came from the actual plan above.
    evidence={'mip_start_feasible_objective_line':'MIP start solution is feasible, objective value is 51263' in log,
      'native_time_limit_line':'Time limit reached' in log,'final_native_report_matches_json':json.loads(log.splitlines()[-1])==warm,
      'same_native_final_actions_as_seed':all(plan['decisions'][s['id']][f]==load(snap/'warm-start-plan.json')['decisions'][s['id']][f]
        for s in data['scenarios'] for f in ('order_lots','truck_on','production')),
      'native_warm_start_projection_limit':'setSolution/getSolution success is source+actual native receipt/log evidence; reviewer did not re-execute HiGHS API or obtain an independently instrumented API readback vector'}
    for label in ('mip_start_feasible_objective_line','native_time_limit_line','final_native_report_matches_json'):need(label,evidence[label],True)
    strict=Fraction(load(snap/'exact-lp/certificate_check.json')['lower_bound_exact'])
    upper=Fraction(ledger['expected_cost_exact']['numerator'],ledger['expected_cost_exact']['denominator'])
    intervals={'strict_exact_lp_bound':str(strict),'strict_lp_objective_lattice_bound':'46220.3',
      'strict_bound_previously_independently_certified_not_resolved':True,'native_root_numeric_bound':native['dual_bound'],
      'native_warm_numeric_bound':warm['dual_bound'],'native_numeric_bounds_are_exact_certificates':False,
      'independent_business_feasible_upper':str(upper),'upper_improved':upper<Fraction(51263),
      'strict_gap_over_lower_percent':float((upper-strict)/strict*100),
      'native_numeric_gap_over_primal_percent':(warm['objective']-warm['dual_bound'])/warm['objective']*100,
      'native_numeric_gap_over_dual_percent':(warm['objective']-warm['dual_bound'])/warm['dual_bound']*100,
      'one_percent_certified':upper<=Fraction(101,100)*strict,'true_integer_optimum_known':False}
    # Shrink only verbose AST/instance check representations in report; exact snapshots remain preserved.
    for c in checks:
        if c['contract'] in ('same_frozen_v2_input','same_model_input_as_strict_lp','build_model_semantics_match_previously_exactly_audited_model'):
            c['actual']='compared complete structured content / AST';c['expected']='same semantic structure'
    save(ROOT/'local-checks.json',checks);save(ROOT/'native-evidence-audit.json',evidence);save(ROOT/'bound-comparison.json',intervals)
    summary={'scope':'native integer result adapter and warm-start/returned-plan qualification only',
      'local_checks':len(checks),'local_checks_passed':all(c['passed'] for c in checks),
      'actual_business_checker_receipt':checker_receipt,'independent_prefix_arithmetic':prefix_result,
      'full_integer_vectors_and_1096_rows_passed':all(v['all_passed'] for v in mappings.values()),
      'native_warm_seconds':warm['seconds'],'native_warm_nodes':warm['nodes'],'bound_comparison':intervals,
      'mip_lp_runs_by_reviewer':0,'provider_calls':0,'gpu_work':False,'paused_containers_resumed':False,
      'freeze_approved':False,'candidate_score_issued':False,'hours_validated':False}
    save(ROOT/'stage-assessment.json',summary)
    run(['git','-C',str(REPO),'status','--short'],'git-status-after')
    print(json.dumps(summary,ensure_ascii=False,indent=2))
    if not summary['local_checks_passed']:raise SystemExit(1)

if __name__=='__main__':main()
