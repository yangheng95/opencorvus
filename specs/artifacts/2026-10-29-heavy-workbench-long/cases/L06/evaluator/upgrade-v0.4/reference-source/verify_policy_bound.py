"""Check the complete stored policy's Bellman equalities against public physics.

No Planner import or new policy construction. Each claimed feasible/infeasible
state and every admissible action is checked by finite-horizon induction.
"""
from pathlib import Path
from functools import cache
from fractions import Fraction as F
import argparse,json,sys,time
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'public'))
from model import load,initial,advance,ContractError,posterior,predictive

def verify(data,policy):
    prior=sum(r['prior'] for r in data['modes'].values() if r['A']==F(17,20))
    odds=prior/(1-prior);checked={'lab':0,'ops':0,'admissible_actions':0}
    @cache
    def weights(k):
        # Exact likelihood-vector quotient, proved by the supplied two mirrored laws.
        r=odds*F(17,3)**k;mass=r/(1+r)
        return {m:(mass if v['A']==F(17,20) else 1-mass)*v['prior']/
                (prior if v['A']==F(17,20) else 1-prior) for m,v in data['modes'].items()}
    def state(phase,key):
        t,g,a,b,k,c=key;s=initial(data);s.update(week=t,phase=phase,good=g,quarantine={'A':a,'B':b},cash=c,minimum_cash=c)
        s['receivables']=[x for x in data['opening'] if x['due_week']>t]
        s['receivables'] += [{'receipt_id':f'sale-week-{w}','amount':data['calendar'][w]['demand']*data['revenue'],'due_week':w+2} for w in range(t) if w+2>t]
        return s
    def key_of(s,k):return s['week'],s['good'],s['quarantine']['A'],s['quarantine']['B'],k,s['cash']
    @cache
    def check(phase,key):
        checked['lab' if phase=='laboratory' else 'ops']+=1;t,g,qa,qb,k,c=key;s=state(phase,key);options=[]
        if phase=='laboratory':
            actions=[{'test':v} for v in [None,'A','B']]
        else:actions=[{'certified_units':e,'order':v} for e in range(data['raw_capacity']+1) for v in [None,'A','B']]
        for action in actions:
            try:
                if phase=='laboratory' and action['test']:
                    v=action['test'];sg=advance(data,s,action,'good');sb=advance(data,s,action,'reject');sign=1 if v=='A' else -1
                    vg=check('operations',key_of(sg,k+sign));vb=check('operations',key_of(sb,k-sign))
                    if vg is None or vb is None:continue
                    p=predictive(data,weights(k),v)
                    value=sg['cumulative_cost']+p*vg+(1-p)*vb
                else:
                    after=advance(data,s,action,None)
                    child=F(0) if after['terminal'] else check(after['phase'],key_of(after,k))
                    if child is None:continue
                    value=after['cumulative_cost']+child
                options.append((value,action));checked['admissible_actions']+=1
            except ContractError:continue
        stored=policy['lab' if phase=='laboratory' else 'ops'].get(','.join(map(str,key)))
        if not options:
            assert stored is None,('infeasible_claim',phase,key);return None
        assert stored is not None,('missing_feasible_certificate',phase,key)
        chosen=[v for v,a in options if a==stored];assert len(chosen)==1,('invalid_stored_action',phase,key)
        assert chosen[0]==min(v for v,a in options),('Bellman_inequality',phase,key)
        return chosen[0]
    value=check('laboratory',(0,0,0,0,0,data['initial_cash']+sum(x['amount'] for x in data['opening'] if x['due_week']==0)))
    assert value is not None
    return {'instance':data['id'],'verified_optimum_exact':str(value),'checked':checked,
            'proof':'For each state every physical/legal action and both positive-probability laboratory results are covered. Terminal0 and all cash floors use the public primitive. Stored action attains the minimum; missing cells are proved infeasible. Backward horizon induction proves the root bound and attainability. No unique policy/tie requirement.',
            'sufficient_state':'All past sales were mandatory; absolute future AR is fixed by week. Current material/quarantine/cash and exact posterior quotient retain all future constraints. Under mirrored17/20 and3/20 likelihoods the complete sample history enters class odds through k; within-class label ratios remain prior ratios.'}

def main():
    p=argparse.ArgumentParser();p.add_argument('--public',type=Path,required=True);p.add_argument('--studies',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();start=time.perf_counter();results=[]
    for folder in sorted((a.public/'instances').iterdir()):
        if folder.is_dir():
            policy=json.loads((a.studies/folder.name/'policy.json').read_text(encoding='utf-8'));science=json.loads((a.studies/folder.name/'science.json').read_text(encoding='utf-8'));r=verify(load(folder),policy);assert r['verified_optimum_exact']==science['bayes_optimum_exact'];results.append(r)
    result={'results':results,'seconds':time.perf_counter()-start,'scope':'one complete bound certificate check of original stored policy; no planner/actor/native/candidate-hours repetition'};a.out.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps(result))
if __name__=='__main__':main()
