#!/usr/bin/env python3
"""Freeze a deterministic, identity-only public AutomationBench case sample."""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
from typing import Any

import automationbench
from automationbench.domains import PUBLIC_DOMAINS, get_domain_dataset
from automationbench.task_contract import TASK_CONTRACT_SCHEMA, task_contract_sha256


SOURCE_REVISION = "4a8e1061254004d9dac807054eed33fad7d1ff14"
SELECTION_SEED = "opencorvus-automationbench-public-50-v1"


def _package_tree_sha256() -> str:
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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=50)
    parser.add_argument("--base-manifest", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
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
    dataset_index = [
        {key: item[key] for key in ("domain", "task", "example_id", "task_contract_sha256")}
        for item in sorted(all_identities, key=lambda item: (item["domain"], str(item["example_id"]), item["task"]))
    ]
    manifest = {
        "schema_version": 1,
        "benchmark": "AutomationBench",
        "distribution_version": importlib.metadata.version("automation-bench"),
        "source_revision": SOURCE_REVISION,
        "package_tree_sha256": _package_tree_sha256(),
        "task_contract_schema": TASK_CONTRACT_SCHEMA,
        "split": "public",
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
            "dataset_index_sha256": hashlib.sha256(
                json.dumps(dataset_index, sort_keys=True, separators=(",", ":")).encode("utf-8")
            ).hexdigest(),
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
