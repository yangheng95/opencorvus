"""Scalar exhaustive v2 oracle, prefix ledger arithmetic, and cheap parser probes."""
import copy
from fractions import Fraction
import importlib.util
import itertools
import json
from pathlib import Path
import sys
import time
sys.dont_write_bytecode=True
from prepare_and_replay import ROOT,SNAP,command,save,load

sys.path.insert(0,str(SNAP/'v2'))
spec=importlib.util.spec_from_file_location('reviewed_v2_checker',SNAP/'v2/check_l06.py')
checker=importlib.util.module_from_spec(spec);spec.loader.exec_module(checker)

def tiny_plan(choice,production):
    a1,b10,b11,a2,b20,b21=choice;e1,e2=production
    return {'format':'l06-plan/1','decisions':{
        name:{'order_lots':[[[a],[b0]],[[0],[b1]]],
            'truck_on':[[int(a>0),int(b0>0)],[0,int(b1>0)]],
            'production':[[[early]],[[total-early]]]}
        for name,a,b0,b1,total,early in [('one',a1,b10,b11,2,e1),('two',a2,b20,b21,3,e2)]}}

def scalar_oracle(orders,early,common):
    a1,b10,b11,a2,b20,b21=orders;e1,e2=early
    if common and (a1!=a2 or b10!=b20 or e1!=e2):return None
    costs=[]
    for a,b0,b1,e,last,total in [(a1,b10,b11,e1,1,2),(a2,b20,b21,e2,2,3)]:
        late=total-e
        if not (1<=e<=2 and 0<=late<=2):return None
        raw_peak0=1+b0;raw0=raw_peak0-e;fg0=e-1
        raw_peak1=raw0+2*a+b1;raw1=raw_peak1-late
        fg_peak1=fg0+late
        if not (0<=raw0 and 0<=raw1 and raw_peak0<=2 and raw_peak1<=2 and e<=2 and fg_peak1<=2 and fg_peak1==last):return None
        cost0=4*a+3*b0+int(b0>0)+raw0
        cost1=3*b1+int(b1>0)+raw1
        if 100-cost0<0 or 100+5-cost0-cost1<0:return None
        costs.append(cost0+cost1)
    return Fraction(sum(costs),2)

def enumerate_tiny(common):
    data=load(SNAP/'v2/inputs/tiny.json');data['common_weeks']=int(common)
    productions=[(1,1),(2,2)] if common else list(itertools.product([1,2],repeat=2))
    rows=[];feasible=0;best=None;disagreements=[]
    for q in itertools.product(range(2),range(3),range(3),range(2),range(3),range(3)):
        for e in productions:
            expected=scalar_oracle(q,e,common)
            if expected is not None:feasible+=1;best=expected if best is None else min(best,expected)
            try:
                r=checker.evaluate(data,tiny_plan(q,e));got=Fraction(**r['expected_cost_exact']);code='business_feasible'
            except checker.PlanError as error:got=None;code=error.code
            if expected!=got:disagreements.append({'q':q,'early':e,'expected':str(expected),'actual':str(got),'code':code})
            rows.append({'q':q,'early_production':e,'oracle':None if expected is None else str(expected),'checker':code})
    result={'scope':'independent scalar end-to-end tiny domain; no solver import/run',
        'common_commitments':common,'tested':len(rows),'feasible':feasible,'best_exact':str(best),
        'disagreements':disagreements,'cases':rows,
        'completeness':'qA0=0..1, qA1=0 terminal, qB0/qB1=0..2; week0 production1..2; terminal FG0 fixes week1 production; trucks determined by positive MOQ. Common stage also fixes week0 production. Every remaining bounded choice is covered.'}
    save(ROOT/('independent-tiny-common.json' if common else 'independent-tiny-clairvoyant.json'),result)
    return {k:v for k,v in result.items() if k!='cases'}

