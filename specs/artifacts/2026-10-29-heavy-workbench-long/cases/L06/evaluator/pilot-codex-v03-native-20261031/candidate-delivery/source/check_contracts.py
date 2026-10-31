"""Focused exact business/protocol checks; no UI automation."""
import argparse, copy, json, subprocess, sys
from pathlib import Path
from common import *
from actor import Actor

def main():
    p=argparse.ArgumentParser();p.add_argument('--public',type=Path,required=True);p.add_argument('--policy',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=False)
    data,_=load_data(a.public);policy=json.loads(a.policy.read_text(encoding='utf8'));actor=Actor(a.public,a.policy);checks=[]
    all_states={};node_responses={}
    for path in data['scenarios']:
        committed=[]
        for t in range(data['weeks']):
            visible=packet(data,committed,event(path,t));response=actor.respond(visible)
            assert canonical(response['action'])==canonical(action_at(policy,path['id'],t))
            key=canonical(visible['history'])
            if key in node_responses:assert canonical(response)==canonical(node_responses[key])
            node_responses[key]=response
            committed,receipt,duplicate=append(data,committed,event(path,t),response['action'],response['request_id'])
            assert receipt['committed_week']==t and receipt['next_week']==t+1
        state,rows=replay(data,committed);all_states[path['id']]=state
        checks.append({'case':'complete_prefix_execution','path':path['id'],'commits':len(committed),'final_cost':state['total_cost_minor'],'final_cash':state['cash']})
    checks.append({'case':'identical_full_information_response','nodes':len(node_responses),'action_and_request_identity':'equal'})
    first=data['scenarios'][0];visible=packet(data,[],event(first,0));response=actor.respond(visible)
    original,receipt,duplicate=append(data,[],event(first,0),response['action'],response['request_id'])
    same,recovered,replayed=append(data,original,event(first,0),response['action'],response['request_id'])
    assert canonical(recovered)==canonical(receipt) and replayed is True and canonical(same)==canonical(original)
    checks.append({'case':'original_receipt_idempotency','receipt':recovered,'replayed':replayed})
    conflict=copy.deepcopy(response['action']);conflict['truck_on'][0]=1-conflict['truck_on'][0]
    try:append(data,original,event(first,0),conflict,response['request_id'])
    except BusinessError as error:
        assert error.code=='idempotency_payload_conflict';checks.append({'case':'different_payload_old_id','error_code':error.code,'week':error.week})
    else:raise AssertionError('expected explicit error')
    invalid=copy.deepcopy(response['action']);invalid['production'][0][0]=10000
    try:advance(data,initial_state(data),event(first,0),invalid)
    except BusinessError as error:
        assert error.code=='plant_capacity' and error.week==0;checks.append({'case':'invalid_action_neutral_diagnostic','error_code':error.code,'week':error.week,'detail':error.detail})
    else:raise AssertionError('expected explicit error')
    changed=copy.deepcopy(visible);changed['post_week_state']['cash']+=1
    try:actor.respond(changed)
    except BusinessError as error:
        assert error.code=='packet_replay_mismatch';checks.append({'case':'authoritative_replay_state','error_code':error.code,'week':error.week})
    else:raise AssertionError('expected explicit error')
    baseline,ba=contingency(data);spot=Actor(a.public,a.policy,'spot')
    for path in data['scenarios']:
        committed=[]
        for t in range(data['weeks']):
            value=packet(data,committed,event(path,t));r=spot.respond(value)
            assert canonical(r['action'])==canonical(action_at(baseline,path['id'],t))
            committed,_,_=append(data,committed,event(path,t),r['action'],r['request_id'])
    checks.append({'case':'executable_spot_matches_canonical','paths':8,'weeks_each':16,'canonical_expected_cost':ba['expected_cost_exact']})
    # Actual invalid stdio invocation; retain original input, stdout, stderr/exit.
    cmd=[sys.executable,'-u','-B',str(ROOT/'programme/actor.py'),'--public',str(a.public),'--policy',str(a.policy)]
    text_input=json.dumps(changed)+'\n';result=subprocess.run(cmd,input=text_input,text=True,capture_output=True,encoding='utf8')
    (a.out/'invalid-packet-input.jsonl').write_text(text_input,encoding='utf8');(a.out/'invalid-packet-stdout.txt').write_text(result.stdout,encoding='utf8');(a.out/'invalid-packet-stderr.txt').write_text(result.stderr,encoding='utf8')
    error=json.loads(result.stderr);assert result.returncode==2 and error['code']=='packet_replay_mismatch'
    checks.append({'case':'actual_native_invalid_packet','argv':cmd,'exit':result.returncode,'diagnostic':error})
    (a.out/'results.json').write_text(json.dumps({'status':'passed','checks':checks},indent=2)+'\n',encoding='utf8')
    print(json.dumps({'status':'passed','checks':len(checks),'information_nodes':len(node_responses)}))
if __name__=='__main__':main()
