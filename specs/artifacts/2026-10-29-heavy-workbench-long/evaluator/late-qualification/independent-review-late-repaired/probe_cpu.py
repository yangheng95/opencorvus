import importlib.util
import json
from pathlib import Path
import sys
import numpy as np
import torch

ROOT=Path('/review')
sys.path.insert(0,str(ROOT/'snapshot/evaluator-tools'))
spec=importlib.util.spec_from_file_location('repaired_qualification',ROOT/'snapshot/qualify_late_newton.py')
q=importlib.util.module_from_spec(spec);spec.loader.exec_module(q)
q.device='cpu';q.sync=lambda:None;torch.set_num_threads(1)
rows=[]
known=q.known_spd()
rows.append({'contract':'known_spd','status':known['status'],'solution_relative_error':known['solution_relative_error']})
x,a=q.pcg(lambda v:torch.tensor([-1.,2.])*v,torch.tensor([1.,0.]),lambda v:v)
assert a['status']=='pcg_nonpositive_curvature' and a['explicit_relative_residual']==1.
rows.append({'contract':'negative_curvature','status':a['status'],'explicit_relative_residual':a['explicit_relative_residual'],'recursive_relative_residual':a['recursive_relative_residual']})
x,a=q.pcg(lambda v:torch.full_like(v,float('nan')),torch.ones(2),lambda v:v)
assert a['status']=='pcg_nonfinite'
rows.append({'contract':'nonfinite_curvature','status':a['status'],'explicit_residual_present':'explicit_relative_residual' in a})
shapes=((100,2),(100,100),(100,100),(1,100))
layers=[(np.ones(s),np.ones(s[0])) for s in shapes]
layers[-1]=(layers[-1][0],np.array([np.nextafter(-100.,float('inf'))]))
arrays=q.numeric.canonical_data('convection')
data={k:torch.tensor(v,requires_grad=k in ('residual','initial')) for k,v in arrays.items()}
out=ROOT/'real-neural-zero-step';out.mkdir()
a=q.run_branch(layers,data,'gd',1e-4,0,2,out)
final=q.numeric.load_network(out/'final.npz')
delta=max(float(np.max(np.abs(p-v))) for before,after in zip(layers,final) for p,v in zip(before,after))
assert a['status']=='optimizer_stalled' and a['accepted_updates']==0 and a['attempts']==1 and delta==0
rows.append({'contract':'real_neural_zero_step','status':a['status'],'accepted_updates':a['accepted_updates'],'attempts':a['attempts'],'actual_parameter_change_inf':delta,'scope':'real neural objective; no mocked objective'})
original=q.nystrom
def injected_decomposition_error(*args,**kwargs):
    return torch.linalg.cholesky(torch.zeros((2,2)))
q.nystrom=injected_decomposition_error
out=ROOT/'local-factorization-envelope';out.mkdir()
try:a=q.run_branch(layers,data,'nncg',.1,0,2,out)
finally:q.nystrom=original
assert a['status']=='factorization_failure' and a['accepted_updates']==0
rows.append({'contract':'factorization_failure_envelope','status':a['status'],'accepted_updates':a['accepted_updates'],'scope':'explicit local injection of actual Cholesky error; not full PINN path'})
out=ROOT/'after-local-failure';out.mkdir()
a=q.run_branch(layers,data,'gd',1e-4,0,2,out)
assert a['status']=='optimizer_stalled'
rows.append({'contract':'subsequent_branch_can_run','status':a['status'],'scope':'local branch-call continuation after named factorization failure'})
result={'device':'cpu','torch':torch.__version__,'numpy':np.__version__,'candidate_execution':False,'rows':rows}
(ROOT/'cpu-contracts.json').write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
print(json.dumps(result,indent=2,allow_nan=False))
