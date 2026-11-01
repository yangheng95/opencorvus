from collections import Counter
import hashlib
import json
from pathlib import Path
import re

root=Path(__file__).resolve().parent
live=root/'live'
report=json.loads((live/'result.json').read_text(encoding='utf-8'))
summary={k:report.get(k) for k in ['phase','status','error','cleanup','consumerScope','registeredCasesAgree','startedAt','endedAt']}
requests=report.get('requests',[])
summary['provider']=dict(requests=len(requests),models=dict(Counter(r.get('model') for r in requests)),streaming=dict(Counter(str(r.get('streaming')) for r in requests)),http=dict(Counter(str(r.get('status')) for r in requests)),probes={name:sum(bool(p.get('matches')) for r in requests for p in r.get('input_evidence',{}).get('probes',[]) if p.get('id')==name) for name in ['shared-verification-policy','completion-summary-schema','patch-operation-contract']},errors=[dict(index=i,status=r.get('status'),reader=r.get('response_reader')) for i,r in enumerate(requests) if r.get('status')!=200])
summary['runs']=[]
for row in report.get('cases',[]):
    kind=row['kind'];trace=json.loads((live/(kind+'-trace.json')).read_text(encoding='utf-8'))
    parts=trace.get('tools')
    if parts is None:parts=[p for m in trace.get('messages',[]) if isinstance(m,dict) for p in m.get('parts',[]) if p.get('type')=='tool']
    issues=[]
    for p in parts:
        s=p.get('state',{});code=s.get('metadata',{}).get('exit')
        if s.get('status')=='error' or type(code) is int and code!=0:issues.append(dict(part=p['id'],tool=p['tool'],input=s.get('input'),failure=s.get('failure'),exit=code,output=s.get('output'),time=s.get('time')))
    item={k:row.get(k) for k in ['kind','entry','taskID','sessionID','startedAt','settledAt','requestsBefore','requestsAfter','lifecycle']}
    item.update(tool_count=len(parts),tool_states=dict(Counter(p.get('state',{}).get('status') for p in parts)),issues=issues,grade=row.get('grade'))
    delivered=live/(kind+'-delivered');bindings=[]
    if delivered.is_dir():
        def strings(value):
            if isinstance(value,str):yield value
            elif isinstance(value,dict):
                for value in value.values():yield from strings(value)
            elif isinstance(value,list):
                for value in value:yield from strings(value)
        refs=set()
        for value in strings(trace):refs.update(re.findall(r'/attachment/[^/\s"<>]+/[^\s"<>?]+',value))
        for ref in refs:
            name=ref.rsplit('/',1)[-1]
            for p in (delivered/'.opencorvus').rglob(name):
                if p.is_file() and p.read_bytes()==(delivered/'deliverable.pyz').read_bytes():bindings.append(dict(attachmentUrl=ref,blobWithinSealedProject=str(p.relative_to(delivered)),exactProgramBytesEqual=True,immutableAttachmentIntegrity=hashlib.sha256(p.read_bytes()).hexdigest()==name.split('.')[0]))
        for part in parts:
            if part['tool']!='artifact_snapshot' or part.get('state',{}).get('status')!='completed':continue
            published=json.loads(part['state']['output'])
            for locator in published['locators']:
                resource=locator.get('locator',{}).get('ref')
                if not resource or resource.get('path')!='deliverable.pyz':continue
                snapshot=resource['snapshot']
                blob=delivered/'.opencorvus'/'.r'/'tasks'/snapshot['task_id']/'artifacts'/'snapshots'/snapshot['snapshot_id']/resource['tree']/resource['path']
                data=blob.read_bytes()
                bindings.append(dict(snapshot=snapshot,resource=resource['path'],blobWithinSealedProject=str(blob.relative_to(delivered)),exactProgramBytesEqual=data==(delivered/'deliverable.pyz').read_bytes(),immutableResourceIntegrity=len(data)==resource['bytes'] and hashlib.sha256(data).hexdigest()==resource['sha256']))
    item['published_program_bindings']=bindings
    summary['runs'].append(item)
(root/'observed-runs.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({**{k:v for k,v in summary.items() if k!='runs'},'runs':[{k:v for k,v in r.items() if k not in ['issues','grade']}|dict(processFaults=len(r['issues']),registeredCasesAgree=r['grade']['passed'] if r['grade'] else None) for r in summary['runs']]},ensure_ascii=False,indent=2))
