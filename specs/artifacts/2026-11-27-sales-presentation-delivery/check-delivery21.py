from pathlib import Path,PurePosixPath
from decimal import Decimal
import csv,io,json,posixpath,re,sqlite3,subprocess,sys,urllib.request,zipfile,xml.etree.ElementTree as E
from PIL import Image
s=Path(__file__).parent;r=json.loads((s/'run21-runtime.json').read_text());label='run21'
out=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-11-27-sales-presentation-delivery')
project=Path(r['project']);session='ses_hXaoxvf6sXUeNwnhrZTA'
def save(name,value):(out/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def read(url):
 req=urllib.request.Request(r['url'].rstrip('/')+'/'+url.lstrip('/'),headers={'x-opencorvus-directory':r['project']})
 with urllib.request.urlopen(req) as response:
  assert response.status==200
  return response.read(),dict(response.headers)
def get(url):return json.loads(read(url)[0])
parts=json.loads((s/'current-tool-parts21.json').read_text(encoding='utf-8'))
deliveries=[p for p in parts if p['tool']=='work_artifact_deliver' and p['state']['status']=='completed']
assert deliveries,'The real three-slide presentation must complete formal delivery.'
delivery=deliveries[-1];data=json.loads(delivery['state']['output'])
record=get('session/'+session+'/interactive-artifact/'+data['artifactID'])
assert record['id']==data['artifactID']==delivery['state']['metadata']['artifactID']
assert record['sessionID']==session and record['payload']['renderer']=='presentation@1' and record['payload']['aspectRatio']=='16:9'
assert len(record['payload']['slides'])==len(data['renders'])==delivery['state']['metadata']['slideCount']==3
assert record['downloads'][0]['url']==data['source']['url'] and record['downloads'][0]['filename']=='销售经理简报-精度修订.pptx'
source,headers=read(data['source']['url'])
assert data['source']['filename']=='销售经理简报-精度修订.pptx' and len(source)==data['source']['size']
assert headers['Content-Type']=='application/vnd.openxmlformats-officedocument.presentationml.presentation' and headers['Content-Disposition'].startswith('attachment;')
assert (project/'deliverables/销售经理简报-精度修订.pptx').read_bytes()==source
receipt=get(data['final_validation_receipt']['url'])
assert receipt==data['final_validation_receipt_payload'] and receipt['profile']=='office.presentation@1' and receipt['source_url']==data['source']['url'] and receipt['source_sha']==data['source']['sha']
author=next(p for p in reversed(parts) if p['tool']=='work_artifact_author' and p['state']['status']=='completed' and json.loads(p['state']['output'])['source']['url']==data['source']['url'])
plan=author['state']['input'];assert plan['filename']=='销售经理简报-精度修订.pptx' and len(plan['slides'])==3
z=zipfile.ZipFile(io.BytesIO(source));ns={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main','c':'http://schemas.openxmlformats.org/drawingml/2006/chart','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships','rel':'http://schemas.openxmlformats.org/package/2006/relationships'}
presentation=E.fromstring(z.read('ppt/presentation.xml'));size=presentation.find('p:sldSz',ns)
assert int(size.get('cx'))*9==int(size.get('cy'))*16
rels={x.get('Id'):x.get('Target') for x in E.fromstring(z.read('ppt/_rels/presentation.xml.rels'))}
slides=[posixpath.normpath(posixpath.join('ppt',rels[x.get('{'+ns['r']+'}id')])).lstrip('/') for x in presentation.findall('p:sldIdLst/p:sldId',ns)]
assert len(slides)==3
normalize=lambda t:re.sub(r'\s+','',t)
texts=[];chart_paths=[];slide_evidence=[]
for index,(path,expected) in enumerate(zip(slides,plan['slides'],strict=True),1):
 root=E.fromstring(z.read(path));body=''.join(x.text or '' for x in root.findall('.//a:t',ns));texts.append(body)
 planned=[e['text'] for e in expected['elements'] if e['kind'] in ['text','shape'] and e.get('text')]
 for text in planned:assert normalize(text) in normalize(body),(index,text)
 relpath=posixpath.join(posixpath.dirname(path),'_rels',posixpath.basename(path)+'.rels')
 rels={x.get('Id'):x.get('Target') for x in E.fromstring(z.read(relpath))} if relpath in z.namelist() else {}
 charts=[]
 for chart in root.findall('.//c:chart',ns):
  target=posixpath.normpath(posixpath.join(posixpath.dirname(path),rels[chart.get('{'+ns['r']+'}id')])).lstrip('/')
  chart_paths.append(target);charts.append(target)
 slide_evidence.append({'slide':index,'path':path,'editableTextElements':len(planned),'fullPlannedTextCovered':True,'nativeCharts':charts})
assert len(chart_paths)==2 and len(slide_evidence[1]['nativeCharts'])==2
charts=[]
for path in chart_paths:
 root=E.fromstring(z.read(path));series=root.findall('.//c:ser',ns);assert len(series)==1
 ser=series[0]
 def points(parent):
  return [p.find('c:v',ns).text for p in sorted(parent.findall('.//c:pt',ns),key=lambda p:int(p.get('idx')))]
 categories=points(ser.find('c:cat',ns));values=[Decimal(value) for value in points(ser.find('c:val',ns))]
 assert set(categories)=={'华东','华南'} and len(categories)==2
 pairs=dict(zip(categories,values,strict=True));assert pairs in [{'华东':Decimal('28.25'),'华南':Decimal('7.35')},{'华东':Decimal(3),'华南':Decimal(2)}]
 literal=ser.find('c:val/c:numLit',ns);assert literal is not None
 measure='net_amount' if pairs['华东']==Decimal('28.25') else 'order_count'
 planned=next(e for e in plan['slides'][1]['elements'] if e['kind']=='chart' and [Decimal(str(v)) for v in e['series'][0]['values']]==values)
 fmt=root.find('.//c:dLbls/c:numFmt',ns)
 assert fmt is not None and fmt.get('formatCode')==planned['data_label_number_format'] and fmt.get('sourceLinked')=='0'
 assert planned['data_labels']=='value' and root.find('.//c:dLbls/c:showVal',ns).get('val')=='1'
 if measure=='net_amount':assert fmt.get('formatCode')=='0.00'
 charts.append({'path':path,'categories':categories,'values':[str(value) for value in values],'regionValues':{key:str(value) for key,value in pairs.items()},'measure':measure,'nativeDataStorage':'c:val/c:numLit','nativeLabelFormat':dict(fmt.attrib),'nativeValueLabels':True,'desktopEditDataQualification':'unverified'})
assert {chart['measure'] for chart in charts}=={'net_amount','order_count'}
original=list(csv.DictReader((s/'original-project-files/sales.csv').open(encoding='utf-8')))
assert sum((Decimal(row['金额']) for row in original),Decimal(0))==Decimal('35.60')
body=''.join(texts)
for value in ['sales.csv','35.60','-2.05','日期','币种','成本','目标']:assert value in body,value
validation_part=next(p for p in reversed(parts) if p['tool']=='work_artifact_validate' and p['state']['status']=='completed' and p['state']['input']['source_url']==data['source']['url'])
validation=json.loads(validation_part['state']['output']);renders=[]
for index,(render,reviewed,slide) in enumerate(zip(data['renders'],validation['renders'],record['payload']['slides'],strict=True),1):
 blob,_=read(render['url']);prior,_=read(reviewed['url'])
 assert render['filename']=='slide-'+str(index)+'.png' and reviewed['slide']==index and blob==prior and len(blob)==render['size']
 assert slide['image']['url']==render['url'] and slide['image']['mime']=='image/png'
 assert any(a['url']==reviewed['url'] and a['mime']=='image/png' for a in validation_part['state']['attachments'])
 image=Image.open(io.BytesIO(blob));assert image.size==(1280,720)
 (out/(label+'-delivered-slide-'+str(index)+'.png')).write_bytes(blob)
 renders.append({'slide':index,'bytes':len(blob),'size':list(image.size),'sameCanonicalReviewBytes':True,'multimodalToolImage':True,'url':render['url']})
c=sqlite3.connect((Path(r['root'])/'runtime/data/opencorvus.db').as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
preserved={}
for table,rows in json.loads((s/'original-work-rows20.json').read_text(encoding='utf-8')).items():
 for old in rows:assert dict(c.execute('SELECT * FROM '+table+' WHERE id=?',(old['id'],)).fetchone())==old,(table,old['id'])
 preserved[table]=len(rows)
files=[]
for old in (s/'original-project-files').rglob('*'):
 if old.is_file():
  name=old.relative_to(s/'original-project-files');assert (project/name).read_bytes()==old.read_bytes()
  files.append({'file':name.as_posix(),'bytes':old.stat().st_size,'preservedExactBytes':True})
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=project,text=True).strip()=='f7bf091156c9b137c4eb3d5b822721294e9a8f24'
last=c.execute("SELECT id,data FROM message WHERE session_id=? AND json_extract(data,'$.role')='assistant' ORDER BY time_created DESC LIMIT 1",(session,)).fetchone();final=json.loads(last['data'])
assert final['finish']=='stop' and final['time']['completed']>0 and final['agent']=='work'
display=[json.loads(p['data']) for p in c.execute("SELECT data FROM part WHERE message_id=? AND json_extract(data,'$.type')='interactive-artifact'",(record['messageID'],))]
assert any(p['artifactID']==record['id'] and p['toolPartID']==delivery['id'] for p in display)
downloads=[]
if '--before-downloads' not in sys.argv:
 before={p['name'] for p in json.loads((s/'downloads-before.json').read_text(encoding='utf-8'))['files']}
 fresh=[p for p in Path('C:/Users/hengu/Downloads').iterdir() if p.is_file() and p.name not in before]
 matches=[p for p in fresh if re.fullmatch(r'销售经理简报-精度修订(?: \(\d+\))?\.pptx',p.name)];assert matches
 for p in matches:
  assert p.read_bytes()==source
  downloads.append({'filename':p.name,'bytes':len(source),'canonicalBytes':True})
save(label+'-delivery-check'+('-before-downloads' if '--before-downloads' in sys.argv else '')+'.json',{'status':'passed','artifactID':record['id'],'finalMessageID':last['id'],'sourceBytes':len(source),'slides':slide_evidence,'nativeCharts':charts,'renders':renders,'preservedRows':preserved,'preservedFiles':files,'downloads':downloads,'finalReceipt':receipt})
save(label+'-delivered-artifact.json',record);save(label+'-actual-tool-parts.json',parts)
(out/'销售经理简报-精度修订.pptx').write_bytes(source)
print(json.dumps({'status':'passed','artifactID':record['id'],'sourceBytes':len(source),'slides':3,'editableCharts':len(charts),'preservedRows':sum(preserved.values()),'preservedFiles':len(files),'downloads':len(downloads)},ensure_ascii=False))
