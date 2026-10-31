"""Independent operating-table audit against every original MPS row and raw fact."""
import argparse, csv, json, math
from collections import Counter,defaultdict
from pathlib import Path
import core

def close(a,b,scale=None):
    a=float(a);b=float(b)
    if not math.isfinite(a) or not math.isfinite(b) or abs(a-b)>1e-6+1e-9*abs(b if scale is None else scale): raise ValueError(f'Numeric reconciliation differs: {a} versus {b}')

def integer(v):
    x=float(v)
    if not math.isfinite(x) or x!=round(x): raise ValueError('Non-integer wire value '+str(v))
    return int(x)

def csvrows(path,columns,key):
    with path.open(newline='',encoding='utf-8-sig') as f:
        r=csv.DictReader(f)
        if not set(columns)<=set(r.fieldnames): raise ValueError('Missing CSV columns '+str(path))
        rows=list(r)
    keys=[tuple(row[k] for k in key) for row in rows]
    if len(keys)!=len(set(keys)): raise ValueError('Duplicate semantic key '+str(path))
    return rows

def audit(model,raw_archive,instance,out):
    out=Path(out);data=core.read_mps(model);raw=core.load_raw(raw_archive,instance,data)
    layout=json.loads((out/'layout.json').read_text());base=out.resolve()
    def local(relative):
        p=(out/relative).resolve()
        if not p.is_relative_to(base): raise ValueError('Output path escapes run root')
        return p
    values=json.loads(local(layout['values']).read_text());native=json.loads(local(layout['reported_objective']['file']).read_text())
    obj=native[layout['reported_objective']['key']] if layout['reported_objective']['key'] is not None else native
    check=core.validate(data,values,obj)
    if not check['feasible']: raise ValueError('Original MPS feasibility '+str(check))
    if isinstance(native,dict) and native.get('native_objective') is not None: close(native['native_objective'],obj)
    arcs=csvrows(local(layout['arcs']),core.ARC_COLS,['original_variable'])
    expected={n for n in data['arcs'] if values[n]>1e-6}
    if {r['original_variable'] for r in arcs}!=expected: raise ValueError('Arc coverage')
    service=defaultdict(float);berths=Counter();costs=defaultdict(float)
    for r in arcs:
        n=r['original_variable'];p,t,q,u,c=data['arcs'][n];kind=core.kind_for(data['arcs'][n],raw)
        for k,x in [('vessel_class',c),('from_port',p),('from_time_index',t),('to_port',q),('to_time_index',u)]:
            if integer(r[k])!=x: raise ValueError('Arc endpoint/class '+n)
        if r['kind']!=kind: raise ValueError('Arc kind')
        count=integer(r['vessel_count']);close(count,values[n]);close(r['class_capacity'],raw['classes'][c]['capacity'])
        close(r['original_cost_per_vessel'],data['variables'][n]['obj']);contribution=count*data['variables'][n]['obj'];close(r['cost_contribution'],contribution);costs[kind]+=contribution
        if kind in ('initial_source','waiting'):
            if r['inventory_service_port']!='' or r['inventory_service_time_index']!='': raise ValueError('Non-service empty wire fields')
            close(r['signed_inventory_effect'],0)
        else:
            if integer(r['inventory_service_port'])!=p or integer(r['inventory_service_time_index'])!=t: raise ValueError('Service origin')
            effect=-data['inv'][p,t]['coeff'][n]*count;close(r['signed_inventory_effect'],effect);service[p,t]+=effect;berths[p,t]+=count
    paths=csvrows(local(layout['paths']),core.PATH_COLS,['anonymous_path_id','step']);groups=defaultdict(list);used=Counter()
    for r in paths:
        n=r['original_variable'];used[n]+=1;groups[r['anonymous_path_id']].append(r)
        if n not in expected: raise ValueError('Path uses uncovered arc')
        a=next(a for a in arcs if a['original_variable']==n)
        for k in core.PATH_COLS[2:]:
            if k in ('original_variable','kind'):
                if r[k]!=a[k]: raise ValueError('Path arc identity/kind')
            elif integer(r[k])!=integer(a[k]): raise ValueError('Path endpoints/class')
    if used!={r['original_variable']:integer(r['vessel_count']) for r in arcs}: raise ValueError('Path count coverage')
    for pid,rs in groups.items():
        rs.sort(key=lambda r:integer(r['step']));steps=[integer(r['step']) for r in rs]
        if steps!=list(range(steps[0],steps[0]+len(steps))): raise ValueError('Consecutive path steps')
        if rs[0]['kind']!='initial_source' or integer(rs[0]['from_time_index'])!=-1 or rs[-1]['kind']!='terminal_exit' or integer(rs[-1]['to_time_index'])!=data['T']: raise ValueError('Path source/exit')
        for a,b in zip(rs,rs[1:]):
            if tuple(integer(a[k]) for k in ['vessel_class','to_port','to_time_index'])!=tuple(integer(b[k]) for k in ['vessel_class','from_port','from_time_index']): raise ValueError('Path physical continuity')
    ledger=csvrows(local(layout['ledger']),core.LEDGER_COLS,['port','time_index'])
    if {(integer(r['port']),integer(r['time_index'])) for r in ledger}!=set(data['inv']): raise ValueError('Ledger port-period coverage')
    for r in ledger:
        p=integer(r['port']);t=integer(r['time_index']);port=raw['ports'][p];rhs=data['inv'][p,t]['rhs'];role=port['type']
        if r['port_name']!=port['name'] or r['role']!=role: raise ValueError('Port name/role')
        before=values[f'supplyAtNode_({p},{t})'];after=values[f'supplyAtNode_({p},{t+1})'] if t+1<data['T'] else values[f'endingSupplyInRegion_{p}'];a=values[f'alphaSlack_({p},{t})'];effect=-a if role=='Loading' else a;penalty=data['variables'][f'alphaSlack_({p},{t})']['obj']
        for k,v in [('stock_before',before),('stock_after',after),('signed_production_consumption',rhs),('signed_vessel_service_inventory_effect',service[p,t]),('alpha_loss_or_shortfall',a),('signed_alpha_effect',effect),('berths_used',berths[p,t]),('berths_available',float(port['numBerths'])),('original_alpha_unit_penalty',penalty),('alpha_cost',a*penalty)]: close(r[k],v)
        residual=after-before-rhs-service[p,t]-effect;close(r['inventory_residual'],residual,scale=rhs);close(residual,0,scale=rhs)
        costs['lost_production' if role=='Loading' else 'stockout']+=a*penalty
    costs['original_objective_constant']+=data['offset']
    cr=csvrows(local(layout['costs']),core.COST_COLS,['component']);legal={'initial_source','waiting','loaded_voyage','empty_return','terminal_exit','lost_production','stockout','original_objective_constant'}
    found={r['component']:float(r['original_objective_contribution']) for r in cr}
    if not set(found)<=legal: raise ValueError('Illegal cost component')
    for k in set(costs)|set(found): close(found.get(k,0),costs.get(k,0))
    close(math.fsum(found.values()),obj)
    return {**check,'operating_audit_passed':True,'positive_arcs_checked':len(arcs),'path_steps_checked':len(paths),'complete_anonymous_paths':len(groups),'port_period_rows_checked':len(ledger),'economic_sum':math.fsum(found.values())}

def main():
    p=argparse.ArgumentParser();p.add_argument('--model',required=True);p.add_argument('--raw',required=True);p.add_argument('--instance',required=True);p.add_argument('--out',required=True);args=p.parse_args()
    result=audit(args.model,args.raw,args.instance,args.out);core.dump(Path(args.out)/'independent-audit.json',result);print(json.dumps(result))
if __name__=='__main__':main()
