"""Independent stdlib arithmetic, exact tiny enumeration, and cheap reader boundaries.

No SciPy import, solver call, container, GPU, Provider, or training.
"""
import copy
from fractions import Fraction
import importlib.util
import itertools
import json
from pathlib import Path
import shutil
import sys
import time

sys.dont_write_bytecode=True
from prepare_and_replay import ROOT, SRC, SNAP, command, save

spec=importlib.util.spec_from_file_location('reviewed_check_l06',SNAP/'check_l06.py')
checker=importlib.util.module_from_spec(spec);spec.loader.exec_module(checker)

def tiny_oracle(choice, common=True):
    """Closed scalar economics from the actual tiny data; never calls the checker."""
    a1,b10,b11,a2,b20,b21=choice
    if common and (a1!=a2 or b10!=b20):return None
    costs=[]
    for a,b0,b1,last_demand in ((a1,b10,b11,1),(a2,b20,b21,2)):
        # week0 initial1 + same-week B0 - mandatory production1 = B0 stock.
        # A is paid in week0 but 2 units arrive only week1.
        closing1=b0+2*a+b1-last_demand
        if closing1<0 or closing1>2:return None
        cost0=4*a+3*b0+int(b0>0)+b0
        cost1=3*b1+int(b1>0)+closing1
        if 100-cost0<0 or 100+5-cost0-cost1<0:return None
        costs.append(cost0+cost1)
    return Fraction(sum(costs),2)

def tiny_plan(c):
    a1,b10,b11,a2,b20,b21=c
    return {'format':'l06-plan/1','decisions':{
        name:{'order_lots':[[[a],[b0]],[[0],[b1]]],
              'truck_on':[[int(a>0),int(b0>0)],[0,int(b1>0)]],
              'production':[[[1]],[[demand]]]}
        for name,a,b0,b1,demand in [('one',a1,b10,b11,1),('two',a2,b20,b21,2)]}}

def enumerate_tiny():
    data=json.loads((SNAP/'tiny-v1/instance.json').read_text())
    rows=[];feasible=0;best=None;clairvoyant=None;disagreements=[]
    for choice in itertools.product(range(2),range(3),range(3),range(2),range(3),range(3)):
        val=tiny_oracle(choice)
        if val is not None:
            feasible+=1;best=val if best is None else min(best,val)
        cv=tiny_oracle(choice,common=False)
        if cv is not None:clairvoyant=cv if clairvoyant is None else min(clairvoyant,cv)
        try:
            result=checker.evaluate(data,tiny_plan(choice))
            got=Fraction(**result['expected_cost_exact']);code='business_feasible'
        except checker.PlanError as error:
            got=None;code=error.code
        if got!=val:disagreements.append({'choice':choice,'oracle':str(val),'checker':str(got),'code':code})
        rows.append({'choice':choice,'oracle':None if val is None else str(val),'checker_code':code})
    result={'scope':'all 324 joint purchase choices under the supplied tiny instance; scalar closed oracle independent of checker',
        'enumerated':len(rows),'feasible':feasible,'best_exact':str(best),
        'clairvoyant_without_common_constraint_best':str(clairvoyant),
        'disagreements':disagreements,'all_choices':rows,
        'domain_completeness':'zero finished-goods capacity fixes production to weekly demand; all trucks determined by positive shipment MOQ; late A orders forbidden; q bounds force A0 in0..1/B0,B1 in0..2'}
    save(ROOT/'independent-tiny-enumeration.json',result)
    return {k:v for k,v in result.items() if k!='all_choices'}

