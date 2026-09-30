"""Harness-owned loopback MCP transport for one simulated API occurrence."""

from __future__ import annotations

import asyncio
import socket
from collections.abc import AsyncIterator, Iterator
from contextlib import asynccontextmanager, contextmanager

import uvicorn
from mcp.server.fastmcp import FastMCP

from .api_session import ApiSession
from .mcp_tools import public_catalog, register_tools


class _Server(uvicorn.Server):
    @contextmanager
    def capture_signals(self) -> Iterator[None]:
        # Inspect owns process signals. Per-sample servers only own their sockets.
        yield


@asynccontextmanager
async def world_server(world: ApiSession) -> AsyncIterator[str]:
    mcp = FastMCP("automationbench", stateless_http=True, json_response=True)

    register_tools(mcp, world.call, public_catalog)

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server: _Server | None = None
    serving: asyncio.Task[None] | None = None
    try:
        sock.bind(("127.0.0.1", 0))
        sock.listen(128)
        port = sock.getsockname()[1]
        server = _Server(
            uvicorn.Config(
                mcp.streamable_http_app(),
                log_level="error",
                access_log=False,
                timeout_graceful_shutdown=5,
            )
        )
        serving = asyncio.create_task(server.serve(sockets=[sock]))

        async def ready() -> None:
            while not server.started:
                if serving.done():
                    await serving
                    raise RuntimeError("AutomationBench MCP exited before readiness")
                await asyncio.sleep(0.01)

        await asyncio.wait_for(ready(), timeout=10)
        yield f"http://127.0.0.1:{port}/mcp"
    finally:
        try:
            if server is not None and serving is not None:
                server.should_exit = True
                try:
                    await asyncio.wait_for(asyncio.shield(serving), timeout=10)
                finally:
                    if not serving.done():
                        serving.cancel()
                        await asyncio.gather(serving, return_exceptions=True)
        finally:
            sock.close()
