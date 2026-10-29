import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "reviewed-source/script/benchmark"))
import numpy as np
import pinn_numeric_check as check

layers = [(np.zeros((100, 2)), np.zeros(100)), (np.zeros((100, 100)), np.zeros(100)),
          (np.zeros((100, 100)), np.zeros(100)), (np.zeros((1, 100)), np.ones(1))]
arbitrary = {"residual": np.array([[np.pi / 2, 0.0]]), "initial": np.array([[np.pi / 2, 0.0]]),
             "boundary_left": np.array([[0.0, 0.5]]), "boundary_right": np.array([[2 * np.pi, 0.5]]),
             "evaluation": np.array([[np.pi / 2, 0.0]])}
numeric_only = check.metrics("convection", layers, arbitrary)
canonical = check.metrics("convection", layers, check.canonical_data("convection"))
print(json.dumps({"probe": "numeric_primitive_vs_authoritative_data", "arbitrary_one_point": numeric_only,
                  "canonical_data": canonical,
                  "interpretation": "metrics is intentionally a numeric primitive; current CLI generates canonical data and does not admit candidate point files"}))
assert numeric_only["total_loss"] == 0 and numeric_only["l2re"] == 0
assert canonical["constraint_loss"] > 0.5 and canonical["l2re"] > 1.5

random = np.random.default_rng(935)
layers = [(random.normal(scale=.3, size=(7, 2)), random.normal(scale=.1, size=7)),
          (random.normal(scale=.3, size=(5, 7)), random.normal(scale=.1, size=5)),
          (random.normal(scale=.3, size=(4, 5)), random.normal(scale=.1, size=4)),
          (random.normal(scale=.3, size=(1, 4)), random.normal(scale=.1, size=1))]
points = np.array([[.19, .32], [.71, .83]])
jets = check.forward_jets(layers, points)
h = 1e-4
for axis, first, second in [(0, "ux", "uxx"), (1, "ut", "utt")]:
    plus, minus = points.copy(), points.copy()
    plus[:, axis] += h
    minus[:, axis] -= h
    upper, lower = check.forward_jets(layers, plus)["u"], check.forward_jets(layers, minus)["u"]
    e1 = float(np.max(np.abs((upper - lower) / (2 * h) - jets[first])))
    e2 = float(np.max(np.abs((upper - 2 * jets["u"] + lower) / h**2 - jets[second])))
    print(json.dumps({"probe": "four_layer_input_derivatives", "first": first, "second": second,
                      "first_max_abs_error": e1, "second_max_abs_error": e2, "finite_difference_step": h}))
    assert e1 < 1e-7 and e2 < 1e-6
