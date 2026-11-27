from pathlib import Path
import json,re,urllib.request
s=Path(__file__).parent;r=json.loads((s/'run128-runtime.json').read_text(encoding='utf-8'))
d=json.loads((s/'task-dispatch.json').read_text(encoding='utf-8'));ref=json.loads((s/'attachment-reference.json').read_text(encoding='utf-8'))
source=(s/'original-project-files/test_sales_summary.py').read_bytes()
with urllib.request.urlopen(r['url'].rstrip('/')+ref['url']) as response:assert response.status==200 and response.read()==source and len(source)==ref['size']==10107
parts=json.loads((s/'run128-task-parts.json').read_text(encoding='utf-8'))
assert [p['tool'] for p in parts]==['read','capability_search','bash','publish_interactive_artifact']
assert [p['state']['status'] for p in parts]==['completed','completed','completed','error']
read=parts[0]['state'];meta=read['metadata'];assert meta['offset']==1 and meta['lines']==meta['totalLines']==264
assert read['input']['filePath']==ref['url']
body=read['output'].split('<content>',1)[1].split('</content>',1)[0]
assert [v.split(': ',1)[1] for v in body.splitlines() if re.match(r'^\d+: ',v)]==source.decode('utf-8').splitlines()
attempt=parts[-1]['state'];content=attempt['input']['artifact']['content']
assert content=={'renderer':'file-preview@1','kind':'text','source':ref}
failure=attempt['failure'];assert failure['kind']==failure['classification']=='tool-input-invalid'
issues=json.loads(failure['message'].split('\nError message: ',1)[1])
assert issues==[{'code':'custom','message':'file preview kind must match attachment MIME','path':['artifact','content','source','mime']}]
url=r['url']+'session/'+d['sessionID']+'/message'
with urllib.request.urlopen(urllib.request.Request(url,headers={'x-opencorvus-directory':r['project']})) as response:messages=json.load(response)
user=next(m for m in messages if m['info']['id']==d['messageID']);files=[p for p in user['parts'] if p['type']=='file'];assert len(files)==1
for key in ['mime','url','filename']:assert files[0][key]==ref[key]
final=[m for m in messages if m['info'].get('finish')=='stop'][-1]
reply='\n'.join(p['text'] for p in final['parts'] if p['type']=='text');assert reply.strip()
(s/'initial-response.txt').write_text(reply,encoding='utf-8')
(s/'public-user-message.json').write_text(json.dumps(user,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
facts={'status':'verified historical failure','sessionID':d['sessionID'],'messageID':d['messageID'],'sourceBytes':len(source),'sourceLines':264,'sourceMime':ref['mime'],'sourceFilename':ref['filename'],'sourceReferenceEqualsActualUpload':True,'fullReadEqualsOriginal':True,'failureKind':failure['kind'],'failureIssues':issues,'final':'stop','scope':'real tool validation failure with exact canonical original; historical data check, not a current rejection regression test'}
(s/'initial-contract-facts.json').write_text(json.dumps(facts,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(facts,ensure_ascii=False))
