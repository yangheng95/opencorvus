"""Actual native zero-step boundary; deliberately constructed, not a study run."""
import datetime
import json
import sys
import time
from pathlib import Path

import numpy as np
import torch

sys.path.insert(0, '/checks')
from pinn_numeric_check import canonical_data
from pinn_torch_check import model_parameters, objective, parameter_gradient, flatten

torch.set_num_threads(2)
torch.set_default_dtype(torch.float64)
root = Path('/work/native-lbfgs-zero-qualification')
root.mkdir(exist_ok=False)
shapes = ((100, 2), (100, 100), (100, 100), (1, 100))
layers = [(np.zeros(shape), np.zeros(shape[0])) for shape in shapes]
layers[-1][1][:] = 2e-8
parameters = model_parameters(layers, 'cpu')
arrays = canonical_data('convection')
data = {name: torch.tensor(value, requires_grad=name in ('initial', 'residual')) for name, value in arrays.items()}

def export(name):
    np.savez(root / name, **{f'{kind}_{i}': parameters[2*i+j].detach().numpy().copy()
                            for i in range(4) for j, kind in enumerate(('weight', 'bias'))})

export('before.npz')
previous = flatten(parameters).detach().clone()
value_before, gradient_before = parameter_gradient('convection', parameters, data)
optimizer = torch.optim.LBFGS(parameters, lr=1., max_iter=1, max_eval=25, history_size=100,
                              line_search_fn='strong_wolfe', tolerance_grad=1e-9, tolerance_change=1e-15)
closures = []

def closure():
    optimizer.zero_grad(set_to_none=True)
    value = objective('convection', parameters, data)
    value.backward()
    gradient = flatten([p.grad for p in parameters]).detach()
    closures.append({'call': len(closures)+1, 'loss': float(value.detach()),
                     'gradient_inf': float(gradient.abs().max()),
                     'trial_displacement_inf': float((flatten(parameters).detach()-previous).abs().max())})
    return value

start = time.perf_counter()
optimizer.step(closure)
elapsed = time.perf_counter()-start
value_after, gradient_after = parameter_gradient('convection', parameters, data)
delta = float((flatten(parameters).detach()-previous).abs().max())
native = optimizer.state[parameters[0]]
ginf = float(gradient_after.abs().max())
status = 'gradient_converged' if ginf <= 1e-9 else 'optimizer_stalled' if delta == 0 else 'updated'
gtd = float(gradient_before.detach() @ native['d'])
export('after.npz')
receipt = {
    'scope': 'constructed actual full-width PINN/native boundary only; not registered initialization or candidate result',
    'created_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'torch': torch.__version__, 'device': 'cpu', 'problem': 'convection',
    'status': status, 'attempts': 1, 'accepted_updates': int(delta > 0),
    'native_iterations': native.get('n_iter'), 'native_function_evaluations': native.get('func_evals'),
    'closure_calls': len(closures), 'closures': closures, 'parameter_step_inf': delta,
    'loss_before': float(value_before.detach()), 'loss_after': float(value_after.detach()),
    'gradient_before_inf': float(gradient_before.detach().abs().max()), 'gradient_after_inf': ginf,
    'native_directional_derivative': gtd, 'native_trial_step': float(native['t']),
    'tolerance_grad': 1e-9, 'tolerance_change': 1e-15, 'step_seconds': elapsed,
    'checks': {'stalled_state': status == 'optimizer_stalled', 'gradient_exceeds_convergence': ginf > 1e-9,
               'native_direction_guard': gtd > -1e-15, 'zero_step': delta == 0,
               'one_attempt_zero_accepted_one_native_one_closure': native.get('n_iter') == 1 and len(closures) == 1 and delta == 0}
}
(root/'receipt.json').write_text(json.dumps(receipt, indent=2)+'\n')
print(json.dumps(receipt))
assert all(receipt['checks'].values()), receipt
