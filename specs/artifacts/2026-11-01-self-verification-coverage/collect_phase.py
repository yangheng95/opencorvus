"""Read closed native trial facts and original publication resources; no model calls."""
from collections import Counter
import hashlib
import json
from pathlib import Path
import sqlite3
import sys

root=Path(__file__).resolve().parent;phase=sys.argv[1];live=root/phase
report=json.loads((live/'result.json').read_text(encoding='utf-8'))
assert report['status'] in ['completed','execution_failed']
db=sqlite3.connect('file:'+str(live/'storage/opencorvus.db')+'?mode=ro',uri=True)
requests=report['requests'];result=dict(phase=phase,status=report['status'],cleanup=report['cleanup'],provider=dict(requests=len(requests),models=dict(Counter(r.get('model') for r in requests)),streaming=dict(Counter(str(r.get('streaming')) for r in requests)),http=dict(Counter(str(r.get('status')) for r in requests)),probes={p:sum(bool(probe.get('matches')) for r in requests for probe in r.get('input_evidence',{}).get('probes',[]) if probe['id']==p) for p in ['shared-verification-policy','completion-summary-schema','patch-operation-contract']}),runs=[])
for row in report['cases']:
    kind=row['kind'];t=json.loads((live/(kind+'-trace.json')).read_text(encoding='utf-8'))
    parts=t.get('tools')
    if parts is None:parts=[p for m in t['messages'] for p in m.get('parts',[]) if p.get('type')=='tool']
    sessions=[s['id'] for s in t.get('sessions',[])]
    if not sessions:sessions=sorted({m['info']['sessionID'] for m in t['messages']})
    placeholders=','.join('?' for _ in sessions)
    rows=db.execute('SELECT r.id,m.session_id,r.data,o.id,o.data FROM tool_part_request r JOIN message m ON m.id=r.message_id LEFT JOIN tool_part_outcome o ON o.request_part_id=r.id WHERE m.session_id IN ('+placeholders+') ORDER BY r.time_created,r.id',sessions).fetchall()
    facts=[dict(requestID=r[0],sessionID=r[1],request=json.loads(r[2]),outcomeID=r[3],outcome=json.loads(r[4]) if r[4] else None) for r in rows]
    (root/(phase+'-'+kind+'-canonical.json')).write_text(json.dumps(facts,ensure_ascii=False,indent=2),encoding='utf-8')
    issues=[];bindings=[];completed=[]
    project=live/(kind+'-delivered')
    for p in parts:
        s=p.get('state',{});exit_code=s.get('metadata',{}).get('exit')
        if s.get('status')=='error' or type(exit_code) is int and exit_code!=0:issues.append(dict(part=p['id'],tool=p['tool'],input=s.get('input'),failure=s.get('failure'),exit=exit_code,output=s.get('output')))
        if p['tool']=='manage_task':completed.append(dict(part=p['id'],input=s.get('input'),output=s.get('output')))
        if p['tool']=='artifact_snapshot' and s.get('status')=='completed':
            published=json.loads(s['output'])
            for locator in published['locators']:
                resource=locator.get('locator',{}).get('ref')
                if not resource or resource.get('path')!='deliverable.pyz':continue
                snapshot=resource['snapshot'];blob=project/'.opencorvus'/'.r'/'tasks'/snapshot['task_id']/'artifacts'/'snapshots'/snapshot['snapshot_id']/resource['tree']/resource['path'];data=blob.read_bytes()
                bindings.append(dict(snapshot=snapshot,resource=resource,relativeBlob=str(blob.relative_to(project)),exactProgramBytesEqual=data==(project/'deliverable.pyz').read_bytes(),immutableResourceIntegrity=len(data)==resource['bytes'] and hashlib.sha256(data).hexdigest()==resource['sha256']))
    run={k:row.get(k) for k in ['kind','entry','taskID','sessionID','startedAt','settledAt','requestsBefore','requestsAfter','lifecycle','grade']}
    run.update(canonical=dict(requests=len(facts),outcomes=sum(f['outcome'] is not None for f in facts),states=dict(Counter(f['outcome']['outcome'] if f['outcome'] else 'pending' for f in facts))),toolStates=dict(Counter(p.get('state',{}).get('status') for p in parts)),issues=issues,publishedProgramBindings=bindings,completionTools=completed)
    result['runs'].append(run)
db.close()
(root/(phase+'-observed.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({**{k:v for k,v in result.items() if k!='runs'},'runs':[{k:v for k,v in row.items() if k not in ['issues','grade','completionTools']}|dict(processFaults=len(row['issues']),externalCasesAgree=row['grade']['passed']) for row in result['runs']]},ensure_ascii=True,indent=2))
