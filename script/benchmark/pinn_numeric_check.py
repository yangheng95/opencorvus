"""Independent NumPy checks for the draft long PINN study.

Reads numeric network exports, not candidate inference code. This checker does
not attest that training occurred or replace clean re-training and source review.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np


class ContractError(ValueError):
    def __init__(self, code, detail):
        self.code = code
        super().__init__(f"{code}: {detail}")


def canonical_data(problem):
    """Evaluator-owned draft sampling contract; never read candidate point files."""
    if problem not in ("convection", "reaction", "wave"):
        raise ContractError("problem", problem)
    extent = 1.0 if problem == "wave" else 2.0 * np.pi
    random = np.random.default_rng(20261029)
    grid = np.stack(
        np.meshgrid(np.linspace(0.0, extent, 257)[1:-1], np.arange(1, 101) / 101.0, indexing="ij"),
        axis=-1,
    ).reshape(-1, 2)
    return {
        "residual": grid[random.choice(len(grid), 10000, replace=False)],
        "initial": np.column_stack((np.linspace(0.0, extent, 257), np.zeros(257))),
        "boundary_left": np.column_stack((np.zeros(101), np.linspace(0.0, 1.0, 101))),
        "boundary_right": np.column_stack((np.full(101, extent), np.linspace(0.0, 1.0, 101))),
        "evaluation": np.stack(
            np.meshgrid(np.linspace(0.0, extent, 129), np.linspace(0.0, 1.0, 65), indexing="ij"), axis=-1
        ).reshape(-1, 2),
    }


def forward_jets(layers, points):
    """Value and x/t first/second derivatives for tanh-hidden linear-output MLP."""
    value = np.asarray(points, dtype=np.float64)
    if value.ndim != 2 or value.shape[1] != 2:
        raise ContractError("point_shape", str(value.shape))
    dx = np.broadcast_to(np.array([1.0, 0.0]), value.shape).copy()
    dt = np.broadcast_to(np.array([0.0, 1.0]), value.shape).copy()
    dxx, dtt = np.zeros_like(value), np.zeros_like(value)
    for index, (weight, bias) in enumerate(layers):
        weight, bias = np.asarray(weight), np.asarray(bias)
        if weight.ndim != 2 or weight.shape[1] != value.shape[1] or bias.shape != (weight.shape[0],):
            raise ContractError("checkpoint_shape", f"layer {index}")
        value = value @ weight.T + bias
        dx, dt = dx @ weight.T, dt @ weight.T
        dxx, dtt = dxx @ weight.T, dtt @ weight.T
        if index < len(layers) - 1:
            value = np.tanh(value)
            first = 1.0 - value * value
            second = -2.0 * value * first
            dxx, dtt = second * dx * dx + first * dxx, second * dt * dt + first * dtt
            dx, dt = first * dx, first * dt
    if value.shape[1] != 1:
        raise ContractError("checkpoint_output", str(value.shape))
    return {key: array[:, 0] for key, array in zip(("u", "ux", "ut", "uxx", "utt"), (value, dx, dt, dxx, dtt))}


def exact_jets(problem, points):
    x, t = np.asarray(points, dtype=np.float64).T
    if problem == "convection":
        angle = x - 40.0 * t
        value, cosine = np.sin(angle), np.cos(angle)
        return {"u": value, "ux": cosine, "ut": -40.0 * cosine, "uxx": -value, "utt": -1600.0 * value}
    if problem == "reaction":
        variance = (np.pi / 4.0) ** 2
        h = np.exp(-((x - np.pi) ** 2) / (2.0 * variance))
        first_h = -h * (x - np.pi) / variance
        second_h = h * (((x - np.pi) / variance) ** 2 - 1.0 / variance)
        exponential = np.exp(5.0 * t)
        denominator = 1.0 + h * (exponential - 1.0)
        value = h * exponential / denominator
        derivative_h = exponential / denominator**2
        derivative_hh = -2.0 * exponential * (exponential - 1.0) / denominator**3
        return {
            "u": value,
            "ux": derivative_h * first_h,
            "ut": 5.0 * value * (1.0 - value),
            "uxx": derivative_hh * first_h**2 + derivative_h * second_h,
            "utt": 25.0 * value * (1.0 - value) * (1.0 - 2.0 * value),
        }
    if problem == "wave":
        low = np.sin(np.pi * x) * np.cos(2.0 * np.pi * t)
        high = np.sin(5.0 * np.pi * x) * np.cos(10.0 * np.pi * t)
        return {
            "u": low + 0.5 * high,
            "ux": np.pi * np.cos(np.pi * x) * np.cos(2.0 * np.pi * t) + 2.5 * np.pi * np.cos(5.0 * np.pi * x) * np.cos(10.0 * np.pi * t),
            "ut": -2.0 * np.pi * np.sin(np.pi * x) * np.sin(2.0 * np.pi * t) - 5.0 * np.pi * np.sin(5.0 * np.pi * x) * np.sin(10.0 * np.pi * t),
            "uxx": -np.pi**2 * low - 12.5 * np.pi**2 * high,
            "utt": -4.0 * np.pi**2 * low - 50.0 * np.pi**2 * high,
        }
    raise ContractError("problem", problem)


def operator_residual(problem, jets):
    if problem == "convection":
        return jets["ut"] + 40.0 * jets["ux"]
    if problem == "reaction":
        return jets["ut"] - 5.0 * jets["u"] * (1.0 - jets["u"])
    if problem == "wave":
        return jets["utt"] - 4.0 * jets["uxx"]
    raise ContractError("problem", problem)


def l2re(prediction, truth):
    numerator = np.sum((prediction - truth) ** 2)
    denominator = np.sum(truth**2)
    if denominator <= 0:
        raise ContractError("metric_denominator", str(denominator))
    return float(np.sqrt(numerator / denominator))


def metrics(problem, layers, data):
    residual = operator_residual(problem, forward_jets(layers, data["residual"]))
    initial = forward_jets(layers, data["initial"])
    initial_target = exact_jets(problem, data["initial"])["u"]
    left, right = forward_jets(layers, data["boundary_left"]), forward_jets(layers, data["boundary_right"])
    constraints = {"initial_value": initial["u"] - initial_target}
    if problem == "wave":
        constraints.update(initial_velocity=initial["ut"], boundary_left=left["u"], boundary_right=right["u"])
    else:
        constraints["periodic_value"] = left["u"] - right["u"]
    constraint_vector = np.concatenate(list(constraints.values()))
    residual_loss = float(0.5 * np.mean(residual**2))
    constraint_loss = float(0.5 * np.mean(constraint_vector**2))
    evaluation = forward_jets(layers, data["evaluation"])
    evaluation_residual = operator_residual(problem, evaluation)
    prediction = evaluation["u"]
    truth = exact_jets(problem, data["evaluation"])["u"]
    families = {
        name: {"count": len(values), "loss": float(0.5 * np.mean(values**2)),
               "rmse": float(np.sqrt(np.mean(values**2)))}
        for name, values in constraints.items()
    }
    answer = {
        "problem": problem,
        "residual_points": len(residual),
        "constraint_count": len(constraint_vector),
        "evaluation_points": len(prediction),
        "residual_loss": residual_loss,
        "constraint_loss": constraint_loss,
        "total_loss": residual_loss + constraint_loss,
        "residual_rmse": float(np.sqrt(np.mean(residual**2))),
        "evaluation_residual_loss": float(0.5 * np.mean(evaluation_residual**2)),
        "evaluation_residual_rmse": float(np.sqrt(np.mean(evaluation_residual**2))),
        "constraint_families": families,
        "l2re": l2re(prediction, truth),
        "parameter_count": sum(weight.size + bias.size for weight, bias in layers),
    }
    scalars = [value for value in answer.values() if isinstance(value, (float, int))]
    scalars.extend(value for family in families.values() for value in family.values())
    if not all(np.isfinite(value) for value in scalars):
        raise ContractError("nonfinite_metric", problem)
    return answer


def load_network(file, width=100):
    expected = {f"{name}_{i}" for i in range(4) for name in ("weight", "bias")}
    with np.load(file, allow_pickle=False) as source:
        if set(source.files) != expected:
            raise ContractError("checkpoint_keys", str(source.files))
        layers = [(source[f"weight_{i}"].copy(), source[f"bias_{i}"].copy()) for i in range(4)]
    dimensions = [2, width, width, width, 1]
    for i, (weight, bias) in enumerate(layers):
        if weight.shape != (dimensions[i + 1], dimensions[i]) or bias.shape != (dimensions[i + 1],):
            raise ContractError("checkpoint_shape", f"layer {i}")
        if weight.dtype != np.float64 or bias.dtype != np.float64:
            raise ContractError("checkpoint_dtype", f"layer {i}")
        if not np.isfinite(weight).all() or not np.isfinite(bias).all():
            raise ContractError("checkpoint_values", f"layer {i}")
    return layers


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("data", "evaluate"))
    parser.add_argument("--problem", choices=("convection", "reaction", "wave"), required=True)
    parser.add_argument("--checkpoint", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    data = canonical_data(args.problem)
    if args.action == "data":
        np.savez(args.out, **data)
        print(json.dumps({"path": str(args.out), "counts": {key: len(value) for key, value in data.items()}}))
        return
    if args.checkpoint is None:
        parser.error("evaluate requires --checkpoint")
    network = load_network(args.checkpoint)
    result = metrics(args.problem, network, data)
    args.out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf8")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
