"""Positive native actor/diagnosis contracts; each stdout/stderr/PID is retained."""
import argparse,copy,json,os,shutil,subprocess,sys,datetime
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--public',type=Path,required=True);a=p.parse_args();r=a.root
sys.path.insert(0,str(a.public));import model
out=r/'actor-contract-checks';out.mkdir(exist_ok=False);d=model.load(a.public/'instances/base')
leaves=json.loads((r/'native-run-02/policy-tree-base.json').read_text(encoding='utf-8'))['leaves'];h=leaves[0]['history'];results={}
def run(name,packet,instance=None):
    folder=out/name;folder.mkdir();argv=[sys.executable,'-B','-u',str(r/'programme/actor.py'),'--public',str(a.public),'--instance',str(instance or a.public/'instances/base'),'--policy-dir',str(r/'programme/policies')]
    proc=subprocess.Popen(argv,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8',creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
    stdout,stderr=proc.communicate(model.canonical(packet)+'\n',timeout=30)
    record={'argv':argv,'pid':proc.pid,'exit_code':proc.returncode,'packet':packet,'stdout':stdout,'stderr':stderr,'at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
    (folder/'native-record.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
    return json.loads(stdout) if stdout else None,record
initial=model.packet(d,[]);one,rec=run('initial-process-one',initial);two,rec2=run('initial-new-process',initial)
assert one==two and one['format']=='l06-inspection-response/1' and one['action']=={'test':None}
assert one['belief']==model.belief_wire(model.posterior(d,[]));results['original-key-deterministic-new-process']='passed'
packet=model.packet(d,h[:2]);bad=copy.deepcopy(packet);bad['committed'].append(copy.deepcopy(bad['committed'][-1]));bad['seq']=3
response,rec=run('duplicate-original-key',bad);assert response['code']=='duplicate_original_key';results['duplicate_original_key']=response
bad=copy.deepcopy(model.packet(d,h[:1]));bad['committed'][0]['post_state']['cash']+=1
response,rec=run('corrupt-original-receipt',bad);assert response['code']=='original_receipt_state';results['original_receipt_state']=response
bad=copy.deepcopy(initial);bad['state']['cash']+=1
response,rec=run('changed-current-state',bad);assert response['code']=='changed_original_packet';results['changed_original_packet']=response
changed=out/'changed-input';shutil.copytree(a.public/'instances/base',changed)
profile=changed/'profile.json';profile.chmod(profile.stat().st_mode | __import__('stat').S_IWRITE);facts=json.loads(profile.read_text());facts['initial_cash']+=1;profile.write_text(json.dumps(facts),encoding='utf-8')
response,rec=run('unsupported-public-facts',initial,changed);assert rec['exit_code']==1 and 'unsupported_public_facts' in rec['stderr'];results['unsupported_public_facts']={'exit_code':1,'named_diagnosis':'unsupported_public_facts'}
s=model.initial(d);s['phase']='operations';s['cash']=d['cash_floor']
try:model.advance(d,s,{'certified_units':1,'order':None})
except model.ContractError as error:assert error.code=='settled_cash_floor';results['credit-infeasibility']={'code':error.code,'state':s,'action':{'certified_units':1,'order':None}}
else:raise AssertionError('expected typed cash contract')
(out/'results.json').write_text(json.dumps({'status':'passed','contracts':results},indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'passed','contracts':list(results)}))
