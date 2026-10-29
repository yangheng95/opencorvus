"""A single registered representative configuration, not a candidate rollout."""
import argparse
import datetime
exec(open('/work/qualify_pinn.py').read().split("emit('environment'")[0])
parser=argparse.ArgumentParser()
parser.add_argument('--problem',choices=('reaction','wave'),required=True)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
root=args.output
root.mkdir(parents=True,exist_ok=False)
events=[]
problem=args.problem
d=data(problem);model=net(345)
export(model,problem)
(root/f'{problem}-checkpoint.npz').rename(root/'init.npz')
adam=torch.optim.Adam(model.parameters(),lr=1e-3,betas=(.9,.999),eps=1e-8,weight_decay=0,amsgrad=False)
sync();begin=time.perf_counter()
emit('start',problem=problem,seed=345,adam_lr=1e-3,started_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),scope='representative feasibility qualification only')
adam_updates=0
for index in range(11000):
    before=torch.cat([p.detach().ravel() for p in model.parameters()]).clone()
    adam.zero_grad(set_to_none=True)
    for name in ('residual','initial'):d[name].grad=None
    value=loss(model,d,problem)
    assert torch.isfinite(value),float(value.detach())
    value.backward()
    assert all(torch.isfinite(p.grad).all() for p in model.parameters())
    adam.step()
    delta=float((torch.cat([p.detach().ravel() for p in model.parameters()])-before).abs().max())
    assert delta>0.,'Adam returned a zero update before the fixed switch'
    adam_updates+=1
    if (index+1)%1000==0:
        emit('adam_progress',attempt=index+1,accepted_updates=adam_updates,loss=float(value.detach()),seconds=time.perf_counter()-begin)
export(model,problem)
(root/f'{problem}-checkpoint.npz').rename(root/'switch-11000.npz')
lbfgs=torch.optim.LBFGS(model.parameters(),lr=1.,max_iter=1,max_eval=25,history_size=100,line_search_fn='strong_wolfe',tolerance_grad=1e-9,tolerance_change=1e-15)
calls=[0]
def closure():
    lbfgs.zero_grad(set_to_none=True)
    for name in ('residual','initial'):d[name].grad=None
    value=loss(model,d,problem)
    assert torch.isfinite(value),float(value.detach())
    value.backward();calls[0]+=1
    return value
plateau=0;accepted=0;status='max_updates'
for index in range(30000):
    before=torch.cat([p.detach().ravel() for p in model.parameters()]).clone()
    previous=float(loss(model,d,problem).detach())
    lbfgs.step(closure)
    value=loss(model,d,problem)
    grads=torch.autograd.grad(value,tuple(model.parameters()))
    assert all(torch.isfinite(g).all() for g in grads)
    ginf=max(float(g.abs().max()) for g in grads)
    delta=float((torch.cat([p.detach().ravel() for p in model.parameters()])-before).abs().max())
    current=float(value.detach())
    if delta>0.:accepted+=1
    plateau=plateau+1 if 0.<delta<=1e-12 and abs(previous-current)<=1e-14*max(1.,abs(previous)) else 0
    native=lbfgs.state[next(iter(model.parameters()))]
    if ginf<=1e-9:status='gradient_converged'
    elif delta==0.:status='optimizer_stalled'
    elif plateau>=25:status='finite_plateau'
    if (index+1)%100==0 or status!='max_updates':
        emit('lbfgs_progress',attempt=index+1,accepted_updates=accepted,native_iterations=native.get('n_iter'),loss=current,gradient_inf=ginf,step_inf=delta,plateau=plateau,closure_calls=calls[0],status=status,seconds=time.perf_counter()-begin)
    if accepted in (100,120):
        export(model,problem)
        (root/f'{problem}-checkpoint.npz').rename(root/f'accepted-{accepted}.npz')
        if accepted==100:
            torch.save({'model':model.state_dict(),'optimizer':lbfgs.state_dict(),'cpu_rng':torch.get_rng_state(),'cuda_rng':torch.cuda.get_rng_state_all(),'accepted_updates':accepted,'attempts':index+1},root/'state-100.pt')
    if status!='max_updates':break
export(model,problem)
emit('complete',problem=problem,status=status,adam_updates=adam_updates,lbfgs_attempts=index+1,lbfgs_accepted_updates=accepted,native_iterations=native.get('n_iter'),closure_calls=calls[0],loss=float(loss(model,d,problem).detach()),seconds=time.perf_counter()-begin,completed_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
