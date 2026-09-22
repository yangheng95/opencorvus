"""Provision a real sample for the product's model-free configuration admission test."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from inspect_ai.model import ChatMessageUser
from inspect_ai.solver import TaskState

from opencorvus_inspect.adapter import AdapterConfig
from opencorvus_inspect.automationbench.task import sample_environment
from opencorvus_inspect.automationbench.world import load_cases


async def main() -> None:
    project, squad, manifest = map(Path, sys.argv[1:])
    case = load_cases(manifest)[0]
    state = TaskState(
        model="none",  # type: ignore[arg-type]
        sample_id=case.task,
        epoch=1,
        input=case.request,
        messages=[ChatMessageUser(content=case.request)],
    )
    async with sample_environment([case], squad)(
        state, AdapterConfig.resolve(project_dir=str(project))
    ):
        config = json.loads((project / ".opencorvus/opencorvus.jsonc").read_text(encoding="utf-8"))
        print(
            json.dumps(
                {"project": str(project), "endpoint": config["mcp"]["automationbench"]["url"]}
            ),
            flush=True,
        )
        await asyncio.to_thread(sys.stdin.readline)


if __name__ == "__main__":
    asyncio.run(main())
