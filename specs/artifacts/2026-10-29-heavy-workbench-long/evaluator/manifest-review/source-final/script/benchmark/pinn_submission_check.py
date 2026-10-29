"""Read-only artifact contract checks, not training or scientific certification."""

from __future__ import annotations

import argparse
import json
from pathlib import Path, PurePosixPath
from zipfile import BadZipFile

import numpy as np

from pinn_numeric_check import ContractError, load_network, metrics, canonical_data


def require(condition, code, detail):
    if not condition:
        raise ContractError(code, detail)


def read_json(path):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, "duplicate_json_key", f"{path}: {key}")
            result[key] = value
        return result

    def constant(value):
        raise ContractError("json_number", f"{path}: {value}")

    try:
        return json.loads(path.read_text(encoding="utf8"), object_pairs_hook=pairs, parse_constant=constant)
    except (OSError, ValueError) as error:
        if isinstance(error, ContractError):
            raise
        raise ContractError("json_read", f"{path}: {error}") from error


def artifact(root, value, field):
    require(isinstance(value, str) and bool(value), "artifact_path", field)
    require(all(ord(character) >= 32 for character in value), "artifact_path", field)
    relative = PurePosixPath(value)
    require(not relative.is_absolute() and "\\" not in value and ":" not in value,
            "artifact_path", field)
    try:
        resolved = (root / relative).resolve()
    except (OSError, ValueError, RuntimeError) as error:
        raise ContractError("artifact_path", f"{field}: {error}") from error
    require(resolved.is_relative_to(root), "artifact_scope", field)
    require(resolved.is_file(), "artifact_file", field)
    return resolved


def integer(value, field):
    require(type(value) is int and value >= 0, "counter", field)
    return value


def select_minimum(ids, observations, eligible, tie_key):
    """Only independently recomputed train loss participates in selection."""
    candidates = [key for key in ids if observations[key]["status"] in eligible
                  and observations[key]["metrics"] is not None]
    return min(candidates, key=lambda key: (observations[key]["metrics"]["total_loss"], tie_key(key))) if candidates else None


