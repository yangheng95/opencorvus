"""Deterministic current-packet actor. Python standard library only.

Reads no episode identifier or actual-future source. Actions are compiled public
support policies indexed by full current event history, with exact prefix replay.
"""
import argparse, hashlib, json, sys
from pathlib import Path
from tree_business import (load_data, histories, canonical, event, action_at,
                           audit_policy, packet, replay, BusinessError)
from l06_input import decode_json
from l06_physics import begin_week


def spot_action(data, state, current):
    made=[max(0,d-f) for d,f in zip(current['demand'],state['finished'])]
    production=[[0]*len(data['products']) for _ in data['plants']]
    remaining=current['plant_capacity_hours'].copy()
    for j in [0,3,1,2]:
        for p in range(len(data['plants'])):
            if data['allowed'][p][j]:
                n=min(made[j]-sum(row[j] for row in production),remaining[p]//data['production_hours'][j])
                production[p][j]+=n;remaining[p]-=n*data['production_hours'][j]
    if any(sum(row[j] for row in production)!=made[j] for j in range(len(made))):
        raise BusinessError('contingency_production_unavailable',state['next_week'])
    raw=begin_week(data,state,current)['raw_before_new_orders']
    need=[sum(made[j]*data['bom'][j][m] for j in range(len(made))) for m in range(len(raw))]
    lots=[[0]*len(raw) for _ in data['suppliers']];on=[0]*len(data['suppliers']);spot=len(data['suppliers'])-1;rule=data['suppliers'][spot]
    if rule['lead_weeks']!=0 or any(v!=1 for v in rule['pack_units']):raise BusinessError('contingency_spot_contract')
    lots[spot]=[max(0,n-a) for n,a in zip(need,raw)];on[spot]=int(any(lots[spot]))
    volume=sum(n*v for n,v in zip(lots[spot],data['raw_volume']))
    if on[spot] and volume<rule['minimum_volume']:lots[spot][0]+=rule['minimum_volume']-volume
    return {'order_lots':lots,'truck_on':on,'production':production}


class Actor:
    def __init__(self, public, policy_file, mode='policy'):
        self.data,_=load_data(public);self.mode=mode;self.actions={}
        if mode=='policy':
            self.policy=decode_json(policy_file.read_text(encoding='utf8'),'policy_json')
            audit=audit_policy(self.data,self.policy)
            if not audit['policy_valid']:raise BusinessError('declared_policy_invalid',detail=audit)
            visible=histories(self.data)
            for path in self.data['scenarios']:
                for t,key in enumerate(visible[path['id']]):
                    action=action_at(self.policy,path['id'],t)
                    if key in self.actions and canonical(self.actions[key])!=canonical(action):raise BusinessError('nonanticipativity_violation',t)
                    self.actions[key]=action
    def respond(self, value):
        if type(value) is not dict or set(value)!={'format','week','committed','history','post_week_state','decision_view'} or value['format']!='l06-current-operation/1':raise BusinessError('packet_schema_invalid')
        t=value['week']
        if type(t) is not int or not 0<=t<self.data['weeks']:raise BusinessError('packet_week_invalid')
        if type(value['history']) is not list or len(value['history'])!=t+1:raise BusinessError('packet_history_invalid',t)
        expected=packet(self.data,value['committed'],value['history'][-1])
        if canonical(expected)!=canonical(value):raise BusinessError('packet_replay_mismatch',t)
        # The journal and previous receipts are authoritative; any substituted
        # checkpoint or divergent committed action is diagnosed, never repaired.
        if self.mode=='policy':
            for k,item in enumerate(value['committed']):
                history_key=canonical(value['history'][:k+1])
                if canonical(item['action'])!=canonical(self.actions[history_key]):raise BusinessError('committed_policy_conflict',k)
            key=canonical(value['history'])
            if key not in self.actions:raise BusinessError('observation_not_supported',t)
            action=self.actions[key]
        else:
            action=spot_action(self.data,value['post_week_state'],value['history'][-1])
        # Digest identifies the original complete public history/action payload;
        # it is a protocol request identity, not a source-integrity acceptance test.
        identity=hashlib.sha256(canonical({'history':value['history'],'action':action}).encode('utf8')).hexdigest()
        return {'format':'l06-action-response/1','request_id':'factory-'+identity,'action':action}


def main():
    p=argparse.ArgumentParser();p.add_argument('--public',type=Path,required=True);p.add_argument('--policy',type=Path,default=Path(__file__).with_name('policy.json'));p.add_argument('--mode',choices=['policy','spot'],default='policy');a=p.parse_args()
    actor=Actor(a.public,a.policy,a.mode)
    for line in sys.stdin:
        try:
            value=decode_json(line,'packet_json')
            response=actor.respond(value)
            print(json.dumps(response,separators=(',',':'),allow_nan=False),flush=True)
        except Exception as error:
            print(json.dumps({'status':'actor_diagnostic','code':getattr(error,'code',type(error).__name__),'week':getattr(error,'week',None),'detail':getattr(error,'detail',str(error))},allow_nan=False),file=sys.stderr,flush=True)
            return 2
    return 0
if __name__=='__main__':raise SystemExit(main())
