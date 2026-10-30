from pathlib import Path
import json,shutil,sqlite3,subprocess,time
R=Path(__file__).parent;X=Path('D:/opencorvus-benchmark-runs/l05-full-case-20261031');S=R/'case-initial'
def load(p):return json.loads(p.read_text(encoding='utf-8'))
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
source=X/'closed-main-base/results/run';out=[]
for name in ['planned-wire','new-epoch','exports']:
 target=R/(name+'-mutation');shutil.copytree(source,target);detail={}
 if name=='planned-wire':
  events=load(target/'events.json');fault=next(e for e in events if e.get('pause')=='after_plan_commit');oldkeys={(e['tenant'],e['event_id']) for e in load(source/'original-facts.json')['local']['postings']};row=next(p for p in fault['checkpoint_sql']['local']['postings'] if (p['tenant'],p['event_id']) not in oldkeys);wire=json.loads(row['payload']);old=wire['amount_minor'];wire['amount_minor']=old+1 if old>0 else old-1;row['payload']=json.dumps(wire,sort_keys=True,separators=(',',':'));save(target/'events.json',events);detail=dict(tenant=row['tenant'],key=row['event_id'],original=old,planned_wire=wire['amount_minor'],final_wire_still_original=True,scope='Persistent-plan checkpoint capture versus final real object; not a new programme/native. Same key, altered planned payload violates immutable registered intent across recovery.')
 elif name=='new-epoch':
  c=sqlite3.connect(target/'local.sqlite');row=c.execute('select tenant,event_id,epoch,boundary_seq from postings where boundary_seq>7 and epoch=2 limit 1').fetchone();c.close()
  for dbpath in [target/'local.sqlite',target/'repaired-current/local.sqlite',target/'final/local.sqlite']:
   c=sqlite3.connect(dbpath);c.execute('update postings set epoch=1 where tenant=? and event_id=?',row[:2]);c.commit();c.close()
  detail=dict(tenant=row[0],key=row[1],boundary=row[3],original_epoch=row[2],mutated_epoch=1,scope='Actual copied SQLite mutation after accepted prefix beyond the completed epoch1 cut. Remote wire/receipt and business amounts preserved, not a new native.')
 else:
  for file in ['business.csv','monitor.csv']:
   p=target/'delivery'/file;p.write_text(p.read_text(encoding='utf-8').splitlines()[0]+'\n',encoding='utf-8')
  detail=dict(scope='Required business/monitor machine exports reduced to header only; other actual SQL/report/graph/reconciliation unchanged.')
 argv=['C:/Python314/python.exe','-X','utf8','-B',str(S/'evaluator/check_l05.py'),'--run',str(target),'--raw',str(X/'raw-closed-base'),'--registered',str(S/'evaluator/registered-inputs.json'),'--rubric',str(S/'rubric.json'),'--out',str(R/(name+'-checker-result'))];st=time.monotonic();p=subprocess.run(argv,capture_output=True,text=True,encoding='utf-8');save(R/(name+'-command.json'),dict(argv=argv,exit_code=p.returncode,seconds=time.monotonic()-st,stdout=p.stdout,stderr=p.stderr,mutation=detail));a=load(R/(name+'-checker-result/assessment.json'));out.append(dict(name=name,exit=p.returncode,failed=a.get('failed'),M06=a.get('findings',{}).get('M06',{}).get('status'),M10=a.get('findings',{}).get('M10',{}).get('status'),M14=a.get('findings',{}).get('M14',{}).get('status')))
save(R/'semantic-probe-summary.json',out);print(json.dumps(out,indent=2))
