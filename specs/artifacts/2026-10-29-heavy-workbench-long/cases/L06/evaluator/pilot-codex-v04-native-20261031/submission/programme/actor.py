"""Native deterministic JSON-lines actor: full-prefix replay before every answer."""
import argparse,json,sys,hashlib
from pathlib import Path
from fractions import Fraction as F
p=argparse.ArgumentParser();p.add_argument('--public',type=Path,required=True);p.add_argument('--instance',type=Path,required=True);p.add_argument('--policy-dir',type=Path,required=True);a=p.parse_args()
sys.path.insert(0,str(a.public));import model

def normalize(x):
    if isinstance(x,F):return str(x)
    if isinstance(x,dict):return {k:normalize(v) for k,v in x.items()}
    if isinstance(x,list):return [normalize(v) for v in x]
    return x

def key(data,history):
    # This is an original-request content identity, not a correctness checksum.
    content=model.canonical({'law':normalize(data),'prefix':history})
    return 'l06-'+hashlib.sha256(content.encode('utf-8')).hexdigest()

def state_key(s,h):
    k=0
    for item in h:
        if item['phase']=='laboratory' and item['action']['test']:
            k+=1 if (item['action']['test']=='A')==(item['observation']=='good') else -1
    return ','.join(map(str,(s['week'],0 if s['phase']=='laboratory' else 1,s['good'],s['quarantine']['A'],s['quarantine']['B'],s['cash'],k)))

data=model.load(a.instance);policy=json.loads((a.policy_dir/(data['id']+'.json')).read_text(encoding='utf-8'))
model.require(model.canonical(normalize(data))==model.canonical(policy['law']),'unsupported_public_facts')

def respond(packet):
    model.require(type(packet) is dict and packet.get('format')=='l06-inspection-packet/1','packet_version')
    model.require(packet.get('instance_id')==data['id'],'packet_instance')
    h=packet.get('committed');model.require(type(h) is list,'complete_original_prefix')
    model.require(type(packet.get('seq')) is int and packet['seq']==len(h),'complete_original_prefix')
    seen=set()
    for i,item in enumerate(h):
        model.require(item.get('request_id') not in seen,'duplicate_original_key')
        model.require(item.get('request_id')==key(data,h[:i]),'original_key_prefix_conflict')
        seen.add(item['request_id'])
    rebuilt=model.packet(data,h)
    model.require(model.canonical(rebuilt)==model.canonical(packet),'changed_original_packet')
    model.require(not rebuilt['state']['terminal'],'terminal_business')
    lookup=state_key(rebuilt['state'],h)
    model.require(lookup in policy['states'],'unsupported_policy_prefix')
    return {'format':'l06-inspection-response/1','request_id':key(data,h),'belief':model.belief_wire(model.posterior(data,h)),'action':policy['states'][lookup]['action']}
for line in sys.stdin:
    try:
        result=respond(json.loads(line));print(model.canonical(result),flush=True)
    except Exception as error:
        code=getattr(error,'code',type(error).__name__)
        print(model.canonical({'format':'l06-inspection-diagnosis/1','code':code,'detail':str(error)}),flush=True)
