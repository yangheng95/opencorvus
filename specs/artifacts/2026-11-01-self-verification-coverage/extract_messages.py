import json
from pathlib import Path
import sys

root=Path(__file__).resolve().parent;phase=sys.argv[1];kind=sys.argv[2]
t=json.loads((root/phase/(kind+'-trace.json')).read_text(encoding='utf-8'))
rows=[]
if 'parts' in t:
    messages={m['id']:m for m in t['messages']}
    for p in t['parts']:
        if p['data'].get('type')=='text':
            m=messages[p['message_id']]
            rows.append(dict(part=p['id'],message=p['message_id'],session=m['session_id'],role=m['data'].get('role'),text=p['data']['text']))
else:
    for m in t['messages']:
        for p in m.get('parts',[]):
            if p.get('type')=='text':rows.append(dict(part=p['id'],message=m['info']['id'],session=m['info']['sessionID'],role=m['info']['role'],text=p['text']))
(root/(phase+'-'+kind+'-messages.json')).write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
for row in rows:
    if row['role']=='assistant':print(row['part'],row['session'],json.dumps(row['text'][-1900:],ensure_ascii=True))
