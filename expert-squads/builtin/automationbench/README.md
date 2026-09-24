# AutomationBench

An API-only business-workflow squad for the official AutomationBench simulated environment.
The Inspect harness supplies one isolated `automationbench` Model Context Protocol (MCP)
server per sample. Install this directory using the normal Expert Squad package loader,
or pass it as the Inspect task's `squad` argument. Select profile `automationbench`.

The read-only source reviewer establishes governing records, current updates and eligible
entities before mutation. The executor independently checks decisive facts and owns all
business mutations. The verifier checks the original request, records and receipts after
execution settles. The orchestrator coordinates their real handoffs and terminal decision.
Workflow dependencies expose the review → execute → verify order; they are not a host
semantic gate for choosing business tools or declaring success.

Only `api_search`, `api_fetch` and `base64_encode` are projected as business tools.
Platform Task artifact transport remains available through the ordinary worker contract.
The reviewer and verifier use the same official API surface and are instructed to perform
read-only work; role instructions are not an operating-system security boundary.
No case answer, official assertions, score access, shell, model client or benchmark runner
is bundled here. Inspect records official strict and partial scores after settlement.

Local checker validation proves transport and grading contracts. Model-driven squad
performance requires a separately authorized OpenCorvus Provider run.
