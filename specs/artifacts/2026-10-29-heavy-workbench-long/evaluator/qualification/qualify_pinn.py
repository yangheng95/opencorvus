"""Evaluator-only qualification, not a candidate solution or timed case run."""
import json
import math
import time
from pathlib import Path

import numpy as np
import torch
from torch import nn

torch.set_default_dtype(torch.float64)
torch.set_num_threads(4)
device = 'cuda'
root = Path('/work/qualification')
root.mkdir(exist_ok=True)
events = []

def emit(event, **values):
    row = {'event': event, **values}
    print(json.dumps(row), flush=True)
    events.append(row)
    (root / 'events.json').write_text(json.dumps(events, indent=2))

def sync():
    torch.cuda.synchronize()

def targets(problem, x):
    a, t = x[:, :1], x[:, 1:]
    if problem == 'convection':
        return torch.sin(a - 40*t)
    if problem == 'reaction':
        h = torch.exp(-(a-math.pi)**2/(2*(math.pi/4)**2))
        return h*torch.exp(5*t)/(1 + h*(torch.exp(5*t)-1))
    return torch.sin(math.pi*a)*torch.cos(2*math.pi*t) + .5*torch.sin(5*math.pi*a)*torch.cos(10*math.pi*t)

def gradient(y, x):
    return torch.autograd.grad(y.sum(), x, create_graph=True)[0]

def jets(model, x):
    u = model(x)
    d = gradient(u, x)
    xx = gradient(d[:, :1], x)[:, :1]
    tt = gradient(d[:, 1:], x)[:, 1:]
    return u, d[:, :1], d[:, 1:], xx, tt

def data(problem):
    extent = 1. if problem == 'wave' else 2*math.pi
    rng = np.random.default_rng(20261029)
    grid = np.stack(np.meshgrid(np.linspace(0, extent, 257)[1:-1], np.arange(1,101)/101, indexing='ij'), -1).reshape(-1, 2)
    r = grid[rng.choice(len(grid), 10000, replace=False)]
    i = np.stack([np.linspace(0, extent, 257), np.zeros(257)], -1)
    l = np.stack([np.zeros(101), np.linspace(0,1,101)], -1)
    b = np.stack([np.full(101, extent), np.linspace(0,1,101)], -1)
    e = np.stack(np.meshgrid(np.linspace(0,extent,129),np.linspace(0,1,65),indexing='ij'), -1).reshape(-1,2)
    values = dict(residual=r, initial=i, boundary_left=l, boundary_right=b, evaluation=e)
    np.savez(root/f'{problem}-data.npz', **values)
    return {k:torch.tensor(v, device=device, requires_grad=(k in ('residual','initial'))) for k,v in values.items()}

def loss(model, d, problem):
    x = d['residual']
    u = model(x)
    du = gradient(u, x)
    if problem == 'wave':
        r = gradient(du[:,1:], x)[:,1:] - 4*gradient(du[:,:1],x)[:,:1]
    elif problem == 'convection':
        r = du[:,1:] + 40*du[:,:1]
    else:
        r = du[:,1:] - 5*u*(1-u)
    ic = model(d['initial']) - targets(problem,d['initial'])
    if problem == 'wave':
        c = torch.cat([ic,gradient(model(d['initial']),d['initial'])[:,1:],model(d['boundary_left']),model(d['boundary_right'])])
    else:
        c = torch.cat([ic,model(d['boundary_left'])-model(d['boundary_right'])])
    return .5*(r.square().mean()+c.square().mean())

def net(seed):
    torch.manual_seed(seed)
    model = nn.Sequential(nn.Linear(2,100),nn.Tanh(),nn.Linear(100,100),nn.Tanh(),nn.Linear(100,100),nn.Tanh(),nn.Linear(100,1)).to(device)
    for layer in model:
        if isinstance(layer,nn.Linear):
            nn.init.xavier_normal_(layer.weight)
            nn.init.zeros_(layer.bias)
    return model

def export(model, problem):
    source = [m for m in model if isinstance(m,nn.Linear)]
    np.savez(root/f'{problem}-checkpoint.npz', **{f'{name}_{i}':getattr(m,name).detach().cpu().numpy() for i,m in enumerate(source) for name in ('weight','bias')})

def nystrom(operator, n, rank, mu):
    q = torch.linalg.qr(torch.randn(n,rank,device=device), mode='reduced').Q
    y = torch.stack([operator(v) for v in q.T],1)
    shift = math.sqrt(n)*torch.finfo(y.dtype).eps*torch.linalg.norm(y)
    yn = y+shift*q
    core = (q.T@yn + yn.T@q)/2
    chol = torch.linalg.cholesky(core)
    b = torch.linalg.solve_triangular(chol,yn.T,upper=False).T
    u,s,_ = torch.linalg.svd(b,full_matrices=False)
    lam = torch.clamp(s*s-shift,min=0)
    def pinv(v):
        projection = u.T@v
        return v-u@projection + u@(((lam[-1]+mu)/(lam+mu))*projection)
    return pinv

