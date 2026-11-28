from pathlib import Path
import json,sys
s=Path(__file__).parent
for label in sys.argv[1:]:
    r=json.loads((s/(label+'-runtime.json')).read_text(encoding='utf-8'));rows=json.loads(Path(r['auditPath']).read_text(encoding='utf-8'))
    facts=[]
    for request in rows:
        reader=request['response_reader'];assert request['model']=='gpt-6.1-sol' and request['streaming'] is True and request['status']==200
        assert reader['state']=='settled' and reader['terminal']['kind']=='eof'
        facts.append({'model':request['model'],'streaming':True,'httpStatus':200,'reader':'settled','terminal':reader['terminal']})
    assert r['state']=='exited' and r['exitCode']==0 and r['credentialCleanup']=='passed' and r['providerDrain']['allReadersSettled']
    result={'status':'passed','label':label,'requests':len(facts),'streams':facts,'providerDrain':r['providerDrain'],'credentialCleanup':r['credentialCleanup'],'officePackageVerification':r['officePackageVerification'],'preflight':{k:v for k,v in r['preflight'].items() if k!='sessionID'}}
    (s/('stream-facts-'+label+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'label':label,'requests':len(facts),'terminal':'all EOF','cleanup':'passed'}))
