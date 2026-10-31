"""Reference execution actor: public support and current packet only.

Candidate implementations may use another language, representation or solver.
This is a reference programme, never a required candidate implementation.
"""
from pathlib import Path
import argparse,json,sys
from tree_business import load_data,event,canonical,action_at

def main():
    p=argparse.ArgumentParser();p.add_argument('--public',type=Path,required=True);p.add_argument('--policy',type=Path,required=True);a=p.parse_args()
    data,_=load_data(a.public);policy=json.loads(a.policy.read_text())
    for line in sys.stdin:
        packet=json.loads(line);week=packet['week'];prefix=packet['history']
        matches=[s for s in data['scenarios'] if canonical([event(s,t) for t in range(week+1)])==canonical(prefix)]
        if not matches:raise ValueError('public current history not supported')
        actions=[action_at(policy,s['id'],week) for s in matches]
        if any(canonical(v)!=canonical(actions[0]) for v in actions):raise ValueError('policy has no unique current-information action')
        print(json.dumps({'format':'l06-action-response/1','request_id':'stable-ticket-'+str(week),'action':actions[0]},allow_nan=False),flush=True)
if __name__=='__main__':main()
