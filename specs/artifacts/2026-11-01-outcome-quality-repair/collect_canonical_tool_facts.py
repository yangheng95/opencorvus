from collections import Counter
from contextlib import closing
import json
from pathlib import Path
import sqlite3

root=Path(__file__).resolve().parent
rows=[]
for phase,kinds in [('baseline',['coding','task']),('after',['coding','bundle','stock'])]:
    dbpath=next((root/phase/'storage').rglob('*.db'))
    with closing(sqlite3.connect(dbpath.as_uri()+'?mode=ro',uri=True)) as db:
        for kind in kinds:
            trace=json.loads((root/phase/(kind+'-trace.json')).read_text(encoding='utf-8'))
            ids=[s['id'] for s in trace.get('sessions',[])]
            if not ids:
                ids=list({m['info']['sessionID'] for m in trace.get('messages',[]) if isinstance(m,dict) and 'info' in m})
            placeholders=','.join('?' for _ in ids)
            facts=db.execute(f'SELECT r.id,m.session_id,r.data,o.data FROM tool_part_request r JOIN message m ON m.id=r.message_id LEFT JOIN tool_part_outcome o ON o.request_part_id=r.id WHERE m.session_id IN ({placeholders})',ids).fetchall()
            outcomes=[json.loads(row[3]) for row in facts if row[3] is not None]
            rows.append(dict(phase=phase,kind=kind,session_ids=ids,request_count=len(facts),outcome_count=len(outcomes),pending=[r[0] for r in facts if r[3] is None],outcome_keys=list(outcomes[0]) if outcomes else [],outcome_statuses=dict(Counter(o["outcome"] for o in outcomes))))
(root/'canonical-tool-facts.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(rows,ensure_ascii=False,indent=2))
