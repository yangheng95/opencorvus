"""Build a single extensive-form history-node CP-SAT policy; no actual future input."""
import argparse, datetime, json, sys
from pathlib import Path
from ortools.sat.python import cp_model
from common import *

FIELDS = ('order_lots', 'truck_on', 'production')

def build(data, perfect_information=False):
    model = cp_model.CpModel()
    T = data['weeks']; visible = histories(data)
    nodes = {}; node_of = {}
    for path in data['scenarios']:
        for t in range(T):
            key = (path['id'],t) if perfect_information else visible[path['id']][t]
            if key not in nodes:
                nodes[key] = {'index':len(nodes),'week':t,'path':path,'mass':0,'paths':[]}
            nodes[key]['mass'] += path['probability_numerator']
            nodes[key]['paths'].append(path['id'])
            node_of[path['id'],t] = nodes[key]
    variables = {}
    baseline, _ = contingency(data)
    for n in nodes.values():
        t=n['week']; path=n['path']; idx=n['index']; e=event(path,t)
        x=[[model.new_int_var(0,e['supplier_capacity_volume'][s]//(rule['pack_units'][m]*data['raw_volume'][m]) if t+rule['lead_weeks']<T else 0,f'x{idx}_{s}_{m}') for m in range(4)] for s,rule in enumerate(data['suppliers'])]
        u=[model.new_bool_var(f'u{idx}_{s}') for s in range(3)]
        y=[[model.new_int_var(0,e['plant_capacity_hours'][p]//data['production_hours'][j] if data['allowed'][p][j] else 0,f'y{idx}_{p}_{j}') for j in range(4)] for p in range(2)]
        r=[model.new_int_var(0,data['raw_storage_volume']//v,f'r{idx}_{m}') for m,v in enumerate(data['raw_volume'])]
        f=[model.new_int_var(0,0 if t==T-1 else data['product_storage_volume']//v,f'f{idx}_{j}') for j,v in enumerate(data['product_volume'])]
        cost=model.new_int_var(0,100000,f'cost{idx}')
        cash=model.new_int_var(0 if t==T-1 else -data['credit_limit_minor'],1000000,f'cash{idx}')
        variables[idx]={'x':x,'u':u,'y':y,'r':r,'f':f,'cost':cost,'cash':cash}
        for s,rule in enumerate(data['suppliers']):
            volume=sum(x[s][m]*rule['pack_units'][m]*data['raw_volume'][m] for m in range(4))
            model.add(volume<=e['supplier_capacity_volume'][s]*u[s])
            model.add(volume>=rule['minimum_volume']*u[s])
        for p in range(2):
            model.add(sum(y[p][j]*data['production_hours'][j] for j in range(4))<=e['plant_capacity_hours'][p])
        model.add(cost==sum(x[s][m]*rule['pack_units'][m]*rule['price_minor'][m] for s,rule in enumerate(data['suppliers']) for m in range(4))+sum(u[s]*rule['freight_minor'] for s,rule in enumerate(data['suppliers']))+sum(y[p][j]*data['production_cost_minor'][p][j] for p in range(2) for j in range(4))+sum(r[m]*data['raw_holding_minor'][m] for m in range(4))+sum(f[j]*data['product_holding_minor'][j] for j in range(4)))
        base=action_at(baseline,path['id'],t)
        for a,k in [(x,'order_lots'),(u,'truck_on'),(y,'production')]:
            if k=='truck_on':
                for s in range(3):model.add_hint(a[s],base[k][s])
            else:
                for i,row in enumerate(a):
                    for j,v in enumerate(row):model.add_hint(v,base[k][i][j])
    for n in nodes.values():
        t=n['week']; path=n['path']; v=variables[n['index']]; e=event(path,t)
        prev=variables[node_of[path['id'],t-1]['index']] if t else None
        made=[sum(v['y'][p][j] for p in range(2)) for j in range(4)]
        use=[sum(made[j]*data['bom'][j][m] for j in range(4)) for m in range(4)]
        for m in range(4):
            arrivals=sum(variables[node_of[path['id'],t-rule['lead_weeks']]['index']]['x'][s][m]*rule['pack_units'][m] for s,rule in enumerate(data['suppliers']) if t>=rule['lead_weeks'])
            model.add(v['r'][m]==(prev['r'][m] if prev else data['initial_raw'][m])+arrivals-use[m])
        for j in range(4):model.add(v['f'][j]==(prev['f'][j] if prev else data['initial_products'][j])+made[j]-e['demand'][j])
        model.add(sum((v['r'][m]+use[m])*data['raw_volume'][m] for m in range(4))<=data['raw_storage_volume'])
        model.add(sum((v['f'][j]+e['demand'][j])*data['product_volume'][j] for j in range(4))<=data['product_storage_volume'])
        revenue=sum(path['demand'][t-data['receipt_lag_weeks']][j]*data['sales_price_minor'][j] for j in range(4)) if t>=data['receipt_lag_weeks'] else 0
        model.add(v['cash']==(prev['cash'] if prev else data['initial_cash_minor'])+revenue-v['cost'])
    model.minimize(sum(n['mass']*variables[n['index']]['cost'] for n in nodes.values()))
    return model,nodes,node_of,variables

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--public',type=Path,required=True);ap.add_argument('--out',type=Path,required=True);ap.add_argument('--seconds',type=float,default=120);ap.add_argument('--workers',type=int,default=8);ap.add_argument('--perfect-information',action='store_true');a=ap.parse_args()
    a.out.mkdir(parents=True,exist_ok=False);data,_=load_data(a.public)
    model,nodes,node_of,vs=build(data,a.perfect_information)
    (a.out/'model.pbtxt').write_text(str(model.proto),encoding='utf8')
    solver=cp_model.CpSolver();solver.parameters.max_time_in_seconds=a.seconds;solver.parameters.num_search_workers=a.workers;solver.parameters.random_seed=41031;solver.parameters.log_search_progress=True;solver.parameters.log_to_stdout=False
    log=(a.out/'solver.log').open('w',encoding='utf8')
    solver.log_callback=lambda line:(log.write(line+'\n'),log.flush())
    class Progress(cp_model.CpSolverSolutionCallback):
        def on_solution_callback(self):
            print(json.dumps({'incumbent_weighted':self.objective_value,'expected':self.objective_value/data['probability_denominator'],'seconds':self.wall_time}),flush=True)
    status=solver.solve(model,Progress());log.close()
    provenance={'format':'l06-optimization-provenance/1','status':solver.status_name(status),'seed':41031,'workers':a.workers,'time_limit_seconds':a.seconds,'wall_seconds':solver.wall_time,'nodes':len(nodes),'perfect_information':a.perfect_information,'weighted_objective':solver.objective_value,'native_weighted_best_bound':solver.best_objective_bound,'probability_denominator':data['probability_denominator'],'response_stats':solver.response_stats(),'method':'OR-Tools CP-SAT extensive form; one variable set per complete event history' if not a.perfect_information else 'OR-Tools CP-SAT full-path actions: anticipative information relaxation; not executable causal policy','claim':'native solver numerical bound/status only; no independent rational optimality certificate'}
    (a.out/'optimization.json').write_text(json.dumps(provenance,indent=2)+'\n',encoding='utf8')
    if status not in (cp_model.FEASIBLE,cp_model.OPTIMAL):raise RuntimeError('No feasible incumbent; preserve output')
    decisions={}
    for path in data['scenarios']:
        out={k:[] for k in FIELDS}
        for t in range(data['weeks']):
            v=vs[node_of[path['id'],t]['index']]
            out['order_lots'].append([[int(solver.value(q)) for q in row] for row in v['x']]);out['truck_on'].append([int(solver.value(q)) for q in v['u']]);out['production'].append([[int(solver.value(q)) for q in row] for row in v['y']])
        decisions[path['id']]=out
    policy={'format':'l06-tree-policy/1','decisions':decisions}
    (a.out/'policy.json').write_text(json.dumps(policy,indent=2)+'\n',encoding='utf8')
    audit=audit_policy(data,policy)
    (a.out/'audit.json').write_text(json.dumps(audit,indent=2)+'\n',encoding='utf8')
    if not audit['business_feasible'] or (not a.perfect_information and not audit['information_legal']):raise RuntimeError('Extracted action audit failed')
    if a.perfect_information:
        from check_l06 import inspect_plan
        exact=inspect_plan(data,{'format':'l06-plan/1','decisions':decisions})
        (a.out/'physical-audit.json').write_text(json.dumps(exact,indent=2)+'\n',encoding='utf8')
    print(json.dumps(provenance,indent=2))
if __name__=='__main__':main()
