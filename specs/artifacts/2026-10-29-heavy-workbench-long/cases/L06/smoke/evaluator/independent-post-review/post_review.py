"""S06 source-only cold replay and independent non-blind arithmetic review.

Never starts native Task, Provider, GPU, containers, or external optimization.
"""
from collections import Counter
from datetime import datetime,timezone
from fractions import Fraction
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parent
RUN=Path('D:/opencorvus-benchmark-runs/smoke-S06-20261029-24ff4844')
REPO=Path('D:/myhexin-local/opencorvus')
SMOKE=REPO/'specs/artifacts/2026-10-29-heavy-workbench-long/cases/L06/smoke'
CHECK=REPO/'specs/artifacts/2026-10-29-heavy-workbench-long/cases/L06/evaluator/qualification/current-source'
FREEZE_REVIEW=Path('D:/opencorvus-benchmark-runs/s06-smoke-freeze-review-20261029')

def save(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')

def load(path):
    def reject(value):raise ValueError('nonfinite JSON '+value)
    return json.loads(path.read_text(encoding='utf-8'),parse_constant=reject)

def command(argv,label,cwd=ROOT):
    start=time.perf_counter();stamp=datetime.now(timezone.utc).isoformat()
    p=subprocess.run(argv,cwd=cwd,capture_output=True,text=True,encoding='utf-8',
        env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1','PYTHONIOENCODING':'utf-8'})
    base=ROOT/'commands'/label;base.parent.mkdir(parents=True,exist_ok=True)
    base.with_suffix('.stdout.txt').write_text(p.stdout,encoding='utf-8')
    base.with_suffix('.stderr.txt').write_text(p.stderr,encoding='utf-8')
    result={'argv':argv,'cwd':str(cwd),'started_utc':stamp,'seconds':time.perf_counter()-start,
        'exit_code':p.returncode,'stdout':str(base.with_suffix('.stdout.txt').relative_to(ROOT)),
        'stderr':str(base.with_suffix('.stderr.txt').relative_to(ROOT))}
    save(base.with_suffix('.json'),result);return result

def main():
    if (ROOT/'replay-assessment.json').exists():raise RuntimeError('use a new occurrence')
    copies=[]
    def capture(src,dst):
        dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
        copies.append({'source':str(src),'snapshot':str(dst.relative_to(ROOT)),
            'bytes':dst.stat().st_size,'byte_equal_at_copy':src.read_bytes()==dst.read_bytes()})
    for name in ('solve.py','README.md'):
        capture(RUN/'sealed'/name,ROOT/'source-snapshot/sealed'/name)
    for case in ('base','price-change'):
        capture(SMOKE/'public/inputs'/f'{case}.json',ROOT/'frozen-inputs'/f'{case}.json')
        for name in ('plan.json','summary.json'):
            capture(RUN/'sealed/original-results'/case/name,ROOT/'source-snapshot/original-results'/case/name)
    for relative in ('public/TASK.md','profile.json','evaluator/contract.json'):
        capture(SMOKE/relative,ROOT/'source-snapshot/smoke-contract'/relative)
    for name in ('check_l06.py','l06_input.py'):
        capture(CHECK/name,ROOT/'evaluator-tools'/name)
    capture(FREEZE_REVIEW/'review_smoke.py',ROOT/'evaluator-tools/independent-freeze-oracle.py')
    for name in ('main-smoke-assessment.json','candidate-git.json'):
        capture(RUN/'evaluator'/name,ROOT/'original-evaluator'/name)
    save(ROOT/'source-inventory.json',copies)
    command(['git','-C',str(REPO),'status','--short'],'git-status-start')

    # Retain only structural API metadata, never message/reasoning bodies.
    task=load(RUN/'evaluator/task-final.json');status=load(RUN/'evaluator/task-status-final.json')
    projection=[]
    for o in status.get('executionProjection',{}).get('occurrences',[]):
        projection.append({'sessionID':o.get('sessionID'),'agent':o.get('agent'),'kind':o.get('kind'),
            'event_status_counts':dict(Counter(e.get('status',{}).get('type') for e in o.get('events',[])))})
    nodes=[{k:n[k] for k in ('sessionID','agent','kind','parentSessionID','parentAgentSessionID','time') if k in n}
           for n in status.get('sessionInvocationTopology',{}).get('nodes',[])]
    native={'source_files':[str(RUN/'evaluator/task-final.json'),str(RUN/'evaluator/task-status-final.json')],
        'task':{k:task.get(k) for k in ('id','status','executionLifecycle','terminalReason','packageRevisionBinding','time')},
        'inspect_metadata':task.get('metadata',{}).get('inspect'),
        'status':{k:status.get(k) for k in ('taskID','status','lifecycleStatus','activity','time')},
        'actors':nodes,'occurrence_status_summaries':projection,
        'native_seconds_from_api_time':(task['time']['completed']-task['time']['started'])/1000,
        'single_agent_claim':False,'actual_model_binding_and_inspect_terminal_receipt':'pending supplementary evidence'}
    save(ROOT/'api-terminal-observation.json',native)

    # Execution directory starts with only the two submitted source/doc files and public originals.
    cold=ROOT/'cold-replay';cold.mkdir(exist_ok=False)
    for name in ('solve.py','README.md'):shutil.copy2(ROOT/'source-snapshot/sealed'/name,cold/name)
    (cold/'inputs').mkdir()
    for case in ('base','price-change'):shutil.copy2(ROOT/'frozen-inputs'/f'{case}.json',cold/'inputs'/f'{case}.json')
    save(ROOT/'cold-replay-initial-inventory.json',{
        'cwd':str(cold),'files':[str(p.relative_to(cold)) for p in sorted(cold.rglob('*')) if p.is_file()],
        'scope':'only solve.py, README and two public inputs before execution; no old outputs/DB/evaluator/oracle'})

    spec=importlib.util.spec_from_file_location('reviewer_s06_oracle',ROOT/'evaluator-tools/independent-freeze-oracle.py')
    oracle=importlib.util.module_from_spec(spec);spec.loader.exec_module(oracle)
    artifacts=[];runs=[]
    for case in ('base','price-change'):
        r=command(['C:/Python314/python.exe','-B','solve.py','--input',f'inputs/{case}.json','--output',f'results/{case}'],
                  'solve-'+case,cwd=cold);runs.append(r)
        data=load(ROOT/'frozen-inputs'/f'{case}.json')
        optimum=oracle.enumerate_instance(data)
        save(ROOT/'independent-optima'/f'{case}.json',optimum)
        for kind,path in [('sealed',ROOT/'source-snapshot/original-results'/case/'plan.json'),
                          ('reviewer-cold-replay',cold/'results'/case/'plan.json')]:
            target=ROOT/'business-checks'/f'{kind}-{case}.json'
            cr=command(['C:/Python314/python.exe','-B',str(ROOT/'evaluator-tools/check_l06.py'),'--input',
                str(ROOT/'frozen-inputs'/f'{case}.json'),'--plan',str(path),'--out',str(target)],f'check-{kind}-{case}')
            result=load(target);plan=load(path);ids=[s['id'] for s in data['scenarios']]
            a,b=(plan['decisions'][sid] for sid in ids)
            q=(a['order_lots'][0][0][0],a['order_lots'][0][1][0],a['order_lots'][1][1][0],
               b['order_lots'][0][0][0],b['order_lots'][0][1][0],b['order_lots'][1][1][0])
            early=(a['production'][0][0][0],b['production'][0][0][0])
            scalar=oracle.scalar_value(data,q,early)
            canonical=all(rec['order_lots'][1][0][0]==0 and
                all(rec['truck_on'][t][s]==int(rec['order_lots'][t][s][0]>0) for t in range(2) for s in range(2)) and
                rec['production'][1][0][0]==sum(x[0] for x in sc['demand'])-rec['production'][0][0][0]
                for rec,sc in [(a,data['scenarios'][0]),(b,data['scenarios'][1])])
            exact=Fraction(**result['expected_cost_exact']) if result.get('business_feasible') else None
            passed=(cr['exit_code']==0 and result.get('business_feasible') and canonical and scalar is not None and
                scalar['expected']==exact==Fraction(optimum['best_exact']))
            artifacts.append({'case':case,'kind':kind,'plan':str(path.relative_to(ROOT)),
                'checker_exit_code':cr['exit_code'],'business_feasible':result.get('business_feasible'),
                'checker_cost_exact':None if exact is None else str(exact),
                'independent_scalar_cost':None if scalar is None else str(scalar['expected']),
                'independent_full_domain_optimum':optimum['best_exact'],'canonical_two_week_abi':canonical,
                'all_passed':bool(passed),'scalar_scenario_costs':None if scalar is None else scalar['scenario_costs'],
                'scalar_minimum_cash':None if scalar is None else scalar['minimum_cash']})
    save(ROOT/'independent-artifact-checks.json',artifacts)
    save(ROOT/'replay-assessment.json',{'scope':'non-blind independent S06 source-only replay, not heavy-case/ranking',
        'candidate_execution_runs':runs,'actual_checker_calls':4,'artifacts':artifacts,
        'all_replays_exit0':all(r['exit_code']==0 for r in runs),'all_four_plan_audits_pass':all(a['all_passed'] for a in artifacts),
        'sealed_source_reads':'reviewed input-only open(args.input); Path.exists on output; writes only newly created output files',
        'summary_schema':'not imposed; candidate exact fractions accepted and outputs retained',
        'source_snapshot_scope':'sealed source/code only in execution directory; original outputs kept outside for evaluation',
        'native_condition_pending_model_stream_and_Inspect_terminal_supplement':True})
    command(['git','-C',str(REPO),'status','--short'],'git-status-end')
    print(json.dumps({'candidate_runs':[r['exit_code'] for r in runs],'four_plan_audits':artifacts,
        'native_api_status':native['task']['status'],'native_seconds':native['native_seconds_from_api_time'],
        'native_actors':[{'agent':n['agent'],'kind':n['kind']} for n in nodes]},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
