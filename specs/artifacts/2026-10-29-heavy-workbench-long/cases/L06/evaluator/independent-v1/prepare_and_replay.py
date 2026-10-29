"""CPU/stdlib-only independent review; never imports or runs the MILP solver."""
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parent
SRC=Path('D:/opencorvus-benchmark-runs/l06-procurement-qualification-20261029')
REPO=Path('D:/myhexin-local/opencorvus')
SNAP=ROOT/'source-snapshot'

def save(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def command(argv,label):
    started=datetime.now(timezone.utc).isoformat();start=time.perf_counter()
    p=subprocess.run(argv,cwd=ROOT,capture_output=True,text=True,encoding='utf-8',
                     env={**os.environ,'PYTHONIOENCODING':'utf-8','PYTHONDONTWRITEBYTECODE':'1'})
    base=ROOT/'commands'/label;base.parent.mkdir(parents=True,exist_ok=True)
    base.with_suffix('.stdout.txt').write_text(p.stdout,encoding='utf-8')
    base.with_suffix('.stderr.txt').write_text(p.stderr,encoding='utf-8')
    receipt={'argv':argv,'cwd':str(ROOT),'started_utc':started,
             'wall_seconds':time.perf_counter()-start,'exit_code':p.returncode,
             'stdout':str(base.with_suffix('.stdout.txt').relative_to(ROOT)),
             'stderr':str(base.with_suffix('.stderr.txt').relative_to(ROOT))}
    save(base.with_suffix('.json'),receipt)
    return receipt

def main():
    if (ROOT/'prepared.json').exists():raise RuntimeError('use a new occurrence')
    files=['qualify_l06.py','check_l06.py','qualify_business_checks.py',
           'full-v1/instance.json','full-v1/solver.json','full-v1.stdout.txt','full-v1.stderr.txt',
           'full-v1-executed-source.py', 'minimum-credit/solver.json','minimum-credit/plan.json',
           'minimum-credit/instance.json','minimum-credit/witness-credit-input.json',
           'minimum-credit/independent-business-check.json','minimum-credit-executed-source.py',
           'minimum-credit.stdout.txt','minimum-credit.stderr.txt']
    files += [str(p.relative_to(SRC)).replace('\\','/') for p in sorted((SRC/'tiny-v1').iterdir()) if p.is_file()]
    inventory=[]
    for relative in files:
        src,dst=SRC/relative,SNAP/relative;dst.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(src,dst)
        inventory.append({'source':str(src),'snapshot':str(dst.relative_to(ROOT)),
                          'bytes':dst.stat().st_size,'byte_equal_at_copy':src.read_bytes()==dst.read_bytes()})
    recall=REPO/'specs/records/2026-10/2026-10-29-heavy-workbench-l06-qualification.md'
    shutil.copy2(recall,SNAP/'l06-qualification-Recall.md')
    save(ROOT/'source-inventory.json',inventory)
    command(['git','-C',str(REPO),'status','--short'],'git-status-start')
    old=Path('D:/opencorvus-benchmark-runs/heavy-long-nine-upgrade-review-20261029')
    text=(old/'REVIEW.md').read_text(encoding='utf-8')
    original=json.loads((old/'native-zero-readonly-addendum/reviewer-arithmetic.json').read_text(encoding='utf-8'))
    lines=[{'line':i,'text':line} for i,line in enumerate(text.splitlines(),1) if '项独立算术/端点条件' in line]
    save(ROOT/'native-count-check.json',{'actual_check_count':len(original['checks']),'current_report':lines,
        'action':'already 12 before this occurrence; no old report/JSON/command modification',
        'current_report_matches_count':len(original['checks'])==12 and len(lines)==1 and lines[0]['text'].startswith('12项')})
    replay=ROOT/'replay';replay.mkdir(exist_ok=False)
    for relative in ('check_l06.py','qualify_business_checks.py','tiny-v1/instance.json',
                     'tiny-v1/plan.json','tiny-v1/solver.json'):
        dst=replay/relative;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(SNAP/relative,dst)
    run1=command([sys.executable,'-B',str(replay/'qualify_business_checks.py')],'tiny324-nine-contracts')
    run2=command([sys.executable,'-B',str(SNAP/'check_l06.py'),'--input',str(SNAP/'minimum-credit/witness-credit-input.json'),
        '--plan',str(SNAP/'minimum-credit/plan.json'),'--out',str(replay/'minimum-credit-business.json')],'minimum-credit-business')
    run3=command([sys.executable,'-B',str(SNAP/'check_l06.py'),'--input',str(SNAP/'full-v1/instance.json'),
        '--plan',str(SNAP/'minimum-credit/plan.json'),'--out',str(replay/'original-credit-same-plan.json')],'original-credit-same-plan')
    full=json.loads((SNAP/'full-v1/instance.json').read_text(encoding='utf-8'))
    mininp=json.loads((SNAP/'minimum-credit/instance.json').read_text(encoding='utf-8'))
    witness=json.loads((SNAP/'minimum-credit/witness-credit-input.json').read_text(encoding='utf-8'))
    save(ROOT/'input-lineage.json',{'original_to_minimum_credit':{
        k:{'original':full.get(k),'minimum_credit':mininp.get(k)} for k in full.keys()|mininp.keys() if full.get(k)!=mininp.get(k)},
        'minimum_credit_to_witness':{k:{'minimum_credit':mininp.get(k),'witness':witness.get(k)} for k in mininp.keys()|witness.keys() if mininp.get(k)!=witness.get(k)},
        'current_model_source_equals_minimum_credit_executed_source':(SNAP/'qualify_l06.py').read_bytes()==(SNAP/'minimum-credit-executed-source.py').read_bytes()})
    save(ROOT/'prepared.json',{'scope':'source snapshot and original stdlib scripts only, no solver/GPU/Provider',
        'source_files':len(inventory),'runs':[run1,run2,run3], 'source_snapshot_utc':datetime.now(timezone.utc).isoformat()})
    print(json.dumps({'sources':len(inventory),'run_exit_codes':[r['exit_code'] for r in (run1,run2,run3)],
                      'native_check_count':len(original['checks'])},indent=2))

if __name__=='__main__':main()
