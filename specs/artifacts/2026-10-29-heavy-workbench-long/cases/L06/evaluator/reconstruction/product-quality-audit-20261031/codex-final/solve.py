"""Fresh assigned-input optimizer. Numerical allocation counts actual solver calls.
No previous plan is read. Models and raw data are authoritative run arguments.
"""
from __future__ import annotations
import os, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent
os.environ['PYTHONDONTWRITEBYTECODE']='1'
os.environ['OMP_NUM_THREADS']='1';os.environ['OPENBLAS_NUM_THREADS']='1';os.environ['MKL_NUM_THREADS']='1'
os.environ['MPLCONFIGDIR']=str(ROOT/'cache'/'matplotlib')
sys.path.insert(0,str(ROOT/'vendor'))
import argparse, json, math, platform, time, traceback, datetime
import core


def finite(x):
    return float(x) if math.isfinite(float(x)) and abs(float(x))<1e19 else None


def derived_integer_bounds(data):
    """Finite exact safe alpha bounds from each defining equality (no heuristic M)."""
    bounds={n:[v['lb'],v['ub']] for n,v in data['variables'].items()}
    certificate={}
    for n,v in data['variables'].items():
        if not math.isfinite(v['ub']):
            if not n.startswith('alphaSlack_'): raise ValueError('Unsupported unbounded variable '+n)
            candidates=[]
            for rn,row in data['rows'].items():
                if n not in row['coeff'] or row['sense']!='E': continue
                a=row['coeff'][n]; lo=hi=0.0
                for q,b in row['coeff'].items():
                    if q==n: continue
                    l,u=bounds[q]
                    if not math.isfinite(l) or not math.isfinite(u): raise ValueError('Cannot derive alpha bound')
                    lo+=b*(l if b>=0 else u);hi+=b*(u if b>=0 else l)
                upper=(row['rhs']-lo)/a if a>0 else (row['rhs']-hi)/a
                candidates.append((upper,rn))
            if not candidates: raise ValueError('Missing alpha definition')
            upper,row=min(candidates)
            bounds[n][1]=math.floor(upper+1e-9)
            certificate[n]={'derived_upper':bounds[n][1],'defining_original_row':row}
    for n,(l,u) in bounds.items():
        if not math.isfinite(l) or not math.isfinite(u) or abs(l-round(l))>1e-9 or abs(u-round(u))>1e-9: raise ValueError('Nonintegral/unbounded physical data '+n)
    # Continuous stocks and alpha are columns of a separate signed chain incidence
    # matrix at each port. Every other column is an original integer class flow.
    occurrences={n:[] for n,v in data['variables'].items() if not v['integer']}
    for rn,row in data['rows'].items():
        if abs(row['rhs']-round(row['rhs']))>1e-9: raise ValueError('Nonintegral rhs '+rn)
        for n,a in row['coeff'].items():
            if abs(a-round(a))>1e-9: raise ValueError('Nonintegral physical coefficient')
            if n in occurrences: occurrences[n].append((rn,a))
    for n,cols in occurrences.items():
        if not all(r.startswith('invBalanceRegion_') and abs(a)==1 for r,a in cols): raise ValueError('Continuous column outside incidence chain '+n)
        if len(cols)>2 or (len(cols)==2 and sum(a for r,a in cols)!=0): raise ValueError('Continuous incidence violation '+n)
    return {n:(int(l),int(u)) for n,(l,u) in bounds.items()},certificate


