from pathlib import Path
import json,re,sys
s=Path(__file__).parent;label=sys.argv[1]
arts=json.loads((s/(label+'-api-artifacts.json')).read_text(encoding='utf-8'));parts=json.loads((s/(label+'-task-parts.json')).read_text(encoding='utf-8'));status=json.loads((s/(label+'-task-status.json')).read_text(encoding='utf-8'))
assert status['finish']=='stop'
assert [p['tool'] for p in parts]==['read','read','publish_interactive_artifact','publish_interactive_artifact']
assert [p['state']['status'] for p in parts]==['completed']*4
reads=[]
for part,name,count in zip(parts[:2],['sales_summary.py','sales.csv'],[167,6]):
 state=part['state'];m=state['metadata'];assert Path(state['input']['filePath']).name==name
 assert m['offset']==1 and m['lines']==m['totalLines']==count
 body=state['output'].split('<content>',1)[1].split('</content>',1)[0]
 assert [v.split(': ',1)[1] for v in body.splitlines() if re.match(r'^\d+: ',v)]==(s/'original-project-files'/name).read_text(encoding='utf-8').splitlines()
 reads.append({'filename':name,'completeLines':count})
assert len(arts)==2
for a,part,language,filename in zip(arts,parts[2:],['python','plaintext'],['sales-summary','sales_summary.py']):
 p=a['payload'];q=part['state']['input']['artifact']
 assert {'schemaVersion':q['schemaVersion'],'title':q['title'],**q['content']}==p
 assert p['renderer']=='code@1' and p['language']==language and p['filename']==filename and p['editable'] is False
 assert p['source'].encode()==(s/'original-project-files/sales_summary.py').read_bytes()
 assert part['state']['metadata']['artifactID']==a['id']
if label!='run123':
 assert arts==json.loads((s/'run123-api-artifacts.json').read_text(encoding='utf-8'))
 assert parts==json.loads((s/'run123-task-parts.json').read_text(encoding='utf-8'))
facts={'status':'passed','label':label,'sessionID':status['sessionID'],'artifacts':[{'id':a['id'],'language':a['payload']['language'],'filename':a['payload']['filename'],'sourceBytes':len(a['payload']['source'].encode()),'completeOriginal':True} for a in arts],'completeReads':reads,'toolParts':4,'final':'stop'}
(s/('code-facts-'+label+'.json')).write_text(json.dumps(facts,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(facts,ensure_ascii=False))
