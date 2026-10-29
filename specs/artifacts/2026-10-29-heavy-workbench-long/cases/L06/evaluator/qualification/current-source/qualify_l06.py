"""Evaluator feasibility calibration, not a frozen case or candidate run."""
import argparse
import json
from pathlib import Path
import time

import numpy as np
from scipy.optimize import milp, Bounds, LinearConstraint
from scipy.sparse import coo_matrix

from l06_input import InputError, read_json, validate_instance


def solve(data, minimum_credit=False):
    validate_instance(data)
    T, M, J, S, P = data['weeks'], len(data['raw_materials']), len(data['products']), len(data['suppliers']), len(data['plants'])
    keys, index, upper, objective, weekly_cost = [], {}, [], [], {}
    row_indices, columns, coefficients, lower_rows, upper_rows = [], [], [], [], []

    def variable(key, limit, cost, scenario, week):
        i = len(keys); keys.append(key); index[key] = i; upper.append(limit)
        probability = scenario['probability_numerator']/data['probability_denominator']
        objective.append(cost*probability)
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
        upper.append(data['credit_limit_minor']); objective = [0.0]*credit_index+[1.0]

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
    print(json.dumps({'event':'solving','variables':len(keys),'integer_variables':len(keys),'constraints':len(lower_rows),'nonzero_coefficients':matrix.nnz}),flush=True)
    start = time.perf_counter()
    result = milp(np.array(objective),integrality=np.ones(len(keys)),bounds=Bounds(np.zeros(len(keys)),upper),
                  constraints=LinearConstraint(matrix,lower_rows,upper_rows),options={'mip_rel_gap':0.0 if minimum_credit else 0.002,'disp':True})
    report = {'objective_name':'minimum_credit_minor' if minimum_credit else 'expected_operating_cost_minor','status':int(result.status),'message':result.message,'seconds':time.perf_counter()-start,
              'objective':None if result.fun is None else float(result.fun),
              'dual_bound':None if getattr(result,'mip_dual_bound',None) is None else float(result.mip_dual_bound),
              'solver_gap_scaled_by_primal':None if getattr(result,'mip_gap',None) is None else float(result.mip_gap),
              'nodes':None if getattr(result,'mip_node_count',None) is None else int(result.mip_node_count),
              'variables':len(keys),'constraints':len(lower_rows)}
    if result.x is None:
        return report,None
    rounded = np.rint(result.x)
    report['maximum_rounding_difference'] = float(np.max(np.abs(rounded-result.x)))
    assert report['maximum_rounding_difference']<=1e-5, report
    if minimum_credit: report['minimum_credit_limit_minor'] = int(rounded[credit_index])
    decisions = {}
    for scenario in data['scenarios']:
        s = scenario['id']
        get = lambda key: int(rounded[index[key]])
        decisions[s] = {'order_lots':[[[get(('q',s,t,k,m)) for m in range(M)] for k in range(S)] for t in range(T)],
                        'truck_on':[[get(('truck',s,t,k)) for k in range(S)] for t in range(T)],
                        'production':[[[get(('produce',s,t,p,j)) for j in range(J)] for p in range(P)] for t in range(T)],
                        'raw_inventory':[[get(('raw',s,t,m)) for m in range(M)] for t in range(T)],
                        'finished_inventory':[[get(('fg',s,t,j)) for j in range(J)] for t in range(T)]}
    return report,{'format':'l06-plan/1','decisions':decisions}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);parser.add_argument('--input',type=Path,required=True);parser.add_argument('--minimum-credit',action='store_true');args=parser.parse_args()
    args.output.mkdir(parents=True,exist_ok=False)
    try:
        data=validate_instance(read_json(args.input,'instance_invalid'))
    except InputError as error:
        (args.output/'solver.json').write_text(json.dumps({'status':'instance_invalid','path':error.path,'detail':error.detail},indent=2)+'\n')
        raise SystemExit(2)
    (args.output/'instance.json').write_text(json.dumps(data,indent=2)+'\n')
    report,plan=solve(data, minimum_credit=args.minimum_credit)
    (args.output/'solver.json').write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')
    if plan is not None:
        (args.output/'plan.json').write_text(json.dumps(plan,indent=2)+'\n')
    print(json.dumps(report,allow_nan=False),flush=True)


if __name__=='__main__':
    main()
