from pathlib import Path
import json,urllib.request,urllib.parse,uuid
s=Path(__file__).parent;r=json.loads((s/'run168-runtime.json').read_text());assert r['state']=='ready'
directory=str(Path(r['root'])/'memory-handoff-north');query='?'+urllib.parse.urlencode({'directory':directory})
def post(route,body):
    req=urllib.request.Request(r['url']+route+query,data=json.dumps(body,ensure_ascii=False).encode(),headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=300) as response:return json.load(response)
assert not (s/'cancellation-task.json').exists()
session=post('session',{'kind':'assistant','title':'结算说明停止操作复核','metadata':{'conversation':{'experience':'work','surface':'right-sidebar'},'configOverlay':{'model':'openai/gpt-6.1-sol'}}})
body={'messageID':'msg_'+str(uuid.uuid4()),'model':{'providerID':'openai','modelID':'gpt-6.1-sol'},'parts':[{'type':'text','text':'请只读当前项目settlement-review.csv，为接班同事写一份详细的逐条结算核对说明，说明每条记录、分类记录数、各类带符号净额与全量合计的计算过程，以及币种和成本缺失时的结论边界。本人直接完成，不改文件，不执行脚本，不创建任务或专家团，不委派。'}]}
task={'sessionID':session['id'],'directory':directory,'request':body,'uiURL':r['uiURL']+'?'+urllib.parse.urlencode({'sessionID':session['id'],'sessionKind':'conversation','directory':directory,'experience':'work'})}
(s/'cancellation-task.json').write_text(json.dumps(task,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'sessionID':session['id'],'phase':'submitted'}),flush=True)
response=post('session/'+session['id']+'/message',body)
(s/'cancellation-response.json').write_text(json.dumps(response,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'finish':response['info'].get('finish'),'error':response['info'].get('error')},ensure_ascii=False),flush=True)
