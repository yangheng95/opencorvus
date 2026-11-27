from pathlib import Path
from decimal import Decimal
import csv,io,json,re,sqlite3,subprocess,urllib.request,urllib.parse,sys
label=sys.argv[1] if len(sys.argv)>1 else 'run33'
s=Path(__file__).parent;r=json.loads((s/(label+'-runtime.json')).read_text());project=Path(r['project'])
out=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-11-27-sales-source-fact-review')
downloads=Path('C:/Users/hengu/Downloads')
def get(route,raw=False):
 req=urllib.request.Request(r['url'].rstrip('/')+'/'+route.lstrip('/'),headers={'x-opencorvus-directory':r['project']})
 with urllib.request.urlopen(req) as response:
  assert response.status==200
  data=response.read()
  return data if raw else json.loads(data)
work=json.loads((s/'new-work.json').read_text(encoding='utf-8'))
report=(project/work['filename']).read_bytes();assert len(report)==4221
assert get('file/content?'+urllib.parse.urlencode({'path':work['filename']}))['content'].encode()==report
assert (downloads/'销售核对说明-来源复验.md').read_bytes()==report
source=get('file/content?path=sales.csv')['content']
assert source.encode()==(project/'sales.csv').read_bytes()
rows=list(csv.DictReader(io.StringIO(source)));assert len(rows)==5
totals={}
for row in rows:
 group=totals.setdefault(row['区域'],[0,Decimal(0)])
 group[0]+=1;group[1]+=Decimal(row['金额'])
totals['合计']=[len(rows),sum((Decimal(row['金额']) for row in rows),Decimal(0))]
table={m[0]:[int(m[1]),Decimal(m[2])] for m in re.findall(r'^\|\s*(华东|华南|合计)\s*\|\s*(\d+)\s*\|\s*(-?\d+\.\d+)\s*\|',report.decode(),re.M)}
assert table==totals
detail=re.findall(r'^\|\s*(A\d+)\s*\|\s*(\S+)\s*\|\s*(-?\d+\.\d+)\s*\|\s*(\S+)\s*\|',report.decode(),re.M)
assert detail==[(x['订单编号'],x['区域'],x['金额'],x['备注']) for x in rows]
parts=json.loads((s/'current-tool-parts30.json').read_text(encoding='utf-8'))
published=next(x for x in parts if x['tool']=='publish_interactive_artifact')
current=get('session/'+work['sessionID']+'/message/'+published['messageID']+'/part/'+published['id'])
assert current['state']['status']=='completed'
assert current['state']['input']['artifact']['content']['markdown'].encode()==report
assert json.loads(current['state']['output'])=={'artifactID':'art_g0Vc8Tx8y00vfqt2JklC','renderer':'document@1'}
verified=[]
for name,prefix,browser_names in [
 ('下载体验资料包.zip','asset',['下载体验资料包.zip','下载体验资料包 (1).zip','下载体验资料包 (2).zip','下载体验资料包 (3).zip','下载体验资料包 (4).zip']),
 ('重试下载资料包.zip','retry-asset',['重试下载资料包.zip']),
 ('最终重试资料包.zip','final-retry-asset',['最终重试资料包.zip'])]:
 ref=json.loads((s/(prefix+'-reference.json')).read_text(encoding='utf-8'));data=(s/name).read_bytes()
 assert ref['filename']==name and ref['size']==len(data)
 assert get(ref['url'],True)==data
 for browser_name in browser_names:assert (downloads/browser_name).read_bytes()==data
 verified.append({'filename':name,'bytes':len(data),'actualHTTP':200,'browserFiles':browser_names,'exactOriginalBytes':True})
deck=(project/'deliverables/销售经理简报-清晰图表.pptx').read_bytes()
assert len(deck)==16266 and (downloads/'销售经理简报-清晰图表 (1).pptx').read_bytes()==deck
preserved=[]
for old in (s/'original-project-files').rglob('*'):
 if old.is_file():
  name=old.relative_to(s/'original-project-files');assert (project/name).read_bytes()==old.read_bytes()
  preserved.append({'name':name.as_posix(),'bytes':old.stat().st_size})
assert len(preserved)==18
c=sqlite3.connect((Path(r['root'])/'runtime/data/opencorvus.db').as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
counts={}
for table,original in json.loads((s/'original-work-rows.json').read_text(encoding='utf-8')).items():
 assert table in ['message','part','tool_part_request','tool_part_outcome','interactive_artifact']
 for row in original:assert dict(c.execute('SELECT * FROM '+table+' WHERE id=?',(row['id'],)).fetchone())==row
 counts[table]=len(original)
assert sum(counts.values())==1006
assert c.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=project,text=True).strip()=='f7bf091156c9b137c4eb3d5b822721294e9a8f24'
assert json.loads((s/'availability-state.json').read_text())['state']=='restored'
result={'status':'passed','service':label,'report':{'filename':work['filename'],'bytes':len(report),'apiAndBrowserAndPublishedDocumentExact':True,'totals':{k:[n,str(v)] for k,(n,v) in totals.items()},'sourceRows':5},'zipDownloads':verified,'recordedPptx':{'filename':'销售经理简报-清晰图表.pptx','bytes':len(deck),'browserOriginalExact':True},'protectedFiles':preserved,'protectedOldWorkRows':counts,'databaseIntegrity':'ok','availability':'restored','sampleProjectHEAD':'f7bf091156c9b137c4eb3d5b822721294e9a8f24'}
(out/'delivery-facts.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'passed','reportBytes':len(report),'zipByteCounts':[x['bytes'] for x in verified],'recordedPptxBytes':len(deck),'protectedFiles':18,'protectedRows':1006},ensure_ascii=False))