def audit_full():
    d=load(SNAP/'v2/inputs/full.json');plan=load(SNAP/'v2/full-witness/plan.json')
    original=load(ROOT/'replay/v2/full-business-contracts/complete-feasible-credit-witness/result.json')
    T=d['weeks'];M=len(d['raw_materials']);J=len(d['products']);P=len(d['plants']);S=len(d['suppliers'])
    start=time.perf_counter();checks=[];scenarios={};expected=Fraction()
    def test(where,name,condition):checks.append({'where':where,'contract':name,'passed':bool(condition)})
    common=d['common_weeks'];first=plan['decisions'][d['scenarios'][0]['id']]
    for s in d['scenarios']:
        sid=s['id'];r=plan['decisions'][sid];records=[];total=0;prior_raw=d['initial_raw'];prior_fg=d['initial_products']
        for field in ('order_lots','truck_on','production'):
            test(sid+'.'+field,'common_prefix',r[field][:common]==first[field][:common])
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
            raw_peak=sum((a+b)*v for a,b,v in zip(prior_raw,incoming,d['raw_volume']))
            fg_peak=sum((a+b)*v for a,b,v in zip(prior_fg,made,d['product_volume']))
            purchasing=sum(r['order_lots'][t][k][m]*d['suppliers'][k]['pack_units'][m]*d['suppliers'][k]['price_minor'][m] for k in range(S) for m in range(M))
            freight=sum(r['truck_on'][t][k]*d['suppliers'][k]['freight_minor'] for k in range(S))
            labor=sum(r['production'][t][p][j]*d['production_cost_minor'][p][j] for p in range(P) for j in range(J))
            holding=sum(raw[m]*d['raw_holding_minor'][m] for m in range(M))+sum(fg[j]*d['product_holding_minor'][j] for j in range(J))
            cost=purchasing+freight+labor+holding;total+=cost
            cumulative_received=sum(s['demand'][u][j]*d['sales_price_minor'][j] for u in range(max(0,t-d['receipt_lag_weeks']+1)) for j in range(J))
            cash=d['initial_cash_minor']+cumulative_received-total
            past=t-d['receipt_lag_weeks'];received_now=sum(s['demand'][past][j]*d['sales_price_minor'][j] for j in range(J)) if past>=0 else 0
            computed={'raw_inventory':raw,'finished_inventory':fg,'cash':cash,'cost':cost,
                'purchase_cost':purchasing,'freight_cost':freight,'production_cost':labor,'holding_cost':holding,
                'receipts':received_now,'raw_stage_peak_volume':raw_peak,'product_stage_peak_volume':fg_peak}
            source=original['scenarios'][sid]['weeks'][t]
            for field,value in computed.items():test(f'{sid}.week{t}.{field}','independent_prefix_arithmetic',value==source[field])
            test(f'{sid}.week{t}','inventory_credit',min(raw)>=0 and min(fg)>=0 and cash>=(0 if t==T-1 else -d['credit_limit_minor']))
            test(f'{sid}.week{t}','raw_stage_capacity',raw_peak<=d['raw_storage_volume'])
            test(f'{sid}.week{t}','finished_stage_capacity',fg_peak<=d['product_storage_volume'])
            for k in range(S):
                rule=d['suppliers'][k];on=r['truck_on'][t][k]
                volume=sum(r['order_lots'][t][k][m]*rule['pack_units'][m]*d['raw_volume'][m] for m in range(M))
                test(f'{sid}.week{t}.supplier{k}','shipment_capacity_moq_terminal',
                    type(on) is int and on in (0,1) and rule['minimum_volume']*on<=volume<=s['supplier_capacity_volume'][t][k]*on and
                    all(type(v) is int and v>=0 for v in r['order_lots'][t][k]) and (t+rule['lead_weeks']<T or sum(r['order_lots'][t][k])==0))
            for p in range(P):
                hours=sum(r['production'][t][p][j]*d['production_hours'][j] for j in range(J))
                test(f'{sid}.week{t}.plant{p}','plant_capacity_assignment',hours<=s['plant_capacity_hours'][t][p] and
                    all(type(v) is int and v>=0 for v in r['production'][t][p]) and
                    all(d['allowed'][p][j] or r['production'][t][p][j]==0 for j in range(J)))
            records.append({'week':t,**computed});prior_raw,prior_fg=raw,fg
        expected+=Fraction(total*s['probability_numerator'],d['probability_denominator'])
        ar=sum(s['demand'][u][j]*d['sales_price_minor'][j] for u in range(max(0,T-d['receipt_lag_weeks']),T) for j in range(J))
        test(sid,'terminal_goods_cash_ar',all(v==0 for v in fg) and cash>=0 and ar==original['scenarios'][sid]['final_receivable_minor'])
        scenarios[sid]={'total_cost_minor':total,'minimum_cash_minor':min(x['cash'] for x in records),
            'terminal_cash_minor':cash,'terminal_receivable_minor':ar,
            'raw_peak':max((x['raw_stage_peak_volume'],x['week']) for x in records),
            'finished_peak':max((x['product_stage_peak_volume'],x['week']) for x in records),'weeks':records}
    test('objective','rational_cost',expected==Fraction(**original['expected_cost_exact']))
    result={'scope':'v2 full independent prefix/physical-stage/financial arithmetic, not global optimization',
        'all_checks_passed':all(c['passed'] for c in checks),'checks':checks,'check_count':len(checks),
        'seconds':time.perf_counter()-start,'expected_cost_exact':str(expected),
        'caps':{'raw':d['raw_storage_volume'],'finished':d['product_storage_volume']},
        'credit5369_is_only_feasible_upper_bound':True,'scenarios':scenarios}
    save(ROOT/'independent-full-audit.json',result)
    return {k:v for k,v in result.items() if k not in ('checks','scenarios')}|{
        'scenarios':{sid:{k:v for k,v in s.items() if k!='weeks'} for sid,s in scenarios.items()}}

