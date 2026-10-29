"""Private evaluator feasibility witness; not a candidate run."""
exec(open('/work/qualify_pinn.py').read().split("emit('environment'")[0])
root = Path('/work/convergence-qualification')
root.mkdir(exist_ok=True)
events=[]
problem='convection'
d=data(problem);model=net(345)
adam=torch.optim.Adam(model.parameters(),lr=1e-4)
sync();begin=time.perf_counter()
for index in range(11000):
    adam.zero_grad(set_to_none=True)
    value=loss(model,d,problem);value.backward();adam.step()
    if (index+1)%1000==0:
        emit('adam_progress',step=index+1,loss=float(value.detach()),seconds=time.perf_counter()-begin)
lbfgs=torch.optim.LBFGS(model.parameters(),lr=1.,max_iter=1,max_eval=25,history_size=100,line_search_fn='strong_wolfe',tolerance_grad=1e-9,tolerance_change=1e-15)
calls=[0]
def closure():
    lbfgs.zero_grad(set_to_none=True)
    value=loss(model,d,problem);value.backward();calls[0]+=1
    return value
plateau=0
for index in range(30000):
    before=torch.cat([p.detach().ravel() for p in model.parameters()]).clone()
    previous=float(loss(model,d,problem).detach())
    lbfgs.step(closure)
    value=loss(model,d,problem)
    grads=torch.autograd.grad(value,tuple(model.parameters()))
    ginf=max(float(g.abs().max()) for g in grads)
    delta=float(torch.max(torch.abs(torch.cat([p.detach().ravel() for p in model.parameters()])-before)))
    current=float(value.detach())
    plateau = plateau+1 if delta<=1e-12 and abs(previous-current)<=1e-14*max(1.,abs(previous)) else 0
    if (index+1)%100==0:
        emit('lbfgs_progress',step=index+1,loss=current,gradient_inf=ginf,step_inf=delta,plateau=plateau,closure_calls=calls[0],seconds=time.perf_counter()-begin)
    if ginf<=1e-9 or plateau>=25:
        emit('lbfgs_stop',step=index+1,loss=current,gradient_inf=ginf,step_inf=delta,plateau=plateau,closure_calls=calls[0],seconds=time.perf_counter()-begin)
        break
export(model,problem)
emit('complete',loss=float(loss(model,d,problem).detach()),seconds=time.perf_counter()-begin)
