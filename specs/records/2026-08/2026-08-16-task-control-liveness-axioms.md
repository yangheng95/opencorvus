# Task-control liveness axioms

Date: 2026-08-16
Branch: `v0.0.45beta`

## Why

The control kernel that landed on 2026-08-15 (`627146cc`, `c4fe3fc5`) is sound on
safety: one reducer over immutable facts, one expiring lease, zero redundant
durable control state. It stated no liveness contract at all. Every control-plane
commit after it repaired a stall that absence permitted, and the reconciler
rewrite earlier today — which first made liveness a first-class obligation —
closed one instance of the problem without closing the class.

Three independent audits of the working tree agreed: the safety half is complete,
the liveness half is not. This record makes the liveness half explicit, states it
as axioms the implementation is checked against, and repairs every violation the
audits could reach.

## Axioms

Each task-epoch is a transition system over an append-only fact log. The
projection `π(F, now)` maps each ingress to one of ten states, and every state is
exactly one of: **terminal** (no wake owed), **operator-gated** (a legal resting
place that only an operator leaves), or **transient** (must carry a finite wake).

- **A1 Wake totality.** Every non-terminal state maps either to a finite instant
  or to an operator gate that is durably surfaced. A state with neither is
  indistinguishable from a deadlock.
- **A2 Edge coverage with a level backstop.** Every transaction appending a
  projection-affecting fact requests a scan; the heartbeat bounds the cost of a
  missing edge to latency, and sweeps only Tasks whose lifecycle can still
  enable an ingress.
- **A3 Well-founded retry.** Every automatic retry consumes a budget quantified
  over something the retry cannot create. Exhaustion enters a surfaced gate.
- **A4 Total projection.** `π` never throws on persisted facts; integrity
  violations reduce to `blocked`. Throws are reserved for infrastructure faults.
- **A5 Durable ownership.** "That actor is dead" is decided only through an
  expired durable coordinate, never process-local memory.
- **A6 Escape hatch.** Cancellation converges without a restart.

## What was broken, and what changed

**A4 — integrity violations escaped as faults.** The evidence reader threw on
four classes of persisted violation, and `eventForIngress` on eight more. Those
throws pre-empted the reduction's own `blocked/integrity_conflict` value: the
driver counted a fault, retried under backoff, and re-threw forever, so a Task
with immutable corrupt evidence was wedged and logged an error every sixty
seconds while the designed absorbing state was unreachable. Violations now raise
`TaskRootIngressIntegrityError`, caught at the fact store's single boundary and
reduced to `blocked`. Activation derives everything from immutable sources
*before* taking its lease, so a violation can no longer spend one of an
ingress's four activations per heartbeat.

**A1 — six states rested silently.** `taskRootIngressWakeInstant` returned
`undefined` for `blocked`, `waiting` without a deadline, `cancelling`, `closing`,
`exhausted`, and `reconcile_required`, and the scan armed nothing. An ingress
reaching `exhausted/semantic_limit` — three decision-less Turns — stopped with no
task-level error and no operator visibility, and FIFO head-of-line blocking
starved every later operator message behind it. `classifyTaskRootIngressWake` now
covers the union exhaustively with a compile-time `never` check, `cancelling` and
`closing` carry a finite reconciliation wake, and `blocked`/`exhausted` are
surfaced as deterministic infrastructure facts on first observation.

**A5 — cross-process false abandonment.** Abandonment recovery judged liveness
from two process-local registries. Since `eb22d13d` restored two backends sharing
one SQLite database the same night, backend B saw an empty registry for every
dispatch backend A owned, and would terminalize A's live workers, settle them as
infrastructure failures, and inject fabricated ingresses — every thirty seconds,
per Task. Each process now renews a `runtime_process` lease, each lineage records
the process occurrence that owes its delivery, and abandonment requires that
occurrence's lease to have expired. Local registries remain a fast path for this
process's own lineages.

**A2 — a settled dispatch could wake nothing.** Settlement is recorded before
the outcome reaches the Orchestrator. A failure in between left a settled
lineage, which abandonment recovery skips by definition, and no ingress: every
projection `resolved`, no timer owed, a permanent rest behind a database that
looks entirely healthy. A second sweep now replays such lineages, keyed to the
settlement artifact so replays dedupe.

**A3 — the infrastructure-failure loop had no measure.** A failed worker minted
a fresh artifact, hence a fresh ingress, hence a full 3-turn/4-activation budget,
hence another dispatch, hence another failure. Each cycle cost a whole
Orchestrator Turn and produced the next. The budget is now per epoch; beyond it
the failure is recorded and surfaced but no longer re-dispatched. Recovery
artifacts carry deterministic identities so crash replays collapse instead of
minting budget.

**A3 — driver pacing.** An unsettled fixpoint re-armed at the 25 ms minimum
(sixty-four full scans, sleep, repeat); `wakeAt` was overwritten per pass so a
later silent pass cancelled an earlier lease-expiry timer; and `failures` reset
on any progressing pass, so alternating fault/success never escalated. All three
are fixed; backoff now decays only after a fault-free window.

**A6 — cancellation needed a restart.** A convergence that failed midway left
`cancelling` forever, since reconciliation ran only at project bootstrap, and the
convergence lease was acquired by an unbounded 100 ms poll. The scan now
re-attempts convergence on every pass over a `cancelling` Task and the poll has a
deadline. The completion closure is released when the terminal transaction
refuses, instead of holding the Task uncompletable for two minutes while the
model retries into that window.

