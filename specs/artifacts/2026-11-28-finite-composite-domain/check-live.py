from pathlib import Path
from decimal import Decimal
import json,sqlite3,urllib.request,urllib.parse,csv,io
s=Path(__file__).parent
def read(name):return json.loads((s/name).read_text(encoding='utf-8'))
r=read('run168-runtime.json');old=read('original-project-rows.json')
def get(route,directory):
    with urllib.request.urlopen(r['url']+route+'?'+urllib.parse.urlencode({'directory':directory}),timeout=30) as response:
        assert response.status==200
        return json.load(response)
cases=[]
source=list(csv.DictReader(io.StringIO((s/'business-inputs/north/settlement-review.csv').read_text(encoding='utf-8'))))
net=sum((Decimal(row['金额']) for row in source),Decimal(0))
for name in ['array','object','mixed']:
    before=read(name+'-task.json');after=read('candidate-'+name+'-task.json')
    assert {k:v for k,v in before['request'].items() if k!='messageID'}=={k:v for k,v in after['request'].items() if k!='messageID'}
    assert get('session/'+before['sessionID']+'/message',before['directory'])==read(name+'-messages.json')
    messages=get('session/'+after['sessionID']+'/message',after['directory']);assert messages==read('candidate-'+name+'-messages.json')
    original=read(name+'-messages.json')[-1]['info'];candidate=messages[-1]['info']
    if name=='mixed':
        expected={'source':'settlement-review.csv','recordCount':len(source),'netAmount':float(net),'marker':None}
        assert original['finish']==candidate['finish']=='stop'
        assert original['structured']==candidate['structured']==expected
        cases.append({'case':name,'beforeSession':before['sessionID'],'afterSession':after['sessionID'],'requestModelFormatParts':'exact original','finish':'stop','structured':expected})
    else:
        assert original['finish']==candidate['finish']=='error'
        assert original['error']['name']=='UnknownError' and candidate['error']['name']=='APIError'
        prefix='AI_TypeValidationError: Type validation failed: Value: '
        message=original['error']['data']['message'];assert message.startswith(prefix)
        packet,_=json.JSONDecoder().raw_decode(message[len(prefix):])
        error=candidate['error']['data'];assert json.loads(error['responseBody'])==packet
        assert error=={'message':packet['error']['message'],'isRetryable':False,'responseBody':error['responseBody']}
        cases.append({'case':name,'beforeSession':before['sessionID'],'afterSession':after['sessionID'],'requestModelFormatParts':'exact original','finish':'error','beforeError':'UnknownError','afterError':'APIError','originalProviderPacket':packet,'message':error['message'],'isRetryable':False,'rawPacketProvenance':'original SDK serialized value parsed for investigation only;canonical packet equals complete candidate responseBody'})
cancel=read('cancellation-task.json');cancelMessages=get('session/'+cancel['sessionID']+'/message',cancel['directory'])
(s/'cancellation-messages.json').write_text(json.dumps(cancelMessages,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
info=cancelMessages[-1]['info'];assert info['finish']=='error' and info['error']['name']=='MessageAbortedError'
assert info['error']==read('cancellation-response.json')['info']['error']
origin=info['error']['data']['cancellation'];assert origin['actor']=='right_sidebar_conversation' and origin['source']=='right_sidebar.abort' and origin['targetSessionID']==cancel['sessionID']
text='\n'.join(p['text'] for p in cancelMessages[-1]['parts'] if p['type']=='text');assert len(text)>0
c=sqlite3.connect((Path(r['root'])/'runtime/data/opencorvus.db').as_uri()+'?mode=ro',uri=True)
sessions={row['id']:row['session_id'] for row in old['message']};artifacts=[]
for row in old['interactive_artifact']:
    session=sessions[row['message_id']];directory=c.execute('SELECT directory FROM session WHERE id=?',(session,)).fetchone()[0]
    artifact=get('session/'+session+'/interactive-artifact/'+row['id'],directory);assert artifact['payload']==json.loads(row['payload'])
    artifacts.append({'id':row['id'],'renderer':artifact['payload']['renderer'],'publicPayload':'exact original'})
inputs=[]
for side in ['north','south']:
    directory=read('business-'+side+'.json')['directory']
    for p in (s/'business-inputs'/side).iterdir():
        assert p.read_bytes()==(Path(directory)/p.name).read_bytes();inputs.append({'side':side,'file':p.name,'bytes':p.stat().st_size})
memory=get('experimental/project-memory',cancel['directory'])
result={'status':'passed','caseReplays':cases,'cancellation':{'sessionID':cancel['sessionID'],'assistantID':info['id'],'finish':info['finish'],'error':info['error'],'retainedActualTextCharacters':len(text)},'oldPublicArtifacts':len(artifacts),'oldSpreadsheets':sum(x['renderer']=='spreadsheet@1' for x in artifacts),'artifacts':artifacts,'protectedBusinessInputs':inputs,'sourceRows':len(source),'netAmount':str(net),'projectMemory':{key:memory.get(key) for key in ['revision','status','pendingCount','droppedPendingCount']}}
(s/'live-data-facts.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({key:value for key,value in result.items() if key not in ['caseReplays','artifacts','protectedBusinessInputs']},ensure_ascii=False))
