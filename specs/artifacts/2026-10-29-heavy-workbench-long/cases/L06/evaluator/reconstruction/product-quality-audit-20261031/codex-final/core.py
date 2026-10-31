"""Exact input facts, original-model checker, and complete operating exports.
No solve result, reference answer, or instance-specific route is embedded here.
"""
from __future__ import annotations
import csv, json, math, re, zipfile
from collections import defaultdict, Counter
from pathlib import Path

ARC = re.compile(r'^x_\((-?\d+),(-?\d+)\),\((-?\d+),(-?\d+)\),(\d+),Term$')
NODE = re.compile(r'^invBalanceRegion_\((\d+),(\d+)\)$')
INF = float('inf')

def dump(path, data):
    Path(path).write_text(json.dumps(data, indent=2, allow_nan=False)+'\n', encoding='utf-8')

def table(path, rows, columns):
    with Path(path).open('w', newline='', encoding='utf-8') as f:
        w=csv.DictWriter(f, fieldnames=columns); w.writeheader(); w.writerows(rows)

def read_mps(path):
    """Read the supplied free-format finite linear MPS; reject unsupported sections."""
    rows={}; variables={}; section=None; integer=False; objective=None; offset=0.0
    for line in Path(path).read_text(encoding='ascii').splitlines():
        if not line.strip() or line.startswith('*'): continue
        tok=line.split()
        if line[0] != ' ':
            section=tok[0]
            if section in ('RANGES','SOS','QUADOBJ','QMATRIX'): raise ValueError('Unsupported MPS section '+section)
            continue
        if section=='ROWS':
            sense,name=tok
            if sense=='N':
                if objective is not None: raise ValueError('Multiple objective rows')
                objective=name
            else: rows[name]={'sense':sense,'rhs':0.0,'coeff':{}}
        elif section=='COLUMNS':
            if "'MARKER'" in tok:
                integer="'INTORG'" in tok; continue
            name=tok[0]
            v=variables.setdefault(name, {'lb':0.0,'ub':INF,'integer':integer,'obj':0.0})
            for r,a in zip(tok[1::2],tok[2::2]):
                a=float(a.replace('D','E'))
                if r==objective: v['obj']+=a
                else: rows[r]['coeff'][name]=rows[r]['coeff'].get(name,0)+a
        elif section=='RHS':
            for r,a in zip(tok[1::2],tok[2::2]):
                if r==objective: offset=-float(a)
                else: rows[r]['rhs']=float(a)
        elif section=='BOUNDS':
            kind,_,name=tok[:3]; a=float(tok[3]) if len(tok)>3 else None
            v=variables[name]
            if kind in ('LO','LI'): v['lb']=a
            elif kind in ('UP','UI'): v['ub']=a
            elif kind=='FX': v['lb']=v['ub']=a
            elif kind=='BV': v.update(lb=0.0,ub=1.0,integer=True)
            elif kind=='FR': v.update(lb=-INF,ub=INF)
            elif kind=='MI': v['lb']=-INF
            elif kind=='PL': v['ub']=INF
            else: raise ValueError('Unsupported bound '+kind)
    if not variables or not rows: raise ValueError('Empty MPS')
    arcs={n:tuple(map(int,ARC.match(n).groups())) for n in variables if ARC.match(n)}
    inv={(int(q[0]),int(q[1])):r for n,r in rows.items() if (m:=NODE.match(n)) for q in [m.groups()]}
    T=1+max(t for p,t in inv)
    return {'variables':variables,'rows':rows,'offset':offset,'arcs':arcs,'inv':inv,'T':T}

def records(text):
    out=[]; item=None
    for line in text.splitlines():
        bits=line.split()
        if not bits: continue
        key=bits[0]; value=bits[1:]
        if key=='name':
            item={}; out.append(item)
        if item is None: item={};out.append(item)
        item[key]=value[0] if len(value)==1 else value
    return out

def raw_candidates(archive):
    names=['metadata.txt','vessel_class_data.txt','loading_port_data.txt','discharge_port_data.txt','vessel_data.txt']
    if Path(archive).is_dir():
        groups=[]
        for p in Path(archive).rglob('metadata.txt'):
            if all((p.parent/n).is_file() for n in names):
                groups.append((str(p.parent),{n:(p.parent/n).read_text() for n in names}))
        return groups
    with zipfile.ZipFile(archive) as z:
        roots=sorted({str(Path(n).parent).replace('\\','/') for n in z.namelist() if n.endswith('/metadata.txt') or n=='metadata.txt'})
        out=[]
        for root in roots:
            prefix=root+'/' if root!='.' else ''
            if all(prefix+n in z.namelist() for n in names):
                out.append((root,{n:z.read(prefix+n).decode('utf-8-sig') for n in names}))
        return out