**Mixed decisions.** One assistant message containing `dispatch_agent` plus any
other decision tool reduced to a permanent `blocked` — reachable from ordinary
model output, since the tool coordinator allowed that ordering. The coordinator
now refuses the second, different decision while it is still a call; a refused
call leaves no receipt, so the turn can still decide, and `blocked` reverts to
being a backstop rather than a mechanism.

**Missing edges and contracts.** Task creation and coordination requests now
request a scan instead of waiting for the heartbeat; `deliverTaskRootIngress`
reports activations rather than a boolean that callers misread as "a drain
started"; and an activity-reconciliation gate refuses rejection with an
actionable error rather than throwing `NotFoundError` and leaving the Task
waiting on something nothing can resolve.

## Two defects found by the first real Task after the repair

A live Task (`tsk_g00VSOdFHt00m3XGSdwX`) died twice and could not be recovered.
Both causes sit outside the ingress reduction and neither was reachable by the
axioms as first stated.

**An integrity conflict killed the Task instead of blocking one ingress.** The
projection was made total, but the *write* fence
(`assertTaskRootAssistantActivationFenceInTransaction`) still threw an untyped
error when a second assistant Message claimed one continuation parent. That
throw escaped the Orchestrator Turn and `settleOrchestratorExecutionFailure`
terminally failed the Task. Rejecting the write is correct and stays; ending the
Task over it is not, because `blocked` plus its surfaced gate is exactly the
state an operator repairs and resumes from. The fence now raises
`TaskRootIngressIntegrityError` and that class no longer terminalizes the Task.

**Reopening could never recover a Task that had produced anything.** Git
checkpoints are keyed per epoch, so a reopened Task finds no baseline for its new
epoch and falls through to the immutable-creation-workspace comparison — where
its own epoch-1 output is guaranteed to differ from the creation digest. Every
reopen of a Task that did work therefore failed instantly with
`IMMUTABLE_CREATION_WORKSPACE_MISMATCH`. The guard is what its own message says —
the workspace must not be swapped between creation and the *first* execution — so
it now applies only to the first epoch, and a later epoch captures its baseline
from the current tree.

Together these made a single refused assistant append unrecoverable: epoch 1 died
on the fence, and the operator's reopen died on the workspace guard.

**Permission-continuation recovery was not convergent, and it held the first
project-scoped request for two minutes.** `resumeApprovedContinuations` replays
every approved continuation serially on project open. `recoverContinuation`
treated *every* thrown fault as indeterminate and left the request open, on the
stated grounds that recovery cannot distinguish a permanent fault from a
transient one. But `StaleContinuationError` is determinate: it says the Tool
surface, identity, classification or input no longer matches what was approved,
and nothing later can make a past approval match a changed surface again. Those
requests were therefore replayed in full on *every* project open, each failing
after roughly a third of a second.

Measured on the reporter's database: **341 stale continuations, replayed over
113.8 seconds**, with the first project-scoped request — the one the UI makes to
open a Task — completing one second after the storm ended. The retirement
primitive already existed and its own docstring names the property ("retirement
is what keeps recovery convergent: without it the same dead request is rescanned
by every later bootstrap"); it simply was not reached from this path. A stale
continuation now retires. The first open after the fix still pays the backlog
once as it retires each request, and every open after that is clean.

The activation fence had the same shape. It rejected continuations belonging to
a superseded epoch, a replaced lease or an already-consumed activation with an
untyped error, so recovery could not tell those — permanent by construction —
from a transient rejection such as an unexpired lease held elsewhere. Only the
permanent cases are now typed (`TaskRootActivationSupersededError`) and only
those retire; a transient rejection is still left open for a later attempt.

**A liveness probe could outlive its own question.** Resolving a
Task's browser-preview target is on the UI's open path, and it awaits a
reachability probe. The task-scoped probe answers that one-second question by
spawning a supervised child process, and every step around the fetch — capsule
resolution, spawn, `exited`, `outputSettled`, disposal — was unbounded. Measured
end to end against a live backend: `browser-preview` took **121s** while
`conversation` took 1.0s and `worktrees` 0.17s, which is exactly the "the Task
will not open and messages will not render" report. Output settlement has
stranded this runtime on Windows before (see the 08-11 worker-scheduler record).
The probe now carries a hard deadline raced where the handle is still in scope,
so an expired probe answers "not reachable" and disposes its child instead of
being abandoned to finish minutes later. A liveness probe on a read path must
never outlive its own question.

## Cost accounting

The heartbeat swept every non-deleted Task including completed ones, and ran the
abandonment sweep once per fixpoint pass rather than once per scan, at
`tasks × ingresses² × O(messages + interactions)` every thirty seconds. Both are
now scoped, a discarded evidence read is removed, and the interaction query is
Task-scoped. This is the direct source of the freezing the loops sat on top of.

## Deferred

Evidence-read memoization and indexing for the `json_extract` scans; unifying the
three lease-acquisition implementations and the two settlement recorders; the
cross-Task ownership chain where a dispatching Task becomes the owner of its
callee's scan; the three transports carrying one terminal fact; a convergence
routine for `closing`; and an operator affordance to dismiss a reconciliation
gate, which needs an evidence change to synthesize the resulting activity fact.
