"""Shared sample-owned package/configuration and MCP resource scope."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

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