def load_raw(archive, instance, data):
    matches=[]; failures={}
    for name,files in raw_candidates(archive):
        try:
            ports={int(r['index']):r for f in ['loading_port_data.txt','discharge_port_data.txt'] for r in records(files[f])}
            classes={int(r['index']):r for r in records(files['vessel_class_data.txt'])}
            vessels=records(files['vessel_data.txt'])
            if set(ports)!={p for p,t in data['inv']}: raise ValueError('port IDs')
            if set(classes)!={a[4] for a in data['arcs'].values()}: raise ValueError('class IDs')
            for (p,t),row in data['inv'].items():
                port=ports[p]; role=port['type']; key='production' if role=='Loading' else 'consumption'
                arr=port[key]; arr=arr if isinstance(arr,list) else [arr]
                rate=float(arr[t])*(1 if role=='Loading' else -1)
                if rate!=row['rhs']: raise ValueError('signed demand/production differs')
                s=data['variables'][f'supplyAtNode_({p},0)']
                if s['lb']!=float(port['initialInventory']) or s['ub']!=s['lb']: raise ValueError('initial stock')
                if data['rows'][f'berthLimit_({p},{t})']['rhs']!=float(port['numBerths']): raise ValueError('berths')
                for n,a in row['coeff'].items():
                    if n in data['arcs']:
                        c=data['arcs'][n][4]
                        if abs(a)!=float(classes[c]['capacity']): raise ValueError('class service capacity')
            # Match original initial vessel facts without inventing a named path assignment.
            expected=Counter((int(v['vesselClass']),int(next(p for p,r in ports.items() if r['name']==v['initialPort'])),int(v['firstTimeAvailable'])) for v in vessels if int(v['firstTimeAvailable'])<data['T'])
            actual=Counter()
            for n,(p,t,q,u,c) in data['arcs'].items():
                if t==-1:
                    v=data['variables'][n]
                    if v['lb']!=v['ub']: raise ValueError('nonfixed source')
                    if v['lb']: actual[c,q,u]+=int(v['lb'])
            if expected!=actual: raise ValueError('initial vessel injection')
            matches.append({'folder':name,'ports':ports,'classes':classes,'vessels':vessels,'metadata':records(files['metadata.txt'])[0]})
        except (ValueError,KeyError,IndexError,StopIteration) as e: failures[name]=str(e)
    preferred=[r for r in matches if instance in r['folder'] or instance.removesuffix('_t'+str(data['T'])) in r['folder']]
    if len(preferred)==1: return preferred[0]
    if len(matches)==1: return matches[0]
    raise ValueError(f'Raw matching requires one complete data set; matches={[m["folder"] for m in matches]}, rejected={failures}')

def original_objective(data,values):
    return math.fsum(v['obj']*values[n] for n,v in data['variables'].items())+data['offset']

def validate(data, values, reported=None):
    if set(values)!=set(data['variables']): raise ValueError('Complete variable dictionary coverage differs')
    domain=[]; row_errors=[]; maxdom=0.0; maxratio=0.0; maxres=0.0
    for n,v in data['variables'].items():
        x=values[n]
        if not isinstance(x,(int,float)) or not math.isfinite(x): raise ValueError('Nonfinite variable '+n)
        err=max(v['lb']-x,x-v['ub'],abs(x-round(x)) if v['integer'] else 0.0,0.0)
        maxdom=max(maxdom,err)
        if err>1e-6: domain.append({'variable':n,'value':x,'error':err})
    for n,row in data['rows'].items():
        activity=math.fsum(a*values[v] for v,a in row['coeff'].items()); rhs=row['rhs']
        residual=activity-rhs
        violation=abs(residual) if row['sense']=='E' else max(0.0,residual if row['sense']=='L' else -residual)
        tol=1e-6+1e-9*abs(rhs); maxratio=max(maxratio,violation/tol);maxres=max(maxres,violation)
        if violation>tol: row_errors.append({'row':n,'activity':activity,'rhs':rhs,'sense':row['sense'],'violation':violation,'tolerance':tol})
    obj=original_objective(data,values)
    error=abs(obj-reported) if reported is not None else 0.0
    result={'feasible':not domain and not row_errors and error<=1e-6+1e-9*abs(obj),'variable_count':len(values),'row_count':len(data['rows']),'original_objective':obj,'reported_objective_error':error,'max_domain_integrality_error':maxdom,'max_row_violation':maxres,'max_row_tolerance_ratio':maxratio,'domain_violations':domain,'row_violations':row_errors}
    return result

