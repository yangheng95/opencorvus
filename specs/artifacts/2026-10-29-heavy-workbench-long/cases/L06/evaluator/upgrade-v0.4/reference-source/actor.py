"""Source-only deterministic policy actor; all belief/state come from original prefix."""
from pathlib import Path
import argparse,json,sys,hashlib,uuid

def main():
    p=argparse.ArgumentParser();p.add_argument('--public',type=Path,required=True);p.add_argument('--instance',type=Path,required=True);p.add_argument('--fault',default='none');a=p.parse_args()
    sys.path.insert(0,str(a.public));from model import load,posterior,belief_wire,packet,canonical,require
    data=load(a.instance);plan=json.loads((Path(__file__).parent/'plans'/f"{data['id']}.json").read_text(encoding='utf-8'))
    for line in sys.stdin:
        current=json.loads(line);history=current['committed'];rebuilt=packet(data,history)
        require(canonical(current)==canonical(rebuilt),'packet_original_prefix_disagreement')
        state=current['state'];k=0
        for item in history:
            if item['phase']=='laboratory' and item['action']['test']:
                sign=1 if item['action']['test']=='A' else -1
                k+=sign if item['observation']=='good' else -sign
        key=','.join(map(str,[state['week'],state['good'],state['quarantine']['A'],state['quarantine']['B'],k,state['cash']]))
        action=dict(plan['lab' if state['phase']=='laboratory' else 'ops'][key])
        belief=belief_wire(posterior(data,[] if a.fault=='prior-belief' else history))
        if a.fault=='expected-stock' and state['phase']=='operations' and history[-1]['observation']=='reject':
            action['certified_units']=max(0,action['certified_units']-1)
        if a.fault=='ar-credit' and state['phase']=='operations':action['certified_units']=data['raw_capacity']-state['good']
        request_id=('random-'+str(uuid.uuid4())) if a.fault=='random-key' else 'inspection-'+hashlib.sha256(canonical(current).encode('utf-8')).hexdigest()
        print(canonical({'format':'l06-inspection-response/1','request_id':request_id,'belief':belief,'action':action}),flush=True)

if __name__=='__main__':main()
