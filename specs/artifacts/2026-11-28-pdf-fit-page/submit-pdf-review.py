from pathlib import Path
import json, urllib.request, urllib.parse, uuid
s=Path(__file__).parent
r=json.loads((s/'run165-runtime.json').read_text())
assert r['state']=='ready'
assert not (s/'pdf-review-task.json').exists()
directory=str(Path(r['root'])/'memory-handoff-north')
def request(route,body=None,mime='application/json',params=None):
    query={'directory':directory,**(params or {})}
    url=r['url']+route+'?'+urllib.parse.urlencode(query)
    if body is not None and not isinstance(body,bytes): body=json.dumps(body,ensure_ascii=False).encode()
    req=urllib.request.Request(url,data=body,headers={'Content-Type':mime})
    with urllib.request.urlopen(req,timeout=300) as response:
        assert response.status==200
        return json.load(response)
reference=request('attachment',(Path(directory)/'整页阅读结算合册.pdf').read_bytes(),'application/pdf',{'filename':'整页阅读结算合册.pdf'})
session=request('session',{'kind':'assistant','title':'结算合册附件核对','metadata':{'conversation':{'experience':'work','surface':'right-sidebar'},'configOverlay':{'model':'openai/gpt-6.1-sol'}}})
body={'messageID':'msg_'+str(uuid.uuid4()),'model':{'providerID':'openai','modelID':'gpt-6.1-sol'},'parts':[
    {'type':'text','text':'请阅读所附结算合册的最后三页，用中文给接班同事核对：各类型记录数与带符号净额、全量合计，以及退款负数和零金额样品应如何计入。请说明缺少币种和成本时能得出什么结论。仅读取附件，直接回复，不修改文件、不创建任务或专家团、不委派其他执行者。'},
    {'type':'file','mime':'application/pdf','filename':reference['filename'],'url':reference['url']}]}
task={'sessionID':session['id'],'directory':directory,'request':body,'attachment':reference,'uiURL':r['uiURL']+'?'+urllib.parse.urlencode({'sessionID':session['id'],'sessionKind':'conversation','directory':directory,'experience':'work'})}
(s/'pdf-review-task.json').write_text(json.dumps(task,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'sessionID':session['id'],'phase':'submitted'},ensure_ascii=False),flush=True)
response=request('session/'+session['id']+'/message',body)
(s/'pdf-review-response.json').write_text(json.dumps(response,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'sessionID':session['id'],'finish':response['info'].get('finish'),'error':response['info'].get('error',{}).get('name')},ensure_ascii=False),flush=True)
