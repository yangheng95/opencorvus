"""Capture v2 and run only standard-library enumeration/CLI contracts."""
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

def load(path):return json.loads(path.read_text(encoding='utf-8'))

def command(argv,label):
    start=time.perf_counter();stamp=datetime.now(timezone.utc).isoformat()
    p=subprocess.run(argv,cwd=ROOT,capture_output=True,text=True,encoding='utf-8',
        env={**os.environ,'PYTHONIOENCODING':'utf-8','PYTHONDONTWRITEBYTECODE':'1'})
    base=ROOT/'commands'/label;base.parent.mkdir(parents=True,exist_ok=True)
    base.with_suffix('.stdout.txt').write_text(p.stdout,encoding='utf-8')
    base.with_suffix('.stderr.txt').write_text(p.stderr,encoding='utf-8')
    row={'argv':argv,'cwd':str(ROOT),'started_utc':stamp,'seconds':time.perf_counter()-start,
         'exit_code':p.returncode,'stdout':str(base.with_suffix('.stdout.txt').relative_to(ROOT)),
         'stderr':str(base.with_suffix('.stderr.txt').relative_to(ROOT))}
    save(base.with_suffix('.json'),row);return row

def main():
    if (ROOT/'prepared.json').exists():raise RuntimeError('use a new occurrence')
    files=[p.relative_to(SRC) for p in sorted((SRC/'v2').rglob('*')) if p.is_file() and '__pycache__' not in p.parts]
    files += [Path(name) for name in ('l06_input.py','check_l06.py','qualify_l06.py','qualify_business_checks.py','qualify_full_business_checks.py')]
    inventory=[]
    for relative in files:
        src,dst=SRC/relative,SNAP/relative;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
        inventory.append({'source':str(src),'snapshot':str(dst.relative_to(ROOT)),
                          'bytes':dst.stat().st_size,'byte_equal_at_copy':src.read_bytes()==dst.read_bytes()})
    shutil.copy2(REPO/'specs/records/2026-10/2026-10-29-heavy-workbench-l06-qualification.md',SNAP/'l06-Recall.md')
    save(ROOT/'source-inventory.json',inventory)
    command(['git','-C',str(REPO),'status','--short'],'git-status-start')
    save(ROOT/'source-identity.json',{'scope':'source identity only, not execution/functional proof',
        'root_equals_v2':{name:(SNAP/name).read_bytes()==(SNAP/'v2'/name).read_bytes() for name in ('l06_input.py','check_l06.py','qualify_l06.py')},
        'full_action_plan_equals_v1_minimum_credit':(SNAP/'v2/full-witness/plan.json').read_bytes()==(SRC/'minimum-credit/plan.json').read_bytes()})
    replay=ROOT/'replay';replay.mkdir(exist_ok=False)
    for relative in [Path(n) for n in ('l06_input.py','check_l06.py','qualify_business_checks.py','qualify_full_business_checks.py')]+[
        Path('v2/inputs/full.json'),Path('v2/inputs/tiny.json'),Path('v2/full-witness/plan.json'),Path('v2/tiny-solver/solver.json')]:
        dest=replay/relative;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(SNAP/relative,dest)
    a=command([sys.executable,'-B',str(replay/'qualify_business_checks.py')],'v2-tiny-enumeration')
    b=command([sys.executable,'-B',str(replay/'qualify_full_business_checks.py')],'v2-twenty-cli-contracts')
    result={'scope':'current v2 snapshot; standard library replay only; no solver import/run',
        'source_files':len(inventory),'runs':[a,b], 'original_tiny_solver_not_repeated':True,
        'copied_solver_record_use':'compares existing tiny record to exhaustive result, not a new solver result'}
    save(ROOT/'prepared.json',result)
    print(json.dumps({'sources':len(inventory),'exits':[a['exit_code'],b['exit_code']],
        'enumeration':load(replay/'v2/tiny-solver/enumeration.json'),
        'cli_contracts':{k:v for k,v in load(replay/'v2/full-business-contracts/receipt.json').items() if k!='executions'}},
        ensure_ascii=False,indent=2))

if __name__=='__main__':main()
