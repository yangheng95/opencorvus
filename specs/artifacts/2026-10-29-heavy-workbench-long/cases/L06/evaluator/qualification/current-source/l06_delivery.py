"""Read-only derived-output findings; does not grade the full task or attest execution."""
import argparse
from decimal import Decimal
from fractions import Fraction
import json
from pathlib import Path

from check_l06 import evaluate,PlanError
from l06_input import read_json,InputError
from l06_packet import read_packet


SUMMARY_FIELDS={'C07':'total_cost_minor','C08':'minimum_cash_minor','C09':'final_cash_minor',
                'C10':'final_receivable_minor','C11':'probability'}
LEDGER_FIELDS={
    'D03':['arrivals','consumption','raw_inventory','made','finished_inventory','raw_stage_peak_volume','product_stage_peak_volume'],
    'D04':['order_lots','truck_on','production','hours','supplier_volume'],
    'D05':['purchase_cost','freight_cost','production_cost','holding_cost','cost'],
    'D06':['receipts','cash','receivable'],
}
IDS=['C01',*SUMMARY_FIELDS,*LEDGER_FIELDS]


def operational_decisions(plan):
    # Inventory declarations are outputs in D03; physical actions use the one
    # business recurrence. Candidate declarations never supply physical state.
    if not isinstance(plan,dict) or not isinstance(plan.get('decisions'),dict):return plan
    return {**plan,'decisions':{name:{key:value for key,value in record.items() if key not in ('raw_inventory','finished_inventory')} if isinstance(record,dict) else record for name,record in plan['decisions'].items()}}


def assess_inventory_claims(plan,expected):
    for name,record in plan['decisions'].items():
        for field in ['raw_inventory','finished_inventory']:
            if field not in record:continue
            target=[row[field] for row in expected['scenarios'][name]['weeks']]
            if not integer_structure(record[field],target):return finding('D03','candidate_incomplete',f'plan.{name}.{field}','inventory declaration integer shape')
            if not exact_integer_value(record[field],target):return finding('D03','verified_fail',f'plan.{name}.{field}','optional inventory declaration differs from actual recurrence')
    return finding('D03','verified_pass','plan.inventory_claims')


def expected_delivery(data,plan,business):
    ledger={'format':'l06-ledger/1','scenarios':{}}
    summary={'format':'l06-summary/1','expected_cost_minor':business['expected_cost_exact'],'scenarios':{}}
    for scenario in data['scenarios']:
        name=scenario['id'];evaluated=business['scenarios'][name];rows=[]
        for t,source in enumerate(evaluated['weeks']):
            row=dict(source)
            for field in ['order_lots','truck_on','production']:row[field]=plan['decisions'][name][field][t]
            first=max(0,t-data['receipt_lag_weeks']+1)
            row['receivable']=sum(sum(q*p for q,p in zip(demand,data['sales_price_minor'])) for demand in scenario['demand'][first:t+1])
            rows.append(row)
        ledger['scenarios'][name]={'weeks':rows}
        summary['scenarios'][name]={field:evaluated[field] for field in SUMMARY_FIELDS.values() if field!='probability'}
        summary['scenarios'][name]['probability']={'numerator':scenario['probability_numerator'],'denominator':data['probability_denominator']}
    return ledger,summary


def rational(value):
    if type(value) in (int,Decimal):return Fraction(value)
    if type(value) is dict and set(value)=={'numerator','denominator'} and type(value['numerator']) is int and type(value['denominator']) is int and value['denominator']>0:
        return Fraction(value['numerator'],value['denominator'])
    raise ValueError('finite decimal number or integer numerator/positive denominator required')


def exact_integer_value(actual,expected):
    if type(expected) is list:
        return type(actual) is list and len(actual)==len(expected) and all(exact_integer_value(a,e) for a,e in zip(actual,expected))
    return type(actual) is int and actual==expected


def integer_structure(actual,expected):
    if type(expected) is list:
        return type(actual) is list and len(actual)==len(expected) and all(integer_structure(a,e) for a,e in zip(actual,expected))
    return type(actual) is int


def finding(identifier,status,where,detail=None):
    return {'id':identifier,'status':status,'where':where,'detail':detail}


