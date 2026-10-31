"""Real erroneous programmes for the same new policy checker; native exit0 expected."""
from pathlib import Path
from copy import deepcopy
import argparse,json

def main():
    p=argparse.ArgumentParser();p.add_argument('--policy',type=Path,required=True);p.add_argument('--contingency',type=Path);p.add_argument('--mode',required=True,choices=['anticipate','overship','boolean','history']);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
    policy=json.loads(a.policy.read_text());keys=list(policy['decisions']);first=policy['decisions'][keys[0]]
    if a.mode=='anticipate':
        # Both constituent complete trajectories are physically valid. Choosing
        # between them by the as-yet-unobserved actual future is the real error.
        if a.contingency is None:raise ValueError('anticipate requires the real lawful alternative')
        alternative=json.loads(a.contingency.read_text());policy['decisions'][keys[-1]]=deepcopy(alternative['decisions'][keys[-1]])
    elif a.mode=='overship':first['order_lots'][0][-1][0]+=1000;first['truck_on'][0][-1]=1
    elif a.mode=='boolean':first['order_lots'][0][-1][0]=True
    else:
        # A supposedly recovered policy silently rewrites its original week0.
        first['production'][0][0][0]+=1
    a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(policy,indent=2)+'\n');print(json.dumps({'actual_programme':a.mode,'output':str(a.out)}))
if __name__=='__main__':main()