def kind_for(arc,raw):
    p,t,q,u,c=arc
    if t==-1: return 'initial_source'
    if u<0: raise ValueError('Invalid destination time')
    if q<0: return 'terminal_exit'
    if p==q: return 'waiting'
    return 'loaded_voyage' if raw['ports'][p]['type']=='Loading' else 'empty_return'

ARC_COLS=['original_variable','vessel_class','kind','from_port','from_time_index','to_port','to_time_index','vessel_count','class_capacity','original_cost_per_vessel','cost_contribution','inventory_service_port','inventory_service_time_index','signed_inventory_effect']
PATH_COLS=['anonymous_path_id','step','original_variable','vessel_class','kind','from_port','from_time_index','to_port','to_time_index']
LEDGER_COLS=['port','port_name','role','time_index','stock_before','signed_production_consumption','signed_vessel_service_inventory_effect','alpha_loss_or_shortfall','signed_alpha_effect','stock_after','inventory_residual','berths_used','berths_available','original_alpha_unit_penalty','alpha_cost']
COST_COLS=['component','original_objective_contribution']

def operating_rows(data,raw,values):
    arcs=[]; service=defaultdict(float); berths=defaultdict(int); costs=defaultdict(float)
    for n,arc in sorted(data['arcs'].items()):
        x=round(values[n]); p,t,q,u,c=arc
        if x<=0: continue
        if abs(x-values[n])>1e-6: raise ValueError('Fractional arc')
        k=kind_for(arc,raw); cap=float(raw['classes'][c]['capacity']); contribution=x*data['variables'][n]['obj']
        effect=0.0; sp='';st=''
        if k not in ('initial_source','waiting'):
            sp=p;st=t;effect=-data['inv'][p,t]['coeff'][n]*x
            service[p,t]+=effect;berths[p,t]+=x
        arcs.append(dict(zip(ARC_COLS,[n,c,k,p,t,q,u,x,cap,data['variables'][n]['obj'],contribution,sp,st,effect])))
        costs[k]+=contribution
    # Decompose the original class flow in its acyclic time network.
    remaining={r['original_variable']:r['vessel_count'] for r in arcs}
    outgoing=defaultdict(list);byname={r['original_variable']:r for r in arcs};paths=[];pid=0
    for r in arcs: outgoing[r['vessel_class'],r['from_port'],r['from_time_index']].append(r['original_variable'])
    for r in arcs:
        if r['kind']!='initial_source': continue
        for _ in range(r['vessel_count']):
            pid+=1;step=0;n=r['original_variable']
            while True:
                a=byname[n]
                if remaining[n]<1: raise ValueError('Path decomposition exceeds arc count')
                remaining[n]-=1
                paths.append({'anonymous_path_id':f'class{a["vessel_class"]}-path{pid:03d}','step':step,**{k:a[k] for k in PATH_COLS[2:]}})
                step+=1
                if a['kind']=='terminal_exit': break
                candidates=outgoing[a['vessel_class'],a['to_port'],a['to_time_index']]
                n=next((n for n in candidates if remaining[n]>0),None)
                if n is None: raise ValueError('Path ends before exit')
    if any(remaining.values()): raise ValueError('Uncovered positive class flow')
    ledger=[]
    for (p,t),row in sorted(data['inv'].items()):
        role=raw['ports'][p]['type']; delta=1 if role=='Loading' else -1
        before=values[f'supplyAtNode_({p},{t})']; after=values[f'supplyAtNode_({p},{t+1})'] if t+1<data['T'] else values[f'endingSupplyInRegion_{p}']
        alpha=values[f'alphaSlack_({p},{t})']; penalty=data['variables'][f'alphaSlack_({p},{t})']['obj']; ae=-delta*alpha
        residual=after-(before+row['rhs']+service[p,t]+ae)
        if abs(residual)>1e-6+1e-9*abs(row['rhs']): raise ValueError('Ledger inventory residual')
        ledger.append(dict(zip(LEDGER_COLS,[p,raw['ports'][p]['name'],role,t,before,row['rhs'],service[p,t],alpha,ae,after,residual,berths[p,t],data['rows'][f'berthLimit_({p},{t})']['rhs'],penalty,alpha*penalty])))
        costs['lost_production' if role=='Loading' else 'stockout']+=alpha*penalty
    costs['original_objective_constant']+=data['offset']
    cr=[dict(zip(COST_COLS,[k,v])) for k,v in sorted(costs.items())]
    if abs(math.fsum(costs.values())-original_objective(data,values))>1e-6+1e-9*abs(original_objective(data,values)): raise ValueError('Economic decomposition')
    return arcs,paths,ledger,cr

