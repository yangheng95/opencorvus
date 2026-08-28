# Mission acceptance delta closure

## Recall

### User request

Keep `Mission acceptance_resume` as an intentional reopen authority for the same completed or failed Task, Expert Squad, workflow lineage, and next execution epoch. Replace unbounded free-text repair with an evidence-bound acceptance delta, preserve accepted criteria, compact Task-root Orchestrator and affected worker Sessions at the epoch boundary, route only affected workflow obligations, make successful dispatch fan-out settle the current decision Turn, and retain one durable Provider/scheduler/Bus terminal authority.

### Acceptance metrics

- Every Mission resume binds the exact current terminal lifecycle reference, the current acceptance-ledger revision, a structured gap, completely read evidence, and existing workflow nodes.
- The visible Mission repair Message is rendered from the canonical gap; there is no second prose authority.
- The new epoch can dispatch only continuations whose workflow node is a responsible node or its downstream verification closure, and each continuation names the exact gap and criteria it consumes.
- Accepted criteria retain their original evidence locators in the append-only Task acceptance ledger.
- A repeated criterion can continue only with evidence added since the prior gap or a materially new requested action.
- Task-root Orchestrator and affected worker Sessions keep their physical lineage and create an existing compaction checkpoint before repair reasoning continues.
- A completed `dispatch_agent` decision set closes the Provider step without a follow-up `no_action` call; mixed decision sets remain fail-closed.
- Current Provider request/outcome and scheduler terminal reduction remain the only inactivity authority; no runner/UI observer gains a competing terminal write.
- Current Bus delivery is audited before any delivery-class change; no event may be written through two durable authorities.
- Focused positive tests, typecheck, architecture/docs checks, and the real Task-control checker must pass. Matched Luna benchmark token/cache/score metrics require a separately authorized live Provider run and are not fabricated by deterministic tests.

### Hard constraints

- All Large Language Model (LLM) calls remain streamed.
- Host validation is limited to identity, references, epoch, digest, ledger revision, workflow membership, and evidence novelty. It does not choose a worker or business verdict.
- No fallback, compatibility protocol, hidden summary, synthetic participant Message, parallel Task lifecycle, or call-count cap.
- Artifact read references remain physical-Turn capabilities; the ledger stores canonical locators, not read tokens or copied Artifact bodies.
- Existing unrelated dirty-worktree changes are preserved. In particular, pre-existing edits in `session/index.ts` and `session/loop.ts` belong to another task; this task may add a minimal compatible hunk but must stage only its own patch.
- No live benchmark, Provider credential use, process restart, window operation, release, tag, or pull request is authorized by this request.

### Materials read

- `specs/current/architecture/task-control-plane.md`
- `specs/current/architecture/project-memory.md`
- `specs/current/architecture/06-provider.md`
- `specs/records/2026-08/2026-08-05-mission-acceptance-evidence-and-source-task-resume-design.md`
- `specs/records/2026-08/2026-08-15-task-root-compaction-and-artifact-causality-convergence.md`
- `specs/records/2026-08/2026-08-15-task-root-parallel-decision-lock-convergence.md`
- `packages/opencorvus/src/task-api/index.ts`
- `packages/opencorvus/src/orchestrator/{agent,event,dispatch-agent-tool,dispatch-turn-projection,tools}.ts`
- `packages/opencorvus/src/session/{compaction,control,loop,processor,provider-activity-facts}.ts`
- `packages/opencorvus/src/agent/runner.ts`
- `packages/opencorvus/src/engine/{task-root-ingress-delivery,workflow-binding-facts,engine.sql}.ts`
- `packages/opencorvus/src/bus/{index,bus-event,bus.sql}.ts`
- the existing focused Mission resume, Task-root decision, Provider activity, and Bus durable-outbox tests.

### Repository-wide search result

- `resumeMissionTask()` already owns the required Mission lineage, terminal-reference, complete-read, cancelled-state, epoch, visible Message, ingress, receipt, and idempotency transaction. It is retained.
- `task-control-plane.md` line 61 incorrectly calls the operator the only reopen authority even though production has the separate `mission.acceptance_resume` source.
- The production panel schema still accepts `text + evidence_read_refs`; no structured criterion or ledger revision exists.
- The Task-root reducer already accepts multiple sibling `dispatch_agent` receipts as one decision set. The remaining extra-call defect is physical: `SessionProcessor` retains a Task-root assistant on every Tool-call finish before consulting the durable decision receipt callback.
- Worker continuation already carries a structured immutable `DispatchTurn`, exact evidence locators, and the same physical Session. Existing `SessionCompaction` and `SessionControl` can create a real visible append-only checkpoint before the next Provider call.
- Orchestrator system input already has stable leading blocks, but the live Task block is rebuilt in full on every Provider step. A canonical snapshot cursor plus changed-fact tail can reduce fresh input without freezing state.
- Provider activity already has a write-ahead request and exactly one terminal outcome; late real outcomes after recovery are logged without overwriting the recovery receipt. Scheduler observers must continue to observe these durable facts rather than terminalize them independently.
- Bus already separates ordinary local publication from explicit durable outbox publication. Delivery-class typing is not present on `BusEvent`, but changing every event without a consumer/effect audit would widen risk; the audit must classify actual production subscribers before implementation.

