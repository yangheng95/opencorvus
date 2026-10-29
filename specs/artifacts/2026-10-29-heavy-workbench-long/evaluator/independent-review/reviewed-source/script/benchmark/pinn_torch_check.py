"""Evaluator-owned parameter derivatives and spectral receipts for draft L01.

Loads numeric exports only. No candidate Python is imported. NumPy computes
independent scalar metrics; Torch supplies an independent parameter derivative
implementation, checked by directional finite differences.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch

from pinn_numeric_check import canonical_data, load_network, metrics


def model_parameters(layers, device):
    return tuple(torch.tensor(value, dtype=torch.float64, device=device, requires_grad=True)
                 for layer in layers for value in layer)


def prediction(parameters, coordinates):
    value = coordinates
    for i in range(0, len(parameters), 2):
        value = value @ parameters[i].T + parameters[i + 1]
        if i + 2 < len(parameters):
            value = torch.tanh(value)
    return value


def derivative(value, coordinates):
    return torch.autograd.grad(value.sum(), coordinates, create_graph=True)[0]


def objective(problem, parameters, data, component="total"):
    x = data["residual"]
    value = prediction(parameters, x)
    first = derivative(value, x)
    if problem == "convection":
        residual = first[:, 1:] + 40.0 * first[:, :1]
    elif problem == "reaction":
        residual = first[:, 1:] - 5.0 * value * (1.0 - value)
    else:
        residual = derivative(first[:, 1:], x)[:, 1:] - 4.0 * derivative(first[:, :1], x)[:, :1]
    initial = data["initial"]
    if problem == "convection":
        target = torch.sin(initial[:, :1])
    elif problem == "reaction":
        target = torch.exp(-((initial[:, :1] - np.pi) ** 2) / (2.0 * (np.pi / 4.0) ** 2))
    else:
        target = torch.sin(np.pi * initial[:, :1]) + 0.5 * torch.sin(5.0 * np.pi * initial[:, :1])
    constraints = [prediction(parameters, initial) - target]
    if problem == "wave":
        constraints.extend((derivative(prediction(parameters, initial), initial)[:, 1:],
                            prediction(parameters, data["boundary_left"]), prediction(parameters, data["boundary_right"])))
    else:
        constraints.append(prediction(parameters, data["boundary_left"]) - prediction(parameters, data["boundary_right"]))
    r = 0.5 * residual.square().mean()
    c = 0.5 * torch.cat(constraints).square().mean()
    return {"total": r + c, "residual": r, "constraint": c}[component]


def flatten(values):
    return torch.cat([value.reshape(-1) for value in values])


def parameter_gradient(problem, parameters, data, component="total", graph=False):
    value = objective(problem, parameters, data, component)
    derivatives = torch.autograd.grad(value, parameters, create_graph=graph, allow_unused=True)
    # A PDE derivative residual can be mathematically independent of output bias.
    # Connect exact zeros when differentiating again; their Hessian is also zero.
    derivatives = tuple((gradient if gradient is not None else torch.zeros_like(parameter))
                        + (parameter * 0.0 if graph else 0.0)
                        for parameter, gradient in zip(parameters, derivatives))
    return value, flatten(derivatives)


def hessian_operator(gradient, parameters):
    def multiply(vector):
        values = torch.autograd.grad(gradient @ vector, parameters, retain_graph=True, allow_unused=True)
        return flatten(tuple(value if value is not None else torch.zeros_like(parameter)
                             for parameter, value in zip(parameters, values))).detach()
    return multiply


def lanczos(operator, dimension, steps, device="cpu"):
    generator = torch.Generator(device="cpu").manual_seed(1087)
    vector = torch.randn(dimension, generator=generator, dtype=torch.float64).to(device)
    vector = vector / torch.linalg.vector_norm(vector)
    basis, diagonal, subdiagonal = [], [], []
    previous = torch.zeros_like(vector)
    beta = torch.zeros((), dtype=torch.float64, device=device)
    for i in range(min(steps, dimension)):
        basis.append(vector)
        image = operator(vector) - beta * previous
        alpha = vector @ image
        image -= alpha * vector
        # Two full reorthogonalizations prevent repeated Ritz values from loss of orthogonality.
        for _ in range(2):
            for retained in basis:
                image -= (retained @ image) * retained
        diagonal.append(alpha)
        newbeta = torch.linalg.vector_norm(image)
        if i + 1 == min(steps, dimension) or newbeta <= 1e-13:
            break
        subdiagonal.append(newbeta)
        previous, vector, beta = vector, image / newbeta, newbeta
    matrix = torch.diag(torch.stack(diagonal))
    if subdiagonal:
        off = torch.stack(subdiagonal)
        matrix += torch.diag(off, 1) + torch.diag(off, -1)
    eigenvalues, eigenvectors = torch.linalg.eigh(matrix)
    q = torch.stack(basis, dim=1)
    indices = sorted(set(range(min(5, len(eigenvalues)))) | set(range(max(0, len(eigenvalues) - 5), len(eigenvalues))))
    pairs = []
    for i in indices:
        ritz = q @ eigenvectors[:, i]
        residual = torch.linalg.vector_norm(operator(ritz) - eigenvalues[i] * ritz)
        pairs.append({"value": float(eigenvalues[i]), "explicit_ritz_residual": float(residual)})
    return {"steps": len(basis), "dimension": dimension, "pairs": pairs,
            "interpretation": "finite Krylov Ritz estimates; not the full spectrum or a certified condition number"}


def evaluate(problem, checkpoint, device="cpu", spectral_steps=0, component="total"):
    layers = load_network(checkpoint)
    arrays = canonical_data(problem)
    independent = metrics(problem, layers, arrays)
    parameters = model_parameters(layers, device)
    data = {name: torch.tensor(value, dtype=torch.float64, device=device,
                              requires_grad=name in ("residual", "initial")) for name, value in arrays.items()}
    value, gradient = parameter_gradient(problem, parameters, data, component, graph=True)
    metric_name = {"total": "total_loss", "residual": "residual_loss", "constraint": "constraint_loss"}[component]
    np.testing.assert_allclose(float(value.detach()), independent[metric_name], rtol=1e-9, atol=1e-10)
    multiply = hessian_operator(gradient, parameters)
    generator = torch.Generator(device="cpu").manual_seed(789)
    direction = torch.randn(gradient.numel(), generator=generator, dtype=torch.float64).to(device)
    direction /= torch.linalg.vector_norm(direction)
    exact_hvp = multiply(direction)
    epsilon = 1e-5
    perturbed = []
    offset = 0
    plus, minus = [], []
    for parameter in parameters:
        local = direction[offset:offset + parameter.numel()].reshape(parameter.shape)
        plus.append((parameter.detach() + epsilon * local).requires_grad_(True))
        minus.append((parameter.detach() - epsilon * local).requires_grad_(True))
        offset += parameter.numel()
    for group in (tuple(plus), tuple(minus)):
        shifted_value, shifted_gradient = parameter_gradient(problem, group, data, component)
        perturbed.append((float(shifted_value.detach()), shifted_gradient.detach()))
    scalar_difference = (perturbed[0][0] - perturbed[1][0]) / (2.0 * epsilon)
    finite_hvp = (perturbed[0][1] - perturbed[1][1]) / (2.0 * epsilon)
    result = {
        "problem": problem, "component": component, "device": device, "torch": torch.__version__, "independent_numpy": independent,
        "gradient_inf": float(gradient.detach().abs().max()),
        "gradient_l2": float(torch.linalg.vector_norm(gradient.detach())),
        "directional_gradient": float(gradient.detach() @ direction),
        "finite_difference_directional_gradient": scalar_difference,
        "hvp_l2": float(torch.linalg.vector_norm(exact_hvp)),
        "finite_difference_hvp_relative_error": float(torch.linalg.vector_norm(exact_hvp - finite_hvp)
                                                      / torch.clamp(torch.linalg.vector_norm(exact_hvp), min=1e-12)),
    }
    hvp_error = float(torch.linalg.vector_norm(exact_hvp - finite_hvp))
    result["checks"] = {
        "scalar_matches_independent_numpy": True,
        "directional_gradient_matches_finite_difference": abs(result["directional_gradient"] - scalar_difference)
        <= 1e-7 * max(1.0, abs(result["directional_gradient"]), abs(scalar_difference)),
        "hvp_matches_finite_difference": hvp_error <= 1e-7 + 1e-4 * result["hvp_l2"],
    }
    if spectral_steps:
        result["spectrum"] = lanczos(multiply, gradient.numel(), spectral_steps, device)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--problem", choices=("convection", "reaction", "wave"), required=True)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--device", choices=("cpu", "cuda"), default="cpu")
    parser.add_argument("--spectral-steps", type=int, default=0)
    parser.add_argument("--component", choices=("total", "residual", "constraint"), default="total")
    args = parser.parse_args()
    torch.set_num_threads(4)
    result = evaluate(args.problem, args.checkpoint, args.device, args.spectral_steps, args.component)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf8")
    print(json.dumps(result))
    if not all(result["checks"].values()):
        raise SystemExit(2)


if __name__ == "__main__":
    main()
