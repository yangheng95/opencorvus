"""Exact stdlib-only independent bound/model/witness audit. No LP/MIP imports."""
from collections import Counter, defaultdict
from datetime import datetime,timezone
from fractions import Fraction
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import time

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parent
BASE=Path('D:/opencorvus-benchmark-runs/l06-procurement-qualification-20261029')
SOURCE=BASE/'v2/continuous-relaxation-qualification'
REPO=Path('D:/myhexin-local/opencorvus')
SNAP=ROOT/'source-snapshot'

def save(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')

def load(path):return json.loads(path.read_text(encoding='utf-8'))

def command(argv,label):
    t=time.perf_counter();stamp=datetime.now(timezone.utc).isoformat()
    p=subprocess.run(argv,cwd=ROOT,capture_output=True,text=True,encoding='utf-8')
    dest=ROOT/'commands'/label;dest.parent.mkdir(parents=True,exist_ok=True)
    dest.with_suffix('.stdout.txt').write_text(p.stdout,encoding='utf-8')
    dest.with_suffix('.stderr.txt').write_text(p.stderr,encoding='utf-8')
    save(dest.with_suffix('.json'),{'argv':argv,'cwd':str(ROOT),'started_utc':stamp,
        'seconds':time.perf_counter()-t,'exit_code':p.returncode})

def capture():
    if SNAP.exists():raise RuntimeError('use a new occurrence; preserve previous evidence')
    inventory=[]
    for source in sorted(SOURCE.rglob('*')):
        if not source.is_file() or '__pycache__' in source.parts:continue
        dest=SNAP/source.relative_to(SOURCE);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,dest)
        inventory.append({'source':str(source),'copy':str(dest.relative_to(ROOT)),
            'bytes':dest.stat().st_size,'byte_equal_at_copy':source.read_bytes()==dest.read_bytes()})
    witness=BASE/'v2/full-business-contracts-final/complete-feasible-credit-witness'
    for name in ('input.json','plan.json','result.json'):
        dest=ROOT/'witness'/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(witness/name,dest)
        inventory.append({'source':str(witness/name),'copy':str(dest.relative_to(ROOT)),
            'bytes':dest.stat().st_size,'byte_equal_at_copy':(witness/name).read_bytes()==dest.read_bytes()})
    shutil.copy2(REPO/'specs/records/2026-10/2026-10-29-heavy-workbench-l06-qualification.md',ROOT/'Recall.md')
    save(ROOT/'source-inventory.json',inventory)
    command(['git','-C',str(REPO),'status','--short'],'git-status-start')

def certify(model,certificate):
    """Independent standard-library proof arithmetic, including all rows' types."""
    n=len(model['variable_keys']) if 'variable_keys' in model else len(model['objective_numerators'])
    lo,hi,cnum=model['variable_lower'],model['variable_upper'],model['objective_numerators']
    D=model['objective_denominator']
    if type(D) is not int or D<=0 or not len(lo)==len(hi)==len(cnum)==n:raise ValueError('model dimensions/denominator')
    if any(type(x) is not int for x in lo+hi+cnum) or any(a>b for a,b in zip(lo,hi)):raise ValueError('finite integer model box')
    for row in model['rows']:
        if any(b is not None and type(b) is not int for b in (row['lower'],row['upper'])):raise ValueError('row bounds')
        if row['lower'] is not None and row['upper'] is not None and row['lower']>row['upper']:raise ValueError('empty row interval')
        for i,v in row['terms']:
            if type(i) is not int or not 0<=i<n or type(v) is not int:raise ValueError('sparse row coefficient')
    AtY=[Fraction(0) for _ in range(n)];bTy=Fraction(0);seen=set();sides=Counter()
    for item in certificate['multipliers']:
        r,side=item['row'],item['side']
        if type(r) is not int or not 0<=r<len(model['rows']):raise ValueError('dual row identity')
        if (r,side) in seen:raise ValueError('duplicate row/side')
        seen.add((r,side));sides[side]+=1
        y=Fraction(item['value']);row=model['rows'][r]
        if side=='equality':
            if row['lower'] is None or row['lower']!=row['upper']:raise ValueError('equality type')
            sign=1;bound=row['upper']
        elif side in ('upper','lower'):
            if y>0:raise ValueError('dual cone')
            sign=1 if side=='upper' else -1;bound=row[side]
            if bound is None:raise ValueError('unbounded row side')
        else:raise ValueError('unknown row side')
        bTy+=y*sign*bound
        for index,a in row['terms']:AtY[index]+=y*sign*a
    residual=[Fraction(c,D)-v for c,v in zip(cnum,AtY)]
    terms=[min(r*a,r*b) for r,a,b in zip(residual,lo,hi)]
    box=sum(terms,Fraction());lb=bTy+box
    return {'lower_bound_exact':str(lb),'lower_bound':float(lb),'row_dual_constant_exact':str(bTy),
        'box_correction_exact':str(box),'maximum_stationarity_residual_exact':str(max(map(abs,residual),default=Fraction())),
        'variables':n,'rows':len(model['rows']),'multipliers':len(seen),'side_counts':dict(sides),
        'negative_box_terms':sum(t<0 for t in terms),'all_model_bounds_exact_integers':True,
        'arithmetic':'independent fractions.Fraction; solver_value ignored; no optimization'}

