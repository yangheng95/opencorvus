"""Exact full-horizon Bayes/known-class Bellman planner; no selected future input."""
from pathlib import Path
from fractions import Fraction as F
from functools import cache
import sys,time,json,argparse
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'public'))
from model import load, equivalence, canonical

class Planner:
    def __init__(self,data,known=None):
        self.d=data;self.known=known;self.lab_policy={};self.ops_policy={}
        self.groups=equivalence(data)
        good=[m for m,r in data['modes'].items() if r['A']==F(17,20) and r['B']==F(3,20)]
        other=[m for m,r in data['modes'].items() if r['A']==F(3,20) and r['B']==F(17,20)]
        assert len(good)+len(other)==len(data['modes']) and good and other
        self.group_prior=sum(data['modes'][m]['prior'] for m in good)
        self.odds=self.group_prior/(1-self.group_prior)
        self.inc=[sum(v['amount'] for v in data['opening'] if v['due_week']==t)+
                  (data['calendar'][t-2]['demand']*data['revenue'] if t>=2 else 0) for t in range(data['weeks'])]
        self.p=cache(self.p);self.lab=cache(self.lab);self.ops=cache(self.ops)

    def p(self,k,v):
        if self.known is not None:return self.d['modes'][self.known][v]
        odds=self.odds*F(17,3)**k
        pa=(17*odds+3)/(20*(odds+1))
        return pa if v=='A' else 1-pa

    def lab(self,t,g,qa,qb,k,c):
        key=(t,g,qa,qb,k,c); d=self.d
        best=self.ops(*key);choice=None
        if g+2<=d['raw_capacity'] and c-d['lab_fee']>=d['cash_floor']:
            for v,exists in [('A',qa),('B',qb)]:
                if not exists:continue
                a,b=(0,qb) if v=='A' else (qa,0);sign=1 if v=='A' else -1
                kg=k+sign if self.known is None else 0
                kb=k-sign if self.known is None else 0
                vg=self.ops(t,g+2,a,b,kg,c-d['lab_fee'])
                vb=self.ops(t,g,a,b,kb,c-d['lab_fee'])
                if vg is None or vb is None:continue
                pg=self.p(k,v);value=d['lab_fee']+pg*vg+(1-pg)*vb
                if best is None or value<best:best=value;choice=v
        if best is not None:self.lab_policy[key]={'test':choice}
        return best

    def ops(self,t,g,qa,qb,k,c):
        d=self.d;best=None;choice=None;demand=d['calendar'][t]['demand'];terminal=t==d['weeks']-1
        vendors=[None]+([v for v,q in [('A',qa),('B',qb)] if q==0] if not terminal else [])
        for e in range(max(0,demand-g),d['raw_capacity']-g+1):
            remaining=g+e-demand
            for v in vendors:
                a,b=qa,qb;purchase=d['suppliers'][v]['pack_cost'] if v else 0
                if v=='A':a=1
                if v=='B':b=1
                cost=purchase+e*d['calendar'][t]['certified_unit_cost']+demand*d['production_cost']
                cost+=remaining*(d['terminal_good_disposal'] if terminal else d['holding'])
                if terminal:cost+=(a+b)*d['terminal_pack_disposal']
                after=c-cost
                if after<(0 if terminal else d['cash_floor']):continue
                future=F(0) if terminal else self.lab(t+1,remaining,a,b,k,after+self.inc[t+1])
                if future is None:continue
                value=cost+future
                if best is None or value<best:best=value;choice={'certified_units':e,'order':v}
        if best is not None:self.ops_policy[(t,g,qa,qb,k,c)]=choice
        return best

    def solve(self):return self.lab(0,0,0,0,0,self.d['initial_cash']+self.inc[0])

def main():
    a=argparse.ArgumentParser();a.add_argument('--inputs',type=Path,required=True);a.add_argument('--out',type=Path,required=True);a.add_argument('--known-class',action='store_true');args=a.parse_args()
    args.out.mkdir(exist_ok=False,parents=True);start=time.perf_counter();data=load(args.inputs);p=Planner(data);value=p.solve();assert value is not None
    result={'instance':data['id'],'bayes_optimum_exact':str(value),'laboratory_states':p.lab.cache_info().currsize,'operations_states':p.ops.cache_info().currsize,'elapsed_seconds':time.perf_counter()-start,'quality_ratio_pre_registered':'101/100','known_class_information_bound':None,'equivalence_classes':equivalence(data),'scope':'complete eight-week exact prospective law, no candidate hours or maturity'}
    policy={'format':'l06-inspection-policy/1','instance':data['id'],'lab':{','.join(map(str,k)):v for k,v in p.lab_policy.items()},'ops':{','.join(map(str,k)):v for k,v in p.ops_policy.items()}}
    (args.out/'policy.json').write_text(json.dumps(policy,separators=(',',':'))+'\n',encoding='utf-8')
    if args.known_class:
        bound=F(0);parts=[]
        for group in equivalence(data):
            mass=sum(data['modes'][m]['prior'] for m in group);q=Planner(data,known=group[0]);v=q.solve();assert v is not None;bound+=mass*v
            parts.append({'members':group,'prior_mass':str(mass),'optimum_if_class_known':str(v)})
        result['known_class_information_bound']={'exact':str(bound),'parts':parts,'value_of_advance_class_information_exact':str(value-bound),'scope':'class revealed before week0; future batch results still unobserved, not a deployable Bayes policy'}
    result['elapsed_seconds']=time.perf_counter()-start
    (args.out/'science.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps(result))

if __name__=='__main__':main()
