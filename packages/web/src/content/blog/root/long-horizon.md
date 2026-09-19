---
title: "Why long-running work needs a harness"
description: "Progress, context, checkable artifacts and the layers that connect them."
locale: "root"
key: "long-horizon"
category: "mechanisms"
order: 2
---

An **agent harness** is the runtime that turns a model into an agent: the loop, tool
routing, context management, memory, permission enforcement, and recovery. Long-horizon
capability is a property of that whole system rather than of the model — a capable model
inside a harness that loses task state still stops short.

OpenCorvus is that harness, already assembled, and aimed at work that runs long. It ships
a streaming agent loop across five primary roles, 70 built-in tools, a catalog of 87 model
providers, orchestration that survives a restart, a durable permission authority, project
and session memory, automatic context compaction, and [inspectable Expert Squads](https://opencorvus.com/market/).
Before an Agent can run, you explicitly select a model and configure a reachable provider;
the catalog is capability metadata, not a hidden default credential or model fallback.

Three things break long work, and each has an answer here: **runs that stop short**,
**results you cannot check**, and **workflows that never improve**. Combining several
Expert Squads is what makes the longest work tractable, and revising a squad from your own
feedback is what makes the tenth run better than the first.

Then every layer underneath is a configuration surface. Swap the model, narrow the
tool set, tighten the permission rules, replace an entire squad, or drive the whole
harness from the SDK.

Both halves are written in this repository — the harness runtime and the desktop
application — with no third-party agent engine underneath. That is a design choice
rather than a boast: it is what makes every layer replaceable. It stands on a great
deal of open source, Bun, the AI SDK, SolidJS and Tauri among them.



## Where long-horizon work breaks

| It breaks here                                                                                                                      | What answers it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The run stops short.** A step is skipped, a process dies, or a Task ends terminal with the goal half met.                         | Requirements emit `REQ-N` entries carrying their own acceptance conditions and explicit non-goals, and a squad's workflow declares what depends on what. Physical ownership is an append-only lease: when a process disappears, the reconciler terminalizes the abandoned Turn at the lease's expiry — a deterministic timestamp — and only then acquires a successor. Every accepted input passes one total-order reduction in which each state has a name.                                         |
| **The result is not dependably usable.** Success is reported, but what arrives is a summary you cannot check.                       | Handoffs are typed Artifacts with provenance and exact locators, read across a causal boundary that only exposes completed prior-step output. The host records file changes and command results independently of any agent's account of them. Fact-checking, integrity review, and visual QA run as named stages with their own agents, and a qualified Work Artifact — today the editable presentation profile — is delivered when it has been rendered, inspected, and given a validation receipt. |
| **The workflow never improves.** The tenth run repeats the mistake of the first, because the correction died with the conversation. | Tell a squad what you actually wanted and it drafts a revision from what you said; you accept it, and the receipt is how you undo it. Or run a measured Evolution Lab campaign. Nothing installs without your confirmation.                                                                                                                                                                                                                                                                          |

Terminal is not final either. A Task that reached `completed`, `failed`, or `cancelled`
reopens when you send it a message, at a fresh execution occurrence, with the prior
occurrence intact as an immutable fact. There is no separate retry or replan control to
find — a state whose only exit is special vocabulary is a state you cannot leave with an
ordinary action.

The boundary is real: unattended work continues only while your runtime is online, and
output still depends on the model, the reachable sources, and the available evidence. See
[Where long-horizon work breaks](https://opencorvus.com/concepts/long-horizon/).

## What ships

| Capability          | What ships                                                                                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Model providers** | A bundled catalog resolves 87 providers and 2,579 models, including local runtimes; running an Agent requires an explicitly selected model and configured reachable provider. |
| **Tools**           | 70 built-in tools, with Browser and Computer control available as default capability blocks.                                                                                  |
| **Expert Squads**   | Browse the [public catalog](https://opencorvus.com/market/) for ready-to-use embedded squads and importable packages.                                                                                                 |
| **Agent roles**     | Five primary roles: `coding`, `chat`, `work`, `control`, and `mission`.                                                                                                       |
| **Chat channels**   | Slack, Discord, Telegram, Feishu, DingTalk, WeCom, WhatsApp, Line, Signal, Matrix, Mattermost, Microsoft Teams, and Google Chat.                                              |
| **Surfaces**        | Desktop application, HTTP API with Server-Sent Events (SSE), and scheduled automation.                                                                                        |

## The harness, layer by layer

Every layer ships as part of the harness and is a configuration surface. Actual Agent work starts only after a model and reachable provider are explicitly configured.

| Layer                 | Included with the harness                                                                            | Replace via                            |
| --------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Agent loop**        | Five primary roles on a streaming loop with typed tool results.                                      | `agent`, prompt overrides              |
| **Tools**             | 70 built-in tools plus Model Context Protocol (MCP) servers and plugins.                             | `tools`, `mcp`, `plugin`               |
| **Models**            | 87 providers and 2,579 models in one bundled catalog; no model or credential is selected implicitly. | `model`, `small_model`, `provider`     |
| **Context**           | Automatic compaction and per-turn context budgeting keep long runs inside the window.                | model and budget configuration         |
| **Memory**            | Project and session memory with search, organization, and explicit injection.                        | `instructions`, memory configuration   |
| **Permission**        | Every side effect passes one durable allow / ask / deny authority before it runs.                    | `permission` rules, shell scope        |
| **Expert Squads**     | Inspectable squads in the [public catalog](https://opencorvus.com/market/); a Task pins one exact revision and cannot silently switch it.                | `expert_squads`, author your own       |
| **Durable execution** | Process leases, an event log, and a reconciler resume owned work after a restart.                    | Platform guarantee                     |
| **Verification**      | Integrity review, fact-checking, and visual QA run as named stages.                                  | acceptance configuration               |
| **Evidence**          | Host observations record file changes and command results apart from any agent summary.              | Platform guarantee                     |
| **Surfaces**          | Desktop, HTTP API with SSE, 13 chat channels, scheduled automation.                                  | SDK, plugin API, Agent Client Protocol |

## Core model

| Object           | Role                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Mission          | Coordinates an outcome that spans multiple Tasks and records their dependencies.                                            |
| Task             | Owns one project-scoped unit of work, one fixed Expert Squad, any selected workflow, its Sessions, and lifecycle decisions. |
| Expert Squad     | Packages an agent roster, instructions, Skills, tools, MCP access, and any declared workflows.                              |
| Workflow         | Declares the agents that run for a Task and their dependency order.                                                         |
| Artifact         | Stores a typed output or file snapshot with provenance so another agent or Task can read the exact result.                  |
| Host observation | Records facts such as file changes and command results independently of an agent's summary.                                 |

For a Task, the selected Expert Squad remains fixed; a selected workflow is also fixed.
Workers stream messages and tool calls, publish Artifacts when their contract requires
them, and pass exact Artifact references to downstream workers. The Orchestrator uses
those records and host observations for lifecycle decisions. Unresolved limitations and
blockers remain visible in agent messages.

![Mission and Expert Squad execution flow](/media/agent-teams-workflow.png)
