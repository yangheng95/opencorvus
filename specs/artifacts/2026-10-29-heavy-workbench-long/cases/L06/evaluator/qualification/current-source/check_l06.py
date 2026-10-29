"""Exact business recurrences; imports neither solver nor candidate implementation."""
import argparse
from fractions import Fraction
import json
from pathlib import Path

from l06_input import InputError, read_json, validate_instance,diagnostic_value


class PlanError(ValueError):
    def __init__(self, code, where, actual=None, required=None):
        self.code,self.where,self.actual,self.required=code,where,diagnostic_value(actual),diagnostic_value(required)
        super().__init__(f'{code}: {where}: {self.actual!r}, required {self.required!r}')


def need(condition, code, where, actual=None, required=None):
    if not condition:
        raise PlanError(code, where, actual, required)


def integer_tensor(value, dimensions, where):
    if not dimensions:
        need(type(value) is int and value >= 0, 'decision_integer', where, value, 'nonnegative integer')
        return
    need(isinstance(value, list) and len(value) == dimensions[0], 'decision_shape', where, None, dimensions)
    for i, row in enumerate(value):
        integer_tensor(row, dimensions[1:], f'{where}[{i}]')


def inspect_plan(data, plan):
    validate_instance(data)
    need(isinstance(plan,dict), 'plan_contract', '$', None, 'plan object')
    need(plan.get('format') == 'l06-plan/1', 'plan_contract', 'format', plan.get('format'), 'l06-plan/1')
    T, M, J, S, P = data['weeks'], len(data['raw_materials']), len(data['products']), len(data['suppliers']), len(data['plants'])
    scenarios, decisions = data['scenarios'], plan.get('decisions')
    need(isinstance(decisions, dict) and set(decisions) == {s['id'] for s in scenarios}, 'scenario_coverage', 'decisions')
    probability = sum((Fraction(s['probability_numerator'], data['probability_denominator']) for s in scenarios), Fraction())
    need(probability == 1, 'instance_probability', 'scenarios', str(probability), '1')
    first = scenarios[0]
    K = data['common_weeks']
    for scenario in scenarios:
        name, record = scenario['id'], decisions[scenario['id']]
        need(isinstance(record, dict), 'decision_type', name)
        for field, shape in [('order_lots', [T,S,M]), ('truck_on', [T,S]), ('production', [T,P,J])]:
            integer_tensor(record.get(field), shape, f'{name}.{field}')
        for field in ('demand','supplier_capacity_volume','plant_capacity_hours'):
            need(scenario[field][:K] == first[field][:K], 'instance_information', f'{name}.{field}')
        for field, shape in [('raw_inventory',[T,M]),('finished_inventory',[T,J])]:
            if field in record:
                integer_tensor(record[field],shape,f'{name}.{field}')
    violations=[];checks={}
    def check(condition,code,where,actual=None,required=None,context=None):
        context={} if context is None else context
        family=('cash_terminal' if context['terminal'] else 'cash_intermediate') if code=='cash_limit' else code
        checks[family]=checks.get(family,0)+1
        if not condition:violations.append({'code':code,'where':where,'actual':diagnostic_value(actual),'required':diagnostic_value(required),'context':context})
    for scenario in scenarios:
        name=scenario['id'];record=decisions[name]
        for field in ('order_lots','truck_on','production'):
            check(record[field][:K] == decisions[first['id']][field][:K], 'common_commitment', f'{name}.{field}')
    results = {}
    expected = Fraction()
    for scenario in scenarios:
        name = scenario['id']; record = decisions[name]
        lots, trucks, production = record['order_lots'], record['truck_on'], record['production']
        arrivals = [[0]*M for _ in range(T)]
        purchase_cost = [0]*T; shipment_cost = [0]*T; weekly_volumes = []
        hits = {'supplier_capacity':0,'shipment_minimum':0,'plant_capacity':0,'raw_storage':0,'product_storage':0,'credit_limit':0}
        for t in range(T):
            volumes = []
            for supplier, rule in enumerate(data['suppliers']):
                on = trucks[t][supplier]
                check(on in (0,1), 'shipment_binary', f'{name}.week{t}.{rule["id"]}', on, '0 or 1')
                units = [lots[t][supplier][m]*rule['pack_units'][m] for m in range(M)]
                volume = sum(u*v for u,v in zip(units,data['raw_volume']))
                capacity = scenario['supplier_capacity_volume'][t][supplier]
                check(volume <= capacity*on, 'supplier_capacity', f'{name}.week{t}.{rule["id"]}', volume, capacity*on)
                check(volume >= rule['minimum_volume']*on, 'shipment_minimum', f'{name}.week{t}.{rule["id"]}', volume, rule['minimum_volume']*on)
                arrival = t+rule['lead_weeks']
                check(arrival < T or sum(units) == 0, 'terminal_pipeline', f'{name}.week{t}.{rule["id"]}', arrival, f'<{T} for a positive order')
                if arrival < T:
                    for m, count in enumerate(units):
                        arrivals[arrival][m] += count
                purchase_cost[t] += sum(u*p for u,p in zip(units,rule['price_minor']))
                shipment_cost[t] += on*rule['freight_minor']
                hits['supplier_capacity'] += int(on == 1 and volume == capacity)
                hits['shipment_minimum'] += int(on == 1 and volume == rule['minimum_volume'])
                volumes.append(volume)
            weekly_volumes.append(volumes)
        raw, finished, cash = data['initial_raw'].copy(), data['initial_products'].copy(), data['initial_cash_minor']
        rows, total = [], 0
        for t in range(T):
            made = [sum(production[t][p][j] for p in range(P)) for j in range(J)]
            labor = 0; hours_used = []
            for p in range(P):
                for j in range(J):
                    check(data['allowed'][p][j] == 1 or production[t][p][j] == 0, 'product_assignment', f'{name}.week{t}.{p}.{j}')
                    labor += production[t][p][j]*data['production_cost_minor'][p][j]
                hours = sum(count*h for count,h in zip(production[t][p],data['production_hours']))
                cap = scenario['plant_capacity_hours'][t][p]
                check(hours <= cap, 'plant_capacity', f'{name}.week{t}.{p}', hours, cap)
                hits['plant_capacity'] += int(cap > 0 and hours == cap)
                hours_used.append(hours)
            used = [sum(made[j]*data['bom'][j][m] for j in range(J)) for m in range(M)]
            raw_before_production = [previous+incoming for previous,incoming in zip(raw,arrivals[t])]
            finished_before_delivery = [previous+produced for previous,produced in zip(finished,made)]
            raw_peak = sum(count*v for count,v in zip(raw_before_production,data['raw_volume']))
            finished_peak = sum(count*v for count,v in zip(finished_before_delivery,data['product_volume']))
            check(raw_peak <= data['raw_storage_volume'], 'raw_storage_peak', f'{name}.week{t}', raw_peak, data['raw_storage_volume'])
            check(finished_peak <= data['product_storage_volume'], 'product_storage_peak', f'{name}.week{t}', finished_peak, data['product_storage_volume'])
            raw = [available-consuming for available,consuming in zip(raw_before_production,used)]
            finished = [available-demand for available,demand in zip(finished_before_delivery,scenario['demand'][t])]
            check(min(raw)>=0, 'raw_availability', f'{name}.week{t}', raw, 'all >=0 after BOM consumption')
            check(min(finished)>=0, 'fulfilment', f'{name}.week{t}', finished, 'all >=0 after all demand is delivered')
            raw_volume = sum(count*v for count,v in zip(raw,data['raw_volume']))
            finished_volume = sum(count*v for count,v in zip(finished,data['product_volume']))
            hits['raw_storage'] += int(raw_peak == data['raw_storage_volume'])
            hits['product_storage'] += int(finished_peak == data['product_storage_volume'])
            if 'raw_inventory' in record:
                check(record['raw_inventory'][t] == raw, 'declared_raw', f'{name}.week{t}', record['raw_inventory'][t], raw)
            if 'finished_inventory' in record:
                check(record['finished_inventory'][t] == finished, 'declared_finished', f'{name}.week{t}', record['finished_inventory'][t], finished)
            holding = sum(count*c for count,c in zip(raw,data['raw_holding_minor']))+sum(count*c for count,c in zip(finished,data['product_holding_minor']))
            cost = purchase_cost[t]+shipment_cost[t]+labor+holding
            past = t-data['receipt_lag_weeks']
            received = sum(count*p for count,p in zip(scenario['demand'][past],data['sales_price_minor'])) if past>=0 else 0
            cash += received-cost; total += cost
            floor = 0 if t==T-1 else -data['credit_limit_minor']
            check(cash >= floor, 'cash_limit', f'{name}.week{t}', cash, floor,{'week':t,'terminal':t==T-1})
            hits['credit_limit'] += int(t<T-1 and cash == floor)
            rows.append({'week':t,'raw_inventory':raw.copy(),'finished_inventory':finished.copy(),
                         'arrivals':arrivals[t],'consumption':used,'made':made,'hours':hours_used,
                         'raw_stage_peak_volume':raw_peak,'product_stage_peak_volume':finished_peak,
                         'supplier_volume':weekly_volumes[t],'purchase_cost':purchase_cost[t],'freight_cost':shipment_cost[t],
                         'production_cost':labor,'holding_cost':holding,'cost':cost,'receipts':received,'cash':cash})
        check(all(count == 0 for count in finished), 'terminal_finished', name, finished, 'all zero')
        lag = data['receipt_lag_weeks']
        receivable = sum(sum(count*p for count,p in zip(row,data['sales_price_minor'])) for row in scenario['demand'][max(0,T-lag):])
        expected += Fraction(total*scenario['probability_numerator'],data['probability_denominator'])
        results[name] = {'total_cost_minor':total,'final_cash_minor':cash,'final_receivable_minor':receivable,
                         'minimum_cash_minor':min(row['cash'] for row in rows),'active_constraints':hits,'weeks':rows}
    feasible=len(violations)==0
    return {'business_feasible':feasible,'scope':'exact finite instance plan recurrence only; not execution attestation or optimality certificate',
            'expected_cost_minor':float(expected) if feasible else None,
            'expected_cost_exact':{'numerator':expected.numerator,'denominator':expected.denominator} if feasible else None,
            'scenarios':results if feasible else None,'violations':violations,'constraint_checks':checks}


def evaluate(data,plan):
    result=inspect_plan(data,plan)
    if result['violations']:
        error=result['violations'][0]
        raise PlanError(error['code'],error['where'],error['actual'],error['required'])
    return {key:value for key,value in result.items() if key not in ('violations','constraint_checks')}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,required=True);parser.add_argument('--plan',type=Path,required=True);parser.add_argument('--out',type=Path,required=True);args=parser.parse_args()
    try:
        data=validate_instance(read_json(args.input,'instance_invalid'))
        result=evaluate(data,read_json(args.plan,'plan_json'))
    except InputError as error:
        result={'business_feasible':False,'error':error.code,'where':error.path,'detail':error.detail}
    except PlanError as error:
        result={'business_feasible':False,'error':error.code,'where':error.where,'actual':error.actual,'required':error.required}
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k!='scenarios'},allow_nan=False))
    raise SystemExit(0 if result['business_feasible'] else 2)


if __name__=='__main__':
    main()
