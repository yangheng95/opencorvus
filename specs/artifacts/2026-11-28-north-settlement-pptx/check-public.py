from pathlib import Path
import json,sqlite3,urllib.request,urllib.parse,sys
s=Path(__file__).parent;label=sys.argv[1];r=json.loads((s/(label+'-runtime.json')).read_text(encoding='utf-8'));old=json.loads((s/'original-project-rows.json').read_text(encoding='utf-8'))
def get(route,directory,binary=False):
    with urllib.request.urlopen(r['url']+route.lstrip('/')+'?'+urllib.parse.urlencode({'directory':directory}),timeout=30) as response:return response.read() if binary else json.load(response)
c=sqlite3.connect((Path(r['root'])/'runtime/data/opencorvus.db').as_uri()+'?mode=ro',uri=True)
sessions={row['id']:row['session_id'] for row in old['message']};artifacts=[]
for row in old['interactive_artifact']:
    session=sessions[row['message_id']];directory=c.execute('SELECT directory FROM session WHERE id=?',(session,)).fetchone()[0]
    artifact=get('session/'+session+'/interactive-artifact/'+row['id'],directory);assert artifact['payload']==json.loads(row['payload'])
    artifacts.append({'id':row['id'],'renderer':artifact['payload']['renderer'],'publicPayload':'exact original'})
inputs=[]
for side in ['north','south']:
    business=json.loads((s/('business-'+side+'.json')).read_text(encoding='utf-8'))
    for file in (s/'business-inputs'/side).iterdir():assert file.read_bytes()==(Path(business['directory'])/file.name).read_bytes();inputs.append({'side':side,'file':file.name,'bytes':file.stat().st_size})
task=json.loads((s/'business-task.json').read_text(encoding='utf-8'));messages=get('session/'+task['sessionID']+'/message',task['directory']);assert messages==json.loads((s/'business-messages.json').read_text(encoding='utf-8'))
baseline=json.loads((s/'business-artifact.json').read_text(encoding='utf-8'));assert get('session/'+task['sessionID']+'/interactive-artifact/'+baseline['id'],task['directory'])==baseline
facts=json.loads((s/'delivery-facts.json').read_text(encoding='utf-8'));assert get(facts['source']['url'],task['directory'],True)==(s/facts['source']['filename']).read_bytes()
memory=get('experimental/project-memory',task['directory'])
result={'status':'passed','label':label,'oldPublicArtifacts':len(artifacts),'oldSpreadsheets':sum(a['renderer']=='spreadsheet@1' for a in artifacts),'protectedOriginalInputs':inputs,'baselineBusinessSession':'27 messages exact original','baselineSource':'15483 bytes exact original','memory':{key:memory.get(key) for key in ['revision','status','pendingCount','droppedPendingCount']},'artifacts':artifacts}
(s/('public-facts-'+label+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({key:value for key,value in result.items() if key not in ['artifacts','protectedOriginalInputs']},ensure_ascii=False))
