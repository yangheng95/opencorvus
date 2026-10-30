"""Two isolated captured-artifact mutations; no actor/receiver/native is executed."""
from pathlib import Path
import json,shutil,sqlite3,subprocess,time
R=Path(__file__).parent;X=Path('D:/opencorvus-benchmark-runs/l05-full-case-20261031');C=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-29-heavy-workbench-long/cases/L05');S=R/'case-initial';shutil.copytree(C/'public',S/'public');(S/'evaluator').mkdir();
for n in ['app.py','report.py','check_l05.py']:shutil.copy2(C/'evaluator'/n,S/'evaluator'/n)
for n in ['rubric.json']:shutil.copy2(C/n,S/n)
shutil.copy2(C/'evaluator/registered-inputs.json',S/'evaluator/registered-inputs.json')
def load(p):return json.loads(p.read_text(encoding='utf-8'))
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
source=X/'closed-main-base/results/run';out=[]
for name in ['monitor-object','native-identity']:
 target=R/(name+'-mutation');shutil.copytree(source,target);events=load(target/'events.json');detail={}
 if name=='monitor-object':
  event=next(e for e in events if e.get('kind')=='application' and e['request']['action']=='monitor' and e['request']['window_id']=='incident');original=event['response']['sample']['active_json'];active=json.loads(original);bad=json.dumps({k:True for k in active});event['response']['sample']['active_json']=bad;db=sqlite3.connect(target/'local.sqlite');db.execute('update samples set active_json=? where window_id=?',(bad,'incident'));db.commit();db.close();detail=dict(window='incident',original=original,mutated=bad,scope='Wrong JSON object type preserves keys but violates required array. Actual copied persistent sample and original response are changed together; no actor ran.')
 else:
  event=next(e for e in events if e.get('kind')=='application');lines=event['stderr'].splitlines();first=json.loads(lines[0]);first['uid']=0;lines[0]=json.dumps(first);event['stderr']='\n'.join(lines)+'\n';report=load(target/'report-native.json');lines=report['stderr'].splitlines();reported=json.loads(lines[0]);reported['uid']=0;lines[0]=json.dumps(reported);report['stderr']='\n'.join(lines)+'\n';save(target/'report-native.json',report);detail=dict(app_pid=event['pid'],actor_uid_in_original_capture=0,report_uid_in_original_capture=0,isolation_metadata='unchanged10001/65534',scope='Corrupted evaluator capture/protocol control, not real hostile actor execution. Should be facility identity contradiction rather than accepted isolation fact or candidate zero.')
 save(target/'events.json',events);argv=['C:/Python314/python.exe','-X','utf8','-B',str(S/'evaluator/check_l05.py'),'--run',str(target),'--raw',str(X/'raw-closed-base'),'--registered',str(S/'evaluator/registered-inputs.json'),'--rubric',str(S/'rubric.json'),'--out',str(R/(name+'-checker-result'))];st=time.monotonic();p=subprocess.run(argv,capture_output=True,text=True,encoding='utf-8');receipt=dict(argv=argv,exit_code=p.returncode,seconds=time.monotonic()-st,stdout=p.stdout,stderr=p.stderr,mutation=detail);save(R/(name+'-command.json'),receipt);assessment=load(R/(name+'-checker-result/assessment.json'));out.append(dict(name=name,exit=p.returncode,status=assessment['status'],failed=assessment.get('failed'),M12=assessment.get('findings',{}).get('M12',{}).get('status'),M14=assessment.get('findings',{}).get('M14',{}).get('status')))
save(R/'boundary-probe-summary.json',out);print(json.dumps(out,indent=2))
