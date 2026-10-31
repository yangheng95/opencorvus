"""Independent Bellman certificate verifier; does not import the planner.

Actions and child states are rebuilt with the authoritative model.advance,
not with the solver transition function. All alternatives are checked exactly.
"""
import argparse,gzip,json,sys,time
from pathlib import Path
from fractions import Fraction as F
p=argparse.ArgumentParser();p.add_argument('--public',type=Path,required=True);p.add_argument('--build',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
sys.path.insert(0,str(a.public));import model
started=time.perf_counter();report={};total_actions=0;total_edges=0
for path in sorted((a.build/'certificates').glob('*.jsonl.gz')):
    name=path.name.removesuffix('.jsonl.gz');ident=next(x for x in ['shifted-prior','cash-tight','base'] if name.startswith(x+'-'));mode=name[len(ident)+1:]
    d=model.load(a.public/'instances'/ident)
    with gzip.open(path,'rt',encoding='utf-8') as f:rows={tuple(r['state']):r for line in f if (r:=json.loads(line))}
    checked=0;feasible=0;alternatives=0;edges_count=0
    for key,row in rows.items():
        t,phase,g,qa,qb,c,k=key
        ar=[dict(x) for x in d['opening'] if x['due_week']>t]
        ar += [{'receipt_id':f'sale-week-{w}','amount':d['calendar'][w]['demand']*d['revenue'],'due_week':w+d['sales_receipt_lag']} for w in range(t) if w+d['sales_receipt_lag']>t]
        s={'week':t,'phase':'laboratory' if phase==0 else 'operations','good':g,'quarantine':{'A':qa,'B':qb},'incoming':[],'cash':c,'receivables':ar,'cumulative_cost':0,'costs':dict.fromkeys(['normal','certified','production','laboratory','holding','disposal'],0),'minimum_cash':c,'terminal':False}
        if mode=='class-A':class_a=F(1)
        elif mode=='class-B':class_a=F(0)
        else:
            prior=sum(r['prior'] for r in d['modes'].values() if r['A']==F(17,20));odds=prior/(1-prior)*F(17,3)**k;class_a=odds/(1+odds)
        if phase==0:
            actions=[{'test':None}]+([{'test':'A'},{'test':'B'}] if mode!='no-inspection' else [])
        else:actions=[{'certified_units':e,'order':v} for e in range(d['raw_capacity']+1) for v in [None,'A','B']]
        candidates=[]
        for action in actions:
            v=action.get('test')
            pg=(class_a*F(17,20)+(1-class_a)*F(3,20)) if v=='A' else (class_a*F(3,20)+(1-class_a)*F(17,20))
            outcomes=[('good',pg),('reject',1-pg)] if v else [(None,F(1))]
            children=[];invalid=False
            for obs,prob in outcomes:
                try:after=model.advance(d,s,action,obs)
                except model.ContractError:invalid=True;break
                kk=k
                if v:
                    kk=(k+(1 if (v=='A')==(obs=='good') else -1)) if mode in ['same-information','no-inspection'] else 0
                nxt=(after['week'],0 if after['phase']=='laboratory' else 1,after['good'],after['quarantine']['A'],after['quarantine']['B'],after['cash'],kk)
                children.append((prob,None if after['terminal'] else nxt,after['cumulative_cost']))
            if invalid:continue
            alternatives+=1;edges_count+=len(children)
            if any(nxt is not None and nxt in rows and rows[nxt]['value'] is None for prob,nxt,cost in children):continue
            value=F(0)
            for prob,nxt,cost in children:
                if nxt is not None and nxt not in rows:raise AssertionError(('unclosed_feasible_candidate',name,key,action,nxt))
                value+=prob*(cost+(F(rows[nxt]['value']) if nxt is not None else 0))
            candidates.append((value,action))
        best=min((v for v,action in candidates),default=None)
        saved=F(row['value']) if row['value'] is not None else None
        assert saved==best,('bellman_equality',name,key,saved,best)
        if best is not None:
            feasible+=1;assert (best,row['action']) in candidates,('optimal_action',name,key)
        checked+=1
    initial_cash=d['initial_cash']+sum(x['amount'] for x in d['opening'] if x['due_week']==0)
    root=(0,0,0,0,0,initial_cash,0)
    report[name]={'states_exactly_verified':checked,'feasible_states':feasible,'valid_alternative_actions':alternatives,'original_model_outcome_edges':edges_count,'root_value_exact':rows[root]['value']}
    total_actions+=alternatives;total_edges+=edges_count
    print(json.dumps({'certificate':name,**report[name]}),flush=True)
result={'format':'l06-independent-bellman-review/1','method':'independent action enumeration and public model.advance; exact rational Bellman minimum at every stored state, all feasible candidate successors closed; planner module not imported','certificates':report,'valid_alternative_actions':total_actions,'original_model_outcome_edges':total_edges,'seconds':time.perf_counter()-started,'status':'passed'}
a.out.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
