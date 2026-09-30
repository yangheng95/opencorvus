"""Shared public AutomationBench MCP tools, independent of the trial runner."""
from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any


def public_catalog(service: str | None = None) -> str:
    from automationbench.tools.api.search import _load_schemas

    schemas = _load_schemas()
    if service is None:
        return json.dumps({
            "services": [
                {"name": name, "endpoint_count": len(schema.get("endpoints", []))}
                for name, schema in sorted(schemas.items())
            ]
        })
    if service not in schemas:
        raise ValueError(f"unknown official API service: {service}")
    schema = schemas[service]
    return json.dumps({
        "service": service,
        "notes": schema.get("notes", ""),
        "operations": [
            {
                "id": endpoint["id"],
                "method": endpoint["method"],
                "description": endpoint.get("description", ""),
            }
            for endpoint in schema.get("endpoints", [])
        ],
    })


def register_tools(
    mcp: Any,
    call: Callable[[str, dict[str, Any]], str],
    catalog: Callable[[str | None], str],
) -> None:
    @mcp.tool()
    async def api_catalog(service: str | None = None) -> str:
        """List real simulated API services or one service's documented operations.

        This is endpoint metadata, not business records. Use api_search for the
        exact request contract and api_fetch to read actual business data.

        Args:
            service: Exact service name from the service listing; omit to list services.
        """
        return catalog(service)

    @mcp.tool()
    async def api_search(query: str, top_k: int = 5) -> str:
        """Discover official API endpoints and exact request/response contracts.

        Args:
            query: Service, resource and operation terms; this searches API documentation.
            top_k: Number of matching endpoint contracts, from 1 through 20.
        """
        if not query.strip() or not 1 <= top_k <= 20:
            raise ValueError("query must be non-empty and top_k must be from 1 through 20")
        return call("api_search", {"query": query, "top_k": top_k})

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
        return call(
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
        return call("base64_encode", {"text": text})
