from pathlib import Path
import json,re,sys
s=Path(__file__).parent;label=sys.argv[1];r=json.loads((s/(label+'-runtime.json')).read_text());project=Path(r['project'])
parts=json.loads((s/(label+'-task-parts.json')).read_text());artifact=json.loads((s/(label+'-api-artifact.json')).read_text())
assert [p['tool'] for p in parts]==['read','read','read','bash','publish_interactive_artifact']
assert [p['state']['status'] for p in parts]==['completed']*5
reads=[]
for part in parts[:3]:
 name=part['state']['input']['filePath'];text=part['state']['output'].split('<content>',1)[1]
 lines=re.findall(r'^\d+: (.*)$',text,re.MULTILINE)
 assert lines==(project/name).read_text(encoding='utf-8-sig').splitlines(),name
 reads.append({'file':name,'lines':len(lines),'completeOriginalText':True})
assert [p['file'] for p in reads]==['sales_summary.py','test_sales_summary.py','sales.csv']
summary=json.loads(parts[3]['state']['output'].split('<bash_metadata>',1)[0].strip());assert parts[3]['state']['metadata']['exit']==0
assert summary==json.loads((s/'source-execution-facts.json').read_text())['summary']
published=parts[4]['state']['input']['artifact'];assert artifact['payload']=={'schemaVersion':published['schemaVersion'],'title':published['title'],**published['content']}
assert artifact['payload']['renderer']=='diagram@1'
source=artifact['payload']['source'];assert source.encode()==(s/'before-source.mmd').read_bytes()
last=json.loads(json.loads((s/(label+'-task-messages.json')).read_text())[-1]['data']);assert last['finish']=='stop'
if label!='run114':
 assert artifact==json.loads((s/'run114-api-artifact.json').read_text())
 assert parts==json.loads((s/'run114-task-parts.json').read_text())
result={'status':'passed','label':label,'sessionID':artifact['sessionID'],'artifactID':artifact['id'],'fullSourceReads':reads,'modelReadOnlySummaryEqualsIndependentExecution':True,'summary':summary,'originalMMDBytes':len(source.encode()),'finished':'stop','tools':[{'id':p['id'],'tool':p['tool'],'status':p['state']['status']} for p in parts],'diagramSemantics':'reviewed manually against full actual source and tests; file equality alone is not semantic or visual acceptance'}
(s/('diagram-facts-'+label+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,ensure_ascii=False))
