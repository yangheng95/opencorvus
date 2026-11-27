from pathlib import Path
import io,json,re,sqlite3,subprocess,sys,urllib.request
from PIL import Image
s=Path(__file__).parent
r=json.loads((s/'run23-runtime.json').read_text());session='ses_hXaoxvf6sXUeNwnhrZTA'
out=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-11-27-presentation-image-description')
def save(name,data):(out/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def read(url):
 req=urllib.request.Request(r['url'].rstrip('/')+'/'+url.lstrip('/'),headers={'x-opencorvus-directory':r['project']})
 with urllib.request.urlopen(req) as response:
  assert response.status==200
  return response.read()
parts=json.loads((s/'current-tool-parts23.json').read_text(encoding='utf-8'))
delivery=next(p for p in reversed(parts) if p['tool']=='work_artifact_deliver' and p['state']['status']=='completed')
data=json.loads(delivery['state']['output']);prior=json.loads((s/'prior-validation.json').read_text(encoding='utf-8'))
assert data['source']==prior['source']
record=json.loads(read('session/'+session+'/interactive-artifact/'+data['artifactID']))
assert record['id']==data['artifactID']==delivery['state']['metadata']['artifactID']
assert record['payload']['title']=='销售经理简报·中文图片说明'
assert record['payload']['renderer']=='presentation@1' and record['payload']['aspectRatio']=='16:9'
titles=['订单与净金额总览','区域对比：金额与笔数','事实、缺口与后续行动']
assert len(record['payload']['slides'])==len(data['renders'])==3
images=[]
for index,(slide,title,render,reviewed) in enumerate(zip(record['payload']['slides'],titles,data['renders'],prior['renders'],strict=True),1):
 assert slide['title']==slide['imageAlt']==title
 assert slide['image']['url']==render['url']==reviewed['url']
 blob=read(render['url']);assert len(blob)==render['size']==slide['image']['size']
 assert Image.open(io.BytesIO(blob)).size==(1280,720)
 images.append({'slide':index,'title':title,'imageAlt':slide['imageAlt'],'url':render['url'],'size':[1280,720],'bytes':len(blob),'samePriorReviewedImage':True})
source=read(data['source']['url']);project=Path(r['project'])
assert len(source)==data['source']['size']==16259
assert (project/'deliverables/销售经理简报-精度修订.pptx').read_bytes()==source
assert record['downloads'][0]['url']==data['source']['url']
receipt=json.loads(read(data['final_validation_receipt']['url']))
assert receipt==data['final_validation_receipt_payload'] and receipt['source_url']==data['source']['url']
c=sqlite3.connect((Path(r['root'])/'runtime/data/opencorvus.db').as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
preserved={}
for table,rows in json.loads((s/'original-work-rows.json').read_text(encoding='utf-8')).items():
 for row in rows:assert dict(c.execute('SELECT * FROM '+table+' WHERE id=?',(row['id'],)).fetchone())==row
 preserved[table]=len(rows)
files=[]
for old in (s/'original-project-files').rglob('*'):
 if old.is_file():
  name=old.relative_to(s/'original-project-files');assert (project/name).read_bytes()==old.read_bytes()
  files.append({'name':name.as_posix(),'bytes':old.stat().st_size,'preservedExactBytes':True})
assert len(files)==15 and subprocess.check_output(['git','rev-parse','HEAD'],cwd=project,text=True).strip()=='f7bf091156c9b137c4eb3d5b822721294e9a8f24'
last=c.execute("SELECT id,data FROM message WHERE session_id=? AND json_extract(data,'$.role')='assistant' ORDER BY time_created DESC LIMIT 1",(session,)).fetchone();final=json.loads(last['data'])
assert final['finish']=='stop' and final['time']['completed']>0 and final['agent']=='work'
display=[json.loads(p['data']) for p in c.execute("SELECT data FROM part WHERE message_id=? AND json_extract(data,'$.type')='interactive-artifact'",(record['messageID'],))]
assert any(p['artifactID']==record['id'] and p['toolPartID']==delivery['id'] for p in display)
downloads=[]
if '--before-downloads' not in sys.argv:
 before={p['name'] for p in json.loads((s/'downloads-before.json').read_text(encoding='utf-8'))['files']}
 fresh=[p for p in Path('C:/Users/hengu/Downloads').iterdir() if p.is_file() and p.name not in before]
 pptxs=[p for p in fresh if re.fullmatch(r'销售经理简报-精度修订(?: \(\d+\))?\.pptx',p.name)]
 mds=[p for p in fresh if p.suffix=='.md' and p.name.startswith('销售经理简报')]
 assert pptxs and len(mds)==1
 for p in pptxs:
  assert p.read_bytes()==source
  downloads.append({'filename':p.name,'bytes':len(source),'canonicalSourceBytes':True})
 md=mds[0].read_text(encoding='utf-8')
 for index,(slide,title) in enumerate(zip(record['payload']['slides'],titles,strict=True),1):
  assert '# '+title+'\n\n'+slide['markdown'] in md
  assert '!['+title+'](<slide-'+str(index)+'.png>)' in md
 (out/'downloaded-presentation.md').write_text(md,encoding='utf-8')
 downloads.append({'filename':mds[0].name,'bytes':mds[0].stat().st_size,'allOriginalTitlesAndMediaReferences':True})
errors=[{'toolPartID':p['id'],'tool':p['tool'],'failure':p['state']['failure']} for p in parts if p['state']['status']=='error']
result={'status':'passed','artifactID':record['id'],'deliveryToolPartID':delivery['id'],'finalMessageID':last['id'],'sourceBytes':len(source),'sourceExactlyUnchanged':True,'slides':images,'preservedRows':preserved,'preservedFiles':files,'downloads':downloads,'naturalToolErrors':errors}
save('run23-delivery-check'+('-before-downloads' if '--before-downloads' in sys.argv else '')+'.json',result)
save('run23-delivered-artifact.json',record)
save('run23-actual-tool-parts.json',parts)
print(json.dumps({'status':'passed','artifactID':record['id'],'slides':3,'protectedRows':sum(preserved.values()),'protectedFiles':len(files),'downloads':len(downloads)},ensure_ascii=False))