def assess_summary(actual,expected):
    findings=[]
    if not isinstance(actual,dict) or actual.get('format')!='l06-summary/1' or not isinstance(actual.get('scenarios'),dict) or set(actual['scenarios'])!=set(expected['scenarios']):
        return [finding(i,'candidate_incomplete','summary','summary format/scenario coverage') for i in ['C01',*SUMMARY_FIELDS]]
    def field(identifier,targets,as_rational):
        for where,container,key,target in targets:
            if not isinstance(container,dict) or key not in container:return finding(identifier,'candidate_incomplete',where,'required summary field')
            if not as_rational and type(container[key]) is not int:return finding(identifier,'candidate_incomplete',where,'exact integer money required')
            try:
                match=rational(container[key])==rational(target) if as_rational else exact_integer_value(container[key],target)
            except ValueError as error:return finding(identifier,'candidate_incomplete',where,str(error))
            if not match:return finding(identifier,'verified_fail',where,'reported summary differs from exact business recurrence')
        return finding(identifier,'verified_pass','summary')
    findings.append(field('C01',[('summary.expected_cost_minor',actual,'expected_cost_minor',expected['expected_cost_minor'])],True))
    for identifier,name in SUMMARY_FIELDS.items():
        findings.append(field(identifier,[(f'summary.scenarios.{s}.{name}',actual['scenarios'][s],name,record[name]) for s,record in expected['scenarios'].items()],name=='probability'))
    return findings


def assess_ledger(actual,expected):
    if not isinstance(actual,dict) or actual.get('format')!='l06-ledger/1' or not isinstance(actual.get('scenarios'),dict) or set(actual['scenarios'])!=set(expected['scenarios']):
        return [finding(i,'candidate_incomplete','ledger','ledger format/scenario coverage') for i in LEDGER_FIELDS]
    output=[]
    for identifier,fields in LEDGER_FIELDS.items():
        result=finding(identifier,'verified_pass','ledger')
        for name,record in expected['scenarios'].items():
            candidate=actual['scenarios'][name]
            rows=candidate.get('weeks') if isinstance(candidate,dict) else None
            if not isinstance(rows,list) or len(rows)!=len(record['weeks']):
                result=finding(identifier,'candidate_incomplete',f'ledger.{name}.weeks','complete week coverage');break
            for t,(row,expected_row) in enumerate(zip(rows,record['weeks'])):
                if not isinstance(row,dict) or type(row.get('week')) is not int or row['week']!=t:
                    result=finding(identifier,'candidate_incomplete',f'ledger.{name}.weeks[{t}]','explicit ascending week identity');break
                for field in fields:
                    if field not in row:
                        result=finding(identifier,'candidate_incomplete',f'ledger.{name}.week{t}.{field}','required ledger field');break
                    if not integer_structure(row[field],expected_row[field]):
                        result=finding(identifier,'candidate_incomplete',f'ledger.{name}.week{t}.{field}','exact integer shape required');break
                    if not exact_integer_value(row[field],expected_row[field]):
                        result=finding(identifier,'verified_fail',f'ledger.{name}.week{t}.{field}','reported ledger differs from exact business recurrence');break
                if result['status']!='verified_pass':break
            if result['status']!='verified_pass':break
        output.append(result)
    return output


def main():
    parser=argparse.ArgumentParser()
    for field in ['input','plan','ledger','summary','out']:parser.add_argument('--'+field,type=Path,required=True)
    args=parser.parse_args()
    result={'format':'l06-derived-output-findings/1','scope':'10 output projection leaves only; full rubric, execution, quality and total score unassessed','status':'assessed','findings':[]}
    try:
        data=read_packet(args.input)
    except InputError as error:
        result.update(status='run_invalid',infrastructure_error={'code':error.code,'where':error.path,'detail':error.detail})
    else:
        try:
            plan=read_json(args.plan,'plan_json');business=evaluate(data,operational_decisions(plan))
        except (InputError,PlanError) as error:
            result['status']='candidate_blocked'
            result['findings']=[finding(i,'blocked_candidate','plan',{'code':error.code,'where':getattr(error,'path',getattr(error,'where',None))}) for i in IDS]
        else:
            ledger,summary=expected_delivery(data,plan,business)
            for name,expected,assessor,identifiers in [('summary',summary,assess_summary,['C01',*SUMMARY_FIELDS]),('ledger',ledger,assess_ledger,list(LEDGER_FIELDS))]:
                try:
                    value=read_json(getattr(args,name),name+'_json',decimal_numbers=name=='summary')
                except InputError as error:
                    result['findings'].extend(finding(i,'candidate_incomplete',name,{'code':error.code,'where':error.path,'detail':error.detail}) for i in identifiers)
                else:result['findings'].extend(assessor(value,expected))
            declaration=assess_inventory_claims(plan,ledger)
            if declaration['status']!='verified_pass':
                result['findings']=[declaration if item['id']=='D03' and item['status']=='verified_pass' else item for item in result['findings']]
    result['counts']={status:sum(f['status']==status for f in result['findings']) for status in ['verified_pass','verified_fail','candidate_incomplete','blocked_candidate']}
    args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
    print(json.dumps(result,allow_nan=False))
    raise SystemExit(3 if result['status']=='run_invalid' else 0 if result['counts']['verified_pass']==len(IDS) else 2)


if __name__=='__main__':main()
