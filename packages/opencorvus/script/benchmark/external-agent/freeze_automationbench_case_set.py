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
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.count < len(PUBLIC_DOMAINS):
        raise ValueError("case count must include every public domain")
    base, remainder = divmod(args.count, len(PUBLIC_DOMAINS))
    quotas = {domain: base + (1 if index < remainder else 0) for index, domain in enumerate(PUBLIC_DOMAINS)}
    all_identities: list[dict[str, Any]] = []
    selected: list[dict[str, Any]] = []
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
        selected.extend(sorted(identities, key=lambda item: item["selection_rank_sha256"])[: quotas[domain]])
    selected.sort(key=lambda item: item["selection_rank_sha256"])
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
            "algorithm": "per-domain sha256 rank with fixed seed; quota-balanced; selected cases globally sha256-ranked",
            "seed": SELECTION_SEED,
            "count": args.count,
            "domain_quotas": quotas,
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