def solve_cp(data,raw,out,seconds):
    from ortools.sat.python import cp_model
    import ortools
    setup_start=time.perf_counter()
    bounds,cert=derived_integer_bounds(data); model=cp_model.CpModel()
    vv={n:model.new_int_var(*bounds[n],n) for n in data['variables']}
    for rn,row in data['rows'].items():
        expr=cp_model.LinearExpr.weighted_sum([vv[n] for n in row['coeff']],[int(a) for a in row['coeff'].values()]);rhs=int(row['rhs'])
        if row['sense']=='E': model.add(expr==rhs)
        elif row['sense']=='L': model.add(expr<=rhs)
        elif row['sense']=='G': model.add(expr>=rhs)
        else: raise ValueError('Unknown row sense')
    seed,seedcheck=core.terminal_seed(data,raw)
    core.dump(out/'seed-plan.json',seed);core.dump(out/'seed-validation.json',seedcheck)
    for n,v in vv.items(): model.add_hint(v,int(seed[n]))
    model.minimize(sum(v['obj']*vv[n] for n,v in data['variables'].items() if v['obj'])+data['offset'])
    error=model.validate()
    if error: raise ValueError(error)
    model.export_to_file(str(out/'cp-model.textproto'))
    core.dump(out/'derived-bounds.json',cert)
    solver=cp_model.CpSolver();solver.parameters.max_time_in_seconds=seconds
    solver.parameters.num_search_workers=1;solver.parameters.random_seed=0
    solver.parameters.log_search_progress=True;solver.parameters.log_to_stdout=False
    log=(out/'solver.log').open('w',encoding='utf-8')
    solver.log_callback=lambda s:(log.write(s+'\n'),log.flush())
    (out/'parameters.txt').write_text(str(solver.parameters),encoding='utf-8')
    events=[]
    eventfile=(out/'incumbents.jsonl').open('w',encoding='utf-8')
    class Incumbent(cp_model.CpSolverSolutionCallback):
        def on_solution_callback(self):
            values={n:self.Value(v) for n,v in vv.items()}
            e={'event':'native_feasible_incumbent','native_solver_seconds':self.WallTime(),'native_objective':self.ObjectiveValue(),'original_mps_objective':core.original_objective(data,values),'native_bound':self.BestObjectiveBound(),'bound_scope':'CP-SAT integer-stock model, floating objective scaling; not an exact original MILP certificate'}
            events.append(e);eventfile.write(json.dumps(e,allow_nan=False)+'\n');eventfile.flush()
    setup=time.perf_counter()-setup_start
    wall=time.perf_counter();cpu=time.process_time()
    status=solver.solve(model,Incumbent())
    solve_wall=time.perf_counter()-wall;solve_cpu=time.process_time()-cpu
    log.close();eventfile.close()
    values={n:solver.value(v) for n,v in vv.items()} if status in (cp_model.OPTIMAL,cp_model.FEASIBLE) else None
    (out/'response.txt').write_text(solver.response_stats(),encoding='utf-8')
    result={'solver':'OR-Tools CP-SAT','solver_version':ortools.__version__,'method':'integer-stock-cp','status':solver.status_name(status),'native_objective':finite(solver.objective_value) if values is not None else None,'actual_objective':core.original_objective(data,values) if values is not None else None,'native_dual_bound':finite(solver.best_objective_bound),'bound_scope':'CP-SAT integer-stock formulation with automatically scaled floating objective; numerical bound only, not a full original integer-model optimality certificate','solver_threads':1,'numerical_allocation_seconds':seconds,'native_solver_wall_seconds':solver.wall_time,'optimize_call_wall_seconds':solve_wall,'optimize_call_process_cpu_seconds':solve_cpu,'method_setup_seconds':setup,'indivisible_overrun_seconds':max(0.0,solve_wall-seconds),'incumbent_count':len(events),'integer_stock_equivalence':'Integral port-chain incidence matrix with integer rhs and bounded integer initial/storage data; a fixed integer flow has an integral optimum for the continuous stock/alpha subproblem.'}
    return values,result