def pcg(operator,b,pinv,tolerance=1e-9,maxiter=1000):
    x = torch.zeros_like(b)
    r = b-operator(x)
    z = pinv(r)
    p = z.clone()
    rz = r@z
    history=[float(torch.linalg.norm(r))]
    for count in range(maxiter):
        if history[-1] <= tolerance:
            break
        ap = operator(p)
        denominator = p@ap
        if denominator <= 0:
            raise ValueError(f'PCG curvature {float(denominator)}')
        alpha = rz/denominator
        x = x+alpha*p
        r = r-alpha*ap
        history.append(float(torch.linalg.norm(r)))
        z = pinv(r)
        newrz = r@z
        p = z+(newrz/rz)*p
        rz = newrz
    explicit = float(torch.linalg.norm(b-operator(x)))
    return x, {'iterations':len(history)-1,'recursive_residual':history[-1], 'explicit_residual':explicit, 'history':history}

emit('environment',torch=torch.__version__,cuda=torch.version.cuda,gpu=torch.cuda.get_device_name(),purpose='qualification only; not candidate execution')
diagonal = torch.logspace(0,4,128,device=device)
b = torch.linspace(-1,1,128,device=device)
mu = .1
pinv = nystrom(lambda x:diagonal*x,128,16,mu)
solution,receipt = pcg(lambda x:(diagonal+mu)*x,b,pinv,maxiter=1000)
assert receipt['explicit_residual'] < 1e-8
assert torch.max(torch.abs(solution-b/(diagonal+mu))) < 1e-9
emit('known_spd_pcg',**receipt)

for problem in ('convection','reaction','wave'):
    d = data(problem)
    model = net(345)
    adam = torch.optim.Adam(model.parameters(), lr=1e-3)
    for _ in range(8):
        adam.zero_grad(set_to_none=True); value=loss(model,d,problem); value.backward(); adam.step()
    sync(); start=time.perf_counter()
    for _ in range(256):
        adam.zero_grad(set_to_none=True); value=loss(model,d,problem); value.backward(); adam.step()
    sync(); elapsed=time.perf_counter()-start
    emit('adam_steady',problem=problem,updates=256,seconds=elapsed,seconds_per_update=elapsed/256,loss=float(value.detach()))
    lbfgs = torch.optim.LBFGS(model.parameters(),lr=1.,max_iter=1,history_size=100,line_search_fn='strong_wolfe',tolerance_grad=1e-12,tolerance_change=1e-15)
    calls = [0]
    def closure():
        lbfgs.zero_grad(set_to_none=True)
        value=loss(model,d,problem); value.backward(); calls[0]+=1
        return value
    sync(); start=time.perf_counter()
    for _ in range(16):
        lbfgs.step(closure)
    sync(); elapsed=time.perf_counter()-start
    emit('lbfgs_steady',problem=problem,steps=16,closure_calls=calls[0],seconds=elapsed,loss=float(loss(model,d,problem).detach()))
    test = d['evaluation'][:257].detach().clone().requires_grad_(True)
    results = jets(model,test)
    np.savez(root/f'{problem}-torch-jets.npz',points=test.detach().cpu().numpy(),**{key:v.detach().cpu().numpy().ravel() for key,v in zip(('u','ux','ut','uxx','utt'),results)})
    with torch.enable_grad():
        value = loss(model,d,problem)
        gs = torch.autograd.grad(value,tuple(model.parameters()), create_graph=True)
        flat = torch.cat([g.ravel() for g in gs])
        direction=torch.randn_like(flat); direction/=torch.linalg.norm(direction)
        sync(); start=time.perf_counter()
        hvp=None
        for _ in range(8):
            hvp=torch.cat([v.ravel() for v in torch.autograd.grad(flat@direction,tuple(model.parameters()),retain_graph=True)])
        sync(); elapsed=time.perf_counter()-start
        assert torch.isfinite(hvp).all()
        emit('hvp_steady',problem=problem,seconds_per_hvp=elapsed/8,parameters=flat.numel(),norm=float(torch.linalg.norm(hvp)))
        if problem == 'convection':
            params=tuple(model.parameters())
            def op(v):
                return torch.cat([w.ravel() for w in torch.autograd.grad(flat@v,params,retain_graph=True)]).detach()
            # This large damping qualifies the actual Hessian path, not the paper's small-mu success claim.
            actualmu=1e4
            sync();start=time.perf_counter()
            pinv=nystrom(lambda v:op(v)+actualmu*v,flat.numel(),8,1.)
            _,receipt=pcg(lambda v:op(v)+actualmu*v,-flat.detach(),pinv,tolerance=1e-8,maxiter=100)
            sync()
            assert receipt['explicit_residual'] < 1e-7
            emit('actual_pinn_hvp_pcg',damping=actualmu,sketch_rank=8,seconds=time.perf_counter()-start,**receipt)
    export(model,problem)
    value = loss(model,d,problem)
    with torch.no_grad():
        l2re = torch.linalg.norm(model(d['evaluation'])-targets(problem,d['evaluation']))/torch.linalg.norm(targets(problem,d['evaluation']))
    emit('torch_final_metrics',problem=problem,total_loss=float(value.detach()),l2re=float(l2re))
emit('complete')
