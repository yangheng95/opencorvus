# Task-root no-action convergence

## Recall

- User request: diagnose the apparent duplicate handoff, scheduler hang and invalid wakes after the Task-root state-simplification refactor, obtain an independent review, choose the final design, and continue through root repair.
- Acceptance:
  - one lifecycle or conversational ingress that has been inspected but requires no new action resolves from one real visible typed decision receipt;
  - the same ingress is not immediately activated again and ordinary convergence never depends on `semantic_limit`;
  - a later worker lifecycle, operator, coordination or scheduled event remains a new independent ingress and wakes normally in First In, First Out (FIFO) order;
  - status/diagnosis replies remain visible participant prose but use the same typed receipt as their sole non-mutating completion authority;
  - scheduled `wait` retains its existing deadline/Automation semantics and is never overloaded as child polling or a no-timer park;
  - restart, concurrent reconciliation, Session occurrence reuse, Task/Mission paths and multi-project isolation remain fact-reduced and replay safe;
  - the debug projection distinguishes ingress identity and source from its activation history, semantic Turns, decisions and current reducer result;
  - focused positive tests, the production checker where Provider authority is available, and an uninvolved read-only review verify the current path.
- Hard constraints: keep the existing immutable-fact reducer, one reconciler, FIFO and expiring lease authority; add no mutable `idle`, `processed`, `waiting` or retry state; do not parse prose, infer workflow readiness in the Host, synthesize Messages, create a compatibility reader or overload `wait`; all Large Language Model calls remain streaming; no User Interface automation tests are added, changed or run; do not operate the user's running application or credentials without explicit authorization.
- Read material: `specs/current/architecture/task-control-plane.md`; `specs/records/2026-08/2026-08-15-task-root-fact-reduction-kernel.md`; `specs/records/2026-08/2026-08-15-task-root-parallel-decision-lock-convergence.md`; `packages/opencorvus/src/engine/task-root-ingress-reducer.ts`; `packages/opencorvus/src/engine/task-root-ingress-delivery.ts`; `packages/opencorvus/src/orchestrator/decision-tool-names.ts`; `packages/opencorvus/src/orchestrator/runtime-repair-tools.ts`; `packages/opencorvus/src/orchestrator/tools.ts`; `packages/opencorvus/src/prompt/core/orchestrator-core.txt`; the on-demand debug projection and existing reconciliation/Tool-result-control tests.
- Repository search:
  - the reducer resolves only completed recognized decision Tool receipts and intentionally treats prose-only final Turns as semantic attempts;
  - `reconcileTaskControlPlane` immediately activates the same FIFO head again while its projection remains `ready`;
  - the public decision set contains `dispatch_agent`, `respond_agent_coordination`, `manage_task`, `question` and scheduled `wait`, but no non-mutating completion decision;
  - lifecycle Prompt text requires a visible decision while the only no-frontier suggestion is `wait`; the `wait` contract separately forbids polling child completion and always represents a scheduled Automation wake;
  - conversation-only status/diagnosis Prompt text declares prose sufficient, contradicting the reducer and the fact-kernel requirement for a typed receipt;
  - the existing typed `immediate_park` Tool-result control already closes the physical assistant Turn without inventing a follow-up Message;
  - the supplied production bundle contains two lifecycle ingresses with one source event but three activation leases and three prose-only completed assistant Turns each, ending exactly at `semantic_turn_limit=3`; no duplicate source event, abnormal terminal worker occurrence or process incident is present.
- Existing uncommitted work: none at task start; `git status --short` was clean.
- Independent agent feedback: a fresh uninvolved read-only review confirmed the diagnosis with high confidence, rejected Host auto-settlement, prose heuristics, backoff and `wait` overloading, recommended one exclusive visible `no_action` Tool receipt, and identified the additional status/diagnosis Prompt contradiction. The same reviewer requires restart, FIFO, concurrency, Session reuse, multi-project, Mission and real streaming Provider coverage. A new uninvolved read-only delivery review remains mandatory after implementation and after every review-driven repair.

## Observed incident and root cause

The two apparent handoffs were not handoffs and were not independent wake events. Each group was one immutable lifecycle ingress repeatedly activated by the same synchronous reconciliation loop. The completed assistant Turns contained observation Tools and prose but no decision receipt. The reducer therefore counted one semantic Turn and returned `ready`; the reconciler acquired another lease after roughly one process tick. The third attempt reached the immutable semantic budget and projected `exhausted/semantic_limit`, allowing FIFO advancement.

The direct trigger is a completed prose-only assistant Turn for an unresolved ingress. The control-flow root cause is an incomplete decision algebra: the model has no legal visible Tool that says “this ingress is reconciled and requires no new action”. Prompt text makes this gap unavoidable when no ready frontier exists while a child remains active, and repeats it for status/diagnosis messages by declaring prose to be complete even though prose is deliberately not reducer authority.

The state-simplification direction remains correct. `semantic_limit` is an exceptional liveness fence for malformed or repeatedly undecided output, not the normal representation of quiescence.

