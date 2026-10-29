"""Evaluator feasibility calibration, not a frozen case or candidate run."""
import argparse
import json
from pathlib import Path
import time
from dataclasses import dataclass
from fractions import Fraction

import numpy as np
from scipy.optimize import linprog
from scipy.sparse import coo_matrix, vstack

from l06_input import InputError, read_json, validate_instance
from l06_bound_certificate import evaluate_certificate
from l06_integer import solve_integer


@dataclass
class LinearModel:
    keys: list
    upper: list
    objective_numerators: list
    objective_denominator: int
    matrix: object
    lower_rows: list
    upper_rows: list
    credit_index: object

    @property
    def objective(self):
        return np.asarray(self.objective_numerators,dtype=float)/self.objective_denominator

    def payload(self):
        matrix=self.matrix.tocsr()
        def integer(value):
            assert np.isfinite(value) and value==int(value),value
            return int(value)
        rows=[]
        for row in range(matrix.shape[0]):
            start,end=matrix.indptr[row:row+2]
            rows.append({'lower':None if not np.isfinite(self.lower_rows[row]) else integer(self.lower_rows[row]),
                         'upper':None if not np.isfinite(self.upper_rows[row]) else integer(self.upper_rows[row]),
                         'terms':[[int(matrix.indices[k]),integer(matrix.data[k])] for k in range(start,end)]})
        return {'format':'l06-linear-relaxation/1','variable_keys':[list(key) for key in self.keys],
                'variable_lower':[0]*len(self.keys),'variable_upper':[integer(v) for v in self.upper],
                'objective_numerators':self.objective_numerators,'objective_denominator':self.objective_denominator,
                'rows':rows}


