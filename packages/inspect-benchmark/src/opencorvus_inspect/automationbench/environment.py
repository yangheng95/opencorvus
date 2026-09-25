"""Shared sample-owned package/configuration and MCP resource scope."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from ..adapter import AdapterConfig
from .api_session import ApiSession

SquadFiles = tuple[tuple[Path, bytes], ...]


def freeze_squad_files(squad: Path) -> SquadFiles:
    return tuple(
        (file.relative_to(squad), file.read_bytes())
        for file in sorted(squad.rglob("*"))
        if file.is_file()
    )


@asynccontextmanager
async def project_environment(
    config: AdapterConfig, files: SquadFiles, session: ApiSession
) -> AsyncIterator[None]:
    from .mcp import world_server

    project = Path(config.project_dir)
    await asyncio.to_thread(project.mkdir, parents=True, exist_ok=False)
    async with world_server(session) as url:

        def prepare_project() -> None:
            target = project / ".opencorvus" / "expert-squads" / "builtin" / "automationbench"
            for relative, content in files:
                destination = target / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(content)
            (project / ".opencorvus" / "opencorvus.jsonc").write_text(
                json.dumps(
                    {
                        "mcp": {
                            "automationbench": {
                                "type": "remote",
                                "url": url,
                                "transport": "streamable-http",
                                "enabled": True,
                                "oauth": False,
                            }
                        },
                    },
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )

        await asyncio.to_thread(prepare_project)
        yield


def sample_settings(
    input_path: str,
    squad: str,
    project_dir: str,
    model: str,
    base_url: str,
    timeout_seconds: float,
    poll_seconds: float,
) -> tuple[AdapterConfig, Path, dict[str, Any]]:
    import json5

    if not model.strip():
        raise ValueError("AutomationBench requires an explicit provider/model")
    squad_path = Path(squad).resolve(strict=True)
    squad_manifest = json5.loads((squad_path / "expert-squad.jsonc").read_text(encoding="utf-8"))
    if (squad_manifest.get("namespace"), squad_manifest.get("id")) != (
        "builtin",
        "automationbench",
    ):
        raise ValueError("squad must identify the canonical builtin/automationbench package")
    config = AdapterConfig.resolve(
        base_url=base_url,
        project_dir=project_dir,
        model=model,
        prompt_profile="automationbench",
        product_pillar="work",
        init_git=True,
        timeout_seconds=timeout_seconds,
        poll_seconds=poll_seconds,
    )
    if urlsplit(config.base_url).hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise ValueError("AutomationBench requires a co-located loopback OpenCorvus service")
    root = Path(project_dir).resolve()
    if Path(input_path).resolve().is_relative_to(root) or squad_path.is_relative_to(root):
        raise ValueError("input and squad source must remain outside the sample project root")
    return config, squad_path, squad_manifest
