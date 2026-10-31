"""Exact finite Bellman solver. Only public original facts enter this module."""
from fractions import Fraction as F
from functools import lru_cache
import gzip,json,time

INF=None

def normalize(x):
    if isinstance(x,F): return str(x)
    if isinstance(x,dict): return {k:normalize(v) for k,v in x.items()}
    if isinstance(x,list): return [normalize(v) for v in x]
    return x

def state_key(state,history):
    k=0
    for h in history:
        if h['phase']=='laboratory' and h['action']['test']:
            k += 1 if (h['action']['test']=='A') == (h['observation']=='good') else -1
    return (state['week'],0 if state['phase']=='laboratory' else 1,state['good'],state['quarantine']['A'],state['quarantine']['B'],state['cash'],k)

def encode(s): return ','.join(map(str,s))

class Bellman:
    def __init__(self,data,mode='unknown',inspections=True):
        self.d=data;self.mode=mode;self.inspections=inspections;self.actions={};self.values={};self.started=time.perf_counter()
        self.prior=sum(r['prior'] for r in data['modes'].values() if r['A']==F(17,20))
        assert all((r['A'],r['B']) in [(F(17,20),F(3,20)),(F(3,20),F(17,20))] for r in data['modes'].values())
        self.V=lru_cache(None)(self._value)
    def p(self,k,v):
        if self.mode=='A': a=F(1)
        elif self.mode=='B': a=F(0)
        else:
            odds=self.prior/(1-self.prior)*F(17,3)**k;a=odds/(1+odds)
        pa=a*F(17,20)+(1-a)*F(3,20)
        return pa if v=='A' else 1-pa
    def receipt(self,t):
        return sum(x['amount'] for x in self.d['opening'] if x['due_week']==t)+sum(r['demand']*self.d['revenue'] for w,r in self.d['calendar'].items() if w+self.d['sales_receipt_lag']==t)
    def initial(self): return (0,0,0,0,0,self.d['initial_cash']+self.receipt(0),0)
    def candidates(self,s):
        t,phase,g,qa,qb,c,k=s;d=self.d;q={'A':qa,'B':qb}
        if phase==0:
            yield {'test':None},0,[(F(1),(t,1,g,qa,qb,c,k))]
            if self.inspections and g+d['pack_good_units']<=d['raw_capacity'] and c-d['lab_fee']>=d['cash_floor']:
                for v in ('A','B'):
                    if not q[v]:continue
                    a,b=(qa-1,qb) if v=='A' else (qa,qb-1)
                    delta=1 if v=='A' else -1;p=self.p(k,v)
                    kg=k+delta if self.mode=='unknown' else 0;kr=k-delta if self.mode=='unknown' else 0
                    yield {'test':v},d['lab_fee'],[(p,(t,1,g+d['pack_good_units'],a,b,c-d['lab_fee'],kg)),(1-p,(t,1,g,a,b,c-d['lab_fee'],kr))]
            return
        demand=d['calendar'][t]['demand']
        for e in range(max(0,demand-g),d['raw_capacity']-g+1):
            for v in (None,'A','B'):
                if v is not None and (q[v] or t+d['suppliers'][v]['lead']>=d['weeks']):continue
                a,b=qa,qb;normal=0
                if v is not None:
                    assert d['suppliers'][v]['lead']==1
                    normal=d['suppliers'][v]['pack_cost']
                    if v=='A':a+=1
                    else:b+=1
                left=g+e-demand
                expense=normal+e*d['calendar'][t]['certified_unit_cost']+demand*d['production_cost']
                if t==d['weeks']-1:
                    expense+=left*d['terminal_good_disposal']+(a+b)*d['terminal_pack_disposal']
                    if c-expense<max(0,d['cash_floor']):continue
                    yield {'certified_units':e,'order':v},expense,[]
                else:
                    expense+=left*d['holding']
                    if c-expense<d['cash_floor']:continue
                    yield {'certified_units':e,'order':v},expense,[(F(1),(t+1,0,left,a,b,c-expense+self.receipt(t+1),k))]
    def _value(self,*s):
        best=None;choice=None
        for action,cost,edges in self.candidates(s):
            value=F(cost);feasible=True
            for p,nxt in edges:
                sub=self.V(*nxt)
                if sub is None:feasible=False;break
                value+=p*sub
            if feasible and (best is None or value<best):best=value;choice=action
        self.values[s]=best
        if choice is not None:self.actions[s]=choice
        return best
    def reachable(self):
        seen={};leaves=[]
        def visit(s,prob,path):
            if s in seen:
                seen[s]['reach_probability']+=prob
            else:seen[s]={'action':self.actions[s],'value':str(self.values[s]),'reach_probability':prob}
            chosen=self.actions[s]
            for action,cost,edges in self.candidates(s):
                if action==chosen:break
            if not edges:leaves.append((prob,path));return
            for p,nxt in edges:
                obs=None
                if s[1]==0 and chosen['test']:
                    obs='good' if nxt[2]>s[2] else 'reject'
                visit(nxt,prob*p,path+([(s[0],chosen['test'],obs)] if obs else []))
        visit(self.initial(),F(1),[])
        return seen,leaves
    def write_certificate(self,path):
        with gzip.open(path,'wt',encoding='utf-8',newline='\n') as f:
            for s in sorted(self.values):
                f.write(json.dumps({'state':s,'value':None if self.values[s] is None else str(self.values[s]),'action':self.actions.get(s)},separators=(',',':'))+'\n')
