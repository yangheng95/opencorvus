"""Independent derived-output fixtures and real CLI probes; no optimization imports."""
from decimal import Decimal
from fractions import Fraction
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import time
sys.dont_write_bytecode=True
from review_packet import independent_projection

ROOT=Path(__file__).resolve().parent/'delivery-review'
BASE=Path('D:/opencorvus-benchmark-runs/l06-procurement-qualification-20261029')
PYTHON='C:/Python314/python.exe'
IDS=['C01','C07','C08','C09','C10','C11','D03','D04','D05','D06']

def save(p,v):
    p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
def load(p):return json.loads(p.read_text(encoding='utf-8'))

def own_delivery(d,plan):
    ledger={'format':'l06-ledger/1','scenarios':{}};summary={'format':'l06-summary/1','scenarios':{}};expected=Fraction()
    M=len(d['raw_materials']);J=len(d['products']);P=len(d['plants']);S=len(d['suppliers']);T=d['weeks']
    for scenario in d['scenarios']:
        sid=scenario['id'];a=plan['decisions'][sid];raw=d['initial_raw'].copy();fg=d['initial_products'].copy()
        cash=d['initial_cash_minor'];rows=[];total=0;collected=0;delivered=0
        for t in range(T):
            arrivals=[sum(a['order_lots'][u][k][m]*d['suppliers'][k]['pack_units'][m]
                for u in range(T) for k in range(S) if u+d['suppliers'][k]['lead_weeks']==t) for m in range(M)]
            made=[sum(a['production'][t][p][j] for p in range(P)) for j in range(J)]
            consumed=[sum(made[j]*d['bom'][j][m] for j in range(J)) for m in range(M)]
            raw_peak=sum((raw[m]+arrivals[m])*d['raw_volume'][m] for m in range(M))
            fg_peak=sum((fg[j]+made[j])*d['product_volume'][j] for j in range(J))
            raw=[raw[m]+arrivals[m]-consumed[m] for m in range(M)]
            fg=[fg[j]+made[j]-scenario['demand'][t][j] for j in range(J)]
            supplier_volume=[sum(a['order_lots'][t][k][m]*d['suppliers'][k]['pack_units'][m]*d['raw_volume'][m] for m in range(M)) for k in range(S)]
            hours=[sum(a['production'][t][p][j]*d['production_hours'][j] for j in range(J)) for p in range(P)]
            purchasing=sum(a['order_lots'][t][k][m]*d['suppliers'][k]['pack_units'][m]*d['suppliers'][k]['price_minor'][m] for k in range(S) for m in range(M))
            freight=sum(a['truck_on'][t][k]*d['suppliers'][k]['freight_minor'] for k in range(S))
            labor=sum(a['production'][t][p][j]*d['production_cost_minor'][p][j] for p in range(P) for j in range(J))
            holding=sum(raw[m]*d['raw_holding_minor'][m] for m in range(M))+sum(fg[j]*d['product_holding_minor'][j] for j in range(J))
            cost=purchasing+freight+labor+holding;total+=cost
            past=t-d['receipt_lag_weeks'];receipts=sum(scenario['demand'][past][j]*d['sales_price_minor'][j] for j in range(J)) if past>=0 else 0
            collected+=receipts;delivered+=sum(scenario['demand'][t][j]*d['sales_price_minor'][j] for j in range(J));cash+=receipts-cost
            rows.append({'week':t,'order_lots':a['order_lots'][t],'truck_on':a['truck_on'][t],'production':a['production'][t],
                'arrivals':arrivals,'consumption':consumed,'raw_inventory':raw.copy(),'made':made,'finished_inventory':fg.copy(),
                'hours':hours,'supplier_volume':supplier_volume,'raw_stage_peak_volume':raw_peak,'product_stage_peak_volume':fg_peak,
                'purchase_cost':purchasing,'freight_cost':freight,'production_cost':labor,'holding_cost':holding,'cost':cost,
                'receipts':receipts,'cash':cash,'receivable':delivered-collected})
        ledger['scenarios'][sid]={'weeks':rows}
        summary['scenarios'][sid]={'probability':{'numerator':scenario['probability_numerator'],'denominator':d['probability_denominator']},
            'total_cost_minor':total,'minimum_cash_minor':min(r['cash'] for r in rows),'final_cash_minor':cash,'final_receivable_minor':delivered-collected}
        expected+=Fraction(total*scenario['probability_numerator'],d['probability_denominator'])
    summary['expected_cost_minor']={'numerator':expected.numerator,'denominator':expected.denominator}
    return ledger,summary

