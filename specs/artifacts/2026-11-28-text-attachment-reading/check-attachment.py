from pathlib import Path
import json,re,sys,urllib.request,urllib.parse
s=Path(__file__).parent;label=sys.argv[1]
r=json.loads((s/(label+'-runtime.json')).read_text(encoding='utf-8'))
dispatch=json.loads((s/'task-dispatch.json').read_text(encoding='utf-8'));session=dispatch['sessionID']
reference=json.loads((s/'attachment-reference.json').read_text(encoding='utf-8'))
def get(path):
    with urllib.request.urlopen(urllib.request.Request(r['url']+path,headers={'x-opencorvus-directory':r['project']})) as response:
        assert response.status==200
        return json.load(response)
user=get('session/'+session+'/message/'+dispatch['messageID'])
assert user['info']['id']==dispatch['messageID'] and user['info']['role']=='user'
texts=[p for p in user['parts'] if p['type']=='text'];files=[p for p in user['parts'] if p['type']=='file']
assert len(texts)==len(files)==1
assert texts[0]['text']==(s/'request.txt').read_text(encoding='utf-8')
for key in ['url','mime','filename']:assert files[0][key]==reference[key]
assert files[0]['presentation']=='attachment-index'
raw=(s/'original-project-files/sales_summary.py').read_bytes()
with urllib.request.urlopen(r['url'].rstrip('/')+reference['url']) as response:
    assert response.status==200 and response.read()==raw and len(raw)==reference['size']==7650
parts=json.loads((s/(label+'-task-parts.json')).read_text(encoding='utf-8'))
assert [p['tool'] for p in parts]==['read','read','capability_search','bash','publish_interactive_artifact']
assert all(p['state']['status']=='completed' for p in parts)
for part,name,count in zip(parts[:2],['sales_summary.py','sales.csv'],[167,6]):
    state=part['state'];meta=state['metadata']
    assert meta['offset']==1 and meta['lines']==meta['totalLines']==count
    body=state['output'].split('<content>',1)[1].split('</content>',1)[0]
    assert [v.split(': ',1)[1] for v in body.splitlines() if re.match(r'^\d+: ',v)]==(s/'original-project-files'/name).read_text(encoding='utf-8').splitlines()
assert parts[0]['state']['input']['filePath']==reference['url']
artifacts=json.loads((s/(label+'-api-artifacts.json')).read_text(encoding='utf-8'));assert len(artifacts)==1
artifact=artifacts[0];payload=artifact['payload'];authored=parts[-1]['state']['input']['artifact']
assert {'schemaVersion':authored['schemaVersion'],'title':authored['title'],**authored['content']}==payload
assert payload['renderer']=='file-preview@1' and payload['kind']=='text' and payload['source']==reference
assert parts[-1]['state']['metadata']['artifactID']==artifact['id']
status=json.loads((s/(label+'-task-status.json')).read_text(encoding='utf-8'));assert status['finish']=='stop'
messages=get('session/'+session+'/message')
finished=[m for m in messages if m['info'].get('finish')=='stop'][-1]
reply='\n'.join(p['text'] for p in finished['parts'] if p['type']=='text')
assert reply.strip()
(s/'final-response.txt').write_text(reply,encoding='utf-8')
(s/'public-user-message.json').write_text(json.dumps(user,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
if label!='run125':
    assert artifacts==json.loads((s/'run125-api-artifacts.json').read_text(encoding='utf-8'))
    assert parts==json.loads((s/'run125-task-parts.json').read_text(encoding='utf-8'))
facts={'status':'passed','label':label,'sessionID':session,'messageID':dispatch['messageID'],'originalAttachmentBytes':len(raw),'completeReads':[{'name':'sales_summary.py','lines':167},{'name':'sales.csv','lines':6}],'canonicalUserFilePart':True,'publicArtifactSourceEqualsUploadReference':True,'artifactID':artifact['id'],'toolParts':len(parts),'final':'stop','scope':'real upload, public user File Part, full visible read results and natural publish; no UI assertions'}
(s/('attachment-facts-'+label+'.json')).write_text(json.dumps(facts,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(facts,ensure_ascii=False))
