"""Read original R06 facts without model reasoning or any new model execution."""
from datetime import datetime,timezone
import json
from pathlib import Path
import subprocess

repo=Path('D:/myhexin-local/opencorvus')
root=Path(__file__).resolve().parent
root.mkdir(parents=True,exist_ok=True)
original=Path('D:/opencorvus-benchmark-runs/contract-domain-repair-e2e-20261101')
trace=json.loads((original/'live/bundle-trace.json').read_text(encoding='utf-8'))
texts=[]
for p in trace['parts']:
    d=p['data']
    if d.get('type')=='text':texts.append(dict(id=p['id'],message=p['message_id'],text=d.get('text')))
tools=[]
for p in trace['tools']:
    state=p.get('state',{})
    tools.append(dict(id=p['id'],tool=p['tool'],call=p.get('callID'),input=state.get('input'),status=state.get('status'),output=state.get('output'),failure=state.get('failure'),time=state.get('time')))
facts=dict(readAt=datetime.now(timezone.utc).isoformat(),text=texts,tools=tools)
(root/'original-r06-observable-facts.json').write_text(json.dumps(facts,ensure_ascii=False,indent=2),encoding='utf-8')
for args,name in [(['status','--short'],'status-before.log'),(['ls-files','--stage','-z'],'index-before.bin'),(['diff','--cached','--binary'],'foreign-staged-before.patch')]:
    (root/name).write_bytes(subprocess.check_output(['git',*args],cwd=repo))
summary=dict(texts=texts[1:],tools=[dict(id=p['id'],tool=p['tool'],input=p['input'],output=p['output']) for p in tools if p['tool']=='bash'])
(root/'original-r06-self-verification.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(texts=texts[1:],bash=[dict(id=p['id'],input=p['input'],output=str(p['output'])[-500:]) for p in tools if p['tool']=='bash']),ensure_ascii=False,indent=2))
