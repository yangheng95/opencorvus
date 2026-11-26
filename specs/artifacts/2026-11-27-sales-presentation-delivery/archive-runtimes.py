from pathlib import Path
from collections import Counter
import json,socket,urllib.parse
s=Path(__file__).parent;out=Path('D:/myhexin-local/opencorvus/specs/artifacts/2026-11-27-sales-presentation-delivery')
summary=[]
for label in ['run19','run21']:
 r=json.loads((s/(label+'-runtime.json')).read_text())
 p=json.loads((s/(label+'-process.json')).read_text())
 assert r['state']==p['state']=='exited' and r['exitCode']==p['exitCode']==0
 assert r['credentialCleanup']=='passed' and r['stopReason']=='owned_stop_request'
 assert r['preflight']['credential']=='usable' and r['preflight']['catalog']=='projected' and r['preflight']['actualModel']=='gpt-6.1-sol' and r['preflight']['streaming'] is True
 for name in ['auth.json','models.json']:assert not (Path(r['root'])/'runtime/data'/name).exists()
 u=urllib.parse.urlsplit(r['url'])
 with socket.socket() as conn:
  conn.settimeout(1);assert conn.connect_ex((u.hostname,u.port))!=0
 audit=json.loads(Path(r['auditPath']).read_text());assert len(audit)==r['requests']
 for x in audit:
  assert x['model']=='gpt-6.1-sol' and x['streaming'] is True and x['status']==200
  reader=x['response_reader'];assert reader['state']=='settled' and reader['terminal']['kind']=='eof'
  stream=reader['requestContext']['streamRequest'];assert stream['providerID']=='openai' and stream['modelID']==stream['apiModelID']=='gpt-6.1-sol'
 counts=Counter(x['response_reader']['requestContext']['sessionID'] for x in audit)
 pre=counts[r['preflight']['sessionID']];business=counts['ses_hXaoxvf6sXUeNwnhrZTA']
 assert pre==2 and pre+business==len(audit)
 for name,value in [(label+'-runtime.json',r),(label+'-model-request-audit.json',audit),(label+'-process.json',p)]:
  (out/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 summary.append({'label':label,'requests':len(audit),'preflightRequests':pre,'businessRequests':business,'exactStreamingSolHTTP200SettledEOF':True,'originalHandleJoinedExitCode':0,'copiesRetired':True,'closedPort':u.port})
failed=json.loads((s/'run20-runtime.json').read_text());process=json.loads((s/'run20-process.json').read_text())
assert failed['state']==process['state']=='exited' and failed['exitCode']==process['exitCode']==1 and failed['requests']==0 and failed['credentialCleanup']=='passed'
assert 'Work Artifact package digest mismatch' in failed['error']
for name,value in [('run20-runtime.json',failed),('run20-process.json',process)]:
 (out/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
total=sum(x['requests'] for x in summary);business=sum(x['businessRequests'] for x in summary)
(out/'runtime-summary.json').write_text(json.dumps({'status':'passed','totalRequests':total,'businessRequests':business,'preflightRequests':total-business,'runs':summary,'failedRun':{'label':'run20','requests':0,'exitCode':1,'reason':'Fixed runtime package rejected the auto-updated probe executable before model preflight; original vendor executable restored, manifest unchanged, original qualification rerun.'}},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'passed','totalRequests':total,'businessRequests':business,'preflightRequests':total-business,'normalRuns':len(summary),'retainedFailedRuns':1}))
