"""Independent CPU automatic differentiation; imports no candidate/Torch checker."""
import json
from pathlib import Path
import sys
import numpy as np
import torch
root=Path('/review')
sys.path.insert(0,str(root/'source-snapshot'))
import pinn_numeric_check as numeric
torch.set_num_threads(1);torch.set_default_dtype(torch.float64)
reports=[]

for problem in ('convection','reaction','wave'):
    source=root/'observed-exports'/f'{problem}.npz'
    layers=numeric.load_network(source)
    arrays=numeric.canonical_data(problem)
    parameters=[(torch.tensor(w),torch.tensor(b)) for w,b in layers]
    def forward(z):
        for index,(w,b) in enumerate(parameters):
            z=z@w.T+b
            if index<3:z=torch.tanh(z)
        return z[:,0]
    def jets(points):
        z=torch.tensor(points,requires_grad=True);u=forward(z)
        first=torch.autograd.grad(u.sum(),z,create_graph=True)[0]
        xx=torch.autograd.grad(first[:,0].sum(),z,retain_graph=True)[0][:,0]
        tt=torch.autograd.grad(first[:,1].sum(),z)[0][:,1]
        return u.detach(),first[:,0].detach(),first[:,1].detach(),xx.detach(),tt.detach()
    def operator(j):
        u,ux,ut,uxx,utt=j
        if problem=='convection':return ut+40*ux
        if problem=='reaction':return ut-5*u*(1-u)
        return utt-4*uxx
    training=operator(jets(arrays['residual']));evaluation=jets(arrays['evaluation']);physics=operator(evaluation)
    initial=jets(arrays['initial']);x=torch.tensor(arrays['initial'][:,0])
    if problem=='convection':target=torch.sin(x)
    elif problem=='reaction':target=torch.exp(-((x-torch.pi)**2)/(2*(torch.pi/4)**2))
    else:target=torch.sin(torch.pi*x)+.5*torch.sin(5*torch.pi*x)
    families={'initial_value':initial[0]-target}
    left=jets(arrays['boundary_left']);right=jets(arrays['boundary_right'])
    if problem=='wave':families.update(initial_velocity=initial[2],boundary_left=left[0],boundary_right=right[0])
    else:families['periodic_value']=left[0]-right[0]
    pooled=torch.cat(list(families.values()))
    result={'residual_loss':float(.5*training.square().mean()),'constraint_loss':float(.5*pooled.square().mean()),
            'residual_rmse':float(training.square().mean().sqrt()),
            'evaluation_residual_loss':float(.5*physics.square().mean()),'evaluation_residual_rmse':float(physics.square().mean().sqrt()),
            'constraint_families':{k:{'count':len(v),'loss':float(.5*v.square().mean()),'rmse':float(v.square().mean().sqrt())} for k,v in families.items()}}
    numpy_result=json.loads((root/'cli-results'/f'{problem}.json').read_text())
    for field in ['residual_loss','constraint_loss','residual_rmse','evaluation_residual_loss','evaluation_residual_rmse']:
        np.testing.assert_allclose(result[field],numpy_result[field],rtol=1e-9,atol=1e-10)
    assert set(result['constraint_families'])==set(numpy_result['constraint_families'])
    for k,values in result['constraint_families'].items():
        for field in ['count','loss','rmse']:
            np.testing.assert_allclose(values[field],numpy_result['constraint_families'][k][field],rtol=1e-9,atol=1e-10)
    weighted=sum(v['count']*v['loss'] for v in numpy_result['constraint_families'].values())/numpy_result['constraint_count']
    np.testing.assert_allclose(weighted,numpy_result['constraint_loss'],rtol=1e-12,atol=1e-12)
    reports.append({'problem':problem,'status':'matched','device':'cpu','torch':torch.__version__,'same_export_for_all_metrics':str(source),
                    'independent_autograd_metrics':result,'count_weighted_pool':weighted,'tolerance':{'atol':1e-10,'rtol':1e-9}})
(root/'torch-crosscheck.json').write_text(json.dumps(reports,indent=2,allow_nan=False)+'\n')
print(json.dumps([{'problem':x['problem'],'status':x['status'],'family_names':list(x['independent_autograd_metrics']['constraint_families'])} for x in reports]))
