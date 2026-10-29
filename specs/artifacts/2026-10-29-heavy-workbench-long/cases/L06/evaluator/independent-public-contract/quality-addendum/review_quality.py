"""Post-terminal stdlib audit of the fixed-model reference witness; no solver execution."""
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
HOME=ROOT.parent
BASE=Path('D:/opencorvus-benchmark-runs/l06-procurement-qualification-20261029')
DIAG=BASE/'v2/root-node-diagnostic-20261029'
OLD=Path('D:/opencorvus-benchmark-runs/l06-cpsat-independent-review-20261029')
PYTHON='C:/Python314/python.exe'

def save(p,v):
    p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
def load(p):return json.loads(p.read_text(encoding='utf-8'))

def main():
    snap=ROOT/'snapshot';snap.mkdir(exist_ok=False);inventory=[]
    def copy(src,dst):
        dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
        inventory.append({'source':str(src),'copy':str(dst.relative_to(ROOT)),'bytes':dst.stat().st_size,'byte_equal':src.read_bytes()==dst.read_bytes()})
    for p in (DIAG/'executed-source-quality').glob('*.py'):copy(p,snap/'source'/p.name)
    for p in (DIAG/'quality-proof').iterdir():
        if p.is_file():copy(p,snap/'quality-proof'/p.name)
    for n in ('quality-terminal-inspect.json','quality-native-stdout.log','quality-native-stderr.log','quality-stage-assessment.json','quality-container.cid'):
        if (DIAG/n).is_file():copy(DIAG/n,snap/n)
    copy(DIAG/'cpsat-input/full-model.json',snap/'model.json')
    copy(DIAG/'cpsat-full/values.json',snap/'hint.json')
    copy(BASE/'v2/inputs/full.json',snap/'original-full.json')
    copy(HOME/'independent-normalized.json',snap/'independent-public-normalized.json')
    copy(OLD/'review_cpsat.py',snap/'reviewer-exact-vector-tool.py')
    copy(HOME/'snapshot/source/l06_input.py',snap/'previous-reviewed-input-reader.py')
    save(ROOT/'source-inventory.json',inventory)
    (ROOT/'Recall.md').write_text('''# Recall\n\n只审已经自然终态的CPU参考质量研究。读取冻结输入/矩阵/源码/原生终态/向量/计划，标准库独立业务与精确整数向量核算，不运行solver、Provider、GPU或容器，不恢复暂停任务、不再次委托。C47808、native bound47380的gap与严格LP46220.3分口径，非候选成绩或小时级。先前公开合同报告原件不改写，追加当前阶段事实。\n''',encoding='utf-8')
    argv=[PYTHON,'-X','utf8','-B',str(snap/'source/check_l06.py'),'--input',str(snap/'independent-public-normalized.json'),
      '--plan',str(snap/'quality-proof/plan.json'),'--out',str(ROOT/'independent-business-check.json')]
    start=time.perf_counter();p=subprocess.run(argv,cwd=ROOT,capture_output=True,text=True,encoding='utf-8');elapsed=time.perf_counter()-start
    (ROOT/'checker.stdout.txt').write_text(p.stdout,encoding='utf-8');(ROOT/'checker.stderr.txt').write_text(p.stderr,encoding='utf-8')
    save(ROOT/'checker-command.json',{'argv':argv,'exit_code':p.returncode,'seconds':elapsed})
    if p.returncode:raise RuntimeError('actual_business_check_failed')
    business=load(ROOT/'independent-business-check.json');data=load(snap/'independent-public-normalized.json')
    model=load(snap/'model.json');plan=load(snap/'quality-proof/plan.json');values=load(snap/'quality-proof/values.json');native=load(snap/'quality-proof/solver.json')
    checks=[]
    def check(name,ok,detail=None):checks.append({'contract':name,'passed':bool(ok),'detail':detail})
    expected_original={k:v for k,v in load(snap/'original-full.json').items() if k not in ('status','qualification_variant')}
    check('input_same_as_independently_rebuilt_public_facts',data==expected_original)
    check('whole_integer_model_same_as_prior_exactly_audited',model==load(OLD/'source-snapshot/previous-audited-model.json'))
    own_path=OLD/'source-snapshot/reviewer-tools/independent_checks.py'
    own_ast=ast.parse(own_path.read_text(encoding='utf-8'));fun=next(n for n in own_ast.body if isinstance(n,ast.FunctionDef) and n.name=='audit_full')
    namespace={'Fraction':Fraction,'time':time,'save':save,'load':load}
    exec(compile(ast.Module(body=[fun],type_ignores=[]),'owned_prefix_only','exec'),namespace)
    workspace=ROOT/'prefix'
    for path,value in [(workspace/'snapshot/v2/inputs/full.json',data),(workspace/'snapshot/v2/full-witness/plan.json',plan),
      (workspace/'replay/v2/full-business-contracts/complete-feasible-credit-witness/result.json',business)]:save(path,value)
    namespace['ROOT']=workspace;namespace['SNAP']=workspace/'snapshot';prefix=namespace['audit_full']()
    check('independent_prefix_business925',prefix['all_checks_passed'])
    spec=importlib.util.spec_from_file_location('owned_exact_mapping',snap/'reviewer-exact-vector-tool.py')
    own=importlib.util.module_from_spec(spec);spec.loader.exec_module(own)
    mapped=own.exact_map(data,plan,business,model);save(ROOT/'independent-vector-mapping.json',mapped)
    check('1488_integer_coordinates_and_1096_rows_exact',mapped['all_passed'])
    check('saved_native_full_vector_matches_independently_derived',values['variable_keys']==mapped['variable_keys'] and values['values']==mapped['values'])
    check('exact_objective47808',mapped['objective_exact']=='47808' and business['expected_cost_exact']=={'numerator':47808,'denominator':1})
    inspect=load(snap/'quality-terminal-inspect.json')[0]
    check('actual_container_completed_exit0',inspect['State']['Status']=='exited' and inspect['State']['Running'] is False and inspect['State']['ExitCode']==0)
    check('actual_command_model_hint_and_fixed_gap',inspect['Args']==['-B','/work/v2/root-node-diagnostic-20261029/executed-source-quality/qualify_cpsat_model.py',
       '--model','/work/v2/root-node-diagnostic-20261029/cpsat-input/full-model.json','--input','/work/v2/inputs/full.json',
       '--hint','/work/v2/root-node-diagnostic-20261029/cpsat-full/values.json','--seconds','3600','--workers','8','--relative-gap','.009',
       '--output','/work/v2/root-node-diagnostic-20261029/quality-proof'])
    check('native_status_OPTIMAL_with_nonzero_gap',native['status']=='OPTIMAL' and native['native_status_code']==4 and native['requested_primal_relative_gap']==.009)
    log=(snap/'quality-native-stdout.log').read_text(encoding='utf-8')
    check('raw_native_parameters_and_gap_termination',
      'num_search_workers: 8 relative_gap_limit: 0.009' in log and 'Relative gap limit of 0.009 reached.' in log)
    check('final_machine_native_record_matches_raw_log',json.loads(log.splitlines()[-1])==native)
    check('native_bound_scaled_denominator_consistent',native['native_best_bound_scaled']==473800 and native['objective_denominator']==10 and native['native_numeric_bound_minor']==47380)
    check('native_objective_scaled_matches_exact_values',native['native_objective_scaled']==478080 and native['objective_exact']=='47808')
    events=[json.loads(line) for line in (snap/'quality-proof/incumbent-events.jsonl').read_text(encoding='utf-8').splitlines()]
    check('161_strictly_improving_incumbent_events',len(events)==native['incumbent_callback_updates']==161 and
       [r['updates'] for r in events]==list(range(1,162)) and all(a['objective_scaled_exact']>b['objective_scaled_exact'] for a,b in zip(events,events[1:])))
    check('last_progress_vector_and_plan_match_final',events[-1]==load(snap/'quality-proof/progress.json') and
       load(snap/'quality-proof/incumbent-values.json')==values and load(snap/'quality-proof/incumbent-plan.json')==plan)
    C=Fraction(47808);L=Fraction(47380);strict=Fraction(462203,10)
    gaps={'C_exact':str(C),'native_L_exact_number_representation':str(L),'difference_exact':str(C-L),
       'primal_relative_gap_exact':str((C-L)/C),'primal_relative_gap_percent':float((C-L)/C*100),
       'benchmark_relative_to_bound_exact':str((C-L)/L),'benchmark_relative_to_bound_percent':float((C-L)/L*100),
       'actual_primal_gap_within_requested_0_009':(C-L)/C<=Fraction(9,1000),
       'one_percent_reachability_using_trusted_native_bound':(C-L)/L<=Fraction(1,100),
       'strict_rational_LP_lattice_lower':str(strict),'strict_LP_relative_to_bound_percent':float((C-strict)/strict*100),
       'one_percent_from_strict_LP_proof':(C-strict)/strict<=Fraction(1,100),
       'exact_integer_optimum_proven':False,'independent_search_or_dual_certificate_provided':False,
       'bound_trust_model':'fixed mature CP-SAT native lower bound, independently verified import/model identity; not independently replayed proof'}
    check('one_percent_native_bound_witness_arithmetic',gaps['one_percent_reachability_using_trusted_native_bound'])
    save(ROOT/'gap-calculation.json',gaps);save(ROOT/'local-checks.json',checks)
    result={'result':'reference_one_percent_reachability_under_native_solver_trust' if all(c['passed'] for c in checks) else 'review_failed',
      'all_checks_passed':all(c['passed'] for c in checks),'local_checks':len(checks),'business_checker_seconds':elapsed,
      'independent_prefix':prefix,'mapped_columns':mapped['columns'],'mapped_rows':mapped['rows_checked'],'gap':gaps,
      'native_seconds':native['seconds'],'workers':native['workers'],'native_duration_is_reference_not_candidate':True,
      'actual_container_cpu_quota':inspect['HostConfig']['NanoCpus'],'actual_container_cpu_set':inspect['HostConfig']['CpusetCpus'],
      'CPU_single_core_claimed':False,'candidate_score_issued':False,'hours_validated':False,'heavy_freeze_approved':False,
      'remaining_requirements':['pre-register bound source/trust and L before candidate','complete raw-input reference delivery/cold replay',
        'variant quality qualification','full47 leaf grader and human calibration','fresh candidate/comparison active-work evidence'],
      'reviewer_solver_calls':0,'reviewer_model_calls':0,'GPU_work':False,'container_operations_by_reviewer':False,'delegations':0}
    save(ROOT/'stage-assessment.json',result)
    print(json.dumps(result,ensure_ascii=False,indent=2))
    if not result['all_checks_passed']:raise SystemExit(1)

if __name__=='__main__':main()
