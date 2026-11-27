from pathlib import Path
from decimal import Decimal
import json, sqlite3, subprocess, urllib.request, csv, sys
s=Path(__file__).parent; label=sys.argv[1]; r=json.loads((s/(label+'-runtime.json')).read_text()); project=Path(r['project'])
files=json.loads((s/'protected-project-files.json').read_text(encoding='utf-8'))
names={n for n in subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=project).decode().split('\0') if n}
assert names=={x['name'] for x in files}
for entry in files: assert (project/entry['name']).read_bytes()==(s/'original-project-files'/entry['name']).read_bytes(),entry['name']
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=project,text=True).strip()=='f7bf091156c9b137c4eb3d5b822721294e9a8f24'
c=sqlite3.connect((Path(r['root'])/'runtime/data/opencorvus.db').as_uri()+'?mode=ro',uri=True); c.row_factory=sqlite3.Row
original=json.loads((s/'original-project-rows.json').read_text(encoding='utf-8')); protected=0
for table,rows in original.items():
 for row in rows:
  current=c.execute('SELECT * FROM '+table+' WHERE id=?',(row['id'],)).fetchone(); assert current and dict(current)==row,(table,row['id']); protected+=1
assert c.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
artifact='art_g0Vc9LWg500nnHSiR3le'; session='ses_hsexwMLYDYTBLk3B2AEC'
published=json.loads(c.execute('SELECT payload FROM interactive_artifact WHERE id=?',(artifact,)).fetchone()[0]); assert published==json.loads((s/'published-chart.json').read_text(encoding='utf-8'))
with (project/'sales.csv').open(encoding='utf-8',newline='') as source: source_rows=list(csv.DictReader(source))
assert len(published['data'])==len(source_rows)==5
for actual,source in zip(published['data'],source_rows):
 for key in ['订单编号','区域','备注']: assert actual[key]==source[key]
 amount=Decimal(source['金额']); assert Decimal(str(actual['金额']))==amount and actual['金额分']==int(amount*100)
 assert actual['订单类型']==('退款' if amount<0 else '零金额' if amount==0 else '普通订单')
parts=json.loads((s/'tool-parts-run51.json').read_text(encoding='utf-8')); publication=next(p for p in parts if p['id']=='prt_g0Vc9LRtC00Qusi0SXmw')
def api(path):
 with urllib.request.urlopen(urllib.request.Request(r['url']+path,headers={'x-opencorvus-directory':r['project']})) as response: return json.load(response)
if r['state']=='ready':
 publication=api('session/'+session+'/message/'+publication['messageID']+'/part/'+publication['id'])
 actual=api('session/'+session+'/interactive-artifact/'+artifact); assert actual['payload']==published
 (s/('api-artifact-'+label+'.json')).write_text(json.dumps(actual,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 (s/('api-publication-'+label+'.json')).write_text(json.dumps(publication,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
assert publication['state']['status']=='completed' and json.loads(publication['state']['output'])=={'artifactID':artifact,'renderer':'chart@1'}
assert publication['state']['input']['artifact']['content']['data']==published['data']
facts=[]
for ids,count,net in [(['A001','A002'],2,'30.30'),(['A002'],1,'20.20'),(['A003'],1,'-2.05'),(['A004'],1,'0.00'),([row['订单编号'] for row in source_rows],5,'35.60')]:
 selected=[row for row in source_rows if row['订单编号'] in ids]; value=sum((Decimal(row['金额']) for row in selected),Decimal('0.00')); assert len(selected)==count and value==Decimal(net)
 facts.append({'orders':ids,'count':count,'net':net})
result={'status':'passed','label':label,'protectedFiles':len(files),'protectedRows':protected,'artifactID':artifact,'sourceRows':len(source_rows),'childDimensions':[(v['width'],v['height']) for v in published['spec']['hconcat']],'expectedSubsets':facts,'publicationAPI':'live' if r['state']=='ready' else 'saved actual response','integrity':'ok'}
(s/('facts-'+label+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); print(json.dumps(result,ensure_ascii=False))
