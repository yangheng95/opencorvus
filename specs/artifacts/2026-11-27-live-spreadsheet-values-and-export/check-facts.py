from pathlib import Path
from decimal import Decimal
import csv,io,json,sqlite3,subprocess,urllib.request,sys
s=Path(__file__).parent;label=sys.argv[1] if len(sys.argv)>1 else 'run35'
r=json.loads((s/(label+'-runtime.json')).read_text());project=Path(r['project']);work=json.loads((s/'new-work.json').read_text(encoding='utf-8'))
def get(route):
 req=urllib.request.Request(r['url']+route,headers={'x-opencorvus-directory':r['project']})
 with urllib.request.urlopen(req) as response:
  assert response.status==200
  return json.load(response)
source=get('file/content?path=sales.csv')['content']
assert source.encode()==(project/'sales.csv').read_bytes()
rows=list(csv.DictReader(io.StringIO(source)));assert len(rows)==5
totals={}
for row in rows:
 count,amount=totals.get(row['区域'],(0,Decimal(0)))
 totals[row['区域']]=(count+1,amount+Decimal(row['金额']))
parts=json.loads((s/'current-tool-parts-run35.json').read_text(encoding='utf-8'))
c=sqlite3.connect((Path(r['root'])/'runtime/data/opencorvus.db').as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
publications=[]
for part in parts:
 if part['tool']!='publish_interactive_artifact' or part['state']['status']!='completed':continue
 current=get('session/'+work['sessionID']+'/message/'+part['messageID']+'/part/'+part['id'])
 assert current['state']['status']=='completed'
 identity=json.loads(current['state']['output']);assert identity['renderer']=='spreadsheet@1'
 payload=json.loads(c.execute('SELECT payload FROM interactive_artifact WHERE id=?',(identity['artifactID'],)).fetchone()[0])
 assert payload['renderer']=='spreadsheet@1' and payload['editable'] is True
 assert payload['title']==current['state']['input']['artifact']['title']
 assert len(payload['sheets'])==2
 for stored,input_sheet in zip(payload['sheets'],current['state']['input']['artifact']['content']['sheets']):
  assert stored['cells']==input_sheet['cells'] and stored['name']==input_sheet['name']
 details,summary=payload['sheets'];cells={x['address']:x for x in details['cells']};amounts={x['address']:x for x in summary['cells']}
 for i,row in enumerate(rows,2):
  assert [cells[f'{col}{i}']['value'] for col in ['A','B','D']]==[row['订单编号'],row['区域'],row['备注']]
  assert isinstance(cells[f'C{i}']['value'],(int,float)) and Decimal(str(cells[f'C{i}']['value']))==Decimal(row['金额'])
  assert cells[f'C{i}']['numberFormat']=='0.00'
 for i,(region,(count,amount)) in enumerate(totals.items(),2):
  assert amounts[f'A{i}']['value']==region and amounts[f'B{i}']['value']==count and Decimal(str(amounts[f'C{i}']['value']))==amount
 assert amounts['B4']['formula']=='=SUM(B2:B3)' and amounts['B4']['computed']==5
 assert amounts['C4']['formula']=='=SUM(C2:C3)' and Decimal(str(amounts['C4']['computed']))==Decimal('35.60')
 publications.append({'artifactID':identity['artifactID'],'partID':part['id'],'title':payload['title'],'sheets':[{'name':x['name'],'rows':x['rowCount'],'columns':x['columnCount'],'cells':len(x['cells'])} for x in payload['sheets']]})
 (s/(identity['artifactID']+'-payload.json')).write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
assert len(publications)==2
files=[]
for old in (s/'original-project-files').rglob('*'):
 if old.is_file():
  name=old.relative_to(s/'original-project-files');assert (project/name).read_bytes()==old.read_bytes()
  files.append({'name':name.as_posix(),'bytes':old.stat().st_size})
assert len(files)==21
protected={}
for table,original in json.loads((s/'original-project-rows.json').read_text(encoding='utf-8')).items():
 assert table in ['message','part','tool_part_request','tool_part_outcome','interactive_artifact']
 for row in original:assert dict(c.execute('SELECT * FROM '+table+' WHERE id=?',(row['id'],)).fetchone())==row
 protected[table]=len(original)
assert c.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=project,text=True).strip()=='f7bf091156c9b137c4eb3d5b822721294e9a8f24'
result={'status':'passed','service':label,'publications':publications,'sourceTotals':{name:[count,str(amount)] for name,(count,amount) in totals.items()},'protectedFiles':files,'protectedRows':protected,'databaseIntegrity':'ok','sampleProjectHEAD':'f7bf091156c9b137c4eb3d5b822721294e9a8f24'}
(s/('facts-'+label+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'passed','service':label,'publications':len(publications),'protectedFiles':len(files),'protectedRows':sum(protected.values())},ensure_ascii=False))
