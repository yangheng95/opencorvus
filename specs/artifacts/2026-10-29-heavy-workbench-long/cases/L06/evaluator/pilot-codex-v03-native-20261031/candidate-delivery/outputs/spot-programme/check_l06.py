"""Exact business recurrences; imports neither solver nor candidate implementation."""
import argparse
from fractions import Fraction
import json
from pathlib import Path

from l06_input import InputError, read_json, validate_instance,diagnostic_value
from l06_physics import initial_state, propose_week


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
        name=scenario['id'];record=decisions[name];state=initial_state(data)
        rows=[];observations=[]
        hits={key:0 for key in ('supplier_capacity','shipment_minimum','plant_capacity','raw_storage','product_storage','credit_limit')}
        for t in range(T):
            event={key:scenario[key][t] for key in ('demand','supplier_capacity_volume','plant_capacity_hours')}
            action={key:record[key][t] for key in ('order_lots','truck_on','production')}
            declared={key:record[key][t] for key in ('raw_inventory','finished_inventory') if key in record}
            proposed=propose_week(data,state,event,action,name,declared)
            # Legacy inspection intentionally continues tentative algebra to
            # collect all residuals. An invalid path never publishes finance.
            state=proposed['tentative_state'];rows.append(proposed['week_row'])
            observations.extend(proposed['observations'])
            for key,count in proposed['active_constraints'].items():hits[key]+=count
        # Preserve the established first-error contract: every order predicate
        # was historically collected before any physical-week predicate.
        for stage in ('order','physical'):
            for item in observations:
                if item['stage']==stage:
                    check(item['passed'],item['code'],item['where'],item['actual'],item['required'],item['context'])
        check(all(count==0 for count in state['finished']),'terminal_finished',name,state['finished'],'all zero')
        total=state['total_cost_minor'];receivable=sum(state['receipts_by_week'][T:])
        expected+=Fraction(total*scenario['probability_numerator'],data['probability_denominator'])
        results[name]={'total_cost_minor':total,'final_cash_minor':state['cash'],'final_receivable_minor':receivable,
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
