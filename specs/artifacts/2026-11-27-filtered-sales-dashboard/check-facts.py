from pathlib import Path
from decimal import Decimal
import json,sqlite3,subprocess,urllib.request,csv,sys
s=Path(__file__).parent;label=sys.argv[1];r=json.loads((s/(label+'-runtime.json')).read_text());project=Path(r['project'])
files=json.loads((s/'protected-project-files.json').read_text(encoding='utf-8'));names={n for n in subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=project).decode().split('\0') if n};assert names=={x['name'] for x in files}
for entry in files:assert (project/entry['name']).read_bytes()==(s/'original-project-files'/entry['name']).read_bytes(),entry['name']
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=project,text=True).strip()=='f7bf091156c9b137c4eb3d5b822721294e9a8f24'
c=sqlite3.connect((Path(r['root'])/'runtime/data/opencorvus.db').as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row;original=json.loads((s/'original-project-rows.json').read_text(encoding='utf-8'));protected=0
for table,rows in original.items():
 for row in rows:
  current=c.execute('SELECT * FROM '+table+' WHERE id=?',(row['id'],)).fetchone();assert current and dict(current)==row,(table,row['id']);protected+=1
assert c.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
artifact='art_g0Vc91zED00L3QeOwJ39';published=json.loads(c.execute('SELECT payload FROM interactive_artifact WHERE id=?',(artifact,)).fetchone()[0]);assert published==json.loads((s/'published-dashboard.json').read_text(encoding='utf-8'))
with (project/'sales.csv').open(encoding='utf-8',newline='') as source:sourceRows=list(csv.DictReader(source))
assert len(published['data'])==len(sourceRows)==5
for actual,source in zip(published['data'],sourceRows):
 for key in ['订单编号','区域','备注']:assert actual[key]==source[key]
 amount=Decimal(source['金额']);assert Decimal(str(actual['金额']))==amount and actual['金额分']==int(amount*100)
 assert actual['是否退款']==('是' if amount<0 else '否') and actual['退款标记']==int(amount<0) and actual['零金额标记']==int(amount==0)
assert {m['id']:m['value'] for m in published['metrics']}=={'all-orders':5,'all-net':'35.60','all-refunds':1,'all-zeros':1}
facts=[]
for region,refund,orders,net in [(None,None,5,'35.60'),('华东',None,3,'28.25'),('华东','是',1,'-2.05'),('华南','是',0,'0.00'),('华南','否',2,'7.35')]:
 selected=[row for row in sourceRows if (region is None or row['区域']==region) and (refund is None or ('是' if Decimal(row['金额'])<0 else '否')==refund)]
 actualNet=sum((Decimal(row['金额']) for row in selected),Decimal('0.00'));assert len(selected)==orders and actualNet==Decimal(net)
 facts.append({'region':region,'refund':refund,'orders':orders,'net':net})
parts=json.loads((s/'tool-parts-run43.json').read_text(encoding='utf-8'));publication=next(p for p in parts if p['id']=='prt_g0Vc91sT100mecBOegU2')
if r['state']=='ready':
 request=urllib.request.Request(r['url']+'session/ses_hV1OnPAfOAfCSKWMunWr/message/'+publication['messageID']+'/part/'+publication['id'],headers={'x-opencorvus-directory':r['project']})
 with urllib.request.urlopen(request) as response:publication=json.load(response)
 (s/('api-publication-'+label+'.json')).write_text(json.dumps(publication,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
assert publication['state']['status']=='completed' and json.loads(publication['state']['output'])=={'artifactID':artifact,'renderer':'dashboard@1'}
assert publication['state']['input']['artifact']['content']['data']==published['data']
result={'status':'passed','label':label,'protectedFiles':len(files),'protectedRows':protected,'artifactID':artifact,'sourceRows':len(sourceRows),'summarySpecHeight':published['views'][0]['spec']['height'],'expectedSelections':facts,'publicationAPI':'live' if r['state']=='ready' else 'saved actual response','integrity':'ok'}
(s/('facts-'+label+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
