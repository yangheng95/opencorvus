"""Complete tiny v2 search including legal early production; no solver import."""
import copy
from fractions import Fraction
import itertools
import json
from pathlib import Path

from check_l06 import evaluate, PlanError

root=Path(__file__).resolve().parent
data=json.loads((root/'v2/inputs/tiny.json').read_text())

def enumerate_domain(inp):
    tested,feasible,best,best_plan=0,0,None,None
    production_pairs=[(1,1),(2,2)] if inp['common_weeks'] else list(itertools.product([1,2],repeat=2))
    for orders in itertools.product(range(2),range(3),range(3),range(2),range(3),range(3)):
        a1,b10,b11,a2,b20,b21=orders
        for first1,first2 in production_pairs:
            plan={'format':'l06-plan/1','decisions':{}}
            for name,a,b0,b1,total,early in [('one',a1,b10,b11,2,first1),('two',a2,b20,b21,3,first2)]:
                plan['decisions'][name]={'order_lots':[[[a],[b0]],[[0],[b1]]],
                    'truck_on':[[int(a>0),int(b0>0)],[0,int(b1>0)]],
                    'production':[[[early]],[[total-early]]]}
            tested+=1
            try:result=evaluate(inp,plan)
            except PlanError:continue
            feasible+=1
            exact=result['expected_cost_exact'];value=Fraction(exact['numerator'],exact['denominator'])
            if best is None or value<best:best,best_plan=value,copy.deepcopy(plan)
    return {'tested':tested,'feasible':feasible,'best_exact':str(best)},best_plan

common,plan=enumerate_domain(data)
assert common['tested']==648 and common['best_exact']=='9/2',common
solver=json.loads((root/'v2/tiny-solver/solver.json').read_text())
assert solver['objective']==4.5 and solver['dual_bound']==4.5
clairvoyant=copy.deepcopy(data);clairvoyant['common_weeks']=0
future,_=enumerate_domain(clairvoyant)
assert future['tested']==1296 and future['best_exact']=='4',future
(root/'v2/tiny-solver/enumerated-plan.json').write_text(json.dumps(plan,indent=2)+'\n')
report={'scope':'v2 bounded tiny exhaustive search, early production allowed; not full case optimality',
        'enumeration':common,'clairvoyant_control':future,'mip_objective_and_bound_match':True,
        'completeness':'Demand at week0 forces early production>=1, line capacity forces<=2; common stage requires same early quantity; final-zero determines last production. All bounded purchases and their induced freight activations are enumerated.'}
(root/'v2/tiny-solver/enumeration.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
