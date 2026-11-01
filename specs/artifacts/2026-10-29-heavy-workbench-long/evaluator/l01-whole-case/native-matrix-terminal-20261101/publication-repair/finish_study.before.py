"""Actual source validation/recovery/spectrum/report from this run's original objects."""
from pathlib import Path
import json,os,subprocess,sys,time,gc,shutil
import numpy as np
import torch
import study_engine as e
from pinn_numeric_check import load_network,metrics,canonical_data,forward_jets,exact_jets
from pinn_torch_check import evaluate

def finish_study(project,inputs,out,profile,manifest,observations,parent,device,full):
    analysis=out/'analysis-segments'/str(os.getpid());analysis.mkdir(parents=True)
    diagnostics=analysis/'diagnostics';diagnostics.mkdir()
    if full:
        for problem,key in manifest['solution_checkpoints'].items():
            if key is None:continue
            result=evaluate(problem,observations[key]['final'],device=device)
            e.write_json(diagnostics/f'{problem}-numeric.json',result);gc.collect()
            if device=='cuda':torch.cuda.empty_cache()
        if parent:
            for component in ('total','residual','constraint'):
                result=evaluate('convection',observations[parent['id']]['final'],device=device,spectral_steps=60,component=component)
                result['spectrum']['largest5_converged']=all(v['explicit_ritz_residual']/max(1,abs(v['value']))<=1e-3 for v in result['spectrum']['pairs'][-5:])
                e.write_json(diagnostics/f'parent-{component}-spectrum.json',result);gc.collect()
                if device=='cuda':torch.cuda.empty_cache()
            parameters=e.load_parameters(observations[parent['id']]['final'],device);oracle=e.Oracle('convection',parameters,e.data_from_public(inputs,'convection',device))
            _,g=oracle.grad(graph=True);h=oracle.hessian(g);b=-g.detach();mu=1.
            t=time.perf_counter();raw,raw_info=e.pcg(lambda v:h(v)+mu*v,b,lambda v:v);raw_seconds=time.perf_counter()-t;raw_cost=dict(oracle.costs)
            t=time.perf_counter();inverse,sketch=e.nystrom(h,g.numel(),mu,20263029,str(parameters[0].device));pre,pre_info=e.pcg(lambda v:h(v)+mu*v,b,inverse)
            e.write_json(diagnostics/'same-system-pcg.json',{'mu':mu,'same_rhs':'negative actual parent gradient','initial_solution':'zero for both','explicit_tolerance':1e-8,'maximum_iterations':200,'unpreconditioned':raw_info,'unpreconditioned_seconds':raw_seconds,'unpreconditioned_costs':raw_cost,'preconditioned':pre_info,'preconditioned_seconds_including_sketch':time.perf_counter()-t,'preconditioned_sketch':sketch,'combined_costs':dict(oracle.costs),'solution_difference_l2':float(torch.linalg.vector_norm(pre-raw)),'claim':'actual finite system comparison, not a certified complete Hessian condition number'})
            del parameters,oracle,g,h;gc.collect()
            if device=='cuda':torch.cuda.empty_cache()
        recovery=[]
        for phase,start,until,folder in [('adam',500,600,next((out/'runs'/s['id']/'adam' for s in profile['base_configurations'] if s['method']=='adam' and (out/'runs'/s['id']/'adam/state-500.pt').exists()),None)),('lbfgs',100,120,out/'runs'/parent['id']/'lbfgs' if parent else None)]:
            if folder is None or not (folder/f'state-{start}.pt').exists() or not (folder/f'accepted-{until}.npz').exists():
                recovery.append({'phase':phase,'status':'unavailable','reason':'required actual accepted state/comparison not produced; never force zero updates or rerun prefix'});continue
            argv=[sys.executable,'-B',str(project/'run_study.py'),'--inputs',str(inputs),'--output',str(analysis/'recovery'/phase),'--device',device,'--recovery-state',str(folder/f'state-{start}.pt'),'--recovery-until',str(until),'--recovery-expected',str(folder/f'accepted-{until}.npz')]
            t=time.perf_counter();started=e.utc();p=subprocess.run(argv,capture_output=True,text=True)
            item={'phase':phase,'parent_pid':os.getpid(),'argv':argv,'started_at':started,'finished_at':e.utc(),'seconds':time.perf_counter()-t,'native_exit':p.returncode,'stdout':p.stdout,'stderr':p.stderr,'restoration_result':json.loads((analysis/'recovery'/phase/'recovery.json').read_text()) if (analysis/'recovery'/phase/'recovery.json').exists() else None};recovery.append(item)
        e.write_json(diagnostics/'actual-new-process-recovery.json',recovery)
    make_report(project,inputs,analysis,profile,manifest,observations,full)
    if full:
        for p in analysis.iterdir():
            if p.is_file():shutil.copy2(p,out/p.name)
        shutil.copytree(analysis/'figures',out/'figures',dirs_exist_ok=True)
    e.write_json(out/'analysis-current.json',{'path':analysis.relative_to(project).as_posix(),'full_requested':full,'native_pid':os.getpid(),'scope':'old analysis segments remain intact; canonical publication only for requested full study'})

