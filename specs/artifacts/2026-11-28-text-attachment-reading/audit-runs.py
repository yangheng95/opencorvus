from pathlib import Path
import json,sys
s=Path(__file__).parent
for label in sys.argv[1:]:
 r=json.loads((s/(label+'-runtime.json')).read_text(encoding='utf-8'));rows=json.loads(Path(r['auditPath']).read_text(encoding='utf-8'))
 facts=[]
 for x in rows:
  q=x['response_reader'];assert x['model']=='gpt-6.1-sol' and x['streaming'] is True and x['status']==200 and q['state']=='settled' and q['terminal']['kind']=='eof'
  facts.append({'model':x['model'],'streaming':True,'status':200,'reader':'settled','terminal':'eof'})
 assert r['state']=='exited' and r['exitCode']==0 and r['providerDrain']['allReadersSettled'] and r['credentialCleanup']=='passed'
 print(json.dumps({'label':label,'requests':len(facts),'state':r['state'],'streams':facts}))
