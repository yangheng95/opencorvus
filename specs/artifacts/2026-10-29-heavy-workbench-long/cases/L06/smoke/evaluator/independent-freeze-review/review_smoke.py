"""Read five proposed S06 files and independently enumerate the two tiny domains.

Standard library only. Does not run native Task, Provider, solver, or candidate.
"""
from datetime import datetime,timezone
from fractions import Fraction
import itertools
import json
from pathlib import Path
import shutil
import subprocess
import sys
import time

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parent
REPO=Path('D:/myhexin-local/opencorvus')
SOURCE=REPO/'specs/artifacts/2026-10-29-heavy-workbench-long/cases/L06/smoke'
SNAP=ROOT/'source-snapshot'

def save(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')

def load(path):return json.loads(path.read_text(encoding='utf-8'))

def command(argv,label):
    start=time.perf_counter();stamp=datetime.now(timezone.utc).isoformat()
    p=subprocess.run(argv,cwd=ROOT,capture_output=True,text=True,encoding='utf-8')
    base=ROOT/'commands'/label;base.parent.mkdir(parents=True,exist_ok=True)
    base.with_suffix('.stdout.txt').write_text(p.stdout,encoding='utf-8')
    base.with_suffix('.stderr.txt').write_text(p.stderr,encoding='utf-8')
    save(base.with_suffix('.json'),{'argv':argv,'cwd':str(ROOT),'started_utc':stamp,
        'seconds':time.perf_counter()-start,'exit_code':p.returncode})

def differences(a,b,path='$'):
    if type(a)!=type(b):return [{'path':path,'base':a,'changed':b}]
    if isinstance(a,dict):
        return [v for k in sorted(a.keys()|b.keys()) for v in differences(a.get(k),b.get(k),path+'.'+k)]
    if isinstance(a,list):
        if len(a)!=len(b):return [{'path':path,'base':a,'changed':b}]
        return [v for i,(x,y) in enumerate(zip(a,b)) for v in differences(x,y,f'{path}[{i}]')]
    return [] if a==b else [{'path':path,'base':a,'changed':b}]

def scalar_value(d,q,e):
    a1,b10,b11,a2,b20,b21=q;early1,early2=e
    if a1!=a2 or b10!=b20 or early1!=early2:return None
    A,B=d['suppliers'];priceA=A['price_minor'][0];priceB=B['price_minor'][0]
    scenario_costs=[];cash_min=[]
    for s,a,b0,b1,early in ((d['scenarios'][0],a1,b10,b11,early1),(d['scenarios'][1],a2,b20,b21,early2)):
        first_demand,last_demand=(r[0] for r in s['demand'])
        late=first_demand+last_demand-early
        if not (0<=late<=s['plant_capacity_hours'][1][0]):return None
        raw_peak0=d['initial_raw'][0]+B['pack_units'][0]*b0
        raw0=raw_peak0-early;fg0=early-first_demand
        raw_peak1=raw0+A['pack_units'][0]*a+B['pack_units'][0]*b1
        raw1=raw_peak1-late;fg_peak1=fg0+late
        if min(raw0,raw1,fg0)<0 or raw_peak0>d['raw_storage_volume'] or raw_peak1>d['raw_storage_volume']:
            return None
        if early>d['product_storage_volume'] or fg_peak1>d['product_storage_volume'] or fg_peak1!=last_demand:return None
        # Domain bounds already enforce supplier max quantities; MOQ induces truck0/1.
        cost0=A['pack_units'][0]*priceA*a+int(a>0)*A['freight_minor']+B['pack_units'][0]*priceB*b0+int(b0>0)*B['freight_minor']+raw0*d['raw_holding_minor'][0]
        cost1=B['pack_units'][0]*priceB*b1+int(b1>0)*B['freight_minor']+raw1*d['raw_holding_minor'][0]
        c0=d['initial_cash_minor']-cost0
        c1=c0+first_demand*d['sales_price_minor'][0]-cost1
        if c0 < -d['credit_limit_minor'] or c1<0:return None
        scenario_costs.append(cost0+cost1);cash_min.append(min(c0,c1))
    value=sum((Fraction(c*s['probability_numerator'],d['probability_denominator'])
               for c,s in zip(scenario_costs,d['scenarios'])),Fraction())
    return {'expected':value,'scenario_costs':scenario_costs,'minimum_cash':cash_min}

def enumerate_instance(d):
    # The reviewed two-week, one-material, one-product, one-plant ABI.
    supported=(d['weeks']==2 and d['common_weeks']==1 and len(d['raw_materials'])==len(d['products'])==len(d['plants'])==1 and
        len(d['suppliers'])==len(d['scenarios'])==2 and d['initial_products']==[0] and d['initial_raw']==[1] and
        d['allowed']==[[1]] and d['bom']==[[1]] and d['production_hours']==[1] and d['production_cost_minor']==[[0]] and
        d['raw_volume']==d['product_volume']==[1] and d['product_holding_minor']==[0] and d['receipt_lag_weeks']==1 and
        [s['lead_weeks'] for s in d['suppliers']]==[1,0] and [s['pack_units'] for s in d['suppliers']]==[[2],[1]] and
        [s['minimum_volume'] for s in d['suppliers']]==[2,1] and
        all(s['supplier_capacity_volume']==[[2,2],[2,2]] and s['plant_capacity_hours']==[[2],[2]] for s in d['scenarios']))
    if not supported:raise ValueError('outside this exact independent scalar derivation; requires new analysis')
    tested=feasible=0;best=None;best_record=None;records=[]
    for q in itertools.product(range(2),range(3),range(3),range(2),range(3),range(3)):
        for e in ((1,1),(2,2)):
            tested+=1;r=scalar_value(d,q,e)
            if r is not None:
                feasible+=1
                if best is None or r['expected']<best:
                    best=r['expected'];best_record={'purchase_tuple':q,'early_production':e,
                        'scenario_costs':r['scenario_costs'],'minimum_cash':r['minimum_cash']}
            records.append({'q':q,'early':e,'expected_cost':None if r is None else str(r['expected'])})
    return {'tested':tested,'feasible':feasible,'best_exact':str(best),'best':best_record,'records':records}

def main():
    if (ROOT/'enumeration.json').exists():raise RuntimeError('use new occurrence')
    files=('public/TASK.md','public/inputs/base.json','public/inputs/price-change.json','profile.json','evaluator/contract.json')
    inventory=[]
    for relative in files:
        src,dst=SOURCE/relative,SNAP/relative;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
        inventory.append({'source':str(src),'snapshot':str(dst.relative_to(ROOT)),
            'bytes':dst.stat().st_size,'byte_equal_at_copy':src.read_bytes()==dst.read_bytes()})
    save(ROOT/'source-inventory.json',inventory)
    command(['git','-C',str(REPO),'status','--short'],'git-status-start')
    base=load(SNAP/'public/inputs/base.json');price=load(SNAP/'public/inputs/price-change.json')
    profile=load(SNAP/'profile.json');contract=load(SNAP/'evaluator/contract.json')
    t=time.perf_counter();a=enumerate_instance(base);b=enumerate_instance(price)
    counter=scalar_value(price,a['best']['purchase_tuple'],a['best']['early_production'])
    result={'scope':'independent exact arithmetic for only S06 frozen tiny inputs; not candidate/native/MILP execution',
        'base':a,'price-change':b,'seconds':time.perf_counter()-t,
        'input_differences':differences(base,price),
        'old_base_strategy_on_changed_price':str(counter['expected']),
        'old_base_strategy_inferior_to_reoptimized_price':counter['expected']>Fraction(b['best_exact']),
        'references_match':a['best_exact']=='9/2' and b['best_exact']=='11/2',
        'domain_completeness':'A0 in0..1, A1 forced0 by terminal pipeline; B0/B1 each0..2; early production1..2 with common value; final FG0 fixes final production; positive MOQ determines trucks; enumerate all other bounded choices'}
    save(ROOT/'enumeration.json',result)
    save(ROOT/'contract-facts.json',{'profile':profile,'contract':contract,
        'semantic_input_differences':[d for d in result['input_differences'] if d['path']!='$.status'],
        'candidate_public_scope':['public/TASK.md','public/inputs/base.json','public/inputs/price-change.json'],
        'evaluator_only_not_for_candidate':['profile.json','evaluator/contract.json','this review directory'],
        'conditions':len(contract['checks']),'non_numeric_aggregation':contract['aggregation'],
        'zero_actual_smoke_condition_results':'not run yet; this review approves definition only'})
    command(['git','-C',str(REPO),'status','--short'],'git-status-end')
    print(json.dumps({'base':{k:v for k,v in a.items() if k!='records'},
        'price-change':{k:v for k,v in b.items() if k!='records'},
        'differences':result['input_differences'],'base_strategy_on_price_change':result['old_base_strategy_on_changed_price'],
        'reference_match':result['references_match'],'seconds':result['seconds'],
        'scope':'tiny definition review only; no native Task run'},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