def full_prefix_audit():
    d=json.loads((SNAP/'minimum-credit/witness-credit-input.json').read_text())
    plan=json.loads((SNAP/'minimum-credit/plan.json').read_text())
    original=json.loads((ROOT/'replay/minimum-credit-business.json').read_text())
    T=d['weeks'];M=len(d['raw_materials']);J=len(d['products']);P=len(d['plants']);S=len(d['suppliers'])
    start=time.perf_counter();checks=[];scenarios={};expected=Fraction()
    common=d['common_weeks'];first=plan['decisions'][d['scenarios'][0]['id']]
    for s in d['scenarios']:
        sid=s['id'];r=plan['decisions'][sid];records=[];total=0;prior_raw=d['initial_raw'];prior_fg=d['initial_products']
        for field in ('order_lots','truck_on','production'):
            checks.append({'where':sid+'.'+field,'contract':'common_prefix','passed':r[field][:common]==first[field][:common]})
        for t in range(T):
            raw=[];fg=[]
            for m in range(M):
                received=sum(r['order_lots'][u][k][m]*d['suppliers'][k]['pack_units'][m]
                             for k in range(S) for u in range(T) if u+d['suppliers'][k]['lead_weeks']<=t)
                used=sum(r['production'][u][p][j]*d['bom'][j][m] for u in range(t+1) for p in range(P) for j in range(J))
                raw.append(d['initial_raw'][m]+received-used)
            for j in range(J):
                made=sum(r['production'][u][p][j] for u in range(t+1) for p in range(P))
                fg.append(d['initial_products'][j]+made-sum(s['demand'][u][j] for u in range(t+1)))
            incoming=[sum(r['order_lots'][u][k][m]*d['suppliers'][k]['pack_units'][m]
                          for u in range(T) for k in range(S) if u+d['suppliers'][k]['lead_weeks']==t) for m in range(M)]
            made=[sum(r['production'][t][p][j] for p in range(P)) for j in range(J)]
            purchasing=sum(r['order_lots'][t][k][m]*d['suppliers'][k]['pack_units'][m]*d['suppliers'][k]['price_minor'][m] for k in range(S) for m in range(M))
            freight=sum(r['truck_on'][t][k]*d['suppliers'][k]['freight_minor'] for k in range(S))
            labor=sum(r['production'][t][p][j]*d['production_cost_minor'][p][j] for p in range(P) for j in range(J))
            holding=sum(raw[m]*d['raw_holding_minor'][m] for m in range(M))+sum(fg[j]*d['product_holding_minor'][j] for j in range(J))
            cost=purchasing+freight+labor+holding;total+=cost
            receipts=sum(s['demand'][u][j]*d['sales_price_minor'][j] for u in range(max(0,t-d['receipt_lag_weeks']+1)) for j in range(J))
            cash=d['initial_cash_minor']+receipts-total
            demand_due=t-d['receipt_lag_weeks']
            received_now=sum(s['demand'][demand_due][j]*d['sales_price_minor'][j] for j in range(J)) if demand_due>=0 else 0
            source=original['scenarios'][sid]['weeks'][t]
            computed={'raw_inventory':raw,'finished_inventory':fg,'cash':cash,'cost':cost,
                      'purchase_cost':purchasing,'freight_cost':freight,'production_cost':labor,'holding_cost':holding,'receipts':received_now}
            for field,value in computed.items():
                checks.append({'where':f'{sid}.week{t}.{field}','contract':'independent_prefix_arithmetic','passed':value==source[field]})
            checks.append({'where':f'{sid}.week{t}','contract':'stock_cash_bounds',
                'passed':min(raw)>=0 and min(fg)>=0 and sum(a*b for a,b in zip(raw,d['raw_volume']))<=d['raw_storage_volume'] and
                    sum(a*b for a,b in zip(fg,d['product_volume']))<=d['product_storage_volume'] and cash >= (0 if t==T-1 else -d['credit_limit_minor'])})
            supplier_volumes=[]
            for k in range(S):
                supplier=d['suppliers'][k];on=r['truck_on'][t][k]
                volume=sum(r['order_lots'][t][k][m]*supplier['pack_units'][m]*d['raw_volume'][m] for m in range(M))
                checks.append({'where':f'{sid}.week{t}.supplier{k}','contract':'shipment_capacity_pack_and_moq',
                    'passed':type(on) is int and on in (0,1) and supplier['minimum_volume']*on<=volume<=s['supplier_capacity_volume'][t][k]*on and
                              all(type(v) is int and v>=0 for v in r['order_lots'][t][k]) and
                              (t+supplier['lead_weeks']<T or sum(r['order_lots'][t][k])==0)})
                supplier_volumes.append(volume)
            for p in range(P):
                hours=sum(r['production'][t][p][j]*d['production_hours'][j] for j in range(J))
                checks.append({'where':f'{sid}.week{t}.plant{p}','contract':'plant_capacity_qualification',
                    'passed':hours<=s['plant_capacity_hours'][t][p] and all(type(v) is int and v>=0 for v in r['production'][t][p]) and
                              all(d['allowed'][p][j] or r['production'][t][p][j]==0 for j in range(J))})
            raw_before=sum((a+b)*v for a,b,v in zip(prior_raw,incoming,d['raw_volume']))
            fg_before=sum((a+b)*v for a,b,v in zip(prior_fg,made,d['product_volume']))
            records.append({'week':t,**computed,'raw_arrival_before_production_volume':raw_before,'finished_before_delivery_volume':fg_before})
            prior_raw,prior_fg=raw,fg
        expected+=Fraction(total*s['probability_numerator'],d['probability_denominator'])
        ar=sum(s['demand'][u][j]*d['sales_price_minor'][j] for u in range(max(0,T-d['receipt_lag_weeks']),T) for j in range(J))
        checks.append({'where':sid,'contract':'terminal_cash_goods_receivable','passed':all(v==0 for v in fg) and cash>=0 and ar==original['scenarios'][sid]['final_receivable_minor']})
        scenarios[sid]={'total_cost_minor':total,'minimum_cash_minor':min(x['cash'] for x in records),
            'minimum_cash_weeks':[x['week'] for x in records if x['cash']==min(r['cash'] for r in records)],
            'terminal_cash_minor':cash,'terminal_receivable_minor':ar,
            'raw_transient_peak':max((x['raw_arrival_before_production_volume'],x['week']) for x in records),
            'finished_transient_peak':max((x['finished_before_delivery_volume'],x['week']) for x in records),
            'weeks':records}
    checks.append({'where':'objective','contract':'expected_rational_cost','passed':expected==Fraction(**original['expected_cost_exact'])})
    result={'scope':'independent full 16-week prefix arithmetic and physical/financial bounds under end-of-week storage abstraction',
        'seconds':time.perf_counter()-start,'all_checks_passed':all(c['passed'] for c in checks),
        'check_count':len(checks),'checks':checks,'expected_cost_exact':str(expected),
        'raw_storage_limit':d['raw_storage_volume'],'finished_storage_limit':d['product_storage_volume'],
        'scenarios':scenarios,'limits':['not independent global optimization','transient stock capacities are observations, not current model constraints']}
    save(ROOT/'independent-full-prefix-audit.json',result)
    return {'all_checks_passed':result['all_checks_passed'],'checks':len(checks),'expected_cost_exact':str(expected),'seconds':result['seconds'],
            'scenarios':{k:{a:b for a,b in v.items() if a!='weeks'} for k,v in scenarios.items()}}

