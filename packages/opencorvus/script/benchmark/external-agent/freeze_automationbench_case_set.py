#!/usr/bin/env python3
"""Freeze a deterministic, identity-only public AutomationBench case sample."""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
from typing import Any

SOURCE_REVISION = "4a8e1061254004d9dac807054eed33fad7d1ff14"
SELECTION_SEED = "opencorvus-automationbench-public-50-v1"


def _package_tree_sha256() -> str:
    import automationbench

    root = Path(automationbench.__file__).parent
    digest = hashlib.sha256()
    for file in sorted(root.rglob("*.py")):
        digest.update(file.relative_to(root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(file.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def _task_name(info: dict[str, Any]) -> str:
    return str(info.get("task_name", ""))


def dataset_index_sha256(identities: list[dict[str, Any]]) -> str:
    index = [
        {key: item[key] for key in ("domain", "task", "example_id", "task_contract_sha256")}
        for item in sorted(identities, key=lambda item: (item["domain"], str(item["example_id"]), item["task"]))
    ]
    return hashlib.sha256(json.dumps(index, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def verify_manifest(manifest: Any, identities: list[dict[str, Any]], metadata: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(manifest, dict):
        return {"passed": False, "violations": ["manifest_schema_invalid"]}
    violations = []
    for key, expected in metadata.items():
        if type(manifest.get(key)) is not type(expected) or manifest.get(key) != expected:
            violations.append(f"manifest_metadata_mismatch:{key}")
    selection = manifest.get("selection", {})
    cases = manifest.get("cases", [])
    count = selection.get("count") if isinstance(selection, dict) else None
    if (type(count) is not int or count < 5 or count % 5 != 0
            or not isinstance(cases, list) or len(cases) != count):
        return {"passed": False, "violations": violations + ["manifest_case_count_invalid"]}
    index_sha = dataset_index_sha256(identities)
    if selection.get("dataset_index_sha256") != index_sha:
        violations.append("dataset_index_mismatch")
    by_key = {(item["domain"], item["task"]): item for item in identities}
    seen = set()
    for index, item in enumerate(cases, start=1):
        if not isinstance(item, dict):
            violations.append(f"case_identity_invalid:{index}")
            continue
        key = (item.get("domain"), item.get("task"))
        if not all(isinstance(value, str) for value in key):
            violations.append(f"case_identity_invalid:{index}")
            continue
        current = by_key.get(key)
        if key in seen:
            violations.append(f"duplicate_case_identity:{index}")
        seen.add(key)
        if (type(item.get("case_index")) is not int or item["case_index"] != index
                or type(item.get("batch_index")) is not int or item["batch_index"] != (index - 1) // 5 + 1):
            violations.append(f"case_order_mismatch:{index}")
        if current is None or any(type(item.get(field)) is not type(current[field]) or item.get(field) != current[field]
                                  for field in ("example_id", "task_contract_sha256", "selection_rank_sha256")):
            violations.append(f"official_case_identity_mismatch:{index}")
    return {"passed": not violations, "violations": violations, "case_count": count,
            "dataset_index_sha256": index_sha}


def main() -> None:
    from automationbench.domains import PUBLIC_DOMAINS, get_domain_dataset
    from automationbench.task_contract import TASK_CONTRACT_SCHEMA, task_contract_sha256

    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--count", type=int)
    parser.add_argument("--base-manifest", type=Path)
    parser.add_argument("--output", type=Path)
    mode.add_argument("--verify-manifest", type=Path, help="Verify selected identities against the official dataset without changing the sample")
    args = parser.parse_args()
    if args.verify_manifest and args.base_manifest:
        parser.error("--base-manifest applies only to sample generation")
    if args.verify_manifest and args.output and args.verify_manifest.resolve() == args.output.resolve():
        parser.error("verification output must differ from the selected manifest")
    if args.count is None:
        args.count = 50
    if args.count < len(PUBLIC_DOMAINS):
        raise ValueError("case count must include every public domain")
    base, remainder = divmod(args.count, len(PUBLIC_DOMAINS))
    quotas = {domain: base + (1 if index < remainder else 0) for index, domain in enumerate(PUBLIC_DOMAINS)}
    all_identities: list[dict[str, Any]] = []
    quota_selected: list[dict[str, Any]] = []
    for domain in PUBLIC_DOMAINS:
        dataset = get_domain_dataset(domain)
        identities: list[dict[str, Any]] = []
        names: set[str] = set()
        for index in range(len(dataset)):
            row = dict(dataset[index])
            info = row.get("info", {})
            if isinstance(info, str):
                info = json.loads(info)
            name = _task_name(info)
            if not name or name in names:
                raise RuntimeError(f"domain {domain} contains a missing or duplicate task_name: {name}")
            names.add(name)
            example_id = row.get("example_id")
            identity = {
                "domain": domain,
                "task": name,
                "example_id": example_id,
                "task_contract_sha256": task_contract_sha256(
                    example_id=example_id,
                    prompt=row.get("prompt"),
                    info=info,
                ),
            }
            rank_material = f"{SELECTION_SEED}\0{domain}\0{example_id}\0{name}".encode("utf-8")
            identity["selection_rank_sha256"] = hashlib.sha256(rank_material).hexdigest()
            identities.append(identity)
            all_identities.append(identity)
        quota_selected.extend(sorted(identities, key=lambda item: item["selection_rank_sha256"])[: quotas[domain]])
    metadata = {
        "schema_version": 1,
        "benchmark": "AutomationBench",
        "distribution_version": importlib.metadata.version("automation-bench"),
        "source_revision": SOURCE_REVISION,
        "package_tree_sha256": _package_tree_sha256(),
        "task_contract_schema": TASK_CONTRACT_SCHEMA,
        "split": "public",
    }
    if args.verify_manifest:
        data = args.verify_manifest.read_bytes()
        report = verify_manifest(json.loads(data), all_identities, metadata)
        report["manifest_sha256"] = hashlib.sha256(data).hexdigest()
        text = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
        if args.output:
            args.output.write_text(text, encoding="utf-8")
        else:
            print(text, end="")
        raise SystemExit(0 if report["passed"] else 1)
    if args.count > len(all_identities):
        raise ValueError(f"case count {args.count} exceeds the {len(all_identities)} public tasks")
    base_manifest_sha256: str | None = None
    if args.base_manifest:
        base_bytes = args.base_manifest.read_bytes()
        base_manifest = json.loads(base_bytes)
        base_cases = base_manifest.get("cases", [])
        if not isinstance(base_cases, list) or len(base_cases) > args.count:
            raise ValueError("base manifest must contain no more cases than the requested extension")
        identity_by_key = {(item["domain"], item["task"]): item for item in all_identities}
        selected = []
        selected_keys: set[tuple[str, str]] = set()
        for expected_index, base_item in enumerate(base_cases, start=1):
            key = (str(base_item.get("domain", "")), str(base_item.get("task", "")))
            current = identity_by_key.get(key)
            if (
                current is None
                or base_item.get("case_index") != expected_index
                or any(
                    base_item.get(field) != current.get(field)
                    for field in ("example_id", "task_contract_sha256", "selection_rank_sha256")
                )
                or key in selected_keys
            ):
                raise RuntimeError(f"base manifest case {expected_index} does not match the installed dataset")
            selected.append(dict(current))
            selected_keys.add(key)
        selected.extend(
            sorted(
                (item for item in all_identities if (item["domain"], item["task"]) not in selected_keys),
                key=lambda item: item["selection_rank_sha256"],
            )[: args.count - len(selected)]
        )
        base_manifest_sha256 = hashlib.sha256(base_bytes).hexdigest()
        quotas = {domain: sum(1 for item in selected if item["domain"] == domain) for domain in PUBLIC_DOMAINS}
    else:
        selected = sorted(quota_selected, key=lambda item: item["selection_rank_sha256"])
    if len(selected) != args.count:
        raise RuntimeError(f"selected {len(selected)} cases instead of {args.count}")
    for index, item in enumerate(selected):
        item["case_index"] = index + 1
        item["batch_index"] = index // 5 + 1
    manifest = {
        **metadata,
        "selection": {
            "algorithm": (
                "preserve base-manifest order; append remaining unique public identities by global sha256 rank"
                if args.base_manifest
                else "per-domain sha256 rank with fixed seed; quota-balanced; selected cases globally sha256-ranked"
            ),
            "seed": SELECTION_SEED,
            "count": args.count,
            "domain_quotas": quotas,
            **(
                {
                    "base_manifest_sha256": base_manifest_sha256,
                    "base_count": len(base_cases),
                }
                if args.base_manifest
                else {}
            ),
            "dataset_index_sha256": dataset_index_sha256(all_identities),
        },
        "cases": selected,
    }
    text = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
    if args.output:
        args.output.write_text(text, encoding="utf-8")
    else:
        print(text, end="")


if __name__ == "__main__":
    main()
