"""Read canonical sealed execution facts, then normally dispose only this owned server."""
from pathlib import Path
from collections import Counter
from datetime import datetime,timezone
import json,sqlite3,shutil
R=Path(__file__).parent; OC=R/'opencorvus'; dest=OC/'sealed'
def save(name,v): (dest/name).write_text(json.dumps(v,indent=2,default=str)+'\n',encoding='utf-8')
status=json.loads((R/'status-20261101T1205.json').read_text(encoding='utf-8'))
sessions={status['sessionInvocationTopology']['rootSessionID'],*[n['sessionID'] for n in status['sessionInvocationTopology']['nodes']]}
c=sqlite3.connect((dest/'original-task.sqlite').as_uri()+'?mode=ro',uri=True);c.row_factory=sqlite3.Row
requests=[]
for row in c.execute('select r.*,m.session_id from tool_part_request r join message m on r.message_id=m.id order by r.time_created'):
    d=dict(row);d['data']=json.loads(d['data']);requests.append(d)
outcomes=[]
for row in c.execute('select * from tool_part_outcome order by time_created'):
    d=dict(row);d['data']=json.loads(d['data']);outcomes.append(d)
by_request={x['request_part_id']:x for x in outcomes}
owned=[x for x in requests if x['session_id'] in sessions]
pending=[x['id'] for x in owned if x['id'] not in by_request]
if pending:raise RuntimeError('Task tool requests not terminal:'+str(pending))
save('tool-requests.json',requests);save('tool-outcomes.json',outcomes)
usage=[dict(x) for x in c.execute('select * from provider_usage_event order by occurred_at')];c.close()
save('recorded-usage.json',usage)
audit=max((OC/'evidence/provider-audit').glob('*.json'),key=lambda p:p.stat().st_mtime)
shutil.copyfile(audit,dest/'actual-provider-audit.json')
a=json.loads(audit.read_text(encoding='utf-8'))
summary=dict(observed_at=datetime.now(timezone.utc).isoformat(),task_id=status['taskID'],lifecycle=status['lifecycleStatus'],activity=status['activity'],sessions=sorted(sessions),tool_requests_all=len(requests),tool_outcomes_all=len(outcomes),task_requests=len(owned),task_outcomes=len(owned)-len(pending),task_pending=pending,outcome_counts=dict(Counter(by_request[x['id']]['data']['outcome'] for x in owned)),actual_requests=len(a['requests']),actual_request_model_counts=dict(Counter(x['model'] for x in a['requests'])),actual_request_streaming_counts=dict(Counter(str(x['streaming']) for x in a['requests'])),actual_request_http_counts=dict(Counter(str(x['status']) for x in a['requests'])),usage={})
fields=['input_tokens','output_tokens','reasoning_tokens','cache_read_tokens','cache_write_tokens','total_tokens','cost_usd']
for key,rows in [('all_recorded',usage),('task_lineage',[x for x in usage if x['session_id'] in sessions]),('other_preflight',[x for x in usage if x['session_id'] not in sessions])]:
    summary['usage'][key]=dict(events=len(rows),**{f:sum(x[f] for x in rows) for f in fields})
summary['scope']='Provider usage events are recorded accounting, not an invoice or effective activity hours. Internal cost0 does not establish external free use. Codex actual model/usage unknown; no same-model/resource causal ranking.'
save('execution-summary.json',summary)
if status['lifecycleStatus']!='completed' or status['activity']['running']!=0:raise RuntimeError('Task still active')
(OC/'stop').write_text('Normal disposal after original Task/occurrences/tools settled and complete original project/SQLite retained.\n',encoding='utf-8')
print(json.dumps(summary,indent=2))