def row_signature(row):
    terms=defaultdict(int)
    for i,v in row['terms']:terms[i]+=v
    return (row['lower'],row['upper'],tuple(sorted((i,v) for i,v in terms.items() if v)))

def audit_model(data,model):
    """Reconstruct business variables/bounds/objective/all row families, not importing builder."""
    T=data['weeks'];M=len(data['raw_materials']);J=len(data['products']);P=len(data['plants']);S=len(data['suppliers'])
    D=data['probability_denominator'];sc=data['scenarios'];keys=[tuple(k) for k in model['variable_keys']]
    if len(set(keys))!=len(keys):raise ValueError('duplicate variable key')
    index={k:i for i,k in enumerate(keys)};expected={};costs={}
    def var(key,upper,cost,numerator):expected[key]=(0,upper,cost*numerator);costs[key]=cost
    for s in sc:
        sid=s['id'];prob=s['probability_numerator']
        for t in range(T):
            for k,sup in enumerate(data['suppliers']):
                for m in range(M):
                    upper=s['supplier_capacity_volume'][t][k]//(sup['pack_units'][m]*data['raw_volume'][m]) if t+sup['lead_weeks']<T else 0
                    var(('q',sid,t,k,m),upper,sup['pack_units'][m]*sup['price_minor'][m],prob)
                var(('truck',sid,t,k),1,sup['freight_minor'],prob)
            for p in range(P):
                for j in range(J):var(('produce',sid,t,p,j),s['plant_capacity_hours'][t][p]//data['production_hours'][j] if data['allowed'][p][j] else 0,data['production_cost_minor'][p][j],prob)
            for m in range(M):var(('raw',sid,t,m),data['raw_storage_volume']//data['raw_volume'][m],data['raw_holding_minor'][m],prob)
            for j in range(J):var(('fg',sid,t,j),0 if t==T-1 else data['product_storage_volume']//data['product_volume'][j],data['product_holding_minor'][j],prob)
    if set(keys)!=set(expected):raise ValueError('business variable key coverage')
    mismatches=[]
    for key,(a,b,c) in expected.items():
        i=index[key]
        if (model['variable_lower'][i],model['variable_upper'][i],model['objective_numerators'][i])!=(a,b,c):mismatches.append(key)
    expected_rows=[];families=Counter()
    def add(family,terms,lower=None,upper=None):
        aggregate=defaultdict(int)
        for key,v in terms:aggregate[index[key]]+=v
        expected_rows.append({'lower':lower,'upper':upper,'terms':sorted((i,v) for i,v in aggregate.items() if v)})
        families[family]+=1
    for s in sc:
        sid=s['id']
        for t in range(T):
            for k,sup in enumerate(data['suppliers']):
                volume=[(('q',sid,t,k,m),sup['pack_units'][m]*data['raw_volume'][m]) for m in range(M)]
                add('supplier_capacity',volume+[(('truck',sid,t,k),-s['supplier_capacity_volume'][t][k])],upper=0)
                add('shipment_MOQ',volume+[(('truck',sid,t,k),-sup['minimum_volume'])],lower=0)
            for p in range(P):add('plant_capacity',[(('produce',sid,t,p,j),data['production_hours'][j]) for j in range(J)],0,s['plant_capacity_hours'][t][p])
            for m in range(M):
                terms=[(('raw',sid,t,m),1)]
                if t:terms.append((('raw',sid,t-1,m),-1))
                terms += [(('q',sid,t-sup['lead_weeks'],k,m),-sup['pack_units'][m]) for k,sup in enumerate(data['suppliers']) if t>=sup['lead_weeks']]
                terms += [(('produce',sid,t,p,j),data['bom'][j][m]) for p in range(P) for j in range(J)]
                rhs=data['initial_raw'][m] if t==0 else 0;add('raw_balance',terms,rhs,rhs)
            for j in range(J):
                terms=[(('fg',sid,t,j),1)]+([(('fg',sid,t-1,j),-1)] if t else [])
                terms += [(('produce',sid,t,p,j),-1) for p in range(P)]
                rhs=(data['initial_products'][j] if t==0 else 0)-s['demand'][t][j];add('goods_balance',terms,rhs,rhs)
            raw=[(('raw',sid,t-1,m),data['raw_volume'][m]) for m in range(M)] if t else []
            raw += [(('q',sid,t-sup['lead_weeks'],k,m),sup['pack_units'][m]*data['raw_volume'][m]) for k,sup in enumerate(data['suppliers']) for m in range(M) if t>=sup['lead_weeks']]
            add('raw_stage_peak',raw,0,data['raw_storage_volume']-(sum(a*b for a,b in zip(data['initial_raw'],data['raw_volume'])) if t==0 else 0))
            goods=[(('fg',sid,t-1,j),data['product_volume'][j]) for j in range(J)] if t else []
            goods += [(('produce',sid,t,p,j),data['product_volume'][j]) for p in range(P) for j in range(J)]
            add('goods_stage_peak',goods,0,data['product_storage_volume']-(sum(a*b for a,b in zip(data['initial_products'],data['product_volume'])) if t==0 else 0))
            cashterms=[(key,costs[key]) for key in expected if key[1]==sid and key[2]<=t]
            received=sum(s['demand'][u][j]*data['sales_price_minor'][j] for u in range(max(0,t-data['receipt_lag_weeks']+1)) for j in range(J))
            ceiling=data['initial_cash_minor']+received+(data['credit_limit_minor'] if t<T-1 else 0)
            add('cash_prefix',cashterms,upper=ceiling)
    first=sc[0]['id']
    for s in sc[1:]:
        sid=s['id']
        for key in expected:
            if key[0] in ('q','truck','produce') and key[1]==sid and key[2]<data['common_weeks']:
                add('nonanticipativity',[(key,1),((key[0],first,*key[2:]),-1)],0,0)
    actual=Counter(row_signature(r) for r in model['rows']);wanted=Counter(row_signature(r) for r in expected_rows)
    good=(not mismatches and actual==wanted and model['objective_denominator']==D and sum(s['probability_numerator'] for s in sc)==D)
    result={'all_business_model_checks_passed':good,'variable_types':dict(Counter(k[0] for k in keys)),
        'variables':len(keys),'rows':len(model['rows']),'expected_row_families':dict(families),
        'variable_bound_or_objective_mismatches':mismatches,'extra_actual_rows':sum((actual-wanted).values()),
        'missing_business_rows':sum((wanted-actual).values()),'objective_denominator':D,
        'all_lower_bounds_zero':all(x==0 for x in model['variable_lower']),
        'maximum_variable_upper':max(model['variable_upper']),'integer_objective_constant':0,
        'scope':'independent reconstruction of actual finite v2 cost model from input; no builder/matrix or optimizer imported'}
    save(ROOT/'business-model-coverage.json',result)
    return result

def witness_mapping(data,model):
    recorded_input=load(ROOT/'witness/input.json');plan=load(ROOT/'witness/plan.json');ledger=load(ROOT/'witness/result.json')
    same_input=data==recorded_input
    T=data['weeks'];M=len(data['raw_materials']);J=len(data['products']);P=len(data['plants']);S=len(data['suppliers'])
    values={};scenarios={};ledger_mismatches=[]
    for s in data['scenarios']:
        sid=s['id'];actions=plan['decisions'][sid];raw=data['initial_raw'].copy();fg=data['initial_products'].copy();cash=data['initial_cash_minor']
        arrivals=[[0]*M for _ in range(T)];active=defaultdict(list);cost_total=0;necessary_prebuild=[];shipping_blocked=[]
        used_lead_times=Counter();paid_holding_periods=0
        for t in range(T):
            for k,sup in enumerate(data['suppliers']):
                for m in range(M):
                    q=actions['order_lots'][t][k][m];values[('q',sid,t,k,m)]=q
                    if q and t+sup['lead_weeks']<T:arrivals[t+sup['lead_weeks']][m]+=q*sup['pack_units'][m]
                values[('truck',sid,t,k)]=actions['truck_on'][t][k]
        for t in range(T):
            previous_fg=fg.copy();made=[sum(actions['production'][t][p][j] for p in range(P)) for j in range(J)]
            for p in range(P):
                hours=sum(actions['production'][t][p][j]*data['production_hours'][j] for j in range(J))
                cap=s['plant_capacity_hours'][t][p]
                for j in range(J):values[('produce',sid,t,p,j)]=actions['production'][t][p][j]
                if cap>0 and hours==cap:active['plant_capacity'].append([t,data['plants'][p]])
                if cap==0:active['plant_shutdown_zero_capacity'].append([t,data['plants'][p]])
            raw=[a+b for a,b in zip(raw,arrivals[t])];raw_peak=sum(a*b for a,b in zip(raw,data['raw_volume']))
            raw=[a-sum(made[j]*data['bom'][j][m] for j in range(J)) for m,a in enumerate(raw)]
            fg=[a+b for a,b in zip(fg,made)];fg_peak=sum(a*b for a,b in zip(fg,data['product_volume']))
            fg=[a-b for a,b in zip(fg,s['demand'][t])]
            purchase=freight=labor=0
            for k,sup in enumerate(data['suppliers']):
                counts=[actions['order_lots'][t][k][m]*sup['pack_units'][m] for m in range(M)]
                volume=sum(a*b for a,b in zip(counts,data['raw_volume']));on=actions['truck_on'][t][k]
                purchase+=sum(a*b for a,b in zip(counts,sup['price_minor']));freight+=on*sup['freight_minor']
                if on:
                    used_lead_times[str(sup['lead_weeks'])]+=1
                    if volume==s['supplier_capacity_volume'][t][k]:active['supplier_capacity'].append([t,sup['id']])
                    if volume==sup['minimum_volume']:active['shipment_minimum'].append([t,sup['id']])
                if s['supplier_capacity_volume'][t][k]<sup['minimum_volume']:
                    shipping_blocked.append({'week':t,'supplier':sup['id'],'capacity':s['supplier_capacity_volume'][t][k],
                        'MOQ':sup['minimum_volume'],'actual_truck':on,'actual_units':sum(counts)})
            for p in range(P):labor+=sum(actions['production'][t][p][j]*data['production_cost_minor'][p][j] for j in range(J))
            holding=sum(a*b for a,b in zip(raw,data['raw_holding_minor']))+sum(a*b for a,b in zip(fg,data['product_holding_minor']))
            paid_holding_periods+=int(holding>0);cost=purchase+freight+labor+holding;cost_total+=cost
            past=t-data['receipt_lag_weeks'];received=sum(a*b for a,b in zip(s['demand'][past],data['sales_price_minor'])) if past>=0 else 0
            cash+=received-cost
            for m,x in enumerate(raw):values[('raw',sid,t,m)]=x
            for j,x in enumerate(fg):values[('fg',sid,t,j)]=x
            if raw_peak==data['raw_storage_volume']:active['raw_storage'].append(t)
            if fg_peak==data['product_storage_volume']:active['product_storage'].append(t)
            if t<T-1 and cash==-data['credit_limit_minor']:active['credit_limit'].append(t)
            original=ledger['scenarios'][sid]['weeks'][t]
            expected={'raw_inventory':raw,'finished_inventory':fg,'raw_stage_peak_volume':raw_peak,
                      'product_stage_peak_volume':fg_peak,'cost':cost,'cash':cash,'receipts':received}
            for field,value in expected.items():
                if value!=original[field]:ledger_mismatches.append({'scenario':sid,'week':t,'field':field})
            for j in range(J):
                maximum_now=sum(s['plant_capacity_hours'][t][p]//data['production_hours'][j] for p in range(P) if data['allowed'][p][j])
                if maximum_now<s['demand'][t][j]:
                    necessary_prebuild.append({'week':t,'product':data['products'][j],'demand':s['demand'][t][j],
                        'maximum_same_week_even_if_other_products_ignored':maximum_now,'minimum_prior_stock':s['demand'][t][j]-maximum_now,
                        'actual_prior_stock':previous_fg[j]})
        counts={k:len(active[k]) for k in ('supplier_capacity','shipment_minimum','plant_capacity','raw_storage','product_storage','credit_limit')}
        # 'product_storage' is the external ledger name; map the same FG binding fact.
        counts['product_storage']=len(active['product_storage'])
        recorded_counts=ledger['scenarios'][sid]['active_constraints']
        scenarios[sid]={'active_counts':counts,'active_locations':dict(active),
            'matches_recorded_active_counts':counts==recorded_counts,'cost_minor':cost_total,
            'positive_holding_cost_weeks':paid_holding_periods,'used_positive_shipment_lead_times':dict(used_lead_times),
            'necessary_prebuild_observations':necessary_prebuild,'MOQ_exceeds_capacity_observations':shipping_blocked,
            'interpretation':'binding/use/necessity facts only; positive cost or use alone is not an ablation or a causal optimality claim'}
    keys=[tuple(k) for k in model['variable_keys']];vector=[values[k] for k in keys]
    box_ok=all(type(x) is int and lo<=x<=hi for x,lo,hi in zip(vector,model['variable_lower'],model['variable_upper']))
    row_errors=[]
    for i,row in enumerate(model['rows']):
        a=sum(vector[j]*c for j,c in row['terms'])
        if (row['lower'] is not None and a<row['lower']) or (row['upper'] is not None and a>row['upper']):row_errors.append({'row':i,'value':a,'lower':row['lower'],'upper':row['upper']})
    cost=Fraction(sum(c*x for c,x in zip(model['objective_numerators'],vector)),model['objective_denominator'])
    result={'same_v2_input_as_business_ledger':same_input,'variables_mapped':len(vector),'all_exact_box_bounds_passed':box_ok,
        'rows_checked':len(model['rows']),'row_violations':row_errors,'ledger_field_mismatches':ledger_mismatches,
        'objective_exact':str(cost),'objective_matches_independent_v2_upper':cost==51263,
        'all_passed':same_input and box_ok and not row_errors and not ledger_mismatches and cost==51263,
        'scenarios':scenarios,'integer_plan_comes_from':'existing fully verified v2 action ledger, never from rounding fractional LP values'}
    save(ROOT/'integer-witness-vector.json',{'variable_keys':model['variable_keys'],'values':vector})
    save(ROOT/'witness-model-mapping.json',result)
    return result

def local_checks():
    tests=[]
    for label in ('hand','credit'):
        d=load(SNAP/'known-checks-repair'/f'{label}-relaxation.json')
        exact=certify(d['model'],d['certificate'])
        tests.append({'name':label+'-saved-certificate','expected':d['certificate_check']['lower_bound_exact'],
            'actual':exact['lower_bound_exact'],'passed':exact['lower_bound_exact']==d['certificate_check']['lower_bound_exact'],
            'no_solver_repeated':True})
    scalar={'format':'l06-linear-relaxation/1','variable_lower':[0],'variable_upper':[4],
        'objective_numerators':[1],'objective_denominator':1,'rows':[{'lower':2,'upper':None,'terms':[[0,1]]}]}
    cert={'format':'l06-row-dual-certificate/1','multipliers':[{'row':0,'side':'lower','value':'-2'}]}
    example=certify(scalar,cert)
    tests.append({'name':'nonstationary-box-correction','row_constant':example['row_dual_constant_exact'],
        'correction':example['box_correction_exact'],'actual':example['lower_bound_exact'],'known_true_optimum':2,
        'passed':example['row_dual_constant_exact']=='4' and example['box_correction_exact']=='-4' and example['lower_bound_exact']=='0'})
    path=SNAP/'executed-source-repair/l06_bound_certificate.py'
    spec=importlib.util.spec_from_file_location('repaired_exact_reader',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    invalid={'format':'l06-linear-relaxation/1','variable_lower':[0],'variable_upper':[1],
        'objective_numerators':[1.0],'objective_denominator':1,'rows':[]}
    try:module.evaluate_certificate(invalid,{'format':'l06-row-dual-certificate/1','multipliers':[]});observed='returned'
    except ValueError as e:observed=str(e)
    tests.append({'name':'float-numerator-explicit-error','actual':observed,'passed':observed=='certificate_integer_model'})
    invalid_cert={'format':'l06-row-dual-certificate/1','multipliers':[{'row':-1,'side':'lower','value':'0'}]}
    try:module.evaluate_certificate(scalar,invalid_cert);observed='returned'
    except ValueError as e:observed=str(e)
    tests.append({'name':'row-index-explicit-error','actual':observed,'passed':observed=='certificate_row_index'})
    good=module.evaluate_certificate(load(SNAP/'full/model.json'),load(SNAP/'full/certificate.json'))
    result={'tests':tests,'all_passed':all(t['passed'] for t in tests),'repaired_reader_full_bound':good['lower_bound_exact'],
        'native_known_solver_records_read_not_repeated':load(SNAP/'known-checks-repair/receipt.json'),
        'scope':'stdlib arithmetic plus actual reader error contracts only; no LP/MIP import or solve'}
    save(ROOT/'local-checks.json',result);return result

def main():
    capture();start=time.perf_counter()
    model=load(SNAP/'full/model.json');certificate=load(SNAP/'full/certificate.json');data=load(SNAP/'full/instance.json')
    bound=certify(model,certificate);elapsed=time.perf_counter()-start
    bound['independent_load_and_exact_arithmetic_seconds']=elapsed
    recorded=load(SNAP/'full/certificate_check.json')
    bound['matches_recorded_exact_fields']=all(bound[k]==recorded[k] for k in ('lower_bound_exact','row_dual_constant_exact','box_correction_exact','maximum_stationarity_residual_exact'))
    save(ROOT/'exact-certificate-recalculation.json',bound)
    coverage=audit_model(data,model);witness=witness_mapping(data,model);local=local_checks()
    lower=Fraction(bound['lower_bound_exact']);upper=Fraction(witness['objective_exact'])
    D=model['objective_denominator'];scaled=lower*D;integer_numerator_ceiling=-(-scaled.numerator//scaled.denominator)
    gap={'lower_exact':str(lower),'upper_exact':str(upper),'absolute_gap_exact':str(upper-lower),
        'gap_over_lower_exact':str((upper-lower)/lower),'gap_over_lower_percent':float((upper-lower)/lower*100),
        'gap_over_upper_percent':float((upper-lower)/upper*100),
        'one_percent_upper_certified':upper<=Fraction(101,100)*lower,
        'true_integer_optimum_gap_known':False,
        'optional_integer_objective_lattice_bound':str(Fraction(integer_numerator_ceiling,D)),
        'lattice_bound_assumptions':'source MIP declares every variable integer; exact objective numerator coefficients integers and objective constant0; ceiling objective, never rounding LP variables'}
    save(ROOT/'bound-interval.json',gap)
    command(['git','-C',str(REPO),'status','--short'],'git-status-end')
    result={'scope':'local exact cost-bound/model-inclusion qualification only','completed_utc':datetime.now(timezone.utc).isoformat(),
        'bound':bound,'model_coverage':coverage,
        'integer_witness_all_passed':witness['all_passed'],'witness_objective':witness['objective_exact'],
        'active':{sid:s['active_counts'] for sid,s in witness['scenarios'].items()},
        'local_checks_passed':local['all_passed'],'interval':gap,
        'no_new_LP_MIP_GPU_Provider_or_container_work':True,'freeze_approved':False,'hours_validated':False}
    save(ROOT/'review-summary.json',result)
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
