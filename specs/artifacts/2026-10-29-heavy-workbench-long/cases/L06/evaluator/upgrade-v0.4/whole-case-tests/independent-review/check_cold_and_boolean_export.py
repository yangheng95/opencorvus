from pathlib import Path
import json,zipfile,shutil,subprocess,sys,datetime,csv
R=Path('D:/opencorvus-benchmark-runs/l06-v04-whole-case-independent-review-20261031');X=Path('D:/opencorvus-benchmark-runs/l06-v04-full-case-20261031');C=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-10-29-heavy-workbench-long/cases/L06/evaluator/upgrade-v0.4')
with zipfile.ZipFile(R/'cold-originals.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in (R/'cold-rebuild').rglob('*'):
  if p.is_file():z.write(p,p.relative_to(R).as_posix())
 for f in ['cold-owner-started.json','cold-owner-terminal.json','cold.stdout.txt','cold.stderr.txt','source-extraction.json']:z.write(R/f,f)
base=R/'whole-checker-observations';base.mkdir();src=C/'check_whole.py';shutil.copy2(src,base/'actual-check_whole.py');commands=[]
def call(name,run,delivery,layout):
 out=base/name;argv=[sys.executable,'-X','utf8','-B',str(src),'prepare','--run',str(run),'--delivery',str(delivery),'--layout',str(layout),'--role','author_reference','--out',str(out)];start=datetime.datetime.now(datetime.timezone.utc);p=subprocess.run(argv,capture_output=True,text=True,encoding='utf-8');rec={'argv':argv,'started_at':start.isoformat(),'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'native_exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr,'scope':'pure whole-checker over existing closed objects, zero additional actor/planner/solver runs'};f=out/'assignment.json'
 if f.exists():rec['M']={k:v for k,v in json.loads(f.read_text())['leaves'].items() if k.startswith('M')}
 (base/(name+'-command.json')).write_text(json.dumps(rec,indent=2));commands.append({'name':name,**rec});return rec
call('cold-new-episodes-original-delivery',R/'cold-rebuild/native',X/'reference-delivery-final',X/'assessment-main/delivery-layout.json')
# One original financial export cell changed to Boolean due_week, all real source/run unchanged.
d=base/'bool-AR-delivery';shutil.copytree(X/'reference-delivery-final',d);p=d/'data/stage-ledger.csv'
with p.open(encoding='utf-8',newline='') as f:reader=csv.DictReader(f);fields=reader.fieldnames;rows=list(reader)
changed=None
for i,row in enumerate(rows):
 ar=json.loads(row['receivables_json'])
 for item in ar:
  if type(item['due_week']) is int and item['due_week']==1:
   item['due_week']=True;row['receivables_json']=json.dumps(ar);changed={'row':i,'instance':row['instance'],'path':row['path'],'seq':row['seq'],'field':'receivables_json[].due_week','original':1,'replacement':True};break
 if changed:break
assert changed
with p.open('w',encoding='utf-8',newline='') as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
rec=call('boolean-original-AR-due',X/'native-whole-first',d,X/'assessment-main/delivery-layout.json');(base/'boolean-mutation.json').write_text(json.dumps({'mutation':changed,'kind':'explicit private output mutation, not an executed bad programme','M05':rec.get('M',{}).get('M05')},indent=2));(base/'commands.json').write_text(json.dumps(commands,indent=2));print(json.dumps([{'name':v['name'],'exit':v['native_exit'],'M':{k:w['status'] for k,w in v.get('M',{}).items()}} for v in commands],indent=2))
