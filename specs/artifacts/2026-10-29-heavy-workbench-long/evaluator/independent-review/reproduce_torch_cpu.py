import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "reviewed-source/script/benchmark"))
import torch
import numpy as np
import pinn_torch_check as check

torch.set_num_threads(1)
print(json.dumps({"environment": {"torch": torch.__version__, "numpy": np.__version__, "device": "cpu", "gpu_requested": False}}))
suite = unittest.defaultTestLoader.loadTestsFromName("test_pinn_torch_check")
result = unittest.TextTestRunner(verbosity=2).run(suite)

x = torch.tensor([1e-8], dtype=torch.float64, requires_grad=True)
optimizer = torch.optim.LBFGS([x], lr=1, max_iter=1, max_eval=25, history_size=100,
                             line_search_fn="strong_wolfe", tolerance_grad=1e-9, tolerance_change=1e-15)
calls = 0


def closure():
    global calls
    calls += 1
    optimizer.zero_grad()
    loss = 0.5 * x.square().sum()
    loss.backward()
    return loss


before = x.detach().clone()
optimizer.step(closure)
probe = {"probe": "native_lbfgs_finite_zero_step", "objective": "0.5*x^2", "initial_x": 1e-8,
         "parameter": x.item(), "parameter_change_inf": (x.detach() - before).abs().max().item(),
         "gradient_inf": x.grad.abs().max().item(), "closure_calls": calls,
         "native_n_iter": optimizer.state[x].get("n_iter"), "interpretation": "finite optimizer_stalled; not gradient convergence or accepted parameter update"}
print(json.dumps(probe))
assert probe["parameter_change_inf"] == 0 and probe["gradient_inf"] == 1e-8 and calls == 1

parameters = (torch.tensor([[0.2, 0.3]], dtype=torch.float64, requires_grad=True),
              torch.tensor([0.7], dtype=torch.float64, requires_grad=True))
points = torch.tensor([[0.2, 0.3], [0.7, 0.9]], dtype=torch.float64, requires_grad=True)
data = {name: points for name in ("residual", "initial", "boundary_left", "boundary_right")}
value, gradient = check.parameter_gradient("convection", parameters, data, "residual", graph=True)
direction = torch.tensor([1.0, -2.0, 3.0], dtype=torch.float64)
product = check.hessian_operator(gradient, parameters)(direction)
print(json.dumps({"probe": "corrected_component_zero_derivative", "value": float(value.detach()),
                  "gradient": gradient.detach().tolist(), "hessian_times_direction": product.tolist(),
                  "expected_gradient": [332.0, 8.3, 0.0], "expected_hessian_times_direction": [1520.0, 38.0, 0.0]}))
np.testing.assert_allclose(gradient.detach().numpy(), [332.0, 8.3, 0.0], atol=1e-10)
np.testing.assert_allclose(product.numpy(), [1520.0, 38.0, 0.0], atol=1e-10)
raise SystemExit(0 if result.wasSuccessful() else 1)
