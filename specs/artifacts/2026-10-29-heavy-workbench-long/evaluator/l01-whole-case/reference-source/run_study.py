"""Complete source-only author research entry; no private score/reference input.

--resume is an explicit fork from an owned checkpoint in the same project. Old
segments remain intact; it is not a claim of automatic crash or power-loss recovery.
"""
from pathlib import Path
import argparse,datetime,json,os,platform,shutil,subprocess,sys,time,traceback
import numpy as np
import torch
import study_engine as engine
from pinn_numeric_check import load_network,metrics,canonical_data
from study_publication import finalize_manifest

PROJECT=Path(__file__).resolve().parent
def rel(p):return Path(p).resolve().relative_to(PROJECT).as_posix()
def load(p):return json.loads(Path(p).read_text(encoding='utf-8'))
def numerical(p,problem):return metrics(problem,load_network(p),canonical_data(problem))
def blank(s):
    phases={'adam':['adam'],'lbfgs':['lbfgs'],'hybrid':['adam','lbfgs'],'gd':['gd'],'nncg':['nncg']}[s['method']]
    return {'config_id':s['id'],'status':'incomplete','reason':'not executed','parent_id':None,'phases':{p:{'attempts':0,'accepted_updates':0} for p in phases},'costs':{k:0 for k in ('closure_calls','gradient_calls','hvp_calls','lbfgs_native_iterations')},'checkpoints':{'initial':None,'switch':None,'final':None},'trace':None,'receipt':None}

def trace_join(destination,parts):
    with Path(destination).open('w',encoding='utf-8') as target:
        for source,through,shared in parts:
            for line in Path(source).read_text(encoding='utf-8').splitlines():
                v=json.loads(line)
                if through is None or v.get('attempt',0)<=through:
                    if shared:v['shared_prefix_source']=shared
                    target.write(json.dumps(v)+'\n')
def options():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--inputs',type=Path,required=True);p.add_argument('--output',type=Path,required=True)
    p.add_argument('--device',default='cuda',choices=['cpu','cuda']);p.add_argument('--only');p.add_argument('--resume',type=Path);p.add_argument('--continue-study',action='store_true')
    p.add_argument('--recovery-state',type=Path);p.add_argument('--recovery-until',type=int);p.add_argument('--recovery-expected',type=Path)
    return p.parse_args()
def recovery(a):
    a.output.mkdir(parents=True,exist_ok=False)
    state=torch.load(a.recovery_state,map_location='cpu',weights_only=False);ctx=state['context'];spec=ctx['spec'];phase=state['phase']
    parameters=tuple(torch.tensor(v,dtype=torch.float64,device=a.device,requires_grad=True) for v in state['parameters'])
    data=engine.data_from_public(a.inputs,spec['problem'],a.device);oracle=engine.Oracle(spec['problem'],parameters,data)
    r=engine.optimize(oracle,phase,a.recovery_until,a.output,ctx,learning_rate=spec.get('adam_learning_rate') or spec.get('value'),parameter=spec.get('value'),start_state=state)
    expected=load_network(a.recovery_expected);actual=load_network(a.output/'final.npz')
    errors=[]
    for original,new in zip(expected,actual):
        for x,y in zip(original,new):np.testing.assert_allclose(x,y,atol=1e-10,rtol=1e-8);errors.append(float(np.max(np.abs(x-y))))
    original_metrics=numerical(a.recovery_expected,spec['problem']);actual_metrics=numerical(a.output/'final.npz',spec['problem'])
    np.testing.assert_allclose(original_metrics['total_loss'],actual_metrics['total_loss'],atol=1e-10,rtol=1e-8)
    engine.write_json(a.output/'recovery.json',{'status':'verified','maximum_parameter_error':max(errors),'absolute_loss_difference':abs(original_metrics['total_loss']-actual_metrics['total_loss']),'native_pid':os.getpid(),'argv':sys.argv,'original_context':ctx,'actual_phase':r,'source_state':str(a.recovery_state),'expected_uninterrupted':str(a.recovery_expected),'scope':'new process restores saved optimizer/RNG and performs only the remaining comparison updates'})
    return
