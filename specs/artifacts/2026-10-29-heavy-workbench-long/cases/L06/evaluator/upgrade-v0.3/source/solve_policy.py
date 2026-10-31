"""Author full finite-tree policy reference, not supplied to candidates."""
from pathlib import Path
from collections import defaultdict
import argparse,json,time
import numpy as np
from scipy.sparse import coo_matrix,vstack

from qualify_l06 import build_model
from l06_integer import solve_integer
from tree_business import load_data,histories,contingency,audit_policy

def tree_model(data):
    model=build_model(data);history=histories(data);index={tuple(k):i for i,k in enumerate(model.keys)}
    entries=[];row=0
    for t in range(data['weeks']):
        groups=defaultdict(list)
        for s in data['scenarios']:groups[history[s['id']][t]].append(s['id'])
        for group in groups.values():
            representative=group[0]
            for other in group[1:]:
                for key,i in index.items():
                    if key[0] in ('q','truck','produce') and key[1]==other and key[2]==t:
                        entries.extend([(row,i,1),(row,index[(key[0],representative,*key[2:])],-1)]);row+=1
    extra=coo_matrix(([v for _,_,v in entries],([r for r,_,_ in entries],[c for _,c,_ in entries])),shape=(row,len(model.keys)))
    model.matrix=vstack([model.matrix,extra],format='csc');model.lower_rows.extend([0]*row);model.upper_rows.extend([0]*row)
    return model,row

def main():
    p=argparse.ArgumentParser();p.add_argument('--public',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--seconds',type=float,default=120);a=p.parse_args()
    a.out.mkdir(parents=True,exist_ok=False);start=time.perf_counter();data,contract=load_data(a.public)
    baseline,baseline_audit=contingency(data);linear,equalities=tree_model(data)
    def put(name,x):(a.out/name).write_text(json.dumps(x,indent=2,allow_nan=False)+'\n')
    put('contingency-policy.json',baseline);put('contingency-audit.json',baseline_audit);put('model.json',linear.payload())
    native,plan=solve_integer(data,linear,solver_seconds=a.seconds,relative_gap=.01,workers=4,seed=20261031,
        warm_start_plan={'format':'l06-plan/1','decisions':baseline['decisions']},progress_dir=a.out/'search')
    put('native.json',native)
    if plan is None:
        put('result.json',{'status':'reference_not_constructed','native':native,'seconds':time.perf_counter()-start});return 2
    policy={'format':'l06-tree-policy/1','decisions':plan['decisions']};audit=audit_policy(data,policy)
    if not audit['policy_valid']:raise ValueError('actual solver output failed independent full business/information audit')
    expected=audit['expected_cost_exact'];base=baseline_audit['expected_cost_exact']
    target_pass=expected['numerator']*base['denominator']*100<=85*base['numerator']*expected['denominator']
    put('policy.json',policy);put('audit.json',audit)
    put('result.json',{'status':'author_policy_constructed','seconds':time.perf_counter()-start,
        'expected_cost_exact':expected,'contingency_cost_exact':base,'pre_registered_15percent_improvement':target_pass,
        'nonanticipativity_equalities':equalities,'native_bound_scope':native['bound_scope'],
        'limits':'one finite-tree reference, not a candidate, exact optimum, freeze or effective candidate hours'})
    print(json.dumps({'status':'author_policy_constructed','expected':expected,'quality_target_pass':target_pass,'seconds':time.perf_counter()-start}))
    return 0 if target_pass else 2
if __name__=='__main__':raise SystemExit(main())