def build_model(data, minimum_credit=False):
    validate_instance(data)
    T, M, J, S, P = data['weeks'], len(data['raw_materials']), len(data['products']), len(data['suppliers']), len(data['plants'])
    keys, index, upper, objective, weekly_cost = [], {}, [], [], {}
    row_indices, columns, coefficients, lower_rows, upper_rows = [], [], [], [], []

    def variable(key, limit, cost, scenario, week):
        i = len(keys); keys.append(key); index[key] = i; upper.append(limit)
        objective.append(cost*scenario['probability_numerator'])
        weekly_cost.setdefault((scenario['id'], week), {})[i] = cost
        return i

    def constraint(values, lower, upper):
        r = len(lower_rows)
        for c, v in values.items():
            if v:
                row_indices.append(r); columns.append(c); coefficients.append(v)
        lower_rows.append(lower); upper_rows.append(upper)

    for scenario in data['scenarios']:
        s = scenario['id']
        for t in range(T):
            for supplier, rule in enumerate(data['suppliers']):
                capacity = scenario['supplier_capacity_volume'][t][supplier]
                for m in range(M):
                    limit = capacity//(rule['pack_units'][m]*data['raw_volume'][m]) if t+rule['lead_weeks'] < T else 0
                    variable(('q',s,t,supplier,m), limit, rule['pack_units'][m]*rule['price_minor'][m], scenario,t)
                variable(('truck',s,t,supplier), 1, rule['freight_minor'],scenario,t)
            for p in range(P):
                for j in range(J):
                    limit = scenario['plant_capacity_hours'][t][p]//data['production_hours'][j] if data['allowed'][p][j] else 0
                    variable(('produce',s,t,p,j),limit,data['production_cost_minor'][p][j],scenario,t)
            for m in range(M):
                variable(('raw',s,t,m),data['raw_storage_volume']//data['raw_volume'][m],data['raw_holding_minor'][m],scenario,t)
            for j in range(J):
                variable(('fg',s,t,j),0 if t==T-1 else data['product_storage_volume']//data['product_volume'][j],data['product_holding_minor'][j],scenario,t)

    credit_index = None
    if minimum_credit:
        credit_index = len(keys); keys.append(('credit_limit',)); index[('credit_limit',)] = credit_index
        upper.append(data['credit_limit_minor']); objective = [0]*credit_index+[1]

    for scenario in data['scenarios']:
        s = scenario['id']; cumulative_cost = {}; received = 0
        for t in range(T):
            for supplier, rule in enumerate(data['suppliers']):
                shipment = {index[('q',s,t,supplier,m)]:rule['pack_units'][m]*data['raw_volume'][m] for m in range(M)}
                z = index[('truck',s,t,supplier)]
                constraint({**shipment,z:-scenario['supplier_capacity_volume'][t][supplier]},-np.inf,0)
                constraint({**shipment,z:-rule['minimum_volume']},0,np.inf)
            for p in range(P):
                constraint({index[('produce',s,t,p,j)]:data['production_hours'][j] for j in range(J)},0,scenario['plant_capacity_hours'][t][p])
            for m in range(M):
                balance = {index[('raw',s,t,m)]:1}
                if t:
                    balance[index[('raw',s,t-1,m)]]=-1
                for supplier, rule in enumerate(data['suppliers']):
                    ordered = t-rule['lead_weeks']
                    if ordered>=0:
                        balance[index[('q',s,ordered,supplier,m)]]=-rule['pack_units'][m]
                for p in range(P):
                    for j in range(J):
                        balance[index[('produce',s,t,p,j)]]=data['bom'][j][m]
                rhs = data['initial_raw'][m] if t==0 else 0
                constraint(balance,rhs,rhs)
            for j in range(J):
                balance = {index[('fg',s,t,j)]:1}
                if t:
                    balance[index[('fg',s,t-1,j)]]=-1
                for p in range(P):
                    balance[index[('produce',s,t,p,j)]]=-1
                rhs = (data['initial_products'][j] if t==0 else 0)-scenario['demand'][t][j]
                constraint(balance,rhs,rhs)
            raw_peak = {}
            for m in range(M):
                if t: raw_peak[index[('raw',s,t-1,m)]] = data['raw_volume'][m]
                for supplier, rule in enumerate(data['suppliers']):
                    ordered=t-rule['lead_weeks']
                    if ordered>=0: raw_peak[index[('q',s,ordered,supplier,m)]] = rule['pack_units'][m]*data['raw_volume'][m]
            raw_opening = sum(q*v for q,v in zip(data['initial_raw'],data['raw_volume'])) if t==0 else 0
            constraint(raw_peak,0,data['raw_storage_volume']-raw_opening)
            fg_peak = {}
            for j in range(J):
                if t: fg_peak[index[('fg',s,t-1,j)]] = data['product_volume'][j]
                for p in range(P): fg_peak[index[('produce',s,t,p,j)]] = data['product_volume'][j]
            fg_opening = sum(q*v for q,v in zip(data['initial_products'],data['product_volume'])) if t==0 else 0
            constraint(fg_peak,0,data['product_storage_volume']-fg_opening)
            cumulative_cost.update(weekly_cost[(s,t)])
            past = t-data['receipt_lag_weeks']
            if past>=0:
                received += sum(d*p for d,p in zip(scenario['demand'][past],data['sales_price_minor']))
            cash_floor = 0 if t==T-1 or minimum_credit else -data['credit_limit_minor']
            cash_row = dict(cumulative_cost)
            if minimum_credit and t<T-1: cash_row[credit_index] = -1
            constraint(cash_row,-np.inf,data['initial_cash_minor']+received-cash_floor)
    first = data['scenarios'][0]['id']
    for scenario in data['scenarios'][1:]:
        for key,i in index.items():
            if key[0] in ('q','truck','produce') and key[1]==scenario['id'] and key[2]<data['common_weeks']:
                counterpart = (key[0],first,*key[2:])
                constraint({i:1,index[counterpart]:-1},0,0)
    matrix = coo_matrix((np.asarray(coefficients,dtype=float),(row_indices,columns)),shape=(len(lower_rows),len(keys))).tocsc()
    return LinearModel(keys,upper,objective,1 if minimum_credit else data['probability_denominator'],matrix,lower_rows,upper_rows,credit_index)


def solve(data, minimum_credit=False, *, solver_seconds=None,warm_start_plan=None,relative_gap=None,workers=8,seed=20261029,progress_dir=None):
    model=build_model(data,minimum_credit)
    return solve_integer(data,model,minimum_credit=minimum_credit,solver_seconds=solver_seconds,warm_start_plan=warm_start_plan,
                         relative_gap=relative_gap,workers=workers,seed=seed,progress_dir=progress_dir)


def solve_relaxation(data,minimum_credit=False):
    model=build_model(data,minimum_credit)
    eq=[];ineq=[];parts=[];rhs=[]
    for row,(lo,hi) in enumerate(zip(model.lower_rows,model.upper_rows)):
        if np.isfinite(lo) and lo==hi:
            eq.append(row)
        else:
            if np.isfinite(hi):
                ineq.append({'row':row,'side':'upper'});parts.append(model.matrix[row:row+1]);rhs.append(hi)
            if np.isfinite(lo):
                ineq.append({'row':row,'side':'lower'});parts.append(-model.matrix[row:row+1]);rhs.append(-lo)
    print(json.dumps({'event':'continuous_solving','variables':len(model.keys),'integer_variables':0,'equalities':len(eq),'inequalities':len(ineq)}),flush=True)
    start=time.perf_counter()
    result=linprog(model.objective,A_ub=vstack(parts).tocsc() if parts else None,b_ub=rhs or None,
                   A_eq=model.matrix[eq] if eq else None,b_eq=[model.upper_rows[i] for i in eq] if eq else None,
                   bounds=list(zip([0]*len(model.keys),model.upper)),method='highs',options={'disp':True})
    report={'objective_name':'minimum_credit_minor' if minimum_credit else 'expected_operating_cost_minor',
            'method':'continuous_relaxation','status':int(result.status),'message':result.message,
            'seconds':time.perf_counter()-start,'objective':None if result.fun is None else float(result.fun),
            'variables':len(model.keys),'constraints':len(model.lower_rows),'iterations':int(result.nit),
            'interpretation':'lower-bound qualification only; fractional solution is not a business plan'}
    if result.status!=0:return report,None
    certificate={'format':'l06-row-dual-certificate/1','multipliers':[]}
    for row,value in zip(eq,result.eqlin.marginals):
        certificate['multipliers'].append({'row':row,'side':'equality','value':str(Fraction(str(float(value)))),'solver_value':float(value)})
    for entry,value in zip(ineq,result.ineqlin.marginals):
        certificate['multipliers'].append({**entry,'value':str(min(Fraction(0),Fraction(str(float(value))))),'solver_value':float(value)})
    start=time.perf_counter()
    payload=model.payload()
    exact=evaluate_certificate(payload,certificate)
    report['exact_certificate_seconds']=time.perf_counter()-start
    report['certified_lower_bound_exact']=exact['lower_bound_exact']
    report['certified_lower_bound']=exact['lower_bound']
    report['primal_maximum_row_violation']=float(max([0.0]+[max((lo-float(value)) if np.isfinite(lo) else 0,(float(value)-hi) if np.isfinite(hi) else 0) for value,lo,hi in zip(model.matrix@result.x,model.lower_rows,model.upper_rows)]))
    return report,{'model':payload,'certificate':certificate,'certificate_check':exact,'fractional_solution':result.x.tolist()}


def main():
    def positive_integer(text):
        value=int(text)
        if value<1:raise argparse.ArgumentTypeError('positive integer required')
        return value
    def positive_seconds(text):
        value=float(text)
        if not np.isfinite(value) or value<=0:raise argparse.ArgumentTypeError('finite positive seconds required')
        return value
    def nonnegative_gap(text):
        value=float(text)
        if not np.isfinite(value) or value<0:raise argparse.ArgumentTypeError('finite nonnegative gap required')
        return value
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,required=True);parser.add_argument('--input',type=Path,required=True)
    parser.add_argument('--minimum-credit',action='store_true');parser.add_argument('--mode',choices=['integer','relaxation'],default='integer')
    parser.add_argument('--solver-seconds',type=positive_seconds);parser.add_argument('--workers',type=positive_integer,default=8)
    parser.add_argument('--relative-gap',type=nonnegative_gap);parser.add_argument('--seed',type=int,default=20261029)
    parser.add_argument('--warm-start-plan',type=Path)
    args=parser.parse_args()
    if args.mode!='integer' and (args.solver_seconds is not None or args.warm_start_plan is not None or args.relative_gap is not None):
        parser.error('integer solver diagnostics require --mode integer')
    args.output.mkdir(parents=True,exist_ok=False)
    try:
        data=validate_instance(read_json(args.input,'instance_invalid'))
    except InputError as error:
        (args.output/'solver.json').write_text(json.dumps({'status':'instance_invalid','path':error.path,'detail':error.detail},indent=2)+'\n')
        raise SystemExit(2)
    (args.output/'instance.json').write_text(json.dumps(data,indent=2)+'\n')
    if args.mode=='relaxation':
        report,proof=solve_relaxation(data,minimum_credit=args.minimum_credit)
        if proof is not None:
            for name,value in proof.items():(args.output/(name+'.json')).write_text(json.dumps(value,indent=2,allow_nan=False)+'\n')
        plan=None
    else:
        warm=None if args.warm_start_plan is None else read_json(args.warm_start_plan,'warm_start_plan')
        report,plan=solve(data,minimum_credit=args.minimum_credit,solver_seconds=args.solver_seconds,warm_start_plan=warm,relative_gap=args.relative_gap,workers=args.workers,seed=args.seed,progress_dir=args.output/'progress')
    (args.output/'solver.json').write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')
    if plan is not None:
        (args.output/'plan.json').write_text(json.dumps(plan,indent=2)+'\n')
    print(json.dumps(report,allow_nan=False),flush=True)


if __name__=='__main__':
    main()
