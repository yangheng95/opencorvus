from pathlib import Path
from decimal import Decimal
import json, sqlite3, urllib.request, urllib.parse, csv, io
s=Path(__file__).parent
def read(name):return json.loads((s/name).read_text(encoding='utf-8'))
r=read('run165-runtime.json');task=read('pdf-review-task.json');old=read('original-project-rows.json')
def get(route,directory=None,raw=False):
    url=r['url'].rstrip('/')+'/'+route.lstrip('/')
    if directory:url+='?'+urllib.parse.urlencode({'directory':directory})
    with urllib.request.urlopen(url,timeout=30) as response:
        assert response.status==200
        return response.read() if raw else json.load(response)
c=sqlite3.connect((Path(r['root'])/'runtime/data/opencorvus.db').as_uri()+'?mode=ro',uri=True)
message_sessions={row['id']:row['session_id'] for row in old['message']}
artifacts=[]
for row in old['interactive_artifact']:
    session=message_sessions[row['message_id']]
    directory=c.execute('SELECT directory FROM session WHERE id=?',(session,)).fetchone()[0]
    artifact=get('session/'+session+'/interactive-artifact/'+row['id'],directory)
    assert artifact['payload']==json.loads(row['payload'])
    artifacts.append({'id':row['id'],'renderer':artifact['payload']['renderer'],'publicPayload':'exact original'})
inputs=[]
for side in ['north','south']:
    directory=read('business-'+side+'.json')['directory']
    for file in (s/'business-inputs'/side).iterdir():
        assert file.read_bytes()==(Path(directory)/file.name).read_bytes()
        inputs.append({'side':side,'name':file.name,'bytes':file.stat().st_size})
messages=get('session/'+task['sessionID']+'/message',task['directory'])
(s/'pdf-review-messages.json').write_text(json.dumps(messages,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
assistant=messages[-1];assert assistant['info']['finish']=='stop'
assert assistant['info']['id']==read('pdf-review-response.json')['info']['id']
text='\n'.join(part['text'] for part in assistant['parts'] if part['type']=='text')
(s/'pdf-review-answer.md').write_text(text,encoding='utf-8')
source=list(csv.DictReader(io.StringIO((s/'business-inputs/north/settlement-review.csv').read_text(encoding='utf-8'))))
groups={}
for row in source:
    group=groups.setdefault(row['类型'],{'count':0,'net':Decimal(0)})
    group['count']+=1;group['net']+=Decimal(row['金额'])
table=[]
for line in text.splitlines():
    if not line.strip().startswith('|'):continue
    cells=[cell.strip().replace('**','').replace('−','-').replace('＋','+') for cell in line.strip().strip('|').split('|')]
    if cells[0] in groups or cells[0]=='全量合计':table.append(cells)
expected={kind:(group['count'],group['net']) for kind,group in groups.items()}
total=sum((Decimal(row['金额']) for row in source),Decimal(0))
expected['全量合计']=(len(source),total)
actual={row[0]:(int(row[-2]),Decimal(row[-1])) for row in table}
assert actual==expected,(actual,expected)
raw=get(task['attachment']['url'],raw=True)
assert raw==(Path(task['directory'])/'整页阅读结算合册.pdf').read_bytes()
(s/'reviewed-original.pdf').write_bytes(raw)
memory=get('experimental/project-memory',task['directory'])
facts={'status':'passed','oldPublicArtifacts':len(artifacts),'oldSpreadsheets':sum(x['renderer']=='spreadsheet@1' for x in artifacts),'artifacts':artifacts,'protectedBusinessInputs':inputs,'realTask':{'sessionID':task['sessionID'],'assistantID':assistant['info']['id'],'finish':'stop','uploadedAttachmentBytes':len(raw),'canonicalAttachment':'exact original','sourceRows':len(source),'groups':groups,'netAmount':total,'answerTable':'matches independent Decimal calculation'},'projectMemory':{key:memory.get(key) for key in ['revision','status','pendingCount','droppedPendingCount']}}
(s/'live-data-facts.json').write_text(json.dumps(facts,ensure_ascii=False,indent=2,default=str)+'\n',encoding='utf-8')
print(json.dumps({key:value for key,value in facts.items() if key not in ['artifacts','protectedBusinessInputs']},ensure_ascii=False,default=str))
