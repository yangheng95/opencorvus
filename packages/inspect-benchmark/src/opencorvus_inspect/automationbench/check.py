"""Model-free transport and official-rubric checks, never an agent capability score."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

import httpx
from inspect_ai import Task, task
from inspect_ai.dataset import Sample
from inspect_ai.scorer import CORRECT, Score, Scorer, Target, accuracy, scorer
from inspect_ai.solver import Generate, Solver, TaskState, solver

from .task import automationbench_partial, automationbench_strict
from .world import BENCHMARK, SCORING_POLICY, OfficialWorld, load_cases, rescore


async def exercise_invoice_case(url: str, count: int) -> None:
    """Apply known business inputs through the real MCP client and official API implementation."""
    from mcp import ClientSession
    from mcp.client.streamable_http import streamable_http_client

    async with (
        httpx.AsyncClient(trust_env=False) as http_client,
        streamable_http_client(
            url,
            http_client=http_client,
        ) as (read, write, _session_id),
    ):
        async with ClientSession(read, write) as client:
            await client.initialize()
            inventory = await client.list_tools()
            if sorted(tool.name for tool in inventory.tools) != [
                "api_fetch",
                "api_search",
                "base64_encode",
            ]:
                raise ValueError(
                    "AutomationBench MCP inventory does not match the official surface"
                )

            async def call(name: str, arguments: dict[str, Any]) -> str:
                result = await client.call_tool(name, arguments)
                if result.isError:
                    raise ValueError(f"local checker tool {name} returned an MCP error")
                return "\n".join(item.text for item in result.content if item.type == "text")

            await call("api_search", {"query": "wave invoice", "top_k": 20})
            await call("api_search", {"query": "gmail messages send", "top_k": 5})
            inputs = [
                ("wc_001", "pay@brightideas.example.com", 32, 95, "Brand identity redesign"),
                ("wc_002", "finance@greenleaf.example.com", 48, 110, "E-commerce site"),
            ]
            for customer, address, hours, rate, description in inputs[:count]:
                created = json.loads(
                    await call(
                        "api_fetch",
                        {
                            "method": "POST",
                            "url": "https://gql.waveapps.com/graphql/public",
                            "body": {
                                "query": (
                                    "mutation($input: InvoiceCreateInput!) { "
                                    "invoiceCreate(input: $input) { didSucceed invoice { id } } }"
                                ),
                                "variables": {
                                    "input": {
                                        "customerId": customer,
                                        "invoiceDate": "2026-02-05",
                                        "items": [
                                            {
                                                "quantity": hours,
                                                "unitPrice": rate,
                                                "description": description,
                                            }
                                        ],
                                    }
                                },
                            },
                        },
                    )
                )
                invoice = created["data"]["invoiceCreate"]["invoice"]
                await call(
                    "api_fetch",
                    {
                        "method": "POST",
                        "url": "https://gql.waveapps.com/graphql/public",
                        "body": {
                            "query": (
                                "mutation($input: InvoiceSendInput!) { "
                                "invoiceSend(input: $input) { didSucceed invoice { id status } } }"
                            ),
                            "variables": {"input": {"invoiceId": invoice["id"], "to": [address]}},
                        },
                    },
                )
                raw = await call(
                    "base64_encode",
                    {
                        "text": (
                            f"To: {address}\r\nSubject: January invoice\r\n\r\n"
                            f"{description}: {hours} hours at ${rate}; total {hours * rate:,}."
                        )
                    },
                )
                await call(
                    "api_fetch",
                    {
                        "method": "POST",
                        "url": "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                        "body": {"raw": raw},
                    },
                )


@scorer(metrics=[accuracy()])
def checker_contract() -> Scorer:
    async def score(state: TaskState, target: Target) -> Score:
        result = state.metadata["automationbench_score"]
        expected = json.loads(target.text)
        actual = [result["strict"], result["partial"]]
        if actual != expected:
            raise ValueError(f"Official rubric contract diverged: {actual}, expected {expected}")
        return Score(
            value=CORRECT, explanation="Real official rubric matched the known local state"
        )

    return cast(Scorer, score)


@solver
def automationbench_checker() -> Solver:
    """Exercise the actual official tools with fixed local acceptance inputs."""
    manifest = Path(__file__).parents[1] / "examples" / "automationbench-smoke.json"
    case = load_cases(manifest)[0]

    async def solve(state: TaskState, _generate: Generate) -> TaskState:
        from .mcp import world_server

        world = OfficialWorld(case)
        async with world_server(world) as url:
            await exercise_invoice_case(url, int(state.metadata["invoice_count"]))
        result = world.seal()
        snapshot = world.snapshot()
        if rescore(case, snapshot, len(world.events)) != result:
            raise ValueError("Official rubric differs after snapshot restoration")
        state.metadata.update(
            {
                "automationbench_score": result,
                "automationbench_snapshot": snapshot,
                "automationbench_events": world.events,
                "automationbench_execution": {"status": "scored"},
            }
        )
        state.completed = True
        return state

    return cast(Solver, solve)


@task
def automationbench_local_check() -> Task:
    """Validate empty, partial and complete official states without any model or Provider."""
    manifest = Path(__file__).parents[1] / "examples" / "automationbench-smoke.json"
    case = load_cases(manifest)[0]

    return Task(
        dataset=[
            Sample(
                id=name,
                input=f"Local checker validation: {name} invoice state. No model execution.",
                target=json.dumps(expected),
                metadata={
                    "execution_mode": "local-checker-validation",
                    "automationbench_case": case.task,
                    "automationbench_example_id": case.example_id,
                    "invoice_count": count,
                },
            )
            for name, count, expected in [
                ("empty", 0, [0.0, 0.0]),
                ("partial", 1, [0.0, 0.5]),
                ("complete", 2, [1.0, 1.0]),
            ]
        ],
        solver=automationbench_checker(),
        scorer=[
            checker_contract(),
            automationbench_strict(),
            automationbench_partial(),
        ],
        model=None,
        metadata={
            "benchmark": BENCHMARK,
            "scoring_policy": SCORING_POLICY,
            "execution_mode": "local-checker-validation",
        },
    )
