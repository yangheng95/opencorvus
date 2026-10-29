"""Focused CPU boundary probes of the captured private qualification script.

Changing the module's device/sync selects CPU; no candidate or author code is used.
These are qualification-tool probes, not the full PINN task or a GPU re-run.
"""
import importlib.util
import json
import math
from pathlib import Path
import sys

import numpy as np
import torch

ROOT = Path('/review')
sys.path.insert(0, str(ROOT / 'reviewed-source/evaluator-tools'))
spec = importlib.util.spec_from_file_location('qualification_snapshot', ROOT/'reviewed-source/qualify_late_newton.py')
q = importlib.util.module_from_spec(spec)
spec.loader.exec_module(q)
q.device = 'cpu'
q.sync = lambda: None
torch.set_num_threads(1)
receipts = []
print(json.dumps({'torch':torch.__version__,'numpy':np.__version__,'device':'cpu','scope':'independent qualification-tool boundaries only'}))

known = q.known_spd()
receipts.append({'probe':'known_spd_cpu','status':known['status'],
                 'solution_relative_error':known['solution_relative_error'],
                 'lowrank_error':known['exact_lowrank_approximation_relative_error'],
                 'inverse_error':known['exact_lowrank_inverse_relative_error']})

try:
    q.nystrom(lambda v:torch.zeros_like(v), 8, .1, 116)
    receipts.append({'probe':'zero_hessian_nystrom','outcome':'returned'})
except Exception as error:
    receipts.append({'probe':'zero_hessian_nystrom','outcome':'uncaught_exception_from_nystrom',
                     'error_type':type(error).__name__,'error':str(error)})

solution, terminal = q.pcg(lambda v:torch.tensor([-1.,2.])*v,torch.tensor([1.,0.]),lambda v:v)
explicit = float(torch.linalg.vector_norm(torch.tensor([1.,0.])-torch.tensor([-1.,2.])*solution))
receipts.append({'probe':'nonpositive_curvature_receipt','returned':terminal,
                 'independently_recomputed_explicit_relative_residual':explicit,
                 'terminal_has_explicit_residual':'explicit_relative_residual' in terminal})

solution, terminal = q.pcg(lambda v:torch.full_like(v,float('nan')),torch.ones(2),lambda v:v)
receipts.append({'probe':'nonfinite_operator_classification','returned_status':terminal['status'],
                 'curvature_is_finite':math.isfinite(terminal['curvature']),
                 'terminal_has_explicit_residual':'explicit_relative_residual' in terminal})

shapes=((100,2),(100,100),(100,100),(1,100))
layers=[(np.ones(shape),np.ones(shape[0])) for shape in shapes]
layers[-1]=(layers[-1][0],np.array([np.nextafter(-100.,float('inf'))]))
arrays=q.numeric.canonical_data('convection')
data={name:torch.tensor(value,requires_grad=name in ('residual','initial')) for name,value in arrays.items()}
out=ROOT/'zero-update-gd';out.mkdir(exist_ok=False)
terminal=q.run_branch(layers,data,'gd',1e-4,0,2,out)
finished=q.numeric.load_network(out/'final.npz')
delta=max(float(np.max(np.abs(a-b))) for before,after in zip(layers,finished) for a,b in zip(before,after))
receipts.append({'probe':'actual_neural_gd_zero_update_count','status':terminal['status'],
                 'reported_accepted_updates':terminal['accepted_updates'],
                 'reported_attempts':terminal['attempts'],'actual_parameter_change_inf':delta,
                 'scope':'finite architecture/data and real objective, no mocked model/objective/Hessian'})
print(json.dumps(receipts,indent=2,allow_nan=False))
(ROOT/'probe-results.json').write_text(json.dumps(receipts,indent=2,allow_nan=False)+'\n')
