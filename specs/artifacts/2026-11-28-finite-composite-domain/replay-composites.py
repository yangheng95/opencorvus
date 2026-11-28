from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json, urllib.request, urllib.parse, uuid
s=Path(__file__).parent
r=json.loads((s/'run167-runtime.json').read_text());assert r['state']=='ready'
def replay(name):
    original=json.loads((s/(name+'-task.json')).read_text(encoding='utf-8'))
    query='?'+urllib.parse.urlencode({'directory':original['directory']})
    def request(route,body=None):
        req=urllib.request.Request(r['url']+route+query,data=None if body is None else json.dumps(body,ensure_ascii=False).encode(),headers={'Content-Type':'application/json'})
        with urllib.request.urlopen(req,timeout=300) as response:
            assert response.status==200
            return json.load(response)
    session=request('session',{'kind':'assistant','title':'有限复合值结算交接复验-'+name,'metadata':{'conversation':{'experience':'work','surface':'right-sidebar'},'configOverlay':{'model':'openai/gpt-6.1-sol'}}})
    body=original['request'];body['messageID']='msg_'+str(uuid.uuid4())
    task={**original,'sessionID':session['id'],'request':body,'uiURL':r['uiURL']+'?'+urllib.parse.urlencode({'sessionID':session['id'],'sessionKind':'conversation','directory':original['directory'],'experience':'work'})}
    (s/('candidate-'+name+'-task.json')).write_text(json.dumps(task,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'case':name,'sessionID':session['id'],'phase':'submitted'}),flush=True)
    response=request('session/'+session['id']+'/message',body)
    (s/('candidate-'+name+'-response.json')).write_text(json.dumps(response,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    messages=request('session/'+session['id']+'/message')
    (s/('candidate-'+name+'-messages.json')).write_text(json.dumps(messages,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    info=messages[-1]['info'];error=info.get('error')
    print(json.dumps({'case':name,'finish':info.get('finish'),'structured':info.get('structured'),'errorName':error.get('name') if error else None,'errorSummary':error.get('data',{}).get('message') if error else None},ensure_ascii=False),flush=True)
with ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(replay,['array','object','mixed']))
