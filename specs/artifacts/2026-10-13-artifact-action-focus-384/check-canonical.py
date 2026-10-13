from pathlib import Path
import json, sqlite3
root=Path('.tmp-artifact-action-focus-384').resolve()
chat=json.loads((root/'chat-accepted.json').read_text(encoding='utf8'))
input_meta=json.loads((root/'input-metadata.json').read_text(encoding='utf8'))
db=sqlite3.connect((root/'provider-before-02/runtime/data/opencorvus.db').as_uri()+'?mode=ro',uri=True)
db.row_factory=sqlite3.Row
db.execute('BEGIN')
try:
 artifacts=[{**dict(r),'payload':json.loads(r['payload'])} for r in db.execute('SELECT a.id,a.message_id,a.payload FROM interactive_artifact a JOIN message m ON a.message_id=m.id WHERE m.session_id=? ORDER BY a.id',(chat['session']['id'],))]
 messages=[{**dict(r),'data':json.loads(r['data'])} for r in db.execute('SELECT id,data FROM message WHERE session_id=? ORDER BY time_created,id',(chat['session']['id'],))]
 parts=[{**dict(r),'data':json.loads(r['data'])} for r in db.execute('SELECT p.id,p.message_id,p.data FROM part p JOIN message m ON m.id=p.message_id WHERE m.session_id=? ORDER BY p.id',(chat['session']['id'],))]
 tools=[{**dict(r),'request':json.loads(r['request']),'outcome':json.loads(r['outcome'])} for r in db.execute('SELECT r.id,r.message_id,r.data request,o.data outcome FROM tool_part_request r JOIN tool_part_outcome o ON r.id=o.request_part_id JOIN message m ON m.id=r.message_id WHERE m.session_id=?',(chat['session']['id'],))]
 assert len(artifacts)==2
 by_renderer={a['payload']['renderer']:a for a in artifacts}
 file=by_renderer['file-preview@1']['payload']; doc=by_renderer['document@1']['payload']
 assert file['title']=='Reading notes' and file['kind']=='text'
 assert {k:file['source'][k] for k in input_meta}==input_meta
 upload=[p['data'] for p in parts if p['message_id']==chat['messageID'] and p['data'].get('type')=='file']
 assert len(upload)==1 and upload[0]['url']==file['source']['url']
 assert doc['title']=='Desk note' and '原始资料可以先阅读，再复制或下载。' in doc['markdown']
 for a in artifacts:
  matching=[t for t in tools if t['message_id']==a['message_id'] and t['request']['tool']=='publish_interactive_artifact' and t['outcome']['metadata'].get('artifactID')==a['id']]
  assert len(matching)==1 and matching[0]['outcome']['outcome']=='completed'
 finals=[m for m in messages if m['data'].get('finish')=='stop' and m['data'].get('parentID')==chat['messageID']]
 assert len(finals)==1 and finals[0]['data']['modelID']=='gpt-6.1-sol'
 canonical={'sessionID':chat['session']['id'],'artifacts':artifacts,'messages':messages,'parts':parts,'tools':tools}
finally:
 db.rollback();db.close()
audit=json.loads((root/'before-02-live/artifact-action-focus-384-before-02-final-provider-audit.json').read_text(encoding='utf-8-sig'))
for r in audit['requests']:
 assert r['model']=='gpt-6.1-sol' and r['streaming']==True and r['status']==200
 assert r['response_reader']['state']=='settled' and r['response_reader']['terminal']['kind']=='eof'
(root/'canonical-before.json').write_text(json.dumps(canonical,ensure_ascii=False,indent=2),encoding='utf8')
result={'passed':True,'artifactCount':len(artifacts),'toolOutcomes':'Actual message-owned publication results','providerRequests':len(audit['requests']),'model':'gpt-6.1-sol','allStreamsHTTP200EOF':True,'sourceBytes':input_meta['size'],'actualDownloadedBytes':(Path('C:/Users/hengu/Downloads/reading-notes.txt')).stat().st_size,'sessionID':chat['session']['id']}
(root/'canonical-check.json').write_text(json.dumps(result,indent=2),encoding='utf8');print(json.dumps(result))