def export_plan(out,data,raw,values,native):
    check=validate(data,values,native['actual_objective']);dump(out/'validation.json',check)
    if not check['feasible']: raise ValueError('Original-model feasibility check failed; see validation.json')
    arcs,paths,ledger,costs=operating_rows(data,raw,values)
    dump(out/'full-plan.json',values)
    table(out/'arcs.csv',arcs,ARC_COLS);table(out/'paths.csv',paths,PATH_COLS)
    table(out/'port-period.csv',ledger,LEDGER_COLS);table(out/'costs.csv',costs,COST_COLS)
    dump(out/'layout.json',{'values':'full-plan.json','reported_objective':{'file':'native-result.json','key':'actual_objective'},'arcs':'arcs.csv','paths':'paths.csv','ledger':'port-period.csv','costs':'costs.csv'})
    return {'positive_arcs':len(arcs),'anonymous_paths':len({p['anonymous_path_id'] for p in paths}),'ledger_rows':len(ledger),'total_lost_production':sum(r['alpha_loss_or_shortfall'] for r in ledger if r['role']=='Loading'),'total_stockout':sum(r['alpha_loss_or_shortfall'] for r in ledger if r['role']=='Discharge'),'cost_components':{r['component']:r['original_objective_contribution'] for r in costs}}

def terminal_seed(data,raw):
    """Construct a new feasible no-voyage plan from assigned initial injections.

    Greedy terminal service is only a hint. Failure to construct it is explicit;
    it does not change the model or substitute a past plan.
    """
    values={n:(v['lb'] if v['lb']==v['ub'] else 0) for n,v in data['variables'].items()}
    arrivals=defaultdict(Counter);term={};wait={}
    for n,(p,t,q,u,c) in data['arcs'].items():
        v=data['variables'][n]
        if t==-1 and v['lb']>0: arrivals[q,u][c]+=int(v['lb'])
        elif q<0: term[p,t,c]=n
        elif p==q: wait[p,t,c]=n
    active={p:Counter() for p in raw['ports']}
    stock={p:float(r['initialInventory']) for p,r in raw['ports'].items()}
    for t in range(data['T']):
        for p,port in raw['ports'].items():
            values[f'supplyAtNode_({p},{t})']=stock[p]
            active[p].update(arrivals[p,t]);rate=data['inv'][p,t]['rhs'];available=stock[p]+rate
            loading=port['type']=='Loading';storage=float(port['capacity']);chosen=None
            candidates=sorted((c for c,k in active[p].items() if k>0),key=lambda c:(-float(raw['classes'][c]['capacity']),c))
            for c in candidates:
                cap=float(raw['classes'][c]['capacity'])
                if (available>=cap if loading else available+cap<=storage): chosen=c;break
            if chosen is not None:
                cap=float(raw['classes'][chosen]['capacity']);values[term[p,t,chosen]]=1
                active[p][chosen]-=1;available+=-cap if loading else cap
            alpha=max(0.0,available-storage) if loading else max(0.0,-available)
            stock[p]=available-alpha if loading else available+alpha
            values[f'alphaSlack_({p},{t})']=alpha
            if t+1<data['T']:
                for c,k in active[p].items(): values[wait[p,t,c]]=k
            else: values[f'endingSupplyInRegion_{p}']=stock[p]
    if any(sum(c.values()) for c in active.values()): raise ValueError('Terminal seed cannot schedule all initial vessels')
    check=validate(data,values)
    if not check['feasible']: raise ValueError('Constructed terminal seed invalid')
    return values,check
