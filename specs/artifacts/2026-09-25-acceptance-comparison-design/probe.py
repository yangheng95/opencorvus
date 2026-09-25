"""Offline design probe only. No production imports, model calls or output writes."""
from copy import deepcopy
from decimal import Decimal, DecimalException, Inexact, localcontext
import json
from pathlib import Path

from jsonschema import Draft202012Validator

HERE = Path(__file__).resolve().parent
SCHEMA = json.loads((HERE / "comparison.schema.json").read_text(encoding="utf-8"))
Draft202012Validator.check_schema(SCHEMA)
VALIDATOR = Draft202012Validator(SCHEMA)


def decimal_text(value):
    return format(value, "f").rstrip("0").rstrip(".") if "." in format(value, "f") else str(value)


def compare(record):
    errors = sorted(VALIDATOR.iter_errors(record), key=lambda e: str(list(e.path)))
    if errors:
        return {"status": "invalid_contract", "paths": [list(e.path) for e in errors]}
    expectation, observation = record["expectation"], record["observation"]
    if observation["state"] == "unavailable":
        return {"status": "unresolved", "reason": "observation_unavailable"}
    if expectation["kind"] == "literal":
        # JSON identity, rather than Python's True == 1 coercion.
        expected = json.dumps(expectation["value"], sort_keys=True)
        observed = json.dumps(observation["value"], sort_keys=True)
        return {"status": "matched" if expected == observed else "contradicted",
                "expected": expectation["value"], "observed": observation["value"]}
    if expectation["unit"] != observation["unit"]:
        return {"status": "unresolved", "reason": "unit_mismatch"}
    numeric = Draft202012Validator(SCHEMA["$defs"]["decimal"])
    if not numeric.is_valid(observation["value"]):
        return {"status": "invalid_contract", "paths": [["observation", "value"]]}
    used, missing = set(), set()

    def references(node):
        if "input" in node:
            used.add(node["input"])
        elif "op" in node:
            references(node["left"])
            references(node["right"])

    references(expectation["expression"])
    for name in used:
        if name not in expectation["inputs"] or expectation["inputs"][name]["value"] is None:
            missing.add(name)
    unused = sorted(set(expectation["inputs"]) - used)
    if missing:
        return {"status": "unresolved", "reason": "missing_input",
                "inputs": sorted(missing), "unused_inputs": unused}

    def calculate(node):
        if "input" in node:
            return Decimal(expectation["inputs"][node["input"]]["value"])
        if "constant" in node:
            return Decimal(node["constant"])
        left, right = calculate(node["left"]), calculate(node["right"])
        if node["op"] == "add":
            return left + right
        if node["op"] == "subtract":
            return left - right
        if node["op"] == "multiply":
            return left * right
        return left / right

    try:
        with localcontext() as context:
            context.prec = 50
            context.traps[Inexact] = True
            expected = calculate(expectation["expression"])
            observed = Decimal(observation["value"])
    except Inexact:
        return {"status": "unresolved", "reason": "derivation_precision_unavailable"}
    except DecimalException:
        return {"status": "unresolved", "reason": "derivation_domain_error"}
    return {"status": "matched" if expected == observed else "contradicted",
            "expected": decimal_text(expected), "observed": decimal_text(observed),
            "unused_inputs": unused}


def main():
    vectors = json.loads((HERE / "vectors.json").read_text(encoding="utf-8"))
    results = []
    for case in vectors["cases"]:
        record = deepcopy(vectors["records"][case["record"]])
        # Explicit per-vector input substitution, never a change to real evidence.
        for replacement in case.get("replace", []):
            parent = record
            for key in replacement["path"][:-1]:
                parent = parent[key]
            parent[replacement["path"][-1]] = replacement["value"]
        actual = compare(record)
        assert actual == case["expected_output"], (case["id"], actual, case["expected_output"])
        results.append({"id": case["id"], "meaning": case["meaning"], "output": actual})
    print(json.dumps({"scope": "operator_authored_offline_contract_probe",
                      "production_or_model_acceptance": False, "cases": results}, indent=2))


if __name__ == "__main__":
    main()
