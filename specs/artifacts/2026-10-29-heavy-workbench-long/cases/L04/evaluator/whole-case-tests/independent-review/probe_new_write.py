"""One isolated persistent mutation of captured state, zero new app/native execution."""
from pathlib import Path
import shutil,json,csv,sqlite3,subprocess,time
R=Path(__file__).parent;X=Path('D:/opencorvus-benchmark-runs/l04-full-case-20261031');C=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-29-heavy-workbench-long/cases/L04');S=R/'source-initial';S.mkdir()
for p in (C/'evaluator').glob('*.py'):shutil.copy2(p,S/p.name)
shutil.copy2(C/'rubric.json',S/'rubric.json');shutil.copytree(C/'public',R/'public-initial')
source=X/'closed-base/results/run';target=R/'new-write-mutation';shutil.copytree(source,target)
def load(p):return json.loads(p.read_text(encoding='utf-8'))
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
root=target/'clean';eid='CONTINUED-clean';before=load(root/'final-sql.json');old=next(r for r in before['tables']['entries'] if r['entry_id']==eid)['amount_minor']
for path in (root/'final-sql.json',root/'export.json'):
 j=load(path);t=j['tables']
 for e in t['entries']:
  if e['entry_id']==eid:e['amount_minor']+=1
 for e in t['audit_events']:
  if e['entry_id']==eid:
   p=json.loads(e['payload']);p['amount_minor']+=1;e['payload']=json.dumps(p,separators=(',',':'))
 save(path,j)
# Same exact1-cent corruption in real copied SQLite, preserving original ACK.
db=sqlite3.connect(root/'live.sqlite');db.execute('update entries set amount_minor=amount_minor+1 where entry_id=?',(eid,));row=db.execute('select payload from audit_events where entry_id=?',(eid,)).fetchone();j=json.loads(row[0]);j['amount_minor']+=1;db.execute('update audit_events set payload=? where entry_id=?',(json.dumps(j,separators=(',',':')),eid));db.commit();db.close()
p=target/'delivery/reconciliation.csv'
with p.open(encoding='utf-8',newline='') as f:rr=list(csv.DictReader(f));fields=list(rr[0])
for row in rr:
 if row['scenario']=='clean':row['amount_minor_USD']=str(int(row['amount_minor_USD'])+1)
with p.open('w',encoding='utf-8',newline='') as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rr)
registered=next((C/'evaluator').rglob('registered-inputs.json'))
argv=['C:/Python314/python.exe','-X','utf8','-B',str(S/'check_l04.py'),'--run',str(target),'--raw',str(X/'raw-base'),'--registered-inputs',str(registered),'--rubric',str(S/'rubric.json'),'--out',str(R/'new-write-checker-result')]
st=time.monotonic();p=subprocess.run(argv,capture_output=True,text=True,encoding='utf-8');receipt=dict(argv=argv,exit_code=p.returncode,seconds=time.monotonic()-st,stdout=p.stdout,stderr=p.stderr,scope='Persistent isolated mutation, not actual wrong programme/native. Original closed run remains intact. CONTINUED-clean request/receipt901 preserved, actual copied SQL/derived export amount902.')
save(R/'new-write-command.json',receipt);print(json.dumps(receipt,indent=2))
if (R/'new-write-checker-result/assessment.json').is_file():
 a=load(R/'new-write-checker-result/assessment.json');print(json.dumps({'status':a['status'],'findings':{k:v['status'] for k,v in a.get('findings',{}).items()},'original_request_amount':old,'mutated_actual_amount':old+1},indent=2))
