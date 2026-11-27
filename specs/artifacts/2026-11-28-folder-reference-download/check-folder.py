from pathlib import Path
import json,re,struct,sys,urllib.request
s=Path(__file__).parent;label=sys.argv[1];r=json.loads((s/(label+'-runtime.json')).read_text(encoding='utf-8'))
def load(name):return json.loads((s/name).read_text(encoding='utf-8'))
ref=load('attachment-reference.json');manifest=(s/'accepted-directory-manifest.json').read_bytes();dispatch=load('task-dispatch.json')
with urllib.request.urlopen(r['url'].rstrip('/')+ref['url']) as response:assert response.status==200 and response.read()==manifest and len(manifest)==ref['size']==165
assert json.loads(manifest)=={'version':1,'kind':'directory','path':ref['path']}
parts=load(label+'-task-parts.json');assert [p['tool'] for p in parts]==['read']*5+['publish_interactive_artifact']
assert [p['state']['status'] for p in parts]==['completed']*6
assert parts[0]['state']['metadata']['preview'].encode()==manifest
assert parts[1]['state']['metadata']['readType']=='directory' and parts[1]['state']['metadata']['lines']==3
for p,name,lines in [(parts[2],'review/图片审阅.md',7),(parts[3],'review/销售核对说明-来源复验.md',52)]:
 state=p['state'];assert state['metadata']['offset']==1 and state['metadata']['lines']==state['metadata']['totalLines']==lines
 content=state['output'].split('<content>',1)[1].split('</content>',1)[0]
 assert [v.split(': ',1)[1] for v in content.splitlines() if re.match(r'^\d+: ',v)]==(s/'original-project-files'/name).read_text(encoding='utf-8').splitlines()
image=parts[4]['state']['attachments'][0];assert image['mime']=='image/png'
with urllib.request.urlopen(r['url'].rstrip('/')+image['url']) as response:png=response.read();assert response.status==200 and png==(s/'original-project-files/review/区域对比（原图）.png').read_bytes() and len(png)==60144
assert struct.unpack('>II',png[16:24])==(1280,720)
artifacts=load(label+'-api-artifacts.json');artifact=artifacts[0]
assert artifact['id']=='art_g0VcDBybC006d6Ilxdlb' and artifact['payload']['renderer']=='document@1'
declared=parts[5]['state']['input']['artifact'];assert artifact['payload']=={'schemaVersion':declared['schemaVersion'],'title':declared['title'],**declared['content']}
assert json.loads(parts[5]['state']['output'])=={'artifactID':artifact['id'],'renderer':'document@1'}
with urllib.request.urlopen(urllib.request.Request(r['url']+'session/'+dispatch['sessionID']+'/message',headers={'x-opencorvus-directory':r['project']})) as response:messages=json.load(response)
user=next(m for m in messages if m['info']['id']==dispatch['messageID'])
file=next(p for p in user['parts'] if p['type']=='file');assert {k:file[k] for k in ['mime','filename','url']}=={k:ref[k] for k in ['mime','filename','url']}
final=next(m for m in reversed(messages) if m['info'].get('finish')=='stop')
(s/'final-response.txt').write_text('\n'.join(p['text'] for p in final['parts'] if p['type']=='text'),encoding='utf-8')
(s/'public-user-message.json').write_text(json.dumps(user,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
facts={'status':'passed','label':label,'sessionID':dispatch['sessionID'],'messageID':dispatch['messageID'],'artifactID':artifact['id'],
 'manifestBytes':len(manifest),'manifestVersion':1,'canonicalReferenceUnchanged':True,'directoryEntries':3,'fullMarkdownLines':[7,52],
 'acceptedImageBytes':len(png),'imageDimensions':[1280,720],'naturalPublication':'completed','final':'stop',
 'scope':'real API, complete tool outputs and original bytes; UI and model-content review are manual'}
if label=='run132':
 for name in ['before-downloaded-manifest','downloaded-review.directory.json','english-review.directory.json']:
  assert (s/name).read_bytes()==manifest,name
 for actual,original in [('downloaded-original-md.md','review/图片审阅.md'),('downloaded-original-image.png','review/区域对比（原图）.png')]:
  assert (s/actual).read_bytes()==(s/'original-project-files'/original).read_bytes(),actual
 facts['nativeDownloads']=load('download-facts.json')['downloads']
(s/('folder-facts-'+label+'.json')).write_text(json.dumps(facts,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(facts,ensure_ascii=False))
