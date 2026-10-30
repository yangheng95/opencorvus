"""Author study engine. Physics functions are bundled from the single checked source.

This file is candidate reference software, never an evaluator for candidate code.
"""
from pathlib import Path
import datetime,json,math,os,time
import numpy as np
import torch
from pinn_torch_check import objective,parameter_gradient,hessian_operator,flatten,lanczos

def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def finite_json(x):
    if isinstance(x,dict):return {k:finite_json(v) for k,v in x.items()}
    if isinstance(x,(list,tuple)):return [finite_json(v) for v in x]
    if isinstance(x,float) and not math.isfinite(x):return None
    return x
def write_json(path,value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    temporary=path.with_name(path.name+'.tmp');temporary.write_text(json.dumps(finite_json(value),ensure_ascii=False,indent=2)+'\n',encoding='utf-8');temporary.replace(path)
def export(parameters,path):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    with path.with_suffix('.npz.tmp').open('wb') as f:np.savez(f,**{f'{name}_{i}':parameters[2*i+j].detach().cpu().numpy() for i in range(4) for j,name in enumerate(('weight','bias'))})
    path.with_suffix('.npz.tmp').replace(path)
def copy_flat(parameters,value):
    offset=0
    with torch.no_grad():
        for p in parameters:p.copy_(value[offset:offset+p.numel()].reshape(p.shape));offset+=p.numel()
def initial_parameters(seed,device):
    torch.set_default_dtype(torch.float64);torch.manual_seed(seed)
    net=torch.nn.Sequential(torch.nn.Linear(2,100),torch.nn.Tanh(),torch.nn.Linear(100,100),torch.nn.Tanh(),torch.nn.Linear(100,100),torch.nn.Tanh(),torch.nn.Linear(100,1)).to(device)
    for layer in net:
        if isinstance(layer,torch.nn.Linear):torch.nn.init.xavier_normal_(layer.weight,gain=1);torch.nn.init.zeros_(layer.bias)
    return tuple(net.parameters())
def load_parameters(path,device):
    from pinn_numeric_check import load_network
    return tuple(torch.tensor(a,dtype=torch.float64,device=device,requires_grad=True) for pair in load_network(path) for a in pair)
def data_from_public(path,problem,device):
    with np.load(Path(path)/'data'/f'{problem}.npz',allow_pickle=False) as z:
        return {k:torch.tensor(z[k],dtype=torch.float64,device=device,requires_grad=k in ('residual','initial')) for k in ('residual','initial','boundary_left','boundary_right')}
def sync(device):
    if str(device).startswith('cuda'):torch.cuda.synchronize()

class NumericalFailure(ArithmeticError):pass

class Oracle:
    def __init__(self,problem,parameters,data,counters=None):
        self.problem,self.parameters,self.data=problem,parameters,data
        self.costs=dict(counters or dict(closure_calls=0,gradient_calls=0,hvp_calls=0,lbfgs_native_iterations=0,loss_calls=0))
    def value(self,component='total'):
        self.costs['loss_calls']+=1
        return objective(self.problem,self.parameters,self.data,component)
    def grad(self,graph=False,component='total'):
        self.costs['loss_calls']+=1;self.costs['gradient_calls']+=1
        return parameter_gradient(self.problem,self.parameters,self.data,component,graph)
    def hessian(self,gradient):
        operator=hessian_operator(gradient,self.parameters)
        def apply(vector):self.costs['hvp_calls']+=1;return operator(vector)
        return apply

def nystrom(operator,n,mu,seed,device):
    generator=torch.Generator(device=device).manual_seed(seed)
    q=torch.linalg.qr(torch.randn(n,min(n,20),dtype=torch.float64,device=device,generator=generator),mode='reduced').Q
    y=torch.stack([operator(v) for v in q.T],dim=1)
    projected=(q.T@y+y.T@q)/2
    nu=math.sqrt(n)*torch.finfo(y.dtype).eps*torch.linalg.matrix_norm(y,ord=2)
    delta=torch.clamp(-torch.linalg.eigvalsh(projected)[0],min=0)+nu
    ys=y+delta*q;core=(q.T@ys+ys.T@q)/2
    lower=torch.linalg.cholesky(core)
    factor=torch.linalg.solve_triangular(lower,ys.T,upper=False).T
    u,s,_=torch.linalg.svd(factor,full_matrices=False);lam=torch.clamp(s.square()-delta,min=0)
    def inverse(v):
        t=u.T@v;return v-u@t+u@(((lam[-1]+mu)/(lam+mu))*t)
    return inverse,{'seed':seed,'rank':q.shape[1],'delta':float(delta),'nu':float(nu),'lambda':lam.detach().cpu().tolist()}

def pcg(operator,b,inverse,max_steps=200,tolerance=1e-8):
    x=torch.zeros_like(b);scale=max(float(torch.linalg.vector_norm(b)),1e-30)
    r=b-operator(x);z=inverse(r);p=z.clone();rz=r@z;rows=[]
    first=float(torch.linalg.vector_norm(r))/scale
    if first<=tolerance:return x,{'status':'converged','iterations':0,'explicit_relative_residual':first,'history':rows}
    for i in range(max_steps):
        image=operator(p);curvature=float(p@image)
        if not math.isfinite(curvature) or curvature<=0:
            return x,{'status':'pcg_nonfinite' if not math.isfinite(curvature) else 'pcg_nonpositive_curvature','iterations':i,'curvature':curvature,'explicit_relative_residual':float(torch.linalg.vector_norm(b-operator(x)))/scale,'history':rows}
        alpha=rz/curvature;x=x+alpha*p;r=r-alpha*image
        explicit=float(torch.linalg.vector_norm(b-operator(x)))/scale
        rows.append({'iteration':i+1,'curvature':curvature,'recursive_relative_residual':float(torch.linalg.vector_norm(r))/scale,'explicit_relative_residual':explicit})
        if not math.isfinite(explicit):return x,{'status':'pcg_nonfinite','iterations':i+1,'history':rows}
        if explicit<=tolerance:return x,{'status':'converged','iterations':i+1,'explicit_relative_residual':explicit,'history':rows}
        z=inverse(r);next_rz=r@z;p=z+(next_rz/rz)*p;rz=next_rz
    return x,{'status':'pcg_iteration_limit','iterations':max_steps,'explicit_relative_residual':rows[-1]['explicit_relative_residual'],'history':rows}

def state_dict(parameters,optimizer,phase,attempt,accepted,plateau,costs,context):
    return {'parameters':[p.detach().cpu().clone() for p in parameters],'optimizer':optimizer.state_dict() if optimizer is not None else None,'phase':phase,'attempt':attempt,'accepted':accepted,'plateau':plateau,'costs':dict(costs),'cpu_rng':torch.get_rng_state(),'cuda_rng':torch.cuda.get_rng_state_all() if torch.cuda.is_available() else None,'context':context,'saved_at':utc()}
def save_state(path,value):
    temporary=Path(path).with_suffix('.pt.tmp');torch.save(value,temporary);temporary.replace(path)
def restore(state,parameters,optimizer):
    with torch.no_grad():
        for p,v in zip(parameters,state['parameters']):p.copy_(v.to(p.device))
    if optimizer is not None:optimizer.load_state_dict(state['optimizer'])
    torch.set_rng_state(state['cpu_rng'])
    if state.get('cuda_rng') is not None:torch.cuda.set_rng_state_all(state['cuda_rng'])

def optimize(oracle,method,limit,out,context,learning_rate=None,start_state=None,parameter=None,branch_index=0):
    """One actual registered phase. Each line is one attempt, never a closure count."""
    out=Path(out);out.mkdir(parents=True,exist_ok=True);parameters=oracle.parameters;device=parameters[0].device
    optimizer=torch.optim.Adam(parameters,lr=learning_rate,betas=(.9,.999),eps=1e-8,weight_decay=0,amsgrad=False) if method=='adam' else torch.optim.LBFGS(parameters,lr=1,max_iter=1,max_eval=25,history_size=100,line_search_fn='strong_wolfe',tolerance_grad=1e-9,tolerance_change=1e-15) if method=='lbfgs' else None
    attempt=accepted=plateau=0
    if start_state is not None:
        restore(start_state,parameters,optimizer);attempt=start_state['attempt'];accepted=start_state['accepted'];plateau=start_state['plateau'];oracle.costs=dict(start_state['costs'])
    status='max_updates';reason='registered update limit';failure=None;inverse=None;sketch=None
    started=utc();begin=time.perf_counter();trace=(out/'attempts.jsonl').open('a',encoding='utf-8')
    try:
        while accepted<limit:
            attempt+=1;before=flatten(parameters).detach().clone();old_cost=dict(oracle.costs)
            loss,g=oracle.grad(graph=method=='nncg');previous=float(loss.detach());ginf=float(g.detach().abs().max())
            row={'phase':method,'attempt':attempt,'accepted_before':accepted,'loss_before':previous,'gradient_inf_before':ginf,'at':utc()}
            if not math.isfinite(previous) or not torch.isfinite(g).all():
                status='numerical_failure';failure='nonfinite_loss_or_gradient';reason=failure
            elif (method=='lbfgs' and ginf<=1e-9) or (method in ('gd','nncg') and float(torch.linalg.vector_norm(g.detach()))==0):
                # No update was attempted; preserve attempts=accepted for a true zero-gradient stop.
                attempt-=1;status='gradient_converged';reason='gradient_inf <= 1e-9' if method=='lbfgs' else 'zero_gradient'
                row.update(terminal_check=True,attempt=attempt,accepted_after=accepted,gradient_inf_after=ginf,loss_after=previous,step_inf=0)
                trace.write(json.dumps(finite_json(row))+'\n');trace.flush();break
            else:
                if method=='adam':
                    optimizer.zero_grad(set_to_none=True);offset=0
                    for p in parameters:p.grad=g[offset:offset+p.numel()].detach().reshape(p.shape).clone();offset+=p.numel()
                    optimizer.step()
                elif method=='lbfgs':
                    trials=[]
                    def closure():
                        optimizer.zero_grad(set_to_none=True);oracle.costs['closure_calls']+=1
                        v,gradient=oracle.grad();offset=0
                        if not torch.isfinite(v) or not torch.isfinite(gradient).all():raise NumericalFailure('nonfinite_lbfgs_closure')
                        for p in parameters:p.grad=gradient[offset:offset+p.numel()].detach().reshape(p.shape).clone();offset+=p.numel()
                        trials.append((float(v.detach()),gradient.detach(),flatten(parameters).detach()-before))
                        return v
                    native_before=optimizer.state.get(parameters[0],{}).get('n_iter',0)
                    try:optimizer.step(closure)
                    except NumericalFailure as e:copy_flat(parameters,before);status='numerical_failure';failure=str(e);reason=failure
                    native=optimizer.state[parameters[0]]
                    oracle.costs['lbfgs_native_iterations']+=native.get('n_iter',0)-native_before
                    direction=native.get('d');k=int(direction.abs().argmax()) if direction is not None and direction.numel() and float(direction.abs().max())>0 else None
                    trial_rows=[]
                    for j,(v,gradient,delta) in enumerate(trials):
                        alpha=float(delta[k]/direction[k]) if k is not None else None
                        trial_rows.append({'trial':j,'loss':v,'alpha':alpha,'delta_inf':float(delta.abs().max()),'gradient_dot_direction':float(gradient@direction) if direction is not None else None,'direction_consistency_inf':float((delta-alpha*direction).abs().max()) if alpha is not None else None})
                    row.update(native_iterations=native.get('n_iter'),native_t=float(native.get('t',0)),native_directional_derivative=float(native.get('prev_flat_grad',g)@direction) if direction is not None else None,closures=trial_rows)
                elif method=='gd':copy_flat(parameters,before-float(learning_rate)*g.detach());row['step_size']=learning_rate
                elif method=='nncg':
                    operator=oracle.hessian(g);mu=float(parameter)
                    if accepted%20==0:
                        try:inverse,sketch=nystrom(operator,g.numel(),mu,20261029+branch_index*1000+accepted//20,str(device));row['sketch_refresh']=sketch
                        except torch.linalg.LinAlgError as e:status='algorithm_failure';failure='factorization_failure';reason=str(e)
                    if status!='algorithm_failure':
                        direction,solve=pcg(lambda v:operator(v)+mu*v,-g.detach(),inverse);row['pcg']=solve
                        if solve['status']!='converged':status='algorithm_failure';failure=solve['status'];reason=failure
                        else:
                            directional=float(g.detach()@direction);row['gtd']=directional
                            if not math.isfinite(directional) or directional>=0:status='algorithm_failure';failure='non_descent_direction';reason=failure
                            else:
                                row['armijo_trials']=[];found=False
                                for shrink in range(31):
                                    alpha=.5**shrink;copy_flat(parameters,before+alpha*direction);v=float(oracle.value().detach());bound=previous+.1*alpha*directional
                                    row['armijo_trials'].append({'alpha':alpha,'loss':v,'bound':bound})
                                    if math.isfinite(v) and v<=bound:row['step_size']=alpha;found=True;break
                                    if not math.isfinite(v):status='numerical_failure';failure='nonfinite_armijo_loss';reason=failure;break
                                if not found and status!='numerical_failure':status='algorithm_failure';failure='armijo_failure';reason=failure
                else:raise ValueError('unknown registered method')
                if status in ('algorithm_failure','numerical_failure'):copy_flat(parameters,before)
            current=float(oracle.value().detach());step=float((flatten(parameters).detach()-before).abs().max())
            if not math.isfinite(current) or not torch.isfinite(flatten(parameters)).all():
                copy_flat(parameters,before);current=previous;status='numerical_failure';failure='nonfinite_update';reason=failure;step=0
            if status not in ('algorithm_failure','numerical_failure'):
                if step==0:status='optimizer_stalled';reason='finite_zero_parameter_change'
                else:
                    accepted+=1
                    plateau=plateau+1 if step<=1e-12 and abs(previous-current)<=1e-14*max(1,abs(previous)) else 0
                    if method=='lbfgs':
                        _,post_g=oracle.grad();row['gradient_inf_after']=float(post_g.abs().max())
                        if row['gradient_inf_after']<=1e-9:status='gradient_converged';reason='gradient_inf <= 1e-9'
                        elif plateau>=25:status='finite_plateau';reason='25 consecutive accepted tiny parameter/loss changes'
            row.update(accepted_after=accepted,loss_after=current,step_inf=step,plateau=plateau,status=status,costs_total=dict(oracle.costs),costs_increment={k:oracle.costs[k]-old_cost[k] for k in oracle.costs},elapsed_seconds=time.perf_counter()-begin)
            trace.write(json.dumps(finite_json(row))+'\n')
            if accepted in ({500,600,11000} if method=='adam' else {100,120}) or accepted%1000==0 or status!='max_updates':
                trace.flush();export(parameters,out/f'accepted-{accepted}.npz')
                state_path=out/f'state-{accepted}.pt'
                if state_path.exists():state_path=out/'terminal-state.pt'
                save_state(state_path,state_dict(parameters,optimizer,method,attempt,accepted,plateau,oracle.costs,context))
                write_json(out/'progress.json',row)
            if status!='max_updates':break
    finally:trace.close()
    sync(device);export(parameters,out/'final.npz')
    result={'method':method,'status':status,'reason':reason,'failure_code':failure,'attempts':attempt,'accepted_updates':accepted,'costs':dict(oracle.costs),'started_at':started,'finished_at':utc(),'native_pid':os.getpid(),'seconds':time.perf_counter()-begin,'resume_from_saved_at':start_state.get('saved_at') if start_state else None}
    write_json(out/'execution.json',result)
    return result
