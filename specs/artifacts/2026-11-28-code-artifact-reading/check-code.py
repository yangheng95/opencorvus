from pathlib import Path
import json,re,sys
s=Path(__file__).parent;label=sys.argv[1]
a=json.loads((s/(label+'-api-artifact.json')).read_text(encoding='utf-8'));p=a['payload']
parts=json.loads((s/(label+'-task-parts.json')).read_text(encoding='utf-8'));status=json.loads((s/(label+'-task-status.json')).read_text(encoding='utf-8'))
assert status['finish']=='stop'
assert [v['tool'] for v in parts]==['read','read','publish_interactive_artifact']
assert [v['state']['status'] for v in parts]==['completed','completed','completed']
reads=[]
for part,name,count in zip(parts[:2],['sales_summary.py','sales.csv'],[167,6]):
 state=part['state'];meta=state['metadata'];assert Path(state['input']['filePath']).name==name
 assert meta['offset']==1 and meta['lines']==meta['totalLines']==count
 body=state['output'].split('<content>',1)[1].split('</content>',1)[0]
 actual=[v.split(': ',1)[1] for v in body.splitlines() if re.match(r'^\d+: ',v)]
 assert actual==(s/'original-project-files'/name).read_text(encoding='utf-8').splitlines()
 reads.append({'filename':name,'completeLines':count})
assert p['renderer']=='code@1' and p['language']=='python' and p['editable'] is True and p['filename']=='sales_summary.py'
assert p['source'].encode()==(s/'original-project-files/sales_summary.py').read_bytes()
tool_input=parts[-1]['state']['input']['artifact']
assert {'schemaVersion':tool_input['schemaVersion'],'title':tool_input['title'],**tool_input['content']}==p
if label=='run121':assert (s/'before-download.py').read_bytes()==p['source'].encode()
else:
 assert a==json.loads((s/'run121-api-artifact.json').read_text(encoding='utf-8'))
 assert parts==json.loads((s/'run121-task-parts.json').read_text(encoding='utf-8'))
result={'status':'passed','label':label,'sessionID':a['sessionID'],'artifactID':a['id'],'reads':reads,'authoredSourceBytes':len(p['source'].encode()),'publicationMatchesFullOriginal':True,'final':'stop','toolParts':len(parts)}
(s/('code-facts-'+label+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
