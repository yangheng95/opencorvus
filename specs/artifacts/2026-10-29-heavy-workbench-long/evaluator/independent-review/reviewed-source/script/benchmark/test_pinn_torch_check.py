import unittest

import numpy as np
import torch

import pinn_torch_check as check

torch.set_num_threads(4)


class ParameterDerivativeContracts(unittest.TestCase):
    def test_derivative_residual_has_exact_zero_output_bias_gradient_and_hessian(self):
        parameters = (torch.tensor([[0.2, 0.3]], dtype=torch.float64, requires_grad=True),
                      torch.tensor([0.7], dtype=torch.float64, requires_grad=True))
        points = torch.tensor([[0.2, 0.3], [0.7, 0.9]], dtype=torch.float64, requires_grad=True)
        data = {key: points for key in ("residual", "initial", "boundary_left", "boundary_right")}
        value, gradient = check.parameter_gradient("convection", parameters, data, "residual", graph=True)
        self.assertAlmostEqual(float(value.detach()), 0.5 * 8.3**2)
        np.testing.assert_allclose(gradient.detach().numpy(), [332.0, 8.3, 0.0], atol=1e-10)
        multiply = check.hessian_operator(gradient, parameters)
        direction = torch.tensor([1.0, -2.0, 3.0], dtype=torch.float64)
        np.testing.assert_allclose(multiply(direction).numpy(), [1520.0, 38.0, 0.0], atol=1e-10)

    def test_known_spd_quadratic_hessian_and_full_lanczos_spectrum(self):
        point = torch.tensor([0.2, -0.3, 0.6, 0.8, -1.2], dtype=torch.float64, requires_grad=True)
        diagonal = torch.tensor([1.0, 3.0, 7.0, 11.0, 19.0], dtype=torch.float64)
        value = 0.5 * (diagonal * point.square()).sum()
        gradient = torch.autograd.grad(value, point, create_graph=True)[0]
        multiply = check.hessian_operator(gradient, (point,))
        vector = torch.tensor([-1.0, 0.1, 0.3, -0.8, 1.2], dtype=torch.float64)
        np.testing.assert_allclose(multiply(vector).numpy(), (diagonal * vector).numpy(), atol=1e-12)
        result = check.lanczos(multiply, 5, 5)
        np.testing.assert_allclose([pair["value"] for pair in result["pairs"]], diagonal.numpy(), atol=1e-11)
        self.assertLess(max(pair["explicit_ritz_residual"] for pair in result["pairs"]), 1e-11)

    def test_linear_parameter_gradient_matches_closed_form_regression(self):
        parameters = (torch.tensor([[2.0, -3.0]], dtype=torch.float64, requires_grad=True),
                      torch.tensor([0.5], dtype=torch.float64, requires_grad=True))
        coordinates = torch.tensor([[0.2, 0.3], [0.7, 0.9]], dtype=torch.float64)
        output = check.prediction(parameters, coordinates)
        value = 0.5 * output.square().mean()
        gradient = torch.autograd.grad(value, parameters)
        expected = (output.detach().T @ coordinates) / 2.0
        np.testing.assert_allclose(gradient[0].numpy(), expected.numpy(), atol=1e-12)
        np.testing.assert_allclose(gradient[1].numpy(), [float(output.detach().mean())], atol=1e-12)


if __name__ == "__main__":
    unittest.main()
