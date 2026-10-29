@'
import sys,unittest,json
sys.path.insert(0,'/review')
import torch
import pinn_torch_check as c
suite=unittest.defaultTestLoader.loadTestsFromName('test_pinn_torch_check')
r=unittest.TextTestRunner().run(suite)
x=torch.tensor([1e-8],dtype=torch.float64,requires_grad=True)
o=torch.optim.LBFGS([x],lr=1,max_iter=1,max_eval=25,history_size=100,line_search_fn='strong_wolfe',tolerance_grad=1e-9,tolerance_change=1e-15)
calls=0
def closure():
 global calls
 calls+=1;o.zero_grad();loss=.5*x.square().sum();loss.backward();return loss
old=x.detach().clone();o.step(closure)
print(json.dumps({'probe':'native_lbfgs_finite_zero_step','parameter':x.item(),'change':(x.detach()-old).abs().max().item(),'gradient_inf':x.grad.abs().max().item(),'calls':calls,'native_n_iter':o.state[x].get('n_iter')}))
torch.manual_seed(347)
p=tuple(v.requires_grad_(True) for shape in [(2,2),(2,),(2,2),(2,),(2,2),(2,),(1,2),(1,)] for v in [torch.randn(shape,dtype=torch.float64)*.2])
data={k:torch.tensor(v,dtype=torch.float64,requires_grad=k in ('residual','initial')) for k,v in {'residual':[[.2,.3],[.8,.7]],'initial':[[.3,0.],[.9,0.]],'boundary_left':[[0.,.3],[0.,.7]],'boundary_right':[[6.283185307,.3],[6.283185307,.7]]}.items()}
try:
 value,g=c.parameter_gradient('convection',p,data,component='residual',graph=True)
 print(json.dumps({'probe':'residual_component_gradient','gradient':g.tolist()}))
except Exception as e:
 print(json.dumps({'probe':'residual_component_gradient','error_type':type(e).__name__,'error':str(e)}))
'@ | docker run --rm -i --network none --cpus 1 -e PYTHONDONTWRITEBYTECODE=1 --mount 'type=bind,source=D:\myhexin-local\opencorvus\script\benchmark,target=/review,readonly' pytorch/pytorch@sha256:c16f4c749e2d9e96878875cdf6cc45cddda1d1a36fddd371dd6f2360f1b6e2a2 python -B -
