"""The current integer backend: one canonical linear model, native CP-SAT."""
from datetime import datetime,timezone
from fractions import Fraction
import json,math,threading,time
from pathlib import Path

import ortools
from ortools.sat.python import cp_model

from check_l06 import evaluate
from l06_plan import plan_from_vector


def warm_vector(data,model,plan):
    business=evaluate(data,plan);values=[]
    fields={'q':'order_lots','truck':'truck_on','produce':'production'}
    for key in model.keys:
        kind=key[0]
        if kind=='credit_limit':value=data['credit_limit_minor']
        elif kind in fields:
            value=plan['decisions'][key[1]][fields[kind]]
            for part in key[2:]:value=value[part]
        else:
            field='raw_inventory' if kind=='raw' else 'finished_inventory'
            value=business['scenarios'][key[1]]['weeks'][key[2]][field][key[3]]
        values.append(value)
    return values,business


def solve_integer(data,linear,*,minimum_credit=False,solver_seconds=None,relative_gap=None,workers=8,seed=20261029,warm_start_plan=None,progress_dir=None):
    gap=(0.0 if minimum_credit else .002) if relative_gap is None else relative_gap
    if type(workers) is not int or workers<1 or type(seed) is not int or not math.isfinite(gap) or gap<0:raise ValueError('solver_configuration')
    if solver_seconds is not None and (not math.isfinite(solver_seconds) or solver_seconds<=0):raise ValueError('solver_seconds')
    payload=linear.payload();keys=payload['variable_keys'];denominator=payload['objective_denominator']
    lower,upper,coefficients=payload['variable_lower'],payload['variable_upper'],payload['objective_numerators']
    model=cp_model.CpModel();variables=[model.new_int_var(lo,hi,'v'+str(i)) for i,(lo,hi) in enumerate(zip(lower,upper))]
    for row in payload['rows']:
        expression=sum(coefficient*variables[index] for index,coefficient in row['terms'])
        model.add_linear_constraint(expression,cp_model.INT_MIN if row['lower'] is None else row['lower'],cp_model.INT_MAX if row['upper'] is None else row['upper'])
    model.minimize(sum(c*v for c,v in zip(coefficients,variables)))
    warm=None
    if warm_start_plan is not None:
        values,business=warm_vector(data,linear,warm_start_plan)
        if any(type(v) is not int or v<lo or v>hi for v,lo,hi in zip(values,lower,upper)):raise ValueError('warm_start_integer_box')
        for row in payload['rows']:
            activity=sum(c*values[i] for i,c in row['terms'])
            if row['lower'] is not None and activity<row['lower'] or row['upper'] is not None and activity>row['upper']:raise ValueError('warm_start_model_feasibility')
        for variable,value in zip(variables,values):model.add_hint(variable,value)
        warm={'business_feasible':True,'business_expected_cost_minor':business['expected_cost_minor'],
              'model_objective_exact':str(Fraction(sum(c*v for c,v in zip(coefficients,values)),denominator)),'variables_projected':len(values)}
    validation=model.validate()
    if validation:raise ValueError('integer_model_invalid:'+validation)
    solver=cp_model.CpSolver();solver.parameters.num_search_workers=workers;solver.parameters.random_seed=seed
    solver.parameters.relative_gap_limit=gap;solver.parameters.log_search_progress=True
    if solver_seconds is not None:solver.parameters.max_time_in_seconds=solver_seconds
    destination=None if progress_dir is None else Path(progress_dir)
    if destination is not None:destination.mkdir(parents=True,exist_ok=False)
    start=time.perf_counter()
    class Observer(cp_model.CpSolverSolutionCallback):
        def __init__(self):super().__init__();self.best=None;self.updates=0;self.lock=threading.Lock()
        def on_solution_callback(self):
            values=[self.value(variable) for variable in variables];objective=sum(c*v for c,v in zip(coefficients,values))
            with self.lock:
                if self.best is not None and objective>=self.best:return
                self.best=objective;self.updates+=1
                if destination is None:return
                def atomic(name,value):
                    temp=destination/(name+'.tmp');temp.write_text(json.dumps(value,indent=2,allow_nan=False)+'\n',encoding='utf-8');temp.replace(destination/name)
                vector={'variable_keys':keys,'values':values};plan=plan_from_vector(data,keys,values)
                if self.updates==1:atomic('first-values.json',vector);atomic('first-plan.json',plan)
                atomic('incumbent-values.json',vector);atomic('incumbent-plan.json',plan)
                event={'event':'actual_improving_incumbent','observed_utc':datetime.now(timezone.utc).isoformat(),'seconds':time.perf_counter()-start,
                       'objective_scaled_exact':objective,'objective_exact':str(Fraction(objective,denominator)),
                       'objective_name':'minimum_credit_minor' if minimum_credit else 'expected_operating_cost_minor',
                       'native_best_bound_scaled':self.best_objective_bound,'updates':self.updates}
                atomic('progress.json',event)
                with (destination/'events.jsonl').open('a',encoding='utf-8') as file:file.write(json.dumps(event,allow_nan=False)+'\n')
    observer=Observer();status=solver.solve(model,observer);seconds=time.perf_counter()-start
    feasible=status in (cp_model.OPTIMAL,cp_model.FEASIBLE)
    def finite(value):return float(value) if math.isfinite(value) else None
    native_bound=finite(solver.best_objective_bound)
    report={'format':'l06-native-cpsat-integer/1','solver':'OR-Tools CP-SAT','solver_version':ortools.__version__,
            'objective_name':'minimum_credit_minor' if minimum_credit else 'expected_operating_cost_minor',
            'status':solver.status_name(status),'native_status_code':int(status),
            'termination':'optimal_within_requested_gap' if status==cp_model.OPTIMAL else 'feasible_limited' if feasible else 'infeasible' if status==cp_model.INFEASIBLE else 'model_invalid' if status==cp_model.MODEL_INVALID else 'unknown',
            'seconds':seconds,'has_feasible_incumbent':feasible,'objective':None,
            'dual_bound':native_bound/denominator if native_bound is not None and status not in (cp_model.INFEASIBLE,cp_model.MODEL_INVALID) else None,
            'native_best_bound_scaled':native_bound,'objective_denominator':denominator,
            'variables':len(keys),'constraints':len(payload['rows']),'warm_start':warm,'improving_incumbents':observer.updates,
            'solver_options':{'relative_gap_limit':solver.parameters.relative_gap_limit,'num_search_workers':solver.parameters.num_search_workers,
                              'random_seed':solver.parameters.random_seed,'requested_max_time_in_seconds':solver_seconds,
                              'native_max_time_in_seconds':finite(solver.parameters.max_time_in_seconds)},
            'native_time_policy':'unset default infinite' if solver_seconds is None else 'explicit local solver diagnostic',
            'native_branches':solver.num_branches,'native_conflicts':solver.num_conflicts,
            'bound_scope':'native integer-search bound; not independently replayed search proof or rational dual certificate'}
    if destination is not None:(destination/'response-stats.txt').write_text(solver.response_stats(),encoding='utf-8')
    if not feasible:return report,None
    values=[solver.value(variable) for variable in variables];exact=sum(c*v for c,v in zip(coefficients,values))
    if exact!=solver.objective_value:raise ValueError('native_objective_projection')
    report['objective_exact']=str(Fraction(exact,denominator));report['objective']=exact/denominator
    report['solver_gap_scaled_by_primal']=None if native_bound is None else abs(exact-native_bound)/max(1,abs(exact))
    if minimum_credit:report['minimum_credit_limit_minor']=values[linear.credit_index]
    if destination is not None:(destination/'final-values.json').write_text(json.dumps({'variable_keys':keys,'values':values},indent=2)+'\n')
    return report,plan_from_vector(data,keys,values)
