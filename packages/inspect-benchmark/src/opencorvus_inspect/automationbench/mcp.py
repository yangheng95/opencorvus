"""Harness-owned loopback MCP transport for one official simulated world."""

from __future__ import annotations

import asyncio
import json
import socket
from collections.abc import AsyncIterator, Iterator
from contextlib import asynccontextmanager, contextmanager
from typing import Any

import uvicorn
from mcp.server.fastmcp import FastMCP

from .world import OfficialWorld


class _Server(uvicorn.Server):
    @contextmanager
    def capture_signals(self) -> Iterator[None]:
        # Inspect owns process signals. Per-sample servers only own their sockets.
        yield


@asynccontextmanager
async def world_server(world: OfficialWorld) -> AsyncIterator[str]:
    mcp = FastMCP("automationbench", stateless_http=True, json_response=True)

    @mcp.tool()
    async def api_search(query: str, top_k: int = 5) -> str:
        """Discover official API endpoints and exact request/response contracts.

        Args:
            query: Service, resource and operation terms; this searches API documentation.
            top_k: Number of matching endpoint contracts, from 1 through 20.
        """
        if not query.strip() or not 1 <= top_k <= 20:
            raise ValueError("query must be non-empty and top_k must be from 1 through 20")
        return world.call("api_search", {"query": query, "top_k": top_k})

    @mcp.tool()
    async def api_fetch(
        method: str,
        url: str,
        params: dict[str, Any] | None = None,
        body: dict[str, Any] | None = None,
    ) -> str:
        """Execute an official simulated business API using its discovered contract.

        Args:
            method: HTTP method from the discovered API endpoint.
            url: Exact discovered URL with record identifiers substituted.
            params: Query parameter object from the discovered endpoint contract.
            body: Request body object from the discovered endpoint contract.
        """
        return world.call(
            "api_fetch",
            {
                "method": method,
                "url": url,
                "params": json.dumps(params) if params is not None else None,
                "body": json.dumps(body) if body is not None else None,
            },
        )

    @mcp.tool()
    async def base64_encode(text: str) -> str:
        """Encode a string with the official tool, for endpoints requiring encoded content.

        Args:
            text: Exact content to encode.
        """
        return world.call("base64_encode", {"text": text})

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
