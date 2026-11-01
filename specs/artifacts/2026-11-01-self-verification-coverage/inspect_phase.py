import json
from pathlib import Path
import sys

root=Path(__file__).resolve().parent;phase=sys.argv[1];kind=sys.argv[2]
t=json.loads((root/phase/(kind+'-trace.json')).read_text(encoding='utf-8'))
parts=t.get('tools')
if parts is None:parts=[p for m in t['messages'] for p in m.get('parts',[]) if p.get('type')=='tool']
rows=[]
for p in parts:
    s=p.get('state',{})
    if p['tool'] in ['bash','dispatch_agents','manage_task'] or s.get('status')=='error':
        value=s.get('input',{});display=value.get('command',str(value))
        rows.append(dict(id=p['id'],tool=p['tool'],status=s.get('status'),input=value,exit=s.get('metadata',{}).get('exit'),output=s.get('output'),failure=s.get('failure')))
        print(p['id'],p['tool'],str(display)[:190],json.dumps(str(s.get('output'))[-680:],ensure_ascii=True))
(root/(phase+'-'+kind+'-observable.json')).write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
