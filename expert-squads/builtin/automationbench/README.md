# AutomationBench

An API-only business-workflow squad for the official AutomationBench simulated environment.
The Inspect harness supplies one isolated `automationbench` Model Context Protocol (MCP)
server per sample. Install this directory using the normal Expert Squad package loader,
or pass it as the Inspect task's `squad` argument. Select profile `automationbench`.

The executor owns source discovery and mutations. The verifier independently checks the
original request, authoritative records and all mutation receipts after execution settles.
The orchestrator coordinates existing Task participants and makes the real terminal decision.
Workflow dependencies guide those participants; they are not a host-enforced tool sequence.

Only `api_search`, `api_fetch` and `base64_encode` are projected as business tools.
Platform Task artifact transport remains available through the ordinary worker contract.
The verifier uses the same official API surface and is instructed to perform read-only
verification; its role instruction is not an operating-system security boundary.
No case answer, official assertions, score access, shell, model client or benchmark runner
is bundled here. Inspect records official strict and partial scores after settlement.

Local checker validation proves transport and grading contracts. Model-driven squad
performance requires a separately authorized OpenCorvus Provider run.
