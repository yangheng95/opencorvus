"""Fixed-model integer oracle comparison only. Not a production solver router."""
import argparse
from fractions import Fraction
import json
from pathlib import Path
import time

import ortools
from ortools.sat.python import cp_model

from l06_input import read_json,validate_instance
from l06_plan import plan_from_vector


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--model',type=Path,required=True);parser.add_argument('--input',type=Path,required=True)
    parser.add_argument('--hint',type=Path);parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--seconds',type=float,required=True);parser.add_argument('--workers',type=int,required=True)
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=False)
    raw=read_json(args.model,'model_input');data=validate_instance(read_json(args.input,'instance_invalid'))
    if raw['format']!='l06-linear-relaxation/1':raise ValueError('fixed_model_format')
    lower,upper=raw['variable_lower'],raw['variable_upper'];numerators=raw['objective_numerators'];denominator=raw['objective_denominator']
    if len(lower)!=len(upper) or len(lower)!=len(numerators) or len(lower)!=len(raw['variable_keys']):raise ValueError('fixed_model_dimension')
    if any(type(v) is not int for v in [denominator,*lower,*upper,*numerators]) or denominator<=0:raise ValueError('fixed_model_integer')
    model=cp_model.CpModel()
    variables=[model.new_int_var(lo,hi,'v'+str(i)) for i,(lo,hi) in enumerate(zip(lower,upper))]
    for row in raw['rows']:
        if any(type(k) is not int or type(c) is not int or not 0<=k<len(variables) for k,c in row['terms']):raise ValueError('fixed_model_coefficient')
        expression=sum(coefficient*variables[index] for index,coefficient in row['terms'])
        model.add_linear_constraint(expression,cp_model.INT_MIN if row['lower'] is None else row['lower'],cp_model.INT_MAX if row['upper'] is None else row['upper'])
    model.minimize(sum(c*v for c,v in zip(numerators,variables)))
    hint_objective=None
    if args.hint:
        hint=read_json(args.hint,'hint_input')
        if hint['variable_keys']!=raw['variable_keys']:raise ValueError('hint_column_identity')
        values=hint['values']
        if len(values)!=len(variables) or any(type(v) is not int or not lo<=v<=hi for v,lo,hi in zip(values,lower,upper)):
            raise ValueError('hint_integer_box')
        for row in raw['rows']:
            activity=sum(coefficient*values[index] for index,coefficient in row['terms'])
            if row['lower'] is not None and activity<row['lower'] or row['upper'] is not None and activity>row['upper']:
                raise ValueError('hint_constraint')
        for variable,value in zip(variables,values):model.add_hint(variable,value)
        hint_objective=str(Fraction(sum(c*v for c,v in zip(numerators,values)),denominator))
    validation=model.validate()
    if validation:raise ValueError('native_model_invalid:'+validation)
    solver=cp_model.CpSolver();solver.parameters.max_time_in_seconds=args.seconds
    solver.parameters.num_search_workers=args.workers;solver.parameters.random_seed=20261029;solver.parameters.log_search_progress=True
    start=time.perf_counter();status=solver.solve(model);seconds=time.perf_counter()-start
    feasible=status in (cp_model.OPTIMAL,cp_model.FEASIBLE)
    report={'format':'l06-cpsat-fixed-model-comparison/1','scope':'oracle research comparison, not candidate result or fallback',
            'solver_version':ortools.__version__,'status':solver.status_name(status),'native_status_code':int(status),
            'seconds':seconds,'workers':args.workers,'requested_seconds':args.seconds,'random_seed':20261029,
            'model_variables':len(variables),'source_rows':len(raw['rows']),'objective_denominator':denominator,
            'has_feasible_incumbent':feasible,'hint_cost_exact':hint_objective,
            'native_best_bound_scaled':solver.best_objective_bound,'native_numeric_bound_minor':solver.best_objective_bound/denominator,
            'native_bound_scope':'native CP-SAT integer-search bound; distinct from rational LP certificate',
            'native_objective_scaled':solver.objective_value if feasible else None,'branches':solver.num_branches,'conflicts':solver.num_conflicts}
    if feasible:
        values=[solver.value(v) for v in variables]
        exact=sum(c*v for c,v in zip(numerators,values))
        if exact!=solver.objective_value:raise ValueError('native_objective_projection')
        report['objective_exact']=str(Fraction(exact,denominator));report['objective_minor']=exact/denominator
        (args.output/'values.json').write_text(json.dumps({'variable_keys':raw['variable_keys'],'values':values},indent=2)+'\n')
        (args.output/'plan.json').write_text(json.dumps(plan_from_vector(data,raw['variable_keys'],values),indent=2)+'\n')
    (args.output/'solver.json').write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')
    (args.output/'response-stats.txt').write_text(solver.response_stats())
    print(json.dumps(report,allow_nan=False),flush=True)


if __name__=='__main__':main()