### Independent agent feedback

None before implementation. After the first verified implementation, an independent read-only agent found four P1 defects: later Provider steps lacked their full Task-projection baseline; a second same-epoch worker continuation could collide with the first checkpoint's immutable source Message; a prior open criterion could disappear from the next ledger revision; and a continuation could omit the canonical criterion obligation/evidence. The implementation was corrected to carry a frozen full baseline beside every later delta, confirm an existing epoch checkpoint before creating one, enforce exact prior-criterion disposition, and derive the persisted worker obligation/evidence from the current ledger. A second independent read-only review confirmed all four findings closed and found no new P0/P1.

## Problem analysis

### Observable phenomenon

Mission acceptance can correctly reopen a completed or failed Task, but the next epoch receives a free-text repair request and a flat evidence list. The scheduler and workers must reconstruct passed/failed obligations from the entire transcript and Artifact catalog. In long repair chains this causes broad rereads, repeated verification, duplicate reports, rising fresh input, and repeated decision calls after dispatch already committed the current decision.

### Direct triggers

1. `panel.resume_task` exposes `text` instead of a typed acceptance delta.
2. `missionAcceptanceResume` carries only the reviewed terminal reference and a flat locator list.
3. No Task artifact projects the current accepted/failed criterion ledger revision.
4. `dispatch_agent` has no active-gap identity or criterion obligation in its continuation authority.
5. Task-root Tool-call completion is retained unconditionally even after a durable dispatch decision exists.

### Data/control-flow root cause

The lifecycle authority is correct, but acceptance obligation is not a first-class fact. Transport is incremental while obligation is still inferred from history. Because no canonical ledger/gap joins Mission review, Task epoch, workflow node, continuation dispatch, and evidence revision, every participant reconstructs that join independently. The physical session loop then treats all Tool-call steps alike, so a decision-bearing dispatch step follows the same continuation path as a read-only Tool step.

### Why older paths did not cure it

- Exact terminal references and complete Artifact reads prove provenance, not which criteria remain open.
- Incremental continuation prose prevents resending the original request, but does not prevent resending the whole obligation set.
- Sibling-dispatch decision reduction prevents a host fault after receipts exist, but does not stop an unnecessary later Provider step.
- Token-triggered compaction protects overflow, but does not create a semantic checkpoint exactly when execution epoch changes.
- Prompt instructions can ask for narrow repair, but cannot make criterion/node/evidence identity durable or reject drift.

### Impact surface

- Public contract: Mission panel tool schema and prompt instructions.
- Durable facts: `missionAcceptanceResume`, resume receipt, new acceptance-ledger Artifact revision.
- Scheduling: dispatch continuation input, immutable `DispatchTurn`, workflow-node validation, Task-root decision completion.
- Session context: Orchestrator and worker compaction controls and checkpoint focus.
- Projection: panel Task query and Orchestrator wake/live Task input.
- Tests/docs: Mission resume, ledger/repeat convergence, continuation scope, compaction, decision Turn, architecture.
- Provider/Bus: read-only horizontal audit unless a concrete competing terminal/delivery authority is found.

### Excluded or unknown

- Matched Luna p50/cache-hit/score results are unknown until a separately authorized real benchmark uses identical cases, model, configuration, and preserved slot receipts.
- The benchmark branch's 21 outer 600-second timeouts are evidence of the older run, not proof that the current branch still has a competing terminal writer.
- Bus lease amplification magnitude on the current branch is unknown without runtime event/subscriber counts. No speculative all-event migration is allowed.

## Canonical contract

### Reopen authorities

Only these inputs may open `epoch + 1`:

1. Explicit operator Message: completed, failed, or cancelled.
2. Mission acceptance resume: completed or failed only, exact current terminal reference, current ledger revision, completely read evidence, real visible Mission Message, and one structured gap.

Scheduler delivery, coordination, recovery, late Tool/Provider outcome, and local observation must match an already-open epoch and never reopen a Task.

### Acceptance gap

The canonical stored gap contains:

- one stable `gap_id` and the reviewed terminal lifecycle reference;
- failed, unresolved, or stale-evidence criteria;
- relied and contradictory canonical evidence locators;
- one existing responsible workflow node and required new evidence kind per criterion;
- preserved acceptances with their original locators;
- one bounded requested next action;
- repeated-gap provenance and convergence disposition where applicable.

The public Mission tool uses current-Turn `artifact_read_ref` values. The Host resolves them to canonical locators and renders the visible Message from the parsed gap. It stores no independent free-text repair authority.

### Acceptance ledger

`task_acceptance_ledger` is an append-only Engine Artifact lineage. Each revision points to the prior revision Artifact, names the new execution epoch, stores the exact resume gap, and preserves prior accepted evidence. It does not copy Task/Session status or Artifact bodies.

### Differential continuation

During an active repair epoch:

