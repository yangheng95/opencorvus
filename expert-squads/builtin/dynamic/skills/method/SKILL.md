---
name: dynamic-team-method
description: Generate and execute the smallest Task-local Agent team and workflow description directly through existing OpenCorvus Sessions.
---

# Dynamic Team Method

Use this Skill only inside `builtin/dynamic`. It defines a lightweight runtime composition method, not Expert Squad package authoring.

## 1. Decide whether to split

Start from the requested outcome, current authoritative inputs, acceptance, effects, and conflicts. Keep one member when the work is small, sequential, shares one mutable surface, or would force every worker to rediscover the same context. Split only when an independent partition can finish or produce a clear predecessor result without waiting on unrelated work.

Useful independent partitions include distinct evidence sources, competing hypotheses, non-overlapping modules, separate deliverables, and an acceptance challenge that can observe a settled result. Do not create a team merely because Dynamic was selected.

## 2. Describe the ephemeral team

For each member record exactly:

- a short Task-local name;
- exact target capability: `dynamic-generalist` or `dynamic-builder`;
- one responsibility and explicit non-goals;
- owned facts, files, effects, or review surface;
- required predecessor result, if any;
- expected visible result and evidence duty.

Task-local names are prose addresses for this run. They never become manifest IDs, dispatch aliases, installed Agents, reusable configuration, or a second identity source.

## 3. Describe the workflow

Represent the smallest dependency graph in one line when possible:

`source-a || source-b -> synthesis -> delivery -> acceptance`

Omit stages that do no real work. `||` means the members are ready in the same frontier; `->` means the downstream responsibility truly needs a predecessor result. A description guides the Orchestrator but does not create Host workflow state, node occurrence fences, retries, or completion authority.

## 4. Dispatch immediately

Write the team and workflow description in the same streamed Orchestrator message as the first dispatch calls. Do not spend another Agent call producing the description. Dispatch all ready members in that Turn up to real Task capacity. Repeated use of one target creates independent sibling Sessions with separate context and lineage.

Use `dynamic-generalist` for bounded investigation, planning, analysis, review, verification, and synthesis. Use `dynamic-builder` for repository mutation or concrete deliverables. Parallel writers require non-overlapping ownership and managed worktrees when isolation is needed. Shared-file or otherwise shared mutable work is serial.

## 5. Reconcile real evidence

Open the next frontier only from settled real messages, Tool/Result evidence, selected Artifacts, Host observations, and current state. Preserve disagreement and unknowns. If evidence changes the team shape, publish a concise visible delta and continue the exact capable lineage where possible; never create hidden workflow state.

Complete only when the original Task acceptance is evidenced. The generated team/workflow description is a plan, not proof that any member ran or any result is correct.
