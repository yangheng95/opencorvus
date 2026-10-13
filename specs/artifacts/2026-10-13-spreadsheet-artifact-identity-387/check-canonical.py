from pathlib import Path
import json, sqlite3, sys
root=Path('.tmp-spreadsheet-artifact-identity-387').resolve()
chat=json.loads((root/'chat-accepted.json').read_text(encoding='utf8'))
db=sqlite3.connect((root/'provider-before/runtime/data/opencorvus.db').as_uri()+'?mode=ro',uri=True)
db.row_factory=sqlite3.Row
db.execute('BEGIN')
try:
    artifacts=[{**dict(r),'payload':json.loads(r['payload'])} for r in db.execute('SELECT a.id,a.message_id,a.payload FROM interactive_artifact a JOIN message m ON a.message_id=m.id WHERE m.session_id=? ORDER BY a.id',(chat['session']['id'],))]
    messages=[{**dict(r),'data':json.loads(r['data'])} for r in db.execute('SELECT id,data FROM message WHERE session_id=? ORDER BY time_created,id',(chat['session']['id'],))]
    tools=[{**dict(r),'request':json.loads(r['request']),'outcome':json.loads(r['outcome'])} for r in db.execute('SELECT r.id,r.message_id,r.data request,o.data outcome FROM tool_part_request r JOIN tool_part_outcome o ON r.id=o.request_part_id JOIN message m ON m.id=r.message_id WHERE m.session_id=?',(chat['session']['id'],))]
finally:
    db.rollback();db.close()
finals=[m for m in messages if m['data'].get('finish')=='stop' and m['data'].get('parentID')==chat['messageID']]
if '--observe' in sys.argv:
    print(json.dumps({'artifacts':len(artifacts),'finals':len(finals),'tools':[{'tool':t['request']['tool'],'outcome':t['outcome'].get('outcome')}for t in tools]}));sys.exit(0)
assert len(artifacts)==1
payload=artifacts[0]['payload']
assert payload['renderer']=='spreadsheet@1' and payload['title']=='Desk budget' and payload['editable'] is True
assert len(payload['sheets'])==1
sheet=payload['sheets'][0]
assert sheet['name']=='清单' and sheet['rowCount']==20 and sheet['columnCount']==6 and sheet['frozenRows']==1
cells={c['address']:c for c in sheet['cells']}
for address,value in {'A1':'Item','B1':'Quantity','A2':'Notebook','B2':7,'A3':'Pen','B3':5,'A4':'Total'}.items():
    assert cells[address]['value']==value
assert cells['B4']['formula']=='=SUM(B2:B3)' and cells['B4']['computed']==12
publication=[t for t in tools if t['message_id']==artifacts[0]['message_id'] and t['request']['tool']=='publish_interactive_artifact' and t['outcome'].get('metadata',{}).get('artifactID')==artifacts[0]['id']]
assert len(publication)==1 and publication[0]['outcome']['outcome']=='completed'
assert len(finals)==1 and finals[0]['data']['modelID']=='gpt-6.1-sol'
canonical={'sessionID':chat['session']['id'],'artifacts':artifacts,'messages':messages,'tools':tools}
(root/'canonical.json').write_text(json.dumps(canonical,ensure_ascii=False,indent=2),encoding='utf8')
result={'passed':True,'sessionID':chat['session']['id'],'artifactID':artifacts[0]['id'],'renderer':payload['renderer'],'publication':'actual message-owned completed tool result','finalModel':'gpt-6.1-sol','boundary':'Real canonical publication/data; streaming audit, desktop UI and physical closure verified separately'}
(root/'canonical-check.json').write_text(json.dumps(result,indent=2),encoding='utf8');print(json.dumps(result))