def check_submission(root, profile, manifest_path):
    root = Path(root).resolve()
    manifest = read_json(artifact(root, manifest_path, "manifest"))
    require(isinstance(manifest, dict), "manifest_type", manifest_path)
    require(manifest.get("format") == "heavy-pinn-study/1", "manifest_format", "format")
    for field in ("benchmark", "case"):
        require(manifest.get(field) == profile[field], "manifest_identity", field)
    records = manifest.get("runs")
    require(isinstance(records, list), "run_list", "runs")
    specifications = {entry["id"]: entry for entry in profile["base_configurations"] + profile["continuations"]}
    ids = [entry.get("config_id") if isinstance(entry, dict) else None for entry in records]
    require(all(isinstance(key, str) for key in ids), "run_id", "runs[].config_id")
    require(len(set(ids)) == len(ids), "run_id_unique", "runs[].config_id")
    require(set(ids) == set(specifications), "run_coverage", "runs[].config_id")
    base_ids = {entry["id"] for entry in profile["base_configurations"]}
    phases_by_method = {"adam": ("adam",), "lbfgs": ("lbfgs",), "hybrid": ("adam", "lbfgs"),
                        "gd": ("gd",), "nncg": ("nncg",)}
    finite_states = set(profile["selection"]["eligible_terminal_states"])
    observations, networks, by_id = {}, {}, dict(zip(ids, records))
    for key, record in by_id.items():
        spec = specifications[key]
        continuation = key not in base_ids
        method = spec["method"]
        allowed = {"max_updates", "numerical_failure", "incomplete"}
        if method != "adam":
            allowed |= {"gradient_converged", "optimizer_stalled"}
        if method in ("lbfgs", "hybrid"):
            allowed.add("finite_plateau")
        if continuation:
            allowed.add("dependency_incomplete")
        if method == "nncg":
            allowed.add("algorithm_failure")
        status = record.get("status")
        require(isinstance(status, str) and status in allowed, "terminal_state", f"{key}.status")
        require(isinstance(record.get("reason"), str) and bool(record["reason"].strip()), "terminal_reason", key)
        if status in ("numerical_failure", "algorithm_failure"):
            require(isinstance(record.get("failure_code"), str) and bool(record["failure_code"].strip()), "failure_code", key)
        phase_records = record.get("phases")
        require(isinstance(phase_records, dict) and set(phase_records) == set(phases_by_method[method]), "phase_coverage", key)
        total_attempts = 0
        for phase, values in phase_records.items():
            require(isinstance(values, dict), "phase_type", f"{key}.{phase}")
            attempts = integer(values.get("attempts"), f"{key}.{phase}.attempts")
            accepted = integer(values.get("accepted_updates"), f"{key}.{phase}.accepted_updates")
            maximum = spec["updates"] if continuation else spec["max_updates"]
            if method == "hybrid":
                maximum = spec["adam_updates_before_switch"] if phase == "adam" else maximum - spec["adam_updates_before_switch"]
            require(accepted <= attempts and accepted <= maximum and attempts - accepted <= 1,
                    "phase_counts", f"{key}.{phase}")
            if status == "max_updates":
                require(accepted == maximum, "max_updates_count", f"{key}.{phase}")
            total_attempts += attempts
        costs = record.get("costs")
        require(isinstance(costs, dict), "costs_type", key)
        for field in ("closure_calls", "gradient_calls", "hvp_calls", "lbfgs_native_iterations"):
            integer(costs.get(field), f"{key}.costs.{field}")
        lbfgs_attempts = phase_records.get("lbfgs", {}).get("attempts", 0)
        require(costs["lbfgs_native_iterations"] <= lbfgs_attempts and costs["closure_calls"] >= lbfgs_attempts,
                "lbfgs_costs", key)
        if method == "hybrid" and (status in finite_states or lbfgs_attempts > 0):
            require(phase_records["adam"]["accepted_updates"] == spec["adam_updates_before_switch"], "hybrid_switch_count", key)
        if status == "dependency_incomplete":
            require(total_attempts == 0, "dependency_attempts", key)
        require("parent_id" in record, "parent_field", key)
        if not continuation:
            require(record["parent_id"] is None, "base_parent", key)
        checkpoints = record.get("checkpoints")
        require(isinstance(checkpoints, dict) and set(checkpoints) == {"initial", "switch", "final"}, "checkpoint_fields", key)
        require("trace" in record and "receipt" in record, "evidence_fields", key)
        for name in ("trace", "receipt"):
            if record[name] is not None:
                artifact(root, record[name], f"{key}.{name}")
        if status not in ("incomplete", "dependency_incomplete") or total_attempts > 0:
            require(checkpoints["initial"] is not None and checkpoints["final"] is not None, "checkpoint_required", key)
            require(record["trace"] is not None and record["receipt"] is not None, "evidence_required", key)
        switched = method == "hybrid" and phase_records["adam"]["accepted_updates"] == spec["adam_updates_before_switch"]
        if switched:
            require(checkpoints["switch"] is not None, "switch_checkpoint", key)
        else:
            require(checkpoints["switch"] is None, "switch_checkpoint_scope", key)
        if status == "dependency_incomplete":
            require(all(value is None for value in checkpoints.values()) and record["trace"] is None
                    and record["receipt"] is None and all(value == 0 for value in costs.values()), "dependency_artifacts", key)
        loaded = {}
        for name, value in checkpoints.items():
            if value is not None:
                path = artifact(root, value, f"{key}.checkpoints.{name}")
                try:
                    loaded[name] = load_network(path)
                except (OSError, ValueError, EOFError, BadZipFile) as error:
                    if isinstance(error, ContractError):
                        raise
                    raise ContractError("checkpoint_read", f"{key}.{name}: {error}") from error
        networks[key] = loaded
        problem = spec.get("problem", "convection")
        measured = metrics(problem, loaded["final"], canonical_data(problem)) if "final" in loaded else None
        observations[key] = {"status": status, "metrics": measured}

    def identical(first, second, code, key):
        require(all(np.array_equal(a, b) for la, lb in zip(first, second) for a, b in zip(la, lb)), code, key)

    initial_by_seed = {}
    for key in base_ids:
        if "initial" in networks[key]:
            spec = specifications[key]
            seed_key = (spec["problem"], spec["seed"])
            if seed_key in initial_by_seed:
                identical(networks[key]["initial"], initial_by_seed[seed_key], "initial_pairing", key)
            initial_by_seed[seed_key] = networks[key]["initial"]
    selection = profile["selection"]
    parent_ids = [key for key in base_ids if all(specifications[key][field] == selection[field]
                                              for field in ("problem", "seed", "method"))]
    parent = select_minimum(parent_ids, observations, finite_states, lambda key: specifications[key]["adam_learning_rate"])
    for entry in profile["continuations"]:
        key, record = entry["id"], by_id[entry["id"]]
        require(record["parent_id"] == parent, "continuation_parent", key)
        if parent is None:
            require(record["status"] == "dependency_incomplete", "dependency_state", key)
        else:
            require(record["status"] != "dependency_incomplete", "dependency_state", key)
            if "initial" in networks[key]:
                identical(networks[key]["initial"], networks[parent]["final"], "continuation_initial", key)
    solutions = {}
    quality = profile["solution_selection"]
    for problem in ("convection", "reaction", "wave"):
        candidates = [key for key, spec in specifications.items() if
                      (key in base_ids and spec["problem"] == problem and spec["seed"] == quality["seed"])
                      or (key not in base_ids and problem == "convection")]
        solutions[problem] = select_minimum(candidates, observations, quality["eligible_terminal_states"], lambda key: key)
    require(manifest.get("solution_checkpoints") == solutions, "solution_selection", "solution_checkpoints")
    return {"format": "heavy-pinn-artifact-check/1", "artifact_contract_checked": True,
            "training_attestation": "not_performed; requires controlled full clean retraining and independent source/trace review",
            "study_complete": "unassessed", "solution_reproduced": "unassessed",
            "registered_runs": len(records), "continuation_parent": parent,
            "solution_checkpoints": solutions, "observations": observations}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--manifest", required=True, help="Manifest path relative to the project root")
    parser.add_argument("--profile", type=Path, required=True, help="Evaluator-owned frozen public profile")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = check_submission(args.root, read_json(args.profile), args.manifest)
    except ContractError as error:
        result = {"artifact_contract_checked": False, "error": error.code, "detail": str(error)}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf8")
    print(json.dumps(result))
    raise SystemExit(0 if result["artifact_contract_checked"] else 2)


if __name__ == "__main__":
    main()