def main():
    a=options();torch.set_default_dtype(torch.float64);torch.set_num_threads(1)
    if a.recovery_state:return recovery(a)
    inputs=a.inputs.resolve();out=a.output.resolve();rel(out)
    if a.device=='cuda' and not torch.cuda.is_available():raise RuntimeError('declared CUDA device unavailable')
    profile=load(inputs/'profile.json');specs=profile['base_configurations']+profile['continuations']
    if a.only not in [None]+[s['id'] for s in specs]:raise ValueError('unknown registered --only')
    if a.resume and not a.only:raise ValueError('explicit --resume requires its original --only config ID')
    if a.continue_study and not (out/'manifest.json').is_file():raise ValueError('continue-study requires the existing original study output')
    if a.continue_study and not (out/'study-terminal.json').is_file():raise ValueError('continue-study requires a naturally completed previous segment; interrupted phases need an explicit saved-state fork')
    if a.continue_study and (a.resume or a.only):raise ValueError('continue-study executes remaining original cells; do not combine with a new fork/only')
    out.mkdir(parents=True,exist_ok=a.continue_study)
    if a.continue_study:
        if load(out/'profile.json')!=profile:raise ValueError('original study profile changed')
    else:engine.write_json(out/'profile.json',profile)
    execution={'started_at':engine.utc(),'pid':os.getpid(),'argv':sys.argv,'cwd':str(Path.cwd()),'device':a.device,'python':sys.version,'torch':torch.__version__,'numpy':np.__version__,'cuda':torch.version.cuda,'gpu':torch.cuda.get_device_name(0) if a.device=='cuda' else None,'host':platform.platform(),'container_pid_namespace':os.readlink('/proc/self/ns/pid') if Path('/proc/self/ns/pid').exists() else None,'scope':'author source-only execution, not candidate score'}
    engine.write_json(out/f'study-started-{os.getpid()}.json',execution)
    if not a.continue_study:engine.write_json(out/'study-started.json',execution)
    manifest=load(out/'manifest.json') if a.continue_study else {'format':'heavy-pinn-study/1','benchmark':profile['benchmark'],'case':profile['case'],'runs':[blank(s) for s in specs],'solution_checkpoints':{p:None for p in ('convection','reaction','wave')}}
    byid={r['config_id']:r for r in manifest['runs']};observations={};prefixes={};initials={};work=load(out/'work-ledger.json') if a.continue_study else []
    if a.continue_study:
        for s in specs:
            v=byid[s['id']]
            if v['status'] not in ('incomplete','dependency_incomplete'):
                checkpoint=PROJECT/v['checkpoints']['final'];m=numerical(checkpoint,s.get('problem','convection'))
                observations[s['id']]={'metrics':m,'status':v['status'],'final':checkpoint}
                state=out/'runs'/s['id']/'adam/state-11000.pt'
                if s['method']=='adam' and state.exists():prefixes[(s['problem'],s['seed'],s['adam_learning_rate'])]={'config_id':s['id'],'state':state,'trace':state.parent/'attempts.jsonl'}
    resuming=torch.load(a.resume,map_location='cpu',weights_only=False) if a.resume else None
    only_continuation=a.only in [s['id'] for s in profile['continuations']]
    def publish():engine.write_json(out/'manifest.json',manifest);engine.write_json(out/'work-ledger.json',work)
    def init(s):
        seed=s['seed'];p=out/'init'/f'seed{seed}.npz'
        if seed not in initials:
            if not p.exists():engine.export(engine.initial_parameters(seed,a.device),p)
            initials[seed]=p
        return p
    def finish(s,r,folder,phases,oracle,parent_id,initial,switch,trace_parts):
        engine.export(oracle.parameters,folder/'final.npz');trace_join(folder/'attempts.jsonl',trace_parts)
        status=phases[-1]['status'];record=byid[s['id']]
        phase_counts=dict(record['phases']);phase_counts.update({p['method']:{'attempts':p['attempts'],'accepted_updates':p['accepted_updates']} for p in phases})
        record.update(status=status,reason=phases[-1]['reason'],parent_id=parent_id,phases=phase_counts,costs={k:oracle.costs[k] for k in record['costs']},checkpoints={'initial':rel(initial),'switch':rel(switch) if switch else None,'final':rel(folder/'final.npz')},trace=rel(folder/'attempts.jsonl'),receipt=rel(folder/'execution.json'))
        if phases[-1].get('failure_code'):record['failure_code']=phases[-1]['failure_code']
        engine.write_json(folder/'execution.json',{'config_id':s['id'],'actual_parameters':s,'native_pid':os.getpid(),'argv':sys.argv,'phases':phases,'finished_at':engine.utc(),'shared_prefix':r,'source':'actual bundled reference source; caller captures complete project/version before execution'})
        m=numerical(folder/'final.npz',s.get('problem','convection'));engine.write_json(folder/'metrics.json',m);observations[s['id']]={'metrics':m,'status':status,'final':folder/'final.npz'}
        work.append({'config_id':s['id'],'phase_receipts':[rel(folder/p['method']/'execution.json') for p in phases if (folder/p['method']/'execution.json').exists()],'shared_prefix_config':r,'logical_costs':dict(oracle.costs),'meaning':'shared actual prefix is referenced, never billed twice in physical wall/cost totals'})
        publish();print(json.dumps({'event':'config_terminal','config_id':s['id'],'status':status,'total_loss':m['total_loss'],'l2re':m['l2re']}),flush=True)
    publish()
    try:
        for s in profile['base_configurations']:
            if a.only and a.only!=s['id'] and not (only_continuation and not resuming and s['problem']=='convection' and s['seed']==345 and s['method']=='hybrid'):continue
            if a.continue_study and s['id'] in observations:continue
            folder=out/'runs'/s['id'];folder.mkdir(parents=True)
            initial=init(s);parameters=engine.load_parameters(initial,a.device);data=engine.data_from_public(inputs,s['problem'],a.device);oracle=engine.Oracle(s['problem'],parameters,data)
            ctx={'spec':s,'original_initial':rel(initial),'inputs':rel(inputs) if inputs.is_relative_to(PROJECT) else str(inputs),'created_pid':os.getpid()};phases=[];parts=[];switch=None;shared=None
            resumed=resuming if not only_continuation else None
            if resumed and resumed['context']['spec']!=s:raise ValueError('checkpoint/config mismatch')
            prefix_key=(s['problem'],s['seed'],s.get('adam_learning_rate'))
            if s['method'] in ('adam','hybrid'):
                limit=s['max_updates'] if s['method']=='adam' else s['adam_updates_before_switch']
                if s['method']=='hybrid' and prefix_key in prefixes and not resumed:
                    item=prefixes[prefix_key];state=torch.load(item['state'],map_location='cpu',weights_only=False)
                    with torch.no_grad():
                        for p,v in zip(parameters,state['parameters']):p.copy_(v.to(a.device))
                    oracle.costs=dict(state['costs']);shared=item['config_id'];switch=folder/'switch.npz';engine.export(parameters,switch)
                    phases.append({'method':'adam','status':'max_updates','reason':'actual shared Adam prefix','attempts':limit,'accepted_updates':limit,'shared_config':shared})
                    parts.append((item['trace'],limit,shared))
                elif resumed and resumed['phase']=='lbfgs' and s['method']=='hybrid':
                    phases.extend(resumed['context']['completed_phases'])
                    parts.extend((PROJECT/p['path'],p['through'],p['shared']) for p in resumed['context']['prior_trace'])
                    switch=PROJECT/resumed['context']['switch']
                else:
                    if resumed and resumed['phase']=='adam':parts.append((Path(a.resume).parent/'attempts.jsonl',resumed['attempt'],rel(a.resume)))
                    result=engine.optimize(oracle,'adam',limit,folder/'adam',ctx,learning_rate=s['adam_learning_rate'],start_state=resumed if resumed and resumed['phase']=='adam' else None)
                    phases.append(result);parts.append((folder/'adam/attempts.jsonl',None,None))
                    if s['method']=='hybrid':switch=folder/'adam/final.npz'
                    state=folder/'adam/state-11000.pt'
                    if s['method']=='adam' and state.exists():prefixes[prefix_key]={'config_id':s['id'],'state':state,'trace':folder/'adam/attempts.jsonl'}
            if s['method'] in ('lbfgs','hybrid') and (not phases or phases[-1]['status']=='max_updates'):
                n=s['max_updates']-(s['adam_updates_before_switch'] or 0)
                ctx.update(completed_phases=list(phases),prior_trace=[{'path':rel(p),'through':t,'shared':v} for p,t,v in parts],switch=rel(switch) if switch else None)
                if resumed and resumed['phase']=='lbfgs':parts.append((Path(a.resume).parent/'attempts.jsonl',resumed['attempt'],rel(a.resume)))
                result=engine.optimize(oracle,'lbfgs',n,folder/'lbfgs',ctx,start_state=resumed if resumed and resumed['phase']=='lbfgs' else None)
                phases.append(result);parts.append((folder/'lbfgs/attempts.jsonl',None,None))
            finish(s,shared,folder,phases,oracle,None,initial,switch,parts)
        eligible=profile['selection']['eligible_terminal_states']
        candidates=[s for s in profile['base_configurations'] if s['problem']=='convection' and s['seed']==345 and s['method']=='hybrid' and s['id'] in observations and observations[s['id']]['status'] in eligible]
        parent=min(candidates,key=lambda s:(observations[s['id']]['metrics']['total_loss'],s['adam_learning_rate'])) if candidates else None
        if resuming and only_continuation:
            prior=resuming['context']['parent_selection']
            registered={s['id']:s for s in profile['base_configurations'] if s['problem']=='convection' and s['seed']==345 and s['method']=='hybrid'}
            if set(prior)!=set(registered):raise ValueError('resume parent-selection coverage')
            eligible_prior=[]
            for key,v in prior.items():
                checkpoint=PROJECT/v['final'];m=numerical(checkpoint,'convection')
                if m!=v['metrics']:raise ValueError('resume original parent object changed')
                observations[key]={'metrics':m,'status':v['status'],'final':checkpoint}
                if v['status'] in eligible:eligible_prior.append(registered[key])
            parent=min(eligible_prior,key=lambda s:(observations[s['id']]['metrics']['total_loss'],s['adam_learning_rate'])) if eligible_prior else None
        for index,s in enumerate(profile['continuations']):
            if a.only and a.only!=s['id']:continue
            if a.continue_study and s['id'] in observations:continue
            if parent is None:
                byid[s['id']].update(status='dependency_incomplete',reason='no eligible registered hybrid terminal parent');publish();continue
            folder=out/'runs'/s['id'];folder.mkdir(parents=True);initial=folder/'initial.npz';shutil.copy2(observations[parent['id']]['final'],initial)
            parameters=engine.load_parameters(initial,a.device);oracle=engine.Oracle('convection',parameters,engine.data_from_public(inputs,'convection',a.device))
            context={'spec':{**s,'problem':'convection'},'parent_id':parent['id'],'original_initial':rel(initial),'created_pid':os.getpid(),'parent_selection':{v['id']:{'final':rel(observations[v['id']]['final']),'metrics':observations[v['id']]['metrics'],'status':observations[v['id']]['status']} for v in profile['base_configurations'] if v['problem']=='convection' and v['seed']==345 and v['method']=='hybrid' and v['id'] in observations}}
            if resuming and {k:resuming['context']['spec'].get(k) for k in s}!=s:raise ValueError('resume continuation identity')
            if resuming and s['method']=='nncg' and resuming['accepted']%20:raise ValueError('owned NNCG checkpoints must align with a registered sketch refresh')
            result=engine.optimize(oracle,s['method'],s['updates'],folder/s['method'],context,learning_rate=s['value'] if s['method']=='gd' else None,parameter=s['value'] if s['method']=='nncg' else None,branch_index=index-2,start_state=resuming if only_continuation else None)
            parts=[(Path(a.resume).parent/'attempts.jsonl',resuming['attempt'],rel(a.resume))] if resuming else []
            parts.append((folder/s['method']/'attempts.jsonl',None,None))
            finish(s,None,folder,[result],oracle,parent['id'],initial,None,parts)
        finalize_manifest(profile,manifest,observations)
        publish()
        from finish_study import finish_study
        finish_study(PROJECT,inputs,out,profile,manifest,observations,parent,a.device,not a.only)
        terminal={'finished_at':engine.utc(),'native_pid':os.getpid(),'native_exit':0,'registered_records':len(manifest['runs']),'executed_records':len(observations),'only':a.only,'all_registered_terminal':all(r['status']!='incomplete' for r in manifest['runs']),'scope':'execution facts, not study_complete or solution_reproduced certification'}
        engine.write_json(out/f'study-terminal-{os.getpid()}.json',terminal);engine.write_json(out/'study-terminal.json',terminal)
    except Exception as e:
        publish();engine.write_json(out/'study-error.json',{'at':engine.utc(),'native_pid':os.getpid(),'type':type(e).__name__,'error':str(e),'traceback':traceback.format_exc(),'scope':'preserved incomplete execution, not a fabricated numerical failure'});raise
if __name__=='__main__':main()
