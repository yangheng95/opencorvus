"""Demonstrate a usable native resume from an immutable supplied checkpoint.

Path selection is for the public fixture's controller only, never the actor.
All future events are sent solely to the controller's stdin.
"""
import argparse,datetime,json,os,sqlite3,subprocess,sys
from pathlib import Path
from common import *

def main():
    p=argparse.ArgumentParser();p.add_argument('--public',type=Path,required=True);p.add_argument('--checkpoint',type=Path,required=True);p.add_argument('--path',required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=False)
    data,_=load_data(a.public);path=next(s for s in data['scenarios'] if s['id']==a.path);db=a.out/'journal.sqlite3'
    with sqlite3.connect('file:'+a.checkpoint.resolve().as_posix()+'?mode=ro',uri=True) as original:
        before=original.execute('SELECT week,request_id,item_json FROM commits ORDER BY week').fetchall()
        with sqlite3.connect(db) as target:original.backup(target)
    env=dict(os.environ);env['PYTHONPATH']=os.pathsep.join([str(a.public/'exercise-tools/upgrade-v0.3/source'),str(a.public/'exercise-tools/qualification/current-source')])
    cmd=[sys.executable,'-u','-B',str(a.public/'exercise-tools/upgrade-v0.3/source/execute_policy.py'),'--project',str(ROOT/'programme'),'--public',str(a.public),'--db',str(db.resolve()),'--out',str((a.out/'resumed').resolve()),'--python',sys.executable]
    started=datetime.datetime.now(datetime.timezone.utc).isoformat();result=subprocess.run(cmd,input=json.dumps({'events':[event(path,t) for t in range(data['weeks'])]}),capture_output=True,text=True,encoding='utf8',env=env)
    (a.out/'actual-command.json').write_text(json.dumps({'argv':cmd,'started_at':started,'native_exit':result.returncode,'stdout':result.stdout,'stderr':result.stderr,'future_transport':'controller stdin only; fixture path label never in actor argv/env'},indent=2)+'\n',encoding='utf8')
    if result.returncode:raise RuntimeError(result.stderr)
    with sqlite3.connect('file:'+db.resolve().as_posix()+'?mode=ro',uri=True) as target:after=target.execute('SELECT week,request_id,item_json FROM commits ORDER BY week').fetchall()
    assert before==after[:len(before)] and len(after)==16
    recovery=json.loads((a.out/'resumed/resume-receipt.json').read_text(encoding='utf8'));prior=json.loads(before[-1][2]);assert canonical(recovery['receipt'])==canonical(prior['receipt'])
    terminal=json.loads((a.out/'resumed/terminal.json').read_text(encoding='utf8'))
    output={'status':'completed','original_prefix_rows_preserved':len(before),'total_commits':len(after),'original_receipt':recovery,'final_cash':terminal['state']['cash'],'total_cost':terminal['state']['total_cost_minor'],'scope':'copied checkpoint restore demo; original checkpoint is read-only and preserved'}
    (a.out/'recovery-result.json').write_text(json.dumps(output,indent=2)+'\n',encoding='utf8');print(json.dumps(output,indent=2))
if __name__=='__main__':main()