## Canonical decision

Add one public Orchestrator Tool:

```text
no_action({ reason: non-empty string })
```

Its completed Tool request/outcome is the only durable fact. It is a `turn_control_exclusive` decision with completion effect `satisfies_current_epoch`, and its result carries the existing typed `{kind: "immediate_park"}` control. The reducer reads that exact assistant-owned receipt and projects the current ingress `resolved`.

`no_action` means that the current ingress has been fully inspected and requires no dispatch, coordination reply, Task/Delivery Slice mutation, operator question or scheduled external wake. It may also follow a visible status/diagnosis answer in the same assistant Turn. It does not create an Automation, Interaction, timer, worker action, Task lifecycle fact, future wake or durable park state. The current activation ends physically; only a later independently accepted ingress can run the scheduler again.

The input does not contain an ingress ID. Current ingress authority is already derived from the exact activation, assistant Message and control predecessor chain; copying it into model input would create redundant authority.

## Rejected alternatives

- Do not add `wait(mode=until_new_ingress)` or special duration/reason values. Scheduled wake and no-future-wake are opposite effects and must not share one ambiguous Tool contract.
- Do not have the Host infer that no workflow frontier is ready. That would duplicate package workflow judgment, hide missed work and create a second completion authority.
- Do not parse prose, reduce the semantic limit, add backoff or treat exhaustion as success. Those only change the visibility or timing of the same missing decision.
- Do not add mutable `idle`, `parked`, `processed` or retry rows. The completed Tool receipt already is the irreducible fact.

## Implementation

1. Define `no_action` in its own Orchestrator module with a strict `{reason}` schema, visible result, typed `immediate_park` metadata and exclusive execution mode.
2. Project it once into the public Orchestrator Tool surface and add it to the dependency-free decision registry. Its completed receipt uses `satisfies_current_epoch` through the existing evidence reader; reducer, lease and schema remain unchanged.
3. Rewrite the decision-epoch Prompt so execution-control no-op and status/diagnosis completion both require `no_action`; keep scheduled `wait` only for a named external event with a defensible duration and never for child polling.
4. Update current architecture and the fact-kernel record so `no_action` is the unambiguous non-mutating receipt.
5. Add a read-only Task-root ingress diagnostic endpoint used on demand by the clipboard bundle and real checker: ingress/source/sequence, activation identities/count, completed semantic Turn count, decision receipt IDs/commands and current reducer projection. Keep it off the normal Task Board hot path; projection failures return explicit `unavailable` and the bundle reports counts as unknown rather than zero.

## Positive verification

- Tool surface/result: production `no_action` is public, exclusive, returns visible reason and exact `immediate_park` control, and schedules no Automation or Interaction.
- Evidence/reducer: one completed exact receipt becomes one `DecisionFact(command=no_action)` and projects `resolved` with its request Part ID.
- FIFO: first ingress resolves through `no_action`; the second accepted ingress activates in the same reconciliation call, with activation order equal to sequence order.
- Lifecycle: a no-frontier lifecycle ingress activates once and resolves; a later distinct terminal lifecycle event creates and activates its own ingress.
- Conversation: a status/diagnosis answer and `no_action` share one assistant occurrence and settle once.
- Restart: reconstructed facts keep the old ingress resolved and allow only the later ingress to activate.
- Concurrency and isolation: simultaneous reconcilers produce one valid activation; reused Sessions bind the receipt to the exact activation/control chain; Task/Mission and separate Projects do not cross-settle.
- Regression: prose-only malformed output still uses the finite exceptional semantic fence; scheduled `wait` still persists a deadline Automation wake; Mission and Task `immediate_park` behavior remains unchanged.
- Real checker: in an isolated Project with an authorized streaming Provider, run two parallel workers, verify first-terminal `no_action`, second-terminal successor dispatch, status-only settlement, restart non-replay and scheduled-wait wake. Credential/model checks precede the run and credentials never enter output or this record.

## Completion record

Implemented the exclusive `no_action` receipt, terminal-conversation authority, Prompt convergence, on-demand debug endpoint/clipboard projection and real-provider checker assertions. The first independent delivery review found that terminal refusal results could be misread as completed decisions and that the debug projection was coupled to the normal Task Board hot path; both were repaired. Refusals now persist as typed Tool errors and do not enter `DecisionFact`, while diagnostics are computed only by the explicit debug endpoint and return `unavailable` instead of failing the Board. A second read-only review found no unresolved P0-P2 issue.

The official isolated runner passed the four focused files with 8/8 tests, the Tool-result-control regression with 26/26 tests and 69 assertions, and the related Protocol projection files with 3/3 tests. Full workspace typecheck passed for all eight packages that declare the check; `docs:check` passed with 333 operations in 25 groups; control-state redundancy passed with 43 tables and 7 allowed fact classes; `git diff --check` passed. The real streaming Provider checker was updated but not executed because this task had no authorization to use Provider credentials/model projection; that remains disclosed validation scope, not substituted by the local contracts.
