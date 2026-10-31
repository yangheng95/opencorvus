"""Class-block large-neighborhood optimizer, with full original-model solves.
Every run constructs its own incumbent from assigned facts; no stored plan input.
"""
from __future__ import annotations
import os, sys, time, json, argparse, datetime, platform, traceback
from pathlib import Path
import solve
import core

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--model',required=True);p.add_argument('--raw',required=True);p.add_argument('--instance',required=True);p.add_argument('--out',required=True);p.add_argument('--optimization-seconds',type=float,default=180)
    args=p.parse_args();out=Path(args.out).resolve();out.mkdir(parents=True,exist_ok=True)
    if (out/'native-result.json').exists(): raise ValueError('Use a fresh output directory')
    wall=time.perf_counter();cpu=time.process_time()
    core.dump(out/'execution.json',{'argv':sys.argv,'utc_start':datetime.datetime.now(datetime.timezone.utc).isoformat(),'instance':args.instance,'pid':os.getpid(),'executable':sys.executable,'python':sys.version,'platform':platform.platform(),'model':str(Path(args.model).resolve()),'raw_archive':str(Path(args.raw).resolve()),'registered_numerical_allocation_seconds':args.optimization_seconds,'solver_threads':1})
    try:
        data=core.read_mps(args.model);raw=core.load_raw(args.raw,args.instance,data);input_setup=time.perf_counter()-wall
        classes=sorted(raw['classes']);nominal=args.optimization_seconds
        heuristic=time.perf_counter();best,seedcheck=core.terminal_seed(data,raw);used=time.perf_counter()-heuristic
        core.dump(out/'constructed-seed.json',best);core.dump(out/'constructed-seed-validation.json',seedcheck)
        seedseconds=used;bestobj=core.original_objective(data,best);stages=[];global_bounds=[];events=[];validation_seconds=0;global_optimal=False;best_source='constructed-seed';best_native=None
        if len(classes)==1:
            schedule=[('full',None,nominal)]
        else:
            pairs=[{classes[i],classes[(i+1)%len(classes)]} for i in range(len(classes))]
            schedule=[('initial-full',None,nominal*.25)]+[(f'class-pair-{i+1}',pair,nominal*.5/len(pairs)) for i,pair in enumerate(pairs)]+[('final-full',None,nominal*.25)]
        core.dump(out/'registered-schedule.json',{'nominal_seconds':nominal,'stages':[{'label':label,'free_classes':sorted(free) if free is not None else None,'nominal_seconds':allocation} for label,free,allocation in schedule],'seed_heuristic_seconds':seedseconds,'remaining_allocation_rule':'Every call receives min(stage allocation, nominal minus cumulative measured numerical time); the final full call receives all remaining numerical time. Construction of the heuristic seed counts as numerical optimization.'})
        for i,(label,free,allocation) in enumerate(schedule):
            remaining=nominal-used
            if remaining<=0: break
            allocation=remaining if i==len(schedule)-1 else min(allocation,remaining)
            stage=out/'stages'/f'{i:02d}-{label}';stage.mkdir(parents=True)
            before=bestobj;offset=used
            candidate,result=solve.solve_scip(args.model,data,stage,allocation,incumbent=best,free_classes=free)
            used+=result['optimize_call_wall_seconds']
            validation=time.perf_counter()
            if candidate is not None:
                candidateobj=core.original_objective(data,candidate);check=core.validate(data,candidate,result['native_objective']);core.dump(stage/'validation.json',check)
                if not check['feasible']: raise ValueError('Stage candidate fails original MPS')
                if candidateobj<bestobj or (best_source=='constructed-seed' and abs(candidateobj-bestobj)<=1e-6+1e-9*abs(bestobj)):
                    best=candidate;bestobj=candidateobj;best_source=str(stage.relative_to(out));best_native=result['native_objective']
                result['operations']=core.export_plan(stage,data,raw,candidate,result)
            else:
                result['has_feasible_plan']=False
            validation_seconds+=time.perf_counter()-validation
            if free is None and result['native_dual_bound'] is not None: global_bounds.append(result['native_dual_bound'])
            result.update(stage=label,incumbent_before=before,incumbent_retained=bestobj,numerical_time_offset=offset)
            core.dump(stage/'native-result.json',result)
            stages.append({'path':str(stage.relative_to(out)),'label':label,'allocation_seconds':allocation,'objective_before':before,'stage_native_objective':result['native_objective'],'retained_original_objective':bestobj,'native_bound':result['native_dual_bound'],'bound_scope':result['bound_scope'],'status':result['status'],'optimize_call_wall_seconds':result['optimize_call_wall_seconds'],'optimize_call_process_cpu_seconds':result['optimize_call_process_cpu_seconds'],'native_solver_wall_seconds':result['native_solver_wall_seconds'],'method_setup_seconds':result['method_setup_seconds']})
            for line in (stage/'incumbents.jsonl').read_text().splitlines():
                e=json.loads(line);e['stage']=label;e['cumulative_numerical_seconds']=offset+e['native_solver_seconds'];events.append(e)
            print(json.dumps(stages[-1]),flush=True)
            if free is None and result['status']=='optimal':
                global_optimal=True;break
        with (out/'incumbents.jsonl').open('w',encoding='utf-8') as f:
            for e in events: f.write(json.dumps(e,allow_nan=False)+'\n')
        globalbound=max(global_bounds) if global_bounds else None
        result={'method':'class-block-lns','solver':'SCIP 10.0.2 via PySCIPOpt 6.3.0','status':'optimal' if global_optimal else 'FEASIBLE','actual_objective':bestobj,'native_objective':best_native,'best_vector_source':best_source,'native_objective_provenance':'Minimum original MPS objective of accepted native stage incumbents or freshly constructed verified seed. Each native claim is retained under stages.','native_dual_bound':globalbound,'bound_scope':'Maximum bound from unrestricted full original MPS stages only. Restricted class-neighborhood bounds remain local.','solver_threads':1,'numerical_allocation_seconds':nominal,'seed_heuristic_seconds':seedseconds,'optimize_call_wall_seconds':sum(s['optimize_call_wall_seconds'] for s in stages),'native_solver_wall_seconds':sum(s['native_solver_wall_seconds'] for s in stages),'optimize_call_process_cpu_seconds':sum(s['optimize_call_process_cpu_seconds'] for s in stages),'numerical_optimization_total_seconds':used,'indivisible_overrun_seconds':max(0,used-nominal),'input_setup_seconds':input_setup,'method_setup_seconds':sum(s['method_setup_seconds'] for s in stages),'stage_validation_export_seconds':validation_seconds,'stages':stages,'has_feasible_plan':True,'instance':args.instance,'incumbent_count':len(events)}
        if globalbound is not None:result['descriptive_relative_gap']=(bestobj-globalbound)/abs(bestobj)
        core.dump(out/'native-result.json',result);validation=time.perf_counter();result['operations']=core.export_plan(out,data,raw,best,result);result['validation_export_seconds']=time.perf_counter()-validation
        result['lifecycle_wall_seconds']=time.perf_counter()-wall;result['lifecycle_process_cpu_seconds']=time.process_time()-cpu
        core.dump(out/'native-result.json',result);print(json.dumps(result,allow_nan=False),flush=True)
        return 0
    except Exception as e:
        core.dump(out/'error.json',{'type':type(e).__name__,'message':str(e),'traceback':traceback.format_exc(),'elapsed_wall_seconds':time.perf_counter()-wall});traceback.print_exc();return 1
if __name__=='__main__':sys.exit(main())
