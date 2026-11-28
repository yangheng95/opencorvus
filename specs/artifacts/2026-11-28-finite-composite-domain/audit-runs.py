from pathlib import Path
import json,sys
s=Path(__file__).parent
for label in sys.argv[1:]:
 r=json.loads((s/(label+'-runtime.json')).read_text(encoding='utf-8'));rows=json.loads(Path(r['auditPath']).read_text(encoding='utf-8'))
 facts=[]
 for x in rows:
  q=x['response_reader'];assert x['model']=='gpt-6.1-sol' and x['streaming'] is True and x['status']==200 and q['state']=='settled'
  terminal=q['terminal']
  if label=='run168' and len(facts)==4:
   assert terminal['kind']=='aborted'
  else:assert terminal['kind']=='eof'
  facts.append({'model':x['model'],'streaming':True,'status':200,'reader':'settled','terminal':terminal})
 assert r['state']=='exited' and r['exitCode']==0 and r['providerDrain']['allReadersSettled'] and r['credentialCleanup']=='passed'
 result={'label':label,'requests':len(facts),'state':r['state'],'streams':facts,'providerDrain':r['providerDrain'],'credentialCleanup':r['credentialCleanup']}
 (s/('stream-facts-'+label+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({'label':label,'requests':len(facts),'state':r['state'],'eof':sum(f['terminal']['kind']=='eof' for f in facts),'ownedUICancellation':sum(f['terminal']['kind']=='aborted' for f in facts)}))
