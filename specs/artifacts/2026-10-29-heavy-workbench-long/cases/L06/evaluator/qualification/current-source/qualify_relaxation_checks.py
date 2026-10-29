"""Cheap constructive checks against independent hand-computed optima."""
import argparse
import json
from fractions import Fraction
from pathlib import Path
import time

from check_l06 import evaluate
from l06_bound_certificate import evaluate_certificate
from l06_input import read_json
from qualify_l06 import solve,solve_relaxation


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    args.output.mkdir(parents=True,exist_ok=False)
    data={'format':'l06-feasibility-instance/2','weeks':1,'common_weeks':1,'probability_denominator':1,
          'raw_materials':['R'],'products':['P'],'plants':['F'],
          'suppliers':[{'id':'A','lead_weeks':0,'pack_units':[2],'price_minor':[1],'freight_minor':2,'minimum_volume':2}],
          'allowed':[[1]],'production_hours':[1],'production_cost_minor':[[1]],'bom':[[1]],
          'raw_volume':[1],'product_volume':[1],'raw_holding_minor':[1],'product_holding_minor':[1],
          'raw_storage_volume':2,'product_storage_volume':1,'initial_raw':[0],'initial_products':[0],
          'initial_cash_minor':100,'credit_limit_minor':0,'sales_price_minor':[10],'receipt_lag_weeks':1,
          'scenarios':[{'id':'only','probability_numerator':1,'demand':[[1]],'supplier_capacity_volume':[[2]],'plant_capacity_hours':[[1]]}]}
    def write(name,value):
        (args.output/(name+'.json')).write_text(json.dumps(value,indent=2,allow_nan=False)+'\n')
    start=time.perf_counter()
    write('hand-input',data)
    integer,plan=solve(data)
    business=evaluate(data,plan)
    assert integer['objective']==integer['dual_bound']==business['expected_cost_minor']==6
    write('hand-integer',{'solver':integer,'plan':plan,'independent_business':business})
    linear,proof=solve_relaxation(data)
    assert linear['objective']==3 and Fraction(linear['certified_lower_bound_exact'])==3
    assert proof['fractional_solution'][0]==0.5
    write('hand-relaxation',{'solver':linear,**proof})
    scalar={'format':'l06-linear-relaxation/1','variable_lower':[0],'variable_upper':[4],
            'objective_numerators':[1],'objective_denominator':1,'rows':[{'lower':2,'upper':None,'terms':[[0,1]]}]}
    corrected=evaluate_certificate(scalar,{'format':'l06-row-dual-certificate/1','multipliers':[{'row':0,'side':'lower','value':'-2'}]})
    assert corrected['row_dual_constant_exact']=='4' and corrected['box_correction_exact']=='-4' and corrected['lower_bound_exact']=='0'
    write('known-inexact-dual-correction',corrected)
    tiny=read_json(Path(__file__).parent/'v2/inputs/tiny.json','instance_invalid')
    regression,tiny_plan=solve(tiny)
    tiny_business=evaluate(tiny,tiny_plan)
    assert regression['objective']==regression['dual_bound']==tiny_business['expected_cost_minor']==4.5
    write('registered-tiny-integer',{'solver':regression,'plan':tiny_plan,'independent_business':tiny_business})
    credit=json.loads(json.dumps(data))
    credit.update(weeks=2,common_weeks=2,probability_denominator=2,initial_cash_minor=1,credit_limit_minor=10)
    credit['scenarios']=[{'id':name,'probability_numerator':1,'demand':[[1],[0]],
                         'supplier_capacity_volume':[[2],[2]],'plant_capacity_hours':[[1],[1]]} for name in ('a','b')]
    write('credit-input',credit)
    credit_integer,credit_plan=solve(credit,minimum_credit=True)
    assert credit_integer['objective']==credit_integer['dual_bound']==credit_integer['minimum_credit_limit_minor']==5
    credit_exact=json.loads(json.dumps(credit));credit_exact['credit_limit_minor']=5
    credit_business=evaluate(credit_exact,credit_plan)
    assert credit_business['business_feasible'] and all(v['minimum_cash_minor']==-5 for v in credit_business['scenarios'].values())
    write('credit-integer',{'solver':credit_integer,'plan':credit_plan,'independent_business':credit_business})
    credit_linear,credit_proof=solve_relaxation(credit,minimum_credit=True)
    assert credit_linear['objective']==2 and Fraction(credit_linear['certified_lower_bound_exact'])==2
    write('credit-relaxation',{'solver':credit_linear,**credit_proof})
    bad_integer=json.loads(json.dumps(scalar));bad_integer['objective_numerators']=[1.0]
    try:
        evaluate_certificate(bad_integer,{'format':'l06-row-dual-certificate/1','multipliers':[]})
    except ValueError as error:
        assert str(error)=='certificate_integer_model'
        write('certificate-integer-contract',{'input_objective':[1.0],'error':'certificate_integer_model','exception_type':'ValueError'})
    else:raise AssertionError('integer-model input must map to its declared error contract')
    write('receipt',{'status':'passed','hand_integer':6,'hand_continuous':3,'hand_exact_certificate':'3',
                     'inexact_dual_example_true_optimum':2,'inexact_dual_certified_lower_bound':'0',
                     'registered_tiny_integer':4.5,'hand_minimum_credit_integer':5,'hand_minimum_credit_continuous':2,
                     'certificate_integer_error':'certificate_integer_model','seconds':time.perf_counter()-start,
                     'scope':'local numeric/build regression, not heavy-case completion or cost certificate for the full instance'})
    print(json.dumps({'cheap_checks':'passed','output':str(args.output)}),flush=True)


if __name__=='__main__':main()
