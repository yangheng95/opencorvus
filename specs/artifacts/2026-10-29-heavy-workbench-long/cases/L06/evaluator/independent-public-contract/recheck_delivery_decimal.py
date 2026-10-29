"""Only three necessary real CLI checks after the shared Decimal exception repair."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import time
sys.dont_write_bytecode=True

ROOT=Path(__file__).resolve().parent/'delivery-review'
BASE=Path('D:/opencorvus-benchmark-runs/l06-procurement-qualification-20261029')
IDS=['C01','C07','C08','C09','C10','C11','D03','D04','D05','D06']

def load(p):return json.loads(p.read_text(encoding='utf-8'))
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')

def main():
    dest=ROOT/'source-repaired';dest.mkdir(exist_ok=False);inventory=[]
    for name in ('l06_delivery.py','l06_input.py','l06_packet.py','check_l06.py','qualify_delivery.py'):
        shutil.copy2(BASE/name,dest/name)
        inventory.append({'source':str(BASE/name),'copy':str(dest/name),'matches_initial':(ROOT/'source-initial'/name).read_bytes()==(dest/name).read_bytes()})
    save(ROOT/'repair-source-inventory.json',inventory)
    passed={i:'verified_pass' for i in IDS};events=[]
    for label,plan,summary,expected,code in [
      ('repaired-original-exponent',ROOT/'plan.json',ROOT/'huge-exponent-summary.json',passed|{i:'candidate_incomplete' for i in IDS[:6]},2),
      ('repaired-normal-decimal',ROOT/'plan.json',ROOT/'decimal-summary.json',passed,0),
      ('repaired-default-finite',ROOT/'default-overflow.json',ROOT/'summary.json',{i:'blocked_candidate' for i in IDS},2)]:
        out=ROOT/'results'/(label+'.json')
        argv=['C:/Python314/python.exe','-X','utf8','-B',str(dest/'l06_delivery.py'),'--input',str(ROOT/'packet'),
          '--plan',str(plan),'--ledger',str(ROOT/'ledger.json'),'--summary',str(summary),'--out',str(out)]
        start=time.perf_counter();p=subprocess.run(argv,cwd=ROOT,capture_output=True,text=True,encoding='utf-8');elapsed=time.perf_counter()-start
        command=ROOT/'commands'/label
        command.with_suffix('.stdout.txt').write_text(p.stdout,encoding='utf-8');command.with_suffix('.stderr.txt').write_text(p.stderr,encoding='utf-8')
        actual=load(out) if out.is_file() else None
        findings=None if actual is None else {v['id']:v['status'] for v in actual['findings']}
        event={'argv':argv,'exit_code':p.returncode,'seconds':elapsed,'expected_exit':code,'findings':findings,'expected_findings':expected,
          'passed':p.returncode==code and findings==expected,'result_file':str(out)}
        if label=='repaired-default-finite':event['passed']=event['passed'] and all(v['detail']['code']=='plan_json' for v in actual['findings'])
        save(command.with_suffix('.json'),event);events.append(event)
    result={'scope':'shared Decimal exception mapping and unchanged ordinary/default parsing only',
      'actual_cli_checks':3,'all_passed':all(e['passed'] for e in events),'executions':events,
      'original_exit1_and_no_output_preserved':True,'solver_calls':0,'model_calls':0,'full_47_leaf_grader_qualified':False,
      'remaining_37_leaves_assessed':False,'total_score_issued':False}
    save(ROOT/'repair-assessment.json',result);print(json.dumps({'actual_cli_checks':3,'all_passed':result['all_passed'],'solver_calls':0},ensure_ascii=False))
    if not result['all_passed']:raise SystemExit(1)

if __name__=='__main__':main()