- initial worker dispatch is invalid because the workflow occurrence already exists;
- a continuation must name the current `gap_id` and one or more open `criterion_id` values;
- the target node must be the criterion's responsible node or a downstream node in the immutable selected workflow;
- the persisted `DispatchTurn` carries the gap, ledger revision, criteria, and epoch checkpoint requirement;
- the worker receives only the visible continuation delta and exact changed evidence locators.

### Epoch checkpoint

After the Mission repair Message/control Message is durable and before repair reasoning:

- create an automatic existing compaction request with `overflow=true` for the Task-root Orchestrator Session;
- create the same existing compaction request on every affected worker continuation after its new visible user Message is durable and before its Provider call;
- focus names the Task authority, workflow/dispatch lineage, ledger revision, preserved criteria, current gap, evidence locators, unresolved requests, and known unknowns;
- exact values remain in the current visible Message/DispatchTurn/Artifact locators even if the natural-language checkpoint is lossy.

### Decision Turn

At the end of a streamed Provider step, all sibling Tool outcomes are already durable. If the current Task-root assistant owns a valid decision receipt, it completes immediately. `dispatch_agent` siblings therefore settle as one decision set without requesting `no_action`. A Tool-call step without a decision remains eligible for another Provider step. Mixed decision tools remain rejected before a second durable receipt.

## Implementation sequence

1. Add canonical schemas, ledger helpers, rendering, current-revision projection, and workflow-node/repeat validation.
2. Replace panel resume free text with structured input and write the gap, new epoch, ledger revision, visible Message, ingress, and receipt atomically.
3. Bind active repair gaps to continuation dispatch and create epoch compaction controls for Orchestrator and workers.
4. Let the durable Task-root decision callback veto ordinary Tool-call continuation at step settlement.
5. Split stable Orchestrator prefix from first full live projection and later canonical changed-fact tails.
6. Update architecture/prompt/docs and run focused positive contract tests plus the real Task-control checker.
7. Perform an independent read-only delivery review, fix every valid finding, rerun affected checks, commit, merge upstream, inspect `upstream..HEAD`, and push.

## Verification matrix

| Surface | Positive evidence |
| --- | --- |
| Gap schema | valid failed/unresolved/stale criteria parse; duplicate/overlapping criteria map to typed errors |
| Resume transaction | exact current terminal + ledger revision opens one epoch and writes visible Message, ledger, ingress, receipt |
| Repeat convergence | changed locator or new action admits repair; repeat history is projected |
| Differential dispatch | responsible/downstream continuation persists gap and criteria; affected worker keeps Session identity |
| Epoch boundary | Orchestrator and worker continuation each consume a real compaction control before model work |
| Decision Turn | multiple dispatch receipts close the current assistant step; a read-only Tool step still continues |
| Prompt economics | first projection is full; subsequent projection is a cursor-bound canonical fact delta |
| Provider terminal | request/outcome recovery tests prove one outcome authority and late-outcome behavior |
| Bus | durable-outbox tests plus subscriber/effect audit prove no second terminal authority is added |
| Runtime | `check:task-control-real` exercises the real development control path without UI automation |

## Delivery record

- Implemented structured public `acceptance_gap` input, canonical locator materialization, append-only `task_acceptance_ledger` revisions, exact Mission-authored repair Messages, and one atomic epoch/ledger/Message/ingress/receipt transaction.
- The transaction-level test exposed and fixed a root-ingress self-wait: acceptance now releases its physical root owner before synchronously reconciling the persisted ingress.
- Implemented ledger-derived affected workflow continuations, full canonical criterion/evidence projection, root/worker epoch compaction controls, frozen full Task baseline plus canonical delta, and durable decision-step settlement without a synthetic `no_action` call.
- Removed the outer Task-control child stdout-silence kill and the competing Orchestrator prompt inactivity wrapper. Scheduler phase fences now suspend while delegated Provider/Tool execution owns terminal authority. Bus remains on its existing explicit local-publication versus durable-outbox split because the subscriber/effect audit found no second authority introduced by this task.
- Regenerated the SDK/OpenAPI closure with `bun ./packages/sdk/js/script/build.ts`. Owned generated changes are `packages/sdk/openapi.json`, `packages/sdk/js/src/gen/sdk.gen.ts`, and `packages/sdk/js/src/gen/types.gen.ts`; `defaults.ts` and `route-policy.ts` remained unchanged. Regenerated both API reference indexes with `bun run docs:api`.
- Verification: 37 focused Mission/Task/Session/scheduler/Provider/Bus tests passed after the repair review; the corrected Orchestrator expectation then passed independently. Root `bun run api:routes-check` passed (6 rules, 34 files), `bun run docs:check` passed (338 operations, 25 groups), root `bun run typecheck` passed (8/8 workspace tasks), and `git diff --check` passed.
- Independent review round one: four P1 findings, all fixed. Independent review round two: no P0/P1 and all prior findings closed. Neither review modified files or delegated further.
- Not run: live Provider Task-control checker and matched Luna benchmark. They require separately authorized Provider credentials/model projection and identical benchmark cases. No token/cache/score claim is made from deterministic evidence.
- Commit, upstream merge inspection, and push evidence are recorded in the final delivery response because their identities do not exist until this document is staged.
