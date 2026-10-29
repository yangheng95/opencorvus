import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

import pinn_numeric_check as check


class PositiveNumericalContracts(unittest.TestCase):
    def test_evaluator_owned_sampling_has_full_domain_and_boundary_pairing(self):
        for problem, extent in (("convection", 2 * np.pi), ("reaction", 2 * np.pi), ("wave", 1.0)):
            data = check.canonical_data(problem)
            self.assertEqual(data["residual"].shape, (10000, 2))
            self.assertEqual(len(np.unique(data["residual"], axis=0)), 10000)
            self.assertEqual(data["initial"].shape, (257, 2))
            self.assertEqual(data["evaluation"].shape, (8385, 2))
            np.testing.assert_allclose(data["initial"][:, 1], 0.0)
            np.testing.assert_allclose(data["boundary_left"][:, 0], 0.0)
            np.testing.assert_allclose(data["boundary_right"][:, 0], extent)
            np.testing.assert_allclose(data["boundary_left"][:, 1], data["boundary_right"][:, 1])
            self.assertGreater(float(data["residual"][:, 0].min()), 0.0)
            self.assertLess(float(data["residual"][:, 0].max()), extent)

    def test_constant_solution_on_authoritative_grid_has_measured_error(self):
        layers = [(np.zeros((100, 2)), np.zeros(100)), (np.zeros((100, 100)), np.zeros(100)),
                  (np.zeros((100, 100)), np.zeros(100)), (np.zeros((1, 100)), np.ones(1))]
        result = check.metrics("convection", layers, check.canonical_data("convection"))
        self.assertEqual(result["residual_points"], 10000)
        self.assertAlmostEqual(result["constraint_loss"], 192.5 / 358.0, places=12)
        self.assertGreater(result["l2re"], 1.5)

    def test_linear_network_returns_exact_input_derivatives(self):
        points = np.array([[0.2, 0.3], [0.7, 0.9]])
        result = check.forward_jets([(np.array([[2.0, -3.0]]), np.array([0.5]))], points)
        np.testing.assert_allclose(result["u"], 2 * points[:, 0] - 3 * points[:, 1] + 0.5)
        np.testing.assert_allclose(result["ux"], [2, 2])
        np.testing.assert_allclose(result["ut"], [-3, -3])
        np.testing.assert_allclose(result["uxx"], [0, 0])
        np.testing.assert_allclose(result["utt"], [0, 0])

    def test_tanh_network_returns_hand_derived_curvature(self):
        points = np.array([[0.2, 0.3], [0.7, 0.9]])
        layers = [(np.array([[1.0, 2.0]]), np.array([0.0])), (np.array([[3.0]]), np.array([-1.0]))]
        result = check.forward_jets(layers, points)
        value = np.tanh(points[:, 0] + 2 * points[:, 1])
        np.testing.assert_allclose(result["u"], 3 * value - 1)
        np.testing.assert_allclose(result["ux"], 3 * (1 - value**2))
        np.testing.assert_allclose(result["ut"], 6 * (1 - value**2))
        np.testing.assert_allclose(result["uxx"], -6 * value * (1 - value**2))
        np.testing.assert_allclose(result["utt"], -24 * value * (1 - value**2))

    def test_published_analytic_solutions_satisfy_all_three_operators(self):
        for problem in ("convection", "reaction", "wave"):
            points = np.array([[0.12, 0.23], [0.47, 0.78], [0.91, 0.52]])
            np.testing.assert_allclose(check.operator_residual(problem, check.exact_jets(problem, points)), [0, 0, 0], atol=1e-10)

    def test_wave_speed_four_has_known_polynomial_residual(self):
        points = np.array([[0.2, 0.3], [0.7, 0.9]])
        jets = {"u": np.sum(points**2, axis=1), "ut": 2 * points[:, 1], "ux": 2 * points[:, 0], "uxx": np.array([2.0, 2.0]), "utt": np.array([2.0, 2.0])}
        np.testing.assert_allclose(check.operator_residual("wave", jets), [-6, -6])

    def test_convection_and_reaction_hand_calculated_non_solutions(self):
        jets = {"u": np.array([0.25, 0.5]), "ut": np.array([2.0, -1.0]),
                "ux": np.array([3.0, -0.5])}
        np.testing.assert_allclose(check.operator_residual("convection", jets), [122.0, -21.0])
        np.testing.assert_allclose(check.operator_residual("reaction", jets), [1.0625, -2.25])

    def test_wave_nonzero_initial_velocity_contributes_exact_constraint_loss(self):
        linear_time = [(np.array([[0.0, 1.0]]), np.zeros(1))]
        data = {"residual": np.array([[0.25, 0.5]]), "initial": np.array([[0.0, 0.0]]),
                "boundary_left": np.array([[0.0, 0.0]]), "boundary_right": np.array([[1.0, 0.0]]),
                "evaluation": np.array([[0.5, 0.0]])}
        result = check.metrics("wave", linear_time, data)
        self.assertAlmostEqual(result["constraint_loss"], 0.125)

    def test_four_layer_export_load_and_real_cli_evaluation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            checkpoint, receipt = root / "network.npz", root / "receipt.json"
            shapes = ((100, 2), (100, 100), (100, 100), (1, 100))
            values = {f"weight_{i}": np.zeros(shape, dtype=np.float64) for i, shape in enumerate(shapes)}
            values.update({f"bias_{i}": np.zeros(shape[0], dtype=np.float64) for i, shape in enumerate(shapes)})
            np.savez(checkpoint, **values)
            layers = check.load_network(checkpoint)
            self.assertEqual(sum(weight.size + bias.size for weight, bias in layers), 20601)
            run = subprocess.run([sys.executable, str(Path(check.__file__).resolve()), "evaluate", "--problem", "wave",
                                  "--checkpoint", str(checkpoint), "--out", str(receipt)], capture_output=True, text=True)
            self.assertEqual(run.returncode, 0, run.stderr)
            result = json.loads(receipt.read_text(encoding="utf8"))
            self.assertEqual(result["evaluation_points"], 8385)
            self.assertEqual(result["constraint_count"], 716)
            self.assertAlmostEqual(result["l2re"], 1.0)

    def test_wave_initial_velocity_and_boundary_match_public_equation(self):
        initial = np.array([[0.1, 0.0], [0.5, 0.0], [0.9, 0.0]])
        boundary = np.array([[0.0, 0.3], [1.0, 0.7]])
        np.testing.assert_allclose(check.exact_jets("wave", initial)["ut"], [0, 0, 0])
        np.testing.assert_allclose(check.exact_jets("wave", boundary)["u"], [0, 0], atol=1e-14)

    def test_reaction_initial_state_matches_gaussian(self):
        points = np.array([[np.pi, 0.0], [0.0, 0.0], [2 * np.pi, 0.0]])
        np.testing.assert_allclose(check.exact_jets("reaction", points)["u"], [1.0, np.exp(-8.0), np.exp(-8.0)])

    def test_l2_relative_error_has_known_scale(self):
        truth = np.array([1.0, -2.0, 3.0])
        self.assertAlmostEqual(check.l2re(2 * truth, truth), 1.0)
        self.assertAlmostEqual(check.l2re(truth, truth), 0.0)

    def test_pooled_convection_loss_has_known_value(self):
        zero = [(np.zeros((1, 2)), np.zeros(1))]
        data = {
            "residual": np.array([[0.3, 0.4], [0.6, 0.8]]),
            "initial": np.array([[0.0, 0.0], [np.pi / 2, 0.0], [np.pi, 0.0]]),
            "boundary_left": np.array([[0.0, 0.5]]),
            "boundary_right": np.array([[2 * np.pi, 0.5]]),
            "evaluation": np.array([[0.2, 0.3], [0.4, 0.5]]),
        }
        result = check.metrics("convection", zero, data)
        self.assertEqual(result["constraint_count"], 4)
        self.assertAlmostEqual(result["total_loss"], 0.125)
        self.assertAlmostEqual(result["l2re"], 1.0)

    def test_pooled_wave_loss_includes_velocity_constraints(self):
        zero = [(np.zeros((1, 2)), np.zeros(1))]
        data = {
            "residual": np.array([[0.3, 0.4], [0.6, 0.8]]),
            "initial": np.array([[0.0, 0.0], [0.5, 0.0], [1.0, 0.0]]),
            "boundary_left": np.array([[0.0, 0.5]]),
            "boundary_right": np.array([[1.0, 0.5]]),
            "evaluation": np.array([[0.2, 0.3], [0.4, 0.5]]),
        }
        result = check.metrics("wave", zero, data)
        self.assertEqual(result["constraint_count"], 8)
        self.assertAlmostEqual(result["total_loss"], 0.140625)

    def test_invalid_coordinate_shape_maps_to_explicit_error(self):
        with self.assertRaises(check.ContractError) as caught:
            check.forward_jets([(np.zeros((1, 2)), np.zeros(1))], np.zeros((4, 3)))
        self.assertEqual(caught.exception.code, "point_shape")


if __name__ == "__main__":
    unittest.main()