def solve_scip(model_path,data,out,seconds,incumbent=None,free_classes=None):
    from pyscipopt import Model, Eventhdlr, SCIP_EVENTTYPE
    import pyscipopt
    setup_start=time.perf_counter();m=Model();m.hideOutput();m.setLogfile(str(out/'solver.log'));m.readProblem(str(model_path))
    vv={v.name:v for v in m.getVars()}
    if set(vv)!=set(data['variables']): raise ValueError('Independent MPS parser vs SCIP variable coverage')
    for n,v in vv.items():
        d=data['variables'][n]
        if abs(v.getLbOriginal()-d['lb'])>1e-9 or (d['ub']<1e19 and abs(v.getUbOriginal()-d['ub'])>1e-9) or v.getObj()!=d['obj'] or (v.vtype()!='CONTINUOUS')!=d['integer']: raise ValueError('SCIP vs independent parser variable mismatch '+n)
    seed_accepted=None
    if free_classes is not None:
        for n,arc in data['arcs'].items():
            if arc[4] not in free_classes:
                fixed=round(incumbent[n]);m.chgVarLb(vv[n],fixed);m.chgVarUb(vv[n],fixed)
    if incumbent is not None:
        sol=m.createSol()
        for n,v in vv.items(): m.setSolVal(sol,v,incumbent[n])
        seed_accepted=bool(m.addSol(sol,free=True))
        core.dump(out/'warm-start.json',{'accepted_into_original_solution_store':seed_accepted,'original_objective':core.original_objective(data,incumbent),'free_classes':sorted(free_classes) if free_classes is not None else None})
    m.setRealParam('limits/time',seconds);m.setIntParam('parallel/maxnthreads',1);m.setIntParam('lp/threads',1)
    m.setIntParam('randomization/randomseedshift',0);m.setRealParam('numerics/feastol',1e-9)
    m.writeParams(str(out/'parameters.txt'),comments=True,onlychanged=True)
    events=[];eventfile=(out/'incumbents.jsonl').open('w',encoding='utf-8')
    class Recorder(Eventhdlr):
        def eventinit(self): self.model.catchEvent(SCIP_EVENTTYPE.BESTSOLFOUND,self)
        def eventexit(self): self.model.dropEvent(SCIP_EVENTTYPE.BESTSOLFOUND,self)
        def eventexec(self,event):
            sol=self.model.getBestSol();values={n:self.model.getSolVal(sol,v) for n,v in vv.items()}
            e={'event':'native_best_solution','native_solver_seconds':self.model.getSolvingTime(),'native_objective':self.model.getSolObjVal(sol,original=True),'original_mps_objective':core.original_objective(data,values),'native_bound':finite(self.model.getDualbound()),'bound_scope':('Restricted class-neighborhood integer model; not a full-model bound' if free_classes is not None else 'Full original integer MPS model, SCIP numerical certificate')}
            events.append(e);eventfile.write(json.dumps(e,allow_nan=False)+'\n');eventfile.flush()
    m.includeEventhdlr(Recorder(),'incumbent_recorder','Record genuine native best solution events')
    setup=time.perf_counter()-setup_start;wall=time.perf_counter();cpu=time.process_time();m.optimize()
    sw=time.perf_counter()-wall;sc=time.process_time()-cpu;eventfile.close()
    sol=m.getBestSol(); values={n:m.getSolVal(sol,v) for n,v in vv.items()} if sol is not None else None
    m.writeStatistics(str(out/'statistics.txt'))
    if values is not None: m.writeSol(sol,str(out/'native.sol'),write_zeros=True)
    result={'solver':'SCIP','solver_version':f'{m.getMajorVersion()}.{m.getMinorVersion()}.{m.getTechVersion()}','pyscipopt_version':pyscipopt.__version__,'method':'direct-scip','status':str(m.getStatus()),'native_objective':m.getSolObjVal(sol,original=True) if sol is not None else None,'actual_objective':core.original_objective(data,values) if values is not None else None,'native_dual_bound':finite(m.getDualbound()),'bound_scope':('Restricted class-neighborhood integer model; not a full-model bound' if free_classes is not None else 'Full original integer MPS model, numerical SCIP bound'),'warm_start_accepted':seed_accepted,'free_classes':sorted(free_classes) if free_classes is not None else None,'solver_threads':1,'numerical_allocation_seconds':seconds,'native_solver_wall_seconds':m.getSolvingTime(),'optimize_call_wall_seconds':sw,'optimize_call_process_cpu_seconds':sc,'method_setup_seconds':setup,'indivisible_overrun_seconds':max(0.0,sw-seconds),'incumbent_count':len(events),'native_gap':finite(m.getGap()),'nodes':m.getNNodes()}
    m.freeProb()
    return values,result


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--model',required=True);p.add_argument('--raw',required=True);p.add_argument('--instance',required=True);p.add_argument('--out',required=True)
    p.add_argument('--optimization-seconds',type=float,default=180.0)
    p.add_argument('--method',choices=['cp','scip'],default='cp')
    args=p.parse_args();out=Path(args.out).resolve();out.mkdir(parents=True,exist_ok=True)
    if (out/'native-result.json').exists(): raise ValueError('Refuse to overwrite an experiment; use a fresh output directory')
    start=time.perf_counter();startcpu=time.process_time()
    metadata={'argv':sys.argv,'utc_start':datetime.datetime.now(datetime.timezone.utc).isoformat(),'instance':args.instance,'model':str(Path(args.model).resolve()),'raw_archive':str(Path(args.raw).resolve()),'executable':sys.executable,'python':sys.version,'platform':platform.platform(),'pid':os.getpid(),'solver_threads':1,'registered_numerical_allocation_seconds':args.optimization_seconds,'environment_threads':{n:os.environ[n] for n in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS']}}
    core.dump(out/'execution.json',metadata)
    try:
        data=core.read_mps(args.model);raw=core.load_raw(args.raw,args.instance,data)
        parse=time.perf_counter()-start
        core.dump(out/'input-summary.json',{'matched_raw_folder':raw['folder'],'horizon':data['T'],'variables':len(data['variables']),'rows':len(data['rows']),'integer_variables':sum(v['integer'] for v in data['variables'].values()),'classes':{c:{'capacity':r['capacity']} for c,r in raw['classes'].items()},'ports':{i:{k:r[k] for k in ['name','type','capacity','initialInventory','numBerths']} for i,r in raw['ports'].items()}})
        values,result=solve_cp(data,raw,out,args.optimization_seconds) if args.method=='cp' else solve_scip(args.model,data,out,args.optimization_seconds)
        result['input_setup_seconds']=parse;result['instance']=args.instance
        core.dump(out/'native-result.json',result)
        validation=time.perf_counter()
        if values is None:
            result['has_feasible_plan']=False;result['operating_outputs']='unavailable; no finite vector or objective was fabricated'
        else:
            result['has_feasible_plan']=True;result['operations']=core.export_plan(out,data,raw,values,result)
        result['validation_export_seconds']=time.perf_counter()-validation
        result['lifecycle_wall_seconds']=time.perf_counter()-start;result['lifecycle_process_cpu_seconds']=time.process_time()-startcpu
        core.dump(out/'native-result.json',result)
        print(json.dumps(result,allow_nan=False),flush=True)
        return 0 if values is not None else 2
    except Exception as e:
        error={'type':type(e).__name__,'message':str(e),'traceback':traceback.format_exc(),'elapsed_wall_seconds':time.perf_counter()-start}
        core.dump(out/'error.json',error);traceback.print_exc();return 1

if __name__=='__main__': sys.exit(main())