def strict_json(text):
    def reject(value):raise ValueError('nonfinite JSON token '+value)
    return json.loads(text,parse_constant=reject)

def boundary_probes():
    data=load(SNAP/'v2/inputs/tiny.json');plan=load(SNAP/'v2/tiny-solver/plan.json')
    cases=[]
    cases.append(('overflow-exponent-format',copy.deepcopy(data),'{"format":1e999}'))
    bad=copy.deepcopy(data);bad['raw_holding_minor']=[]
    cases.append(('invalid-instance-plus-bad-plan',bad,'{'))
    cases.append(('explicit-nan-plan',copy.deepcopy(data),'{"format":NaN}'))
    bad=copy.deepcopy(data);bad['weeks']=True
    cases.append(('bool-week-instance',bad,json.dumps(plan)))
    cases.append(('duplicate-instance-key',None,json.dumps(plan)))
    rows=[]
    for label,inp,ptext in cases:
        dest=ROOT/'independent-boundaries'/label;dest.mkdir(parents=True,exist_ok=False)
        if inp is None:(dest/'input.json').write_text('{"format":"x","format":"y"}',encoding='utf-8')
        else:save(dest/'input.json',inp)
        (dest/'plan.json').write_text(ptext,encoding='utf-8')
        receipt=command([sys.executable,'-B',str(SNAP/'v2/check_l06.py'),'--input',str(dest/'input.json'),
            '--plan',str(dest/'plan.json'),'--out',str(dest/'result.json')],'independent-'+label)
        raw=(dest/'result.json').read_text(encoding='utf-8') if (dest/'result.json').exists() else ''
        try:result=strict_json(raw);valid=True;error=None
        except ValueError as ex:result=None;valid=False;error=str(ex)
        rows.append({'label':label,'exit_code':receipt['exit_code'],'strict_json_result':valid,
            'strict_json_error':error,'result':result,'raw_result':raw,'receipt':receipt})
    save(ROOT/'independent-boundaries.json',rows)
    return [{k:v for k,v in r.items() if k!='receipt'} for r in rows]

def main():
    result={'common':enumerate_tiny(True),'clairvoyant':enumerate_tiny(False),
            'full':audit_full(),'boundaries':boundary_probes()}
    save(ROOT/'independent-summary.json',result)
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