def main():
    ROOT.mkdir(exist_ok=False);source=ROOT/'source-initial';source.mkdir();inventory=[]
    for name in ('l06_delivery.py','l06_input.py','l06_packet.py','check_l06.py','qualify_delivery.py'):
        shutil.copy2(BASE/name,source/name);inventory.append({'source':str(BASE/name),'copy':str(source/name),'byte_equal':(BASE/name).read_bytes()==(source/name).read_bytes()})
    shutil.copytree(Path(__file__).resolve().parent/'snapshot/public/inputs',ROOT/'packet')
    plan=load(Path(__file__).resolve().parent/'snapshot/reference-constant-policy.json');d,_=independent_projection(ROOT/'packet')
    ledger,summary=own_delivery(d,plan)
    assert summary['expected_cost_minor']=={'numerator':490329,'denominator':10}
    save(ROOT/'plan.json',plan);save(ROOT/'ledger.json',ledger);save(ROOT/'summary.json',summary);save(ROOT/'source-inventory.json',inventory)
    events=[];checks=[]
    def run(label,expected,packet=ROOT/'packet',p=ROOT/'plan.json',l=ROOT/'ledger.json',s=ROOT/'summary.json',code=0):
        out=ROOT/'results'/(label+'.json');out.parent.mkdir(exist_ok=True)
        argv=[PYTHON,'-X','utf8','-B',str(source/'l06_delivery.py'),'--input',str(packet),'--plan',str(p),'--ledger',str(l),'--summary',str(s),'--out',str(out)]
        start=time.perf_counter();proc=subprocess.run(argv,cwd=ROOT,capture_output=True,text=True,encoding='utf-8')
        dest=ROOT/'commands'/label;dest.parent.mkdir(exist_ok=True)
        dest.with_suffix('.stdout.txt').write_text(proc.stdout,encoding='utf-8');dest.with_suffix('.stderr.txt').write_text(proc.stderr,encoding='utf-8')
        actual=load(out) if out.is_file() else None
        record={'argv':argv,'exit_code':proc.returncode,'seconds':time.perf_counter()-start,'output_created':out.is_file(),
            'expected_exit_code':code,'output':str(out),'stdout':str(dest.with_suffix('.stdout.txt')),'stderr':str(dest.with_suffix('.stderr.txt'))}
        save(dest.with_suffix('.json'),record);events.append(record)
        statuses=None if actual is None else {f['id']:f['status'] for f in actual['findings']}
        checks.append({'contract':label,'passed':proc.returncode==code and (expected is None or statuses==expected),
            'actual_exit':proc.returncode,'expected_exit':code,'actual_findings':statuses,'expected_findings':expected})
        return actual
    passed={i:'verified_pass' for i in IDS}
    run('independent-full-delivery',passed)
    bad=json.loads(json.dumps(summary));bad['scenarios']['base']['minimum_cash_minor']=5369;save(ROOT/'bad-mincash.json',bad)
    run('original-mincash-counterexample',passed|{'C08':'verified_fail'},s=ROOT/'bad-mincash.json',code=2)
    decimal=json.loads(json.dumps(summary));decimal.pop('expected_cost_minor')
    for v in decimal['scenarios'].values():v['probability']={'numerator':v['probability']['numerator']*100,'denominator':v['probability']['denominator']*100}
    (ROOT/'decimal-summary.json').write_text(json.dumps(decimal)[:-1]+',"expected_cost_minor":49032.9}',encoding='utf-8')
    run('finite-decimal-unreduced-fractions',passed,s=ROOT/'decimal-summary.json')
    bad=json.loads(json.dumps(plan));bad['decisions']['base']['raw_inventory'][0][0]+=1;save(ROOT/'bad-optional-plan.json',bad)
    run('optional-inventory-value',passed|{'D03':'verified_fail'},p=ROOT/'bad-optional-plan.json',code=2)
    bad=json.loads(json.dumps(plan));bad['decisions']['base']['finished_inventory']=[];save(ROOT/'bad-optional-shape.json',bad)
    run('optional-inventory-shape',passed|{'D03':'candidate_incomplete'},p=ROOT/'bad-optional-shape.json',code=2)
    credit_packet=BASE/'v2/delivery-projection-final/credit-packet';shutil.copytree(credit_packet,ROOT/'credit-packet')
    cp=load(BASE/'v2/delivery-projection-final/credit-plan.json');cd,_=independent_projection(ROOT/'credit-packet')
    cl,cs=own_delivery(cd,cp)
    assert cs['expected_cost_minor']=={'numerator':7,'denominator':1}
    for r in cl['scenarios'].values():
        assert [x['receivable'] for x in r['weeks']]==[10,0] and [x['cash'] for x in r['weeks']]==[-5,4] and [x['receipts'] for x in r['weeks']]==[0,10]
    save(ROOT/'credit-plan.json',cp);save(ROOT/'credit-ledger.json',cl);save(ROOT/'credit-summary.json',cs)
    run('hand-two-week-AR-cash',passed,packet=ROOT/'credit-packet',p=ROOT/'credit-plan.json',l=ROOT/'credit-ledger.json',s=ROOT/'credit-summary.json')
    bad=json.loads(json.dumps(ledger));bad['scenarios']['base']['weeks'][0]['cost']+=1;save(ROOT/'bad-ledger-cost.json',bad)
    run('ledger-cost-projection',passed|{'D05':'verified_fail'},l=ROOT/'bad-ledger-cost.json',code=2)
    run('candidate-omitted-ledger',passed|{i:'candidate_incomplete' for i in ('D03','D04','D05','D06')},l=ROOT/'candidate-omitted.json',code=2)
    # Finite but beyond Decimal constructor exponent range: should be named candidate input error, never a raw Python crash.
    huge=json.loads(json.dumps(summary));huge.pop('expected_cost_minor')
    (ROOT/'huge-exponent-summary.json').write_text(json.dumps(huge)[:-1]+',"expected_cost_minor":1e9999999999999999999}',encoding='utf-8')
    run('decimal-exponent-boundary',passed|{i:'candidate_incomplete' for i in ('C01','C07','C08','C09','C10','C11')},s=ROOT/'huge-exponent-summary.json',code=2)
    spec=importlib.util.spec_from_file_location('owned_reader_probe',source/'l06_input.py');reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
    reader_checks=[]
    for label,text,flag,expected in [('ordinary-default','1.25',False,('float','1.25')),
       ('ordinary-decimal','1.25',True,('Decimal','1.25')),('default-overflow','1e999',False,('InputError','probe_json')),
       ('default-NaN','NaN',False,('InputError','probe_json')),('duplicate-key','{"a":1,"a":2}',False,('InputError','probe_json'))]:
        f=ROOT/(label+'.json');f.write_text(text,encoding='utf-8')
        try:v=reader.read_json(f,'probe_json',decimal_numbers=flag);actual=(type(v).__name__,str(v))
        except reader.InputError as e:actual=('InputError',e.code)
        reader_checks.append({'contract':label,'actual':actual,'expected':expected,'passed':actual==expected})
    save(ROOT/'default-reader-checks.json',reader_checks);save(ROOT/'cli-contract-checks.json',checks)
    save(ROOT/'receipt.json',{'scope':'10 derived-output leaves only, independently generated base and hand ledger/summary fixtures',
        'actual_cli_count':len(events),'executions':events,'all_cli_contracts_passed':all(c['passed'] for c in checks),
        'failed_contracts':[c['contract'] for c in checks if not c['passed']],
        'default_reader_contracts_passed':all(c['passed'] for c in reader_checks),
        'remaining_37_leaves_graded':False,'total_score_issued':False,'solver_calls':0,'model_calls':0,'GPU':False})
    print(json.dumps({'actual_cli_count':len(events),'failed_contracts':[c['contract'] for c in checks if not c['passed']],
        'default_reader_contracts_passed':all(c['passed'] for c in reader_checks),'no_full_case_grader':True},ensure_ascii=False))

if __name__=='__main__':main()
