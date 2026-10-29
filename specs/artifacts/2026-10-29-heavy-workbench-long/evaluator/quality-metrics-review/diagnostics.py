import json
from pathlib import Path
import sys
import numpy as np
root=Path(__file__).resolve().parent
sys.path.insert(0,str(root/'source-snapshot'))
import pinn_numeric_check as check

rows=[]
for problem in ('convection','reaction','wave'):
    data=check.canonical_data(problem)
    for constant in (0.,1.):
        layers=[(np.zeros((100,2)),np.zeros(100)),(np.zeros((100,100)),np.zeros(100)),(np.zeros((100,100)),np.zeros(100)),(np.zeros((1,100)),np.array([constant]))]
        answer=check.metrics(problem,layers,data)
        rows.append({'problem':problem,'control':'actual_four_layer_network','constant':constant,'metrics':answer})
    points=data['evaluation'];initial=points.copy();initial[:,1]=0.
    jets=check.exact_jets(problem,initial)
    jets['ut']=np.zeros_like(jets['u']);jets['utt']=np.zeros_like(jets['u'])
    residual=check.operator_residual(problem,jets)
    rows.append({'problem':problem,'control':'analytic_initial_extension_only_not_network',
                 'l2re':check.l2re(jets['u'],check.exact_jets(problem,points)['u']),
                 'evaluation_residual_rmse':float(np.sqrt(np.mean(residual**2))),
                 'scope':'analytic function, satisfies initial/value-boundary conditions; wave velocity zero; not a trained or exported network'})

# Positive explicit error contract: evaluation-only large derivative overflows its squared residual.
weights=[np.zeros((100,2)),np.zeros((100,100)),np.zeros((100,100)),np.zeros((1,100))]
weights[0][0,1]=1e155;weights[1][0,0]=1.;weights[2][0,0]=1.;weights[3][0,0]=1.
layers=[(w,np.zeros(w.shape[0])) for w in weights]
data={'residual':np.array([[.2,1.]]),'initial':np.array([[np.pi/2,0.]]),
      'boundary_left':np.array([[0.,1.]]),'boundary_right':np.array([[2*np.pi,1.]]),'evaluation':np.array([[np.pi/2,0.]])}
with np.errstate(over='ignore',invalid='ignore'):
    try:check.metrics('convection',layers,data)
    except check.ContractError as error:contract={'input':'finite actual four-layer weights with evaluation-only residual-square overflow','code':error.code}
    else:raise AssertionError('expected numerical error contract')
assert contract['code']=='nonfinite_metric'
(root/'diagnostics.json').write_text(json.dumps({'thresholds_assigned':False,'candidate_scores':False,'controls':rows,'finite_error_contract':contract},indent=2,allow_nan=False)+'\n',encoding='utf-8')
print(json.dumps({'control_count':len(rows),'finite_error_contract':contract,'thresholds_assigned':False}))
