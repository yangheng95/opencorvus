"""Independent, read-only old-suite audit. Writes only under this review directory.

This is evaluator reference/checker replay, not a candidate solution or full score.
"""
import csv
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone

sys.dont_write_bytecode = True
REPO = Path('D:/myhexin-local/opencorvus')
OUT = Path(__file__).resolve().parent
SNAP = OUT / 'source-snapshot'
OLD = Path('specs/artifacts/2026-10-29-heavy-workbench')
PACKAGE = SNAP / OLD
CASES = [f'H{i:02}' for i in range(2, 11)]

def save(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

def read_csv(path):
    with path.open(encoding='utf-8', newline='') as handle:
        return list(csv.DictReader(handle))

def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def command(argv, label):
    started = datetime.now(timezone.utc).isoformat()
    t0 = time.perf_counter()
    proc = subprocess.run(argv, cwd=OUT, capture_output=True, text=True,
                          encoding='utf-8', env={**os.environ, 'PYTHONIOENCODING':'utf-8'})
    elapsed = time.perf_counter()-t0
    base = OUT / 'commands' / label
    base.parent.mkdir(parents=True, exist_ok=True)
    base.with_suffix('.stdout.txt').write_text(proc.stdout, encoding='utf-8')
    base.with_suffix('.stderr.txt').write_text(proc.stderr, encoding='utf-8')
    receipt = {'argv':argv, 'cwd':str(OUT), 'started_utc':started,
               'elapsed_seconds':elapsed, 'exit_code':proc.returncode,
               'stdout':str(base.with_suffix('.stdout.txt').relative_to(OUT)),
               'stderr':str(base.with_suffix('.stderr.txt').relative_to(OUT))}
    save(base.with_suffix('.json'),receipt)
    return receipt

def main():
    if (OUT/'collection.json').exists():
        raise RuntimeError('Existing evidence is immutable; use a new review occurrence')
    paths = [OLD/'suite.json', OLD/'reference_calculations.py',
             Path('script/benchmark/heavy_workbench.py'),
             Path('specs/artifacts/2026-10-29-heavy-workbench-long/README.md'),
             Path('specs/records/2026-10/2026-10-29-heavy-workbench-long.md')]
    paths += [OLD/name for name in ('README.md','PROTOCOL.md','COMPARISON.md','REVIEW.md',
                                   'RECORDS.md','VALIDATION.md','validation/checker-replay.json')]
    for case in CASES:
        paths.append(OLD/'cases'/f'{case}.md')
        paths += sorted(p.relative_to(REPO) for p in (REPO/OLD/'inputs'/case).iterdir()
                        if p.is_file() and p.suffix in ('.csv','.md','.json','.py'))
        paths += sorted(p.relative_to(REPO) for p in (REPO/OLD/'oracle'/case).glob('*.csv'))
    inventory=[]
    for relative in paths:
        src, dst = REPO/relative, SNAP/relative
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        inventory.append({'repo_relative':relative.as_posix(),'bytes':dst.stat().st_size,
                          'snapshot_byte_equal_at_copy':src.read_bytes()==dst.read_bytes()})
    save(OUT/'source-inventory.json',inventory)
    command(['git','-C',str(REPO),'status','--short'],'git-status-start')
    suite=json.loads((PACKAGE/'suite.json').read_text(encoding='utf-8'))
    facts=[]
    for case in (c for c in suite['cases'] if c['id'] in CASES):
        cid=case['id']; rows=read_csv(PACKAGE/'inputs'/cid/'records.csv')
        context=json.loads((PACKAGE/'inputs'/cid/'context.json').read_text(encoding='utf-8'))
        facts.append({'case':cid,'title':case['title'],'rows':len(rows),
                      'columns':list(rows[0]),
                      'distinct_values':{k:len({r[k] for r in rows}) for k in rows[0]},
                      'first_record':rows[0], 'last_record':rows[-1],
                      'prompt':case['prompt'],'outputs':case['outputs'],
                      'budget_historical_do_not_reuse':case['budget'],
                      'protocol':context['dictionary_and_protocol'],
                      'plan_contract':case['result_contract'].get('plan_contract'),
                      'rubric':case['rubric'],
                      'oracle_tables':{p.name:{'rows':len(read_csv(p)),
                                              'columns':list(read_csv(p)[0])}
                                       for p in sorted((PACKAGE/'oracle'/cid).glob('*.csv'))}})
    save(OUT/'old-case-facts.json',facts)
    ref=load_module('review_reference',PACKAGE/'reference_calculations.py')
    check=SNAP/'script/benchmark/heavy_workbench.py'
    results=[]; plans=[]
    for cid in CASES:
        rows=read_csv(PACKAGE/'inputs'/cid/'records.csv')
        started=time.perf_counter(); tables=ref.outputs(cid,rows)
        calc_s=time.perf_counter()-started
        generated=OUT/'diagnostic-reference-replay'/cid
        for name, records in tables.items():
            ref.write_table(generated/'diagnostics'/f'{name}.csv',records)
        rec=command([sys.executable,'-B',str(check),'objective',cid,str(generated),
                     '--out',str(generated/'objective.json')],f'{cid}-objective')
        obj=json.loads((generated/'objective.json').read_text(encoding='utf-8'))
        result={'case':cid,'reference_compute_seconds':calc_s,
                'objective':obj['points'],'maximum':obj['maximum'],
                'receipt':rec,'scope':'author reference 20-point diagnostics only; no 80-point assessment'}
        # Positive explicit error detection contract: perturb a numeric fact, retaining business key.
        bad=OUT/'diagnostic-error-probes'/cid
        shutil.copytree(generated/'diagnostics',bad/'diagnostics')
        numeric_leaf=next(r for r in suite['cases'] if r['id']==cid)['rubric']
        leaf=next(r for r in numeric_leaf if r['mode']=='objective' and r['check']['numeric'])
        path=bad/leaf['check']['artifact']; records=read_csv(path)
        col=leaf['check']['numeric'][0]; before=records[0][col]
        records[0][col]=float(before)+1000
        ref.write_table(path,records)
        bad_rec=command([sys.executable,'-B',str(check),'objective',cid,str(bad),
                         '--out',str(bad/'objective.json')],f'{cid}-objective-error')
        bad_obj=json.loads((bad/'objective.json').read_text(encoding='utf-8'))
        result['single_numeric_error_probe']={'leaf':leaf['id'],'column':col,
            'before':before,'after':records[0][col], 'objective':bad_obj['points'],
            'failed_leaf':next(r for r in bad_obj['leaves'] if r['leaf']==leaf['id']),
            'receipt':bad_rec}
        results.append(result)
        if cid in ('H06','H08','H10'):
            scenarios={'H06':['base','stress'],'H08':['base','stress'],
                       'H10':['base','price','efficiency']}[cid]
            for scenario in scenarios:
                dest=OUT/'author-plan-witness-replay'/cid/scenario
                plan=ref.feasible_witness(cid,rows,scenario); ref.write_table(dest/'plan.csv',plan)
                receipt=command([sys.executable,'-B',str(check),'verify-plan',cid,
                    str(PACKAGE/'inputs'/cid),str(dest/'plan.csv'),'--scenario',scenario,
                    '--out',str(dest/'verification.json')],f'{cid}-{scenario}-plan')
                obj=json.loads((dest/'verification.json').read_text(encoding='utf-8'))
                plans.append({'case':cid,'scenario':scenario,'result':obj,'receipt':receipt,
                              'scope':'author constructive feasibility witness; not optimal/full deliverable'})
    save(OUT/'diagnostic-probes.json',results)
    save(OUT/'author-plan-witness-probes.json',plans)
    save(OUT/'collection.json',{'status':'completed','completed_utc':datetime.now(timezone.utc).isoformat(),
        'python':sys.version, 'source_count':len(inventory), 'cases':CASES,
        'objective_points':{x['case']:x['objective'] for x in results},
        'scope':'design audit and actual evaluator reference/diagnostic replay, NOT candidate performance',
        'writes':'this external review directory only; main repo read-only'})
    print(json.dumps({'source_count':len(inventory), 'cases':{x['case']:{
        'diagnostics':x['objective'],'error_probe':x['single_numeric_error_probe']['objective'],
        'compute_seconds':x['reference_compute_seconds']} for x in results},
        'plans':[{'case':p['case'],'scenario':p['scenario'],'result':p['result']} for p in plans]},
        ensure_ascii=False,indent=2))

if __name__=='__main__': main()
