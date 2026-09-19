#!/usr/bin/env python3
"""Export frozen public AutomationBench cases into Harbor's native task format."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
from typing import Any

from automationbench.domains import get_domain_dataset
from automationbench.task_contract import task_contract_sha256


UPSTREAM_COMMIT = "4a8e1061254004d9dac807054eed33fad7d1ff14"
STOCK_BUDGET = "You have a budget of ~50 tool-using turns — favor parallel tool calls and avoid duplicate searches."


def _task_name(row: dict[str, Any]) -> str:
    info = row.get("info", {})
    if isinstance(info, str):
        info = json.loads(info)
    return str(info.get("task_name", ""))


def load_case(domain: str, task_name: str) -> dict[str, Any]:
    qualified = task_name if "." in task_name else f"{domain}.{task_name}"
    dataset = get_domain_dataset(domain)
    for index in range(len(dataset)):
        row = dict(dataset[index])
        if _task_name(row) == qualified:
            return row
    raise ValueError(f"AutomationBench task not found: {qualified}")


def render_instruction(prompt: Any) -> str:
    if not isinstance(prompt, list):
        raise TypeError("AutomationBench prompt must be a list")
    messages: list[str] = []
    for item in prompt:
        if not isinstance(item, dict):
            if hasattr(item, "model_dump"):
                item = item.model_dump()
            else:
                raise TypeError("AutomationBench prompt message must be an object")
        content = str(item.get("content", ""))
        messages.append(f"{str(item.get('role', '')).upper()}:\n{content}")
    return "\n\n".join(messages) + "\n"


def _dockerfile(domain: str, task_name: str) -> str:
    return '''FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends git procps curl ca-certificates util-linux iptables && rm -rf /var/lib/apt/lists/*
COPY runtime/automationbench_tool.py /opt/automationbench-harbor/automationbench_tool.py
RUN chmod 755 /opt/automationbench-harbor/automationbench_tool.py && install -d -m 0755 /workspace /run/automationbench \
    && git init -q /workspace \
    && git -C /workspace config user.name "AutomationBench" \
    && git -C /workspace config user.email "automationbench@example.invalid" \
    && touch /workspace/.gitkeep \
    && git -C /workspace add .gitkeep \
    && git -C /workspace commit -qm "Initialize Harbor task workspace" \
    && git config --system --add safe.directory /workspace
USER root
'''


def _bridge_dockerfile() -> str:
    return f'''FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/* && pip install --no-cache-dir "automation-bench @ git+https://github.com/zapier/AutomationBench@{UPSTREAM_COMMIT}"
COPY runtime/automationbench_bridge.py /opt/automationbench-harbor/automationbench_bridge.py
'''


def _compose(domain: str, task_name: str) -> str:
    return f'''services:
  main:
    build:
      context: .
      dockerfile: Dockerfile
    command: ["sleep", "infinity"]
    cap_add: ["SYS_ADMIN", "NET_ADMIN"]
    volumes:
      - benchmark-runtime:/run/automationbench
  bridge:
    build:
      context: .
      dockerfile: Bridge.Dockerfile
    environment:
      AUTOMATIONBENCH_DOMAIN: "{domain}"
      AUTOMATIONBENCH_TASK: "{task_name}"
    command:
      - /bin/sh
      - -ceu
      - |
        install -d -m 0755 /run/automationbench
        install -d -m 0700 /run/automationbench/private
        printf '%s\\n' 'harbor-official-verifier-v1' | python3 /opt/automationbench-harbor/automationbench_bridge.py \\
          --domain "$$AUTOMATIONBENCH_DOMAIN" --task "$$AUTOMATIONBENCH_TASK" \\
          --events /run/automationbench/private/events.jsonl \\
          --initial-world /run/automationbench/private/initial-world.json \\
          --final-world /run/automationbench/private/final-world.json \\
          --tool-socket /run/automationbench/tool.sock \\
          --admin-socket /run/automationbench/admin.sock --agent-uid 60001
    volumes:
      - benchmark-runtime:/run/automationbench
volumes:
  benchmark-runtime:
'''


def export_task(output: Path, domain: str, task_name: str, source: Path) -> Path:
    row = load_case(domain, task_name)
    qualified = task_name if "." in task_name else f"{domain}.{task_name}"
    short_name = qualified.split(".", 1)[1]
    target = output / f"{domain}-{short_name.replace('_', '-')}"
    if target.exists():
        raise FileExistsError(f"Harbor task already exists: {target}")
    info = row.get("info", {})
    if isinstance(info, str):
        info = json.loads(info)
    contract_sha256 = task_contract_sha256(
        example_id=row.get("example_id"), prompt=row.get("prompt"), info=info
    )
    (target / "environment" / "runtime").mkdir(parents=True)
    (target / "tests").mkdir()
    (target / "instruction.md").write_text(render_instruction(row.get("prompt")), encoding="utf-8")
    (target / "task.toml").write_text(
        f'''version = "1.0"

[task]
name = "automationbench/{domain}-{short_name.replace('_', '-')}"

[metadata]
category = "{domain}"
tags = ["automationbench", "api-mode", "public"]
upstream_commit = "{UPSTREAM_COMMIT}"
upstream_example_id = "{row.get('example_id')}"
task_contract_sha256 = "{contract_sha256}"

[agent]
timeout_sec = 3600.0
user = "root"
network_mode = "public"

[verifier]
timeout_sec = 120.0
user = "root"
network_mode = "public"

[environment]
build_timeout_sec = 1200.0
cpus = 4
memory_mb = 8192
storage_mb = 20480
network_mode = "public"

[environment.healthcheck]
command = "test -S /run/automationbench/tool.sock && test -S /run/automationbench/admin.sock"
interval_sec = 1.0
timeout_sec = 5.0
retries = 120
''',
        encoding="utf-8",
    )
    runtime = target / "environment" / "runtime"
    for name in ("automationbench_bridge.py", "automationbench_tool.py"):
        shutil.copy2(source / name, runtime / name)
    (target / "environment" / "Dockerfile").write_text(_dockerfile(domain, qualified), encoding="utf-8")
    (target / "environment" / "Bridge.Dockerfile").write_text(_bridge_dockerfile(), encoding="utf-8")
    (target / "environment" / "docker-compose.yaml").write_text(
        _compose(domain, qualified), encoding="utf-8"
    )
    shutil.copy2(Path(__file__).with_name("score_harbor.py"), target / "tests" / "score_harbor.py")
    shutil.copy2(Path(__file__).with_name("test.sh"), target / "tests" / "test.sh")
    return target


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--domain", required=True)
    parser.add_argument("--task", required=True)
    parser.add_argument(
        "--bridge-source",
        type=Path,
        default=Path(__file__).parents[1] / "external-agent",
    )
    args = parser.parse_args()
    print(export_task(args.output, args.domain, args.task, args.bridge_source))


if __name__ == "__main__":
    main()
