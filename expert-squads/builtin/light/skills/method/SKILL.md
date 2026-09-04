---
name: light-advisory-method
description: Run bounded read-only consultation, investigation, option analysis, planning, and clarifying-question work with variable parallel Planner and Investigator sessions. Use when the requested result is knowledge or advice rather than implementation or an external action.
---

# Light Advisory Method

## Bound the requested result

Classify the requested result as one or more of:

1. consultation or explanation;
2. read-only investigation;
3. comparison or option analysis;
4. plan or decision frame;
5. clarifying questions.

Freeze the subject, audience, decision horizon, evidence cutoff, authorized sources, time and jurisdiction where relevant, and the exact actions excluded from Light. If the desired result includes implementation, mutation, approval, communication, transaction, or operation of an external system, preserve the useful advisory portion and report the separate execution capability required.

## Partition independent work

Use direct dispatch rather than a fixed workflow. Create as many Planner and Investigator partitions as the question justifies and platform capacity permits. Every partition must have:

- one bounded question or evidence surface;
- a declared input and expected advisory output;
- no shared mutable state;
- no dependence on a sibling result;
- an explicit stop condition.

Multiple Sessions may use `light-planner` or `light-investigator` concurrently. They remain distinct Sessions with independent context and evidence; the shared Agent identity describes responsibility, not a singleton process or a numbered permanent team member.

## Investigate evidence

For every Planner and Investigator partition, an explicitly assigned source is a verification obligation, even when the request supplies expected values or a proposed conclusion. Read the authorized source with the actual read-only Tool before claiming what it establishes. User-supplied constraints remain supplied facts; an expected answer is not an observation of a file. If access fails, report the exact access result and which conclusion remains unverified.

For each evidence-bearing partition:

1. prefer primary and current sources;
2. record exact repository paths and line numbers or stable external references;
3. distinguish observed facts, source claims, calculations, inferences, contradictions, and unknowns;
4. name source date, version, scope, and applicability when material;
5. stop at authorization, privacy, credential, access, or integrity boundaries.

A source-backed report names the actual path/reference and observed values used for its conclusion. Explain the decisive comparison or calculation briefly; merely repeating the requested answer does not verify it. An investigation report contains its scope, sources, findings, conflicts, unknowns, confidence, and follow-up evidence needs in the worker's visible final assistant message. It never claims that advice was implemented.

## Plan and ask

For each Planner partition, map the objective, constraints, decision criteria, viable options, tradeoffs, risks, dependencies, evidence gaps, and recommended next decision. Do not collapse uncertainty into a single confident answer.

Ask only questions whose answers materially change the result and cannot be discovered from authorized evidence. Each question states:

- the decision it controls;
- why current evidence is insufficient;
- the mutually exclusive choices or requested fact;
- the consequence of leaving it unanswered.

The Orchestrator owns the real user-facing question. A worker proposes questions but never invents operator messages or answers.

## Reconcile and answer

After all sibling reports settle, compare their complete visible final assistant messages and referenced evidence before synthesis. Preserve disagreements and explain which evidence would resolve them. The final message is the result fact for each Light dispatch; this package does not define or require a separate durable Artifact type. Preserve the user's explicit output fields, exact values and requested format after verifying them; a paraphrase is not a substitute for an explicitly required line. Otherwise present the final advisory result in this order when applicable:

1. direct answer or recommendation;
2. supporting evidence;
3. alternatives and tradeoffs;
4. unknowns and limitations;
5. minimal remaining questions;
6. separately scoped execution next step.

The final result is consultation or evidence. It is not implementation, authorization, approval, compliance certification, or proof of an external effect.
