from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json, urllib.request, urllib.error, urllib.parse, uuid
s=Path(__file__).parent
r=json.loads((s/'run166-runtime.json').read_text());assert r['state']=='ready'
directory=str(Path(r['root'])/'memory-handoff-north')
query='?'+urllib.parse.urlencode({'directory':directory})
def request(route,body=None):
    req=urllib.request.Request(r['url']+route+query,data=None if body is None else json.dumps(body,ensure_ascii=False).encode(),headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=300) as response:return json.load(response)
cases={
    'array':{'const':['记录数','带符号净额']},
    'object':{'const':{'source':'settlement-review.csv','currency':None,'description':'按原符号核对'}},
    'mixed':{'enum':['未指定',False,0,None]},
}
def run(item):
    name,marker=item
    target=s/(name+'-task.json');assert not target.exists()
    session=request('session',{'kind':'assistant','title':'有限复合值结算交接-'+name,'metadata':{'conversation':{'experience':'work','surface':'right-sidebar'},'configOverlay':{'model':'openai/gpt-6.1-sol'}}})
    properties={'source':{'type':'string'},'recordCount':{'type':'integer'},'netAmount':{'type':'number'},'marker':marker}
    schema={'type':'object','properties':properties,'required':list(properties),'additionalProperties':False}
    prompt='请只读当前项目settlement-review.csv，逐行核对记录数与带符号金额总和，退款保留负号，零金额样品计数，不推断币种或利润。按给定结构交接：source填写真实文件名，recordCount和netAmount填写实算数值；marker遵守给定有限域。'+('marker选null。' if name=='mixed' else '')+'本人直接完成，不改文件、不执行脚本、不创建任务/专家团、不委派。'
    body={'messageID':'msg_'+str(uuid.uuid4()),'model':{'providerID':'openai','modelID':'gpt-6.1-sol'},'format':{'type':'json_schema','schema':schema,'retryCount':2},'parts':[{'type':'text','text':prompt}]}
    task={'case':name,'sessionID':session['id'],'directory':directory,'request':body,'uiURL':r['uiURL']+'?'+urllib.parse.urlencode({'sessionID':session['id'],'sessionKind':'conversation','directory':directory,'experience':'work'})}
    target.write_text(json.dumps(task,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'case':name,'sessionID':session['id'],'phase':'submitted'}),flush=True)
    try:
        result=request('session/'+session['id']+'/message',body)
        status=200
    except urllib.error.HTTPError as error:
        status=error.code;raw=error.read().decode('utf-8')
        try:result=json.loads(raw)
        except json.JSONDecodeError:result={'body':raw}
    (s/(name+'-response.json')).write_text(json.dumps({'httpStatus':status,'response':result},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    messages=request('session/'+session['id']+'/message')
    (s/(name+'-messages.json')).write_text(json.dumps(messages,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    info=messages[-1]['info']
    error=info.get('error')
    print(json.dumps({'case':name,'httpStatus':status,'finish':info.get('finish'),'structured':info.get('structured'),'errorName':error.get('name') if error else None,'errorSummary':error.get('data',{}).get('message','')[:550] if error else None},ensure_ascii=False),flush=True)
with ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(run,cases.items()))
