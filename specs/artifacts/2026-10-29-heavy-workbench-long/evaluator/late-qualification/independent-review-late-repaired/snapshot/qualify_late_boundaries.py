"""Positive local failure contracts; not end-to-end candidate evidence."""
import importlib.util
import json
import sys
from pathlib import Path
import numpy as np
import torch

sys.path.insert(0,'/work/evaluator-tools')
spec=importlib.util.spec_from_file_location('qualifier','/work/qualify_late_newton.py')
q=importlib.util.module_from_spec(spec);spec.loader.exec_module(q)
q.device='cpu';q.sync=lambda:None
torch.set_num_threads(1)
out=Path('/work/late-boundary-repair');out.mkdir(exist_ok=False)
rows=[]
x,receipt=q.pcg(lambda v:torch.tensor([-1.,2.])*v,torch.tensor([1.,0.]),lambda v:v)
assert receipt['status']=='pcg_nonpositive_curvature'
assert receipt['explicit_relative_residual']==1.
rows.append({'contract':'negative_curvature','status':receipt['status'],'explicit_relative_residual':receipt['explicit_relative_residual']})
x,receipt=q.pcg(lambda v:torch.full_like(v,float('nan')),torch.ones(2),lambda v:v)
assert receipt['status']=='pcg_nonfinite'
rows.append({'contract':'nonfinite_curvature','status':receipt['status']})
shapes=((100,2),(100,100),(100,100),(1,100))
layers=[(np.ones(shape),np.ones(shape[0])) for shape in shapes]
layers[-1]=(layers[-1][0],np.array([np.nextafter(-100.,float('inf'))]))
arrays=q.numeric.canonical_data('convection')
data={key:torch.tensor(value,requires_grad=key in ('residual','initial')) for key,value in arrays.items()}
zero=out/'zero-update';zero.mkdir()
receipt=q.run_branch(layers,data,'gd',1e-4,0,2,zero)
assert receipt['status']=='optimizer_stalled'
assert receipt['accepted_updates']==0
assert receipt['attempts']==1
final=q.numeric.load_network(zero/'final.npz')
for original,actual in zip(layers,final):
    for expected,value in zip(original,actual):np.testing.assert_array_equal(value,expected)
rows.append({'contract':'real_neural_zero_update','status':receipt['status'],'accepted_updates':receipt['accepted_updates'],'attempts':receipt['attempts']})
# Inject only an actual numerical decomposition error to exercise the local error envelope.
# This is deliberately labeled injection; the real-PINN NNCG path is tested separately.
def decomposition_error(*args,**kwargs):
    torch.linalg.cholesky(torch.zeros((2,2)))
q.nystrom=decomposition_error
failed=out/'factorization';failed.mkdir()
receipt=q.run_branch(layers,data,'nncg',.1,0,2,failed)
assert receipt['status']=='factorization_failure'
assert receipt['accepted_updates']==0
rows.append({'contract':'factorization_error_envelope','status':receipt['status'],'accepted_updates':0,
             'evidence_scope':'local error injection using real Cholesky failure; not an end-to-end pass'})
(out/'contracts.json').write_text(json.dumps({'status':'passed','scope':'local contracts only','rows':rows},indent=2,allow_nan=False))
print(json.dumps(rows,allow_nan=False))