def make_report(project,inputs,out,profile,manifest,observations,full):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import csv,html
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer
    figures=out/'figures';figures.mkdir()
    structure=[]
    if full:
        from physics_structure import construct
        folder=out/'structure-controls';folder.mkdir()
        for problem in ('convection','reaction','wave'):
            layers,fit=construct(problem);path=folder/f'{problem}.npz'
            np.savez(path,**{k:v for i,(w,b) in enumerate(layers) for k,v in ((f'weight_{i}',w),(f'bias_{i}',b))})
            measured=metrics(problem,load_network(path),canonical_data(problem))
            structure.append({'problem':problem,'metrics':measured,'fit':fit,'old_profile_eligible':False,'meaning':'neural representation/physics prior control only; never a result of the registered Xavier optimizer trajectory'})
        e.write_json(folder/'actual-results.json',structure)
    rows=[]
    for spec in profile['base_configurations']+profile['continuations']:
        record=next(v for v in manifest['runs'] if v['config_id']==spec['id']);m=observations.get(spec['id'],{}).get('metrics')
        row={'config_id':spec['id'],'status':record['status'],'accepted_updates':sum(v['accepted_updates'] for v in record['phases'].values()),'closure_calls':record['costs']['closure_calls'],'hvp_calls':record['costs']['hvp_calls'],'train_loss':m['total_loss'] if m else None,'l2re':m['l2re'] if m else None,'evaluation_residual_rmse':m['evaluation_residual_rmse'] if m else None};rows.append(row)
    with (out/'summary.csv').open('w',newline='',encoding='utf-8') as f:w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
    fig,axs=plt.subplots(1,3,figsize=(15,4.5))
    for problem,ax in zip(('convection','reaction','wave'),axs):
        for spec in profile['base_configurations']:
            if spec['problem']!=problem or spec['id'] not in observations:continue
            record=next(v for v in manifest['runs'] if v['config_id']==spec['id']);trace=project/record['trace'];points=[]
            for line in trace.read_text().splitlines():
                v=json.loads(line)
                if v.get('loss_after') is not None:points.append((v['accepted_after']+(spec['adam_updates_before_switch'] if v['phase']=='lbfgs' and spec['method']=='hybrid' else 0),v['loss_after']))
            if points:ax.semilogy(*zip(*points),label=spec['id'].replace(problem+'-',''),linewidth=.9)
        ax.set_title(problem);ax.set_xlabel('Actual accepted optimizer updates');ax.set_ylabel('Training objective (log scale)');ax.grid(alpha=.2)
        if ax.lines:ax.legend(fontsize=6)
        else:ax.text(.5,.5,'Not executed',transform=ax.transAxes,ha='center')
    fig.tight_layout();fig.savefig(figures/'actual-training.png',dpi=150);plt.close(fig)
    selected={}
    fig,axs=plt.subplots(3,3,figsize=(13,11))
    for i,(problem,key) in enumerate(manifest['solution_checkpoints'].items()):
        if key is None:
            for ax in axs[i]:ax.text(.5,.5,problem+': no eligible final',ha='center',transform=ax.transAxes);ax.axis('off')
            continue
        arrays=canonical_data(problem);layers=load_network(observations[key]['final']);truth=exact_jets(problem,arrays['evaluation'])['u'];prediction=forward_jets(layers,arrays['evaluation'])['u'];m=observations[key]['metrics']
        selected[problem]={'config_id':key,'metrics':m,'target_components':{'relative_solution':m['l2re']<=.01,'evaluation_residual':m['evaluation_residual_rmse']<=.01,**{k:v['rmse']<=.01 for k,v in m['constraint_families'].items()}}}
        for j,(values,label) in enumerate(((truth,'Known solution'),(prediction,'Actual selected network'),(np.abs(prediction-truth),'Absolute error'))):
            ax=axs[i,j];image=ax.imshow(values.reshape(129,65),origin='lower',aspect='auto',extent=[0,1,0,1 if problem=='wave' else 2*np.pi],cmap='magma' if j==2 else 'viridis');ax.set_title(problem+': '+label,fontsize=10);ax.set_xlabel('t');ax.set_ylabel('x');fig.colorbar(image,ax=ax)
    fig.tight_layout();fig.savefig(figures/'actual-selected-solutions.png',dpi=150);plt.close(fig)
    e.write_json(out/'selected-quality.json',{'target':{'l2re':.01,'evaluation_residual_rmse':.01,'each_condition_rmse':.01},'selected':selected,'all_three_solution_targets':len(selected)==3 and all(all(v['target_components'].values()) for v in selected.values()),'scope':'actual author results; numerical outcomes do not by themselves certify methods/full-study/provenance'})
    table='\n'.join('|'+str(v['config_id'])+'|'+str(v['status'])+'|'+str(v['accepted_updates'])+'|'+str(v['closure_calls'])+'|'+str(v['hvp_calls'])+'|'+str(v['train_loss'])+'|'+str(v['l2re'])+'|' for v in rows)
    quality='\n'.join(problem+': '+json.dumps(v,ensure_ascii=False) for problem,v in selected.items())
    structure_text='\n'.join(v['problem']+': '+json.dumps(v['metrics']) for v in structure) if structure else 'Not run in this partial execution.'
    paper=f'''# PINN optimizer study: actual bounded derived execution

## Scope and preregistration
This is a local derived study of Rathore et al., Challenges in Training PINNs: A Loss Landscape Perspective (ICML2024), not the original study or official PaperBench. Read plan.md, inputs/TASK.md and inputs/SOURCE.md for the exact raw-coordinate architecture, data, optimizer and known earlier feasibility context. All source/assets are captured before this output; the caller's actual native receipts bind their provenance. Full requested execution={full}. This document reports actual completed, failed and unexecuted cells separately and does not infer scientific success from task completion.

## Mathematical and numerical methods
The raw [x,t] width100 three-hidden-layer tanh/linear-output network uses float64, prescribed Xavier initialization and the exact PDE plus concatenated-condition objective. Training consumes only residual coordinates and initial/boundary conditions, never the analytic future evaluation solution. Native Adam and one-iteration strong-Wolfe L-BFGS use the public parameters; shared11k Adam prefixes are explicit. Attempt/closure/accepted-update counts differ and remain visible. A first finite zero parameter change terminates stalled, not converged; exceptions remain real incomplete/error evidence. NNCG uses the actual shifted Nyström sketch, PCG explicit residual and Armijo sufficient descent. Delta stabilizes the projected factor, not the complete Hessian.

## Actual registered results
|Configuration|State|Accepted updates|Closures|HVPs|Train loss|Relative solution error|
|---|---|---:|---:|---:|---:|---:|
{table}

## Same-final quality
Selection uses eligible terminal training loss only, exact-tie ID rule. The convection continuation-parent LR rule is separate. The pre-execution1% solution and0.01 residual/each-condition targets cannot be relaxed to fit these observations. Every component comes from one selected final, not a mixture. Small residual alone is insufficient: reaction initial error can amplify, and periodic/boundary defects are independent. No continuous-domain error certificate follows from the discrete public grid.
{quality}

## Diagnostics and recovery
diagnostics contains actual selected scalar/finite-difference checks, parent full/residual/constraint Ritz estimates and same-system unpreconditioned/preconditioned solves when a complete execution provides that parent. Ritz residuals mark convergence; finite Krylov results are not the complete spectrum or a certified condition number. Recovery uses new real child PIDs and the actual500->600 Adam and100->120 selected L-BFGS saved optimizer/RNG; unavailable states or child failures are reported, never replaced by replaying a prefix. Physical shared computation, logical trajectories and postprocessing costs are distinct; phase wall times overlap inherited prefixes and cannot simply be summed.

## Independent representation and physical-prior controls
The same raw width100/tanh architecture can be compiled from initial/boundary facts and PDE structure using a linear fixed-feature fit. These actual network exports, fit matrices and metrics are stored under structure-controls. They are deliberately not eligible for the old randomized-optimizer selection and cannot prove that any Adam/L-BFGS/NNCG trajectory reproduced a solution. They distinguish representation capacity from the initialization/optimization restriction. Known future evaluation solutions are used only after fitting to evaluate the exported weights, never as fitting labels. No old scientific failure is relabeled as a successful optimizer result.
{structure_text}

## Interpretation and limits
Actual training and selected-field plots accompany this report. Cross-problem observations use seed345; only convection has paired345/456/567 and single-seed learning-rate sensitivity, so they are not19 independent statistical samples or proof of cross-problem seed robustness. All failed methods and unavailable dependencies remain in the denominator. The numerical values above, rather than an invented improvement claim, determine whether a method improved. Original Table2 convection NNCG3.63e-7 is an attributed paper value, not any result here. Current target failure is not compensated by truthful methodology. Author reference seconds and evaluator computation do not qualify effective candidate hours or statistical/professional maturity.

## Reproduction and evidence
Use the captured complete source/requirements, public inputs, run_study.py command and original native execution. A fresh output retrains; reading a supplied NPZ or redrawing these figures is only re-evaluation. The actual process/argv/environment appear in study-started, phase execution, attempts, recovery and caller-owned receipts. No Provider, credentials, real user process, UI or external service is involved. The present reference is not a scored fresh OpenCorvus/Codex candidate.
'''
    (out/'paper.md').write_text(paper,encoding='utf-8')
    (out/'reproduction.md').write_text('Run from the captured project: python run_study.py --inputs inputs --output NEW_RESULTS --device cuda. Default executes the complete registered matrix; --only ID is a partial clean execution and cannot stand in for it. --resume OWN_STATE --only ORIGINAL_ID --output NEW_FORK preserves old source/state and explicitly forks saved optimizer/RNG. Compare original actual receipts and manifests. Figures are generated from this output only. Reading old weights is not clean retraining. See original errors/unexecuted records before claiming completion.\n',encoding='utf-8')
    e.write_json(out/'references.json',[{'title':'Challenges in Training PINNs: A Loss Landscape Perspective','authors':'Rathore et al.','year':2024,'url':'https://proceedings.mlr.press/v235/rathore24a.html','source':'supplied original PDF/Markdown and SOURCE.md, third-party CC BY4.0; no original-author endorsement'}])
    styles=getSampleStyleSheet();story=[]
    for line in paper.splitlines():
        if not line:story.append(Spacer(1,5));continue
        style=styles['Heading1' if line.startswith('# ') else 'Heading2' if line.startswith('## ') else 'BodyText']
        story.append(Paragraph(__import__('html').escape(line.lstrip('# ')),style))
    SimpleDocTemplate(str(out/'paper.pdf')).build(story)
