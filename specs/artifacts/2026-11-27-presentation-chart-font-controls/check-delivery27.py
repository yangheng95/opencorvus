from pathlib import Path
from decimal import Decimal
import io,json,re,sqlite3,subprocess,sys,urllib.request,zipfile,xml.etree.ElementTree as E
from PIL import Image
s=Path(__file__).parent;r=json.loads((s/'run27-runtime.json').read_text());project=Path(r['project']);session='ses_hXaoxvf6sXUeNwnhrZTA'
out=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-11-27-presentation-chart-font-controls')
def save(name,data):(out/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def read(url):
 req=urllib.request.Request(r['url'].rstrip('/')+'/'+url.lstrip('/'),headers={'x-opencorvus-directory':r['project']})
 with urllib.request.urlopen(req) as response:
  assert response.status==200
  return response.read()
parts=json.loads((s/'current-tool-parts27.json').read_text(encoding='utf-8'))
delivery=next(p for p in reversed(parts) if p['tool']=='work_artifact_deliver' and p['state']['status']=='completed')
data=json.loads(delivery['state']['output'])
assert data['source']['filename']=='销售经理简报-清晰图表.pptx'
author=next(p for p in reversed(parts) if p['tool']=='work_artifact_author' and p['state']['status']=='completed' and json.loads(p['state']['output'])['source']['url']==data['source']['url'])
plan=author['state']['input'];assert plan['filename']==data['source']['filename'] and len(plan['slides'])==3
charts=[x for slide in plan['slides'] for x in slide['elements'] if x['kind']=='chart']
assert len(charts)==2 and all(x['data_label_font_size_pt']==18 and x['axis_font_size_pt']==16 and x['data_labels']=='value' for x in charts)
source=read(data['source']['url']);assert len(source)==data['source']['size']
assert (project/'deliverables/销售经理简报-清晰图表.pptx').read_bytes()==source
z=zipfile.ZipFile(io.BytesIO(source));ns={'p':'http://schemas.openxmlformats.org/presentationml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main','c':'http://schemas.openxmlformats.org/drawingml/2006/chart'}
presentation=E.fromstring(z.read('ppt/presentation.xml'));size=presentation.find('p:sldSz',ns)
assert int(size.get('cx'))*9==int(size.get('cy'))*16 and len(presentation.findall('p:sldIdLst/p:sldId',ns))==3
native=[];all_text=''
for name in z.namelist():
 if not name.endswith('.xml'):continue
 root=E.fromstring(z.read(name))
 if root.tag=='{'+ns['p']+'}sld':all_text+=''.join(x.text or '' for x in root.findall('.//a:t',ns))
 if root.tag!='{'+ns['c']+'}chartSpace':continue
 ser=root.findall('.//c:ser',ns);assert len(ser)==1
 def points(element):return [p.find('c:v',ns).text for p in sorted(element.findall('.//c:pt',ns),key=lambda x:int(x.get('idx')))]
 categories=points(ser[0].find('c:cat',ns));values=[Decimal(x) for x in points(ser[0].find('c:val',ns))];pairs=dict(zip(categories,values,strict=True))
 assert pairs in [{'华东':Decimal('28.25'),'华南':Decimal('7.35')},{'华东':Decimal(3),'华南':Decimal(2)}]
 label=root.find('.//c:dLbls/c:txPr//a:defRPr',ns);assert label.get('sz')=='1800'
 axes=root.findall('.//c:catAx/c:txPr//a:defRPr',ns)+root.findall('.//c:valAx/c:txPr//a:defRPr',ns)
 assert len(axes)==2 and all(a.get('sz')=='1600' for a in axes)
 fmt=root.find('.//c:dLbls/c:numFmt',ns);expected='0.00' if pairs['华东']==Decimal('28.25') else '0'
 assert fmt.get('formatCode')==expected and root.find('.//c:dLbls/c:showVal',ns).get('val')=='1'
 native.append({'part':name,'regions':{k:str(v) for k,v in pairs.items()},'dataLabelSizePt':18,'axisLabelSizesPt':[16,16],'nativeNumberFormat':expected})
assert len(native)==2
for text in ['35.60','-2.05','0.00','日期','币种','成本','目标']:assert text in all_text,text
record=json.loads(read('session/'+session+'/interactive-artifact/'+data['artifactID']))
assert record['payload']['renderer']=='presentation@1' and record['payload']['title']=='销售经理简报·清晰图表'
assert len(record['payload']['slides'])==len(data['renders'])==3 and record['downloads'][0]['url']==data['source']['url']
validation=next(p for p in reversed(parts) if p['tool']=='work_artifact_validate' and p['state']['status']=='completed' and p['state']['input']['source_url']==data['source']['url'])
v=json.loads(validation['state']['output'])
received={a['url'] for p in parts if p['tool']=='read' and p['state']['status']=='completed' for a in p['state'].get('attachments',[]) if a.get('mime','').startswith('image/')}
images=[]
for i,(slide,render,reviewed) in enumerate(zip(record['payload']['slides'],data['renders'],v['renders'],strict=True),1):
 assert slide['title']==slide['imageAlt'] and slide['image']['url']==render['url']==reviewed['url']
 blob=read(render['url']);assert Image.open(io.BytesIO(blob)).size==(1280,720) and len(blob)==render['size']
 assert render['url'] in received,(i,received)
 (out/('delivered-slide-'+str(i)+'.png')).write_bytes(blob)
 images.append({'slide':i,'title':slide['title'],'url':render['url'],'bytes':len(blob),'modelReadActualImage':True})
receipt=json.loads(read(data['final_validation_receipt']['url']));assert receipt==data['final_validation_receipt_payload'] and receipt['source_url']==data['source']['url']
c=sqlite3.connect((Path(r['root'])/'runtime/data/opencorvus.db').as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
preserved={}
for table,rows in json.loads((s/'original-work-rows.json').read_text(encoding='utf-8')).items():
 for row in rows:assert dict(c.execute('SELECT * FROM '+table+' WHERE id=?',(row['id'],)).fetchone())==row
 preserved[table]=len(rows)
files=[]
for old in (s/'original-project-files').rglob('*'):
 if old.is_file():
  name=old.relative_to(s/'original-project-files');assert (project/name).read_bytes()==old.read_bytes();files.append({'name':name.as_posix(),'bytes':old.stat().st_size,'preservedExactBytes':True})
assert len(files)==17 and sum(preserved.values())==904 and subprocess.check_output(['git','rev-parse','HEAD'],cwd=project,text=True).strip()=='f7bf091156c9b137c4eb3d5b822721294e9a8f24'
last=c.execute("SELECT id,data FROM message WHERE session_id=? AND json_extract(data,'$.role')='assistant' ORDER BY time_created DESC LIMIT 1",(session,)).fetchone();final=json.loads(last['data']);assert final['finish']=='stop' and final['time']['completed']>0
natural=[json.loads(p['data']) for p in c.execute("SELECT data FROM part WHERE message_id=? AND json_extract(data,'$.type')='interactive-artifact'",(record['messageID'],))]
assert any(p['artifactID']==record['id'] and p['toolPartID']==delivery['id'] for p in natural)
downloads=[]
if '--before-downloads' not in sys.argv:
 before={p['name'] for p in json.loads((s/'downloads-before.json').read_text(encoding='utf-8'))['files']}
 matches=[p for p in Path('C:/Users/hengu/Downloads').iterdir() if p.is_file() and p.name not in before and re.fullmatch(r'销售经理简报-清晰图表(?: \(\d+\))?\.pptx',p.name)]
 assert len(matches)==1
 for p in matches:assert p.read_bytes()==source;downloads.append({'filename':p.name,'bytes':len(source),'canonicalSourceBytes':True})
result={'status':'passed','artifactID':record['id'],'finalMessageID':last['id'],'sourceBytes':len(source),'authorToolPartID':author['id'],'deliveryToolPartID':delivery['id'],'nativeCharts':native,'slides':images,'preservedRows':preserved,'preservedFiles':files,'downloads':downloads,'naturalToolErrors':[{'tool':p['tool'],'failure':p['state']['failure']} for p in parts if p['state']['status']=='error']}
save('run27-delivery-check'+('-before-downloads' if '--before-downloads' in sys.argv else '')+'.json',result);save('run27-delivered-artifact.json',record);save('run27-actual-tool-parts.json',parts)
(out/'销售经理简报-清晰图表.pptx').write_bytes(source)
print(json.dumps({'status':'passed','artifactID':record['id'],'sourceBytes':len(source),'nativeCharts':len(native),'slides':3,'protectedFiles':len(files),'protectedRows':sum(preserved.values()),'downloads':len(downloads)},ensure_ascii=False))