def reader_boundaries():
    original=json.loads((SNAP/'tiny-v1/instance.json').read_text())
    plan=json.loads((SNAP/'tiny-v1/plan.json').read_text());results=[]
    cases=[('top-level-array-plan',original,[],None),('malformed-json-plan',original,None,'{'),
           ('negative-probability',copy.deepcopy(original),copy.deepcopy(plan),None),
           ('missing-holding-vector',copy.deepcopy(original),copy.deepcopy(plan),None),
           ('inconsistent-pre-reveal-demand',copy.deepcopy(original),copy.deepcopy(plan),None)]
    cases[2][1]['scenarios'][0]['probability_numerator']=3
    cases[2][1]['scenarios'][1]['probability_numerator']=-1
    cases[3][1]['raw_holding_minor']=[]
    cases[4][1]['scenarios'][1]['demand'][0][0]=2
    for label,data,value,text in cases:
        dest=ROOT/'reader-boundaries'/label;dest.mkdir(parents=True,exist_ok=False)
        save(dest/'input.json',data)
        if text is None:save(dest/'plan.json',value)
        else:(dest/'plan.json').write_text(text,encoding='utf-8')
        receipt=command([sys.executable,'-B',str(SNAP/'check_l06.py'),'--input',str(dest/'input.json'),
                         '--plan',str(dest/'plan.json'),'--out',str(dest/'result.json')],'boundary-'+label)
        result=json.loads((dest/'result.json').read_text()) if (dest/'result.json').exists() else None
        stderr=(ROOT/receipt['stderr']).read_text(encoding='utf-8')
        results.append({'label':label,'result':result,'exit_code':receipt['exit_code'],
                        'stderr_last_line':stderr.splitlines()[-1] if stderr else None,'receipt':receipt})
    save(ROOT/'reader-boundary-results.json',results)
    return [{'label':r['label'],'result':r['result'],'exit_code':r['exit_code'],'stderr_last_line':r['stderr_last_line']} for r in results]

def main():
    tiny=enumerate_tiny();full=full_prefix_audit();boundaries=reader_boundaries()
    supplementary=[]
    for relative in ('qualify_full_business_checks.py','full-business-contracts/receipt.json'):
        src=SRC/relative;dst=ROOT/'supplementary-main-agent-receipts'/relative
        dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
        supplementary.append({'source':str(src),'snapshot':str(dst.relative_to(ROOT)),
            'byte_equal_at_copy':src.read_bytes()==dst.read_bytes(),'scope':'read only; no repeat full 12-case group'})
    save(ROOT/'supplementary-source-inventory.json',supplementary)
    result={'tiny':tiny,'full':full,'reader_boundaries':boundaries,
        'scope':'cheap stdlib actual observations only; no freeze/1percent/hours approval'}
    save(ROOT/'independent-check-summary.json',result)
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
