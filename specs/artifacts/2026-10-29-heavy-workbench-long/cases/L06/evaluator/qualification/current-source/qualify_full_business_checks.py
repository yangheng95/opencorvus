"""Second-scale full-instance checker probes, no optimization or training."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import time

root=Path(__file__).resolve().parent
out=root/'v2/full-business-contracts-final'
out.mkdir(exist_ok=False)
data=json.loads((root/'v2/inputs/full.json').read_text())
reference=json.loads((root/'v2/full-witness/plan.json').read_text())
reports=[]

def run(label,expected,change_plan=None,change_data=None,raw_plan=None,raw_input=None):
    d,p=copy.deepcopy(data),copy.deepcopy(reference)
    if change_plan:change_plan(p)
    if change_data:change_data(d)
    folder=out/label;folder.mkdir()
    (folder/'input.json').write_text(raw_input if raw_input is not None else json.dumps(d,indent=2)+'\n')
    (folder/'plan.json').write_text(raw_plan if raw_plan is not None else json.dumps(p,indent=2)+'\n')
    argv=[sys.executable,'-B',str(root/'check_l06.py'),'--input',str(folder/'input.json'),'--plan',str(folder/'plan.json'),'--out',str(folder/'result.json')]
    start=time.perf_counter();r=subprocess.run(argv,capture_output=True,text=True)
    (folder/'stdout.txt').write_text(r.stdout);(folder/'stderr.txt').write_text(r.stderr)
    def invalid_number(value):raise ValueError('non-JSON result number '+value)
    result=json.loads((folder/'result.json').read_text(),parse_constant=invalid_number)
    observed='business_feasible' if result['business_feasible'] else result['error']
    assert observed==expected and r.returncode==(0 if expected=='business_feasible' else 2),(label,r.returncode,result)
    row={'case':label,'expected':expected,'actual':observed,'exit_code':r.returncode,'seconds':time.perf_counter()-start,'command':argv,
         'computed_expected_cost_minor':result.get('expected_cost_minor'),'where':result.get('where')}
    reports.append(row)
    return result

base=run('complete-feasible-credit-witness','business_feasible')
def waste(p):
    for record in p['decisions'].values():
        record['order_lots'][-1][2][0]+=20
        record['truck_on'][-1][2]=1
        record['raw_inventory'][-1][0]+=20
bad=run('feasible-dominated-terminal-purchase','business_feasible',waste)
assert bad['expected_cost_minor']>1.01*base['expected_cost_minor']
run('stale-demand-fulfilment','fulfilment',change_data=lambda d:d['scenarios'][0]['demand'][-1].__setitem__(0,d['scenarios'][0]['demand'][-1][0]+1))
run('original-insufficient-credit','cash_limit',change_data=lambda d:d.update(credit_limit_minor=5000))
run('stale-bom-consumption','raw_availability',change_data=lambda d:d['bom'][0].__setitem__(0,d['bom'][0][0]+100))
def capacity(d):
    row=base['scenarios']['base']['weeks'][4]
    supplier=next(i for i,x in enumerate(row['supplier_volume']) if x>0)
    d['scenarios'][0]['supplier_capacity_volume'][4][supplier]=row['supplier_volume'][supplier]-1
run('shared-supplier-capacity','supplier_capacity',change_data=capacity)
run('declared-stock-is-recomputed','declared_raw',lambda p:p['decisions']['base']['raw_inventory'][-1].__setitem__(0,p['decisions']['base']['raw_inventory'][-1][0]+1))
def late(p):
    p['decisions']['base']['order_lots'][-1][0][0]=4
    p['decisions']['base']['truck_on'][-1][0]=1
run('terminal-in-transit-order','terminal_pipeline',late)
claimed=run('reported-zero-cost-is-recomputed','business_feasible',lambda p:p.update(expected_cost_minor=0))
assert claimed['expected_cost_minor']==base['expected_cost_minor']
run('future-specific-early-order','common_commitment',lambda p:p['decisions']['supplier_disruption']['order_lots'][0][0].__setitem__(0,p['decisions']['supplier_disruption']['order_lots'][0][0][0]+1))
run('unqualified-product-line','product_assignment',lambda p:p['decisions']['base']['production'][-1][0].__setitem__(3,1))
run('fractional-purchase-lots','decision_integer',lambda p:p['decisions']['base']['order_lots'][0][0].__setitem__(0,0.5))
run('raw-stage-peak-cannot-use-end-stock','raw_storage_peak',change_data=lambda d:d.update(raw_storage_volume=220))
run('product-stage-peak-cannot-use-end-stock','product_storage_peak',change_data=lambda d:d.update(product_storage_volume=42))
def signed_probability(d):
    d['scenarios'][0]['probability_numerator']=15
    d['scenarios'][1]['probability_numerator']=-7
run('strict-positive-probability','instance_invalid',change_data=signed_probability)
run('cost-vector-dimension','instance_invalid',change_data=lambda d:d.update(raw_holding_minor=[]))
run('top-level-plan-type','plan_contract',raw_plan='[]')
run('malformed-plan-json','plan_json',raw_plan='{')
run('malformed-instance-json','instance_invalid',raw_input='{')
run('duplicate-plan-json-field','plan_json',raw_plan='{"format":"l06-plan/1","format":"l06-plan/1"}')
run('unrepresentable-float-json','plan_json',raw_plan='{"format":1e999}')
run('instance-error-precedes-bad-plan','instance_invalid',change_data=lambda d:d.update(raw_holding_minor=[]),raw_plan='{')
receipt={'scope':'v2 stage-peak full finite-instance checker contracts; not candidate execution or cost-optimality certification',
         'actual_cli_cases':len(reports),'all_expected_contracts_passed':True,'baseline_cost':base['expected_cost_minor'],
         'dominated_feasible_cost':bad['expected_cost_minor'],
         'dominated_plan_above_one_percent_of_known_feasible_upper_bound':True,
         'cost_optimum_claimed':False,'executions':reports}
(out/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({k:v for k,v in receipt.items() if k!='executions'}))
