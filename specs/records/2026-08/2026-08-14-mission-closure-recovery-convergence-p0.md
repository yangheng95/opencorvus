# Mission closure recovery convergence P0

## Recall

- User requirement: investigate the scheduler incident without treating retry as the general root cause, define the
  smallest P0 repair, and implement it in a new worktree.
- Acceptance: after Mission abort, archive, or delete establishes `closing`, no previously materialized unanswered
  scheduler wake and no startup Mission process-recovery candidate may start another Mission model Turn. Every such
  occurrence must receive a durable terminal disposition tied to the exact closure event. Pending inboxes continue to
  use the existing `mission_closed` disposition, successfully answered wakes retain their existing receipt, and an
  explicit later operator reopen remains possible only after `closed`.
- Hard constraints: preserve streaming Large Language Model calls and the existing bounded Provider activity retry;
  do not redesign Provider retry, queues, Task ingress, Bus publication, User Interface projections, or the broader
  workflow architecture. Use the existing Mission execution closure event as authority, add no fallback or parallel
  recovery source, add focused positive non-UI tests, and preserve all unrelated worktree changes.
- Sources read: `specs/current/architecture/task-control-plane.md`, scheduler liveness/systemic repair records,
  Mission/Task duplex communication, Mission closure, scheduler delivery, Mission process recovery, Host startup
  recovery, Session wake, Session control, and focused scheduler/process-recovery tests.
- Whole-repository search: new Mission admission is owned by `openMissionExecution`; abort/archive/delete converge
  through `closeMissionExecutionOperation`; pending Mission scheduler inbox materialization already checks closure;
  `delivered + session_wake + unanswered` recovery in the signal drain, global poll, close drain, and startup project
  drain bypasses closure; standalone Mission process recovery also derives candidates from incomplete Assistant
  Messages or a pending marker without reading closure. Automation and Event schedulers target ordinary Assistant
  Sessions and are outside this Mission-only lifecycle boundary. Provider activity retry is a separate, bounded,
  single-owner path and no evidence connects it to the wake resurrection.
- Independent agent feedback: none before implementation. The first post-implementation read-only review found
  negative-core assertions, overclaimed coverage, historical closure-event acceptance after reopen, and two document
  wording mismatches. All were corrected; the second read-only review reported no findings and confirmed Provider
  retry remained unchanged.

## Root cause and impact

The current closure cut is incomplete. `closeMissionExecutionOperation` appends `closing`, cancels physical Mission
and child Task work, then invokes the generic scheduler drain. That drain first enumerates every delivered scheduler
wake whose exact Message has no successful Assistant reply and calls `SessionWake.resumePersistedWake` directly. The
enumeration and resume path do not consult `mission.execution.closure`, so abort can wait for a wake that its own drain
restarted. The same stale occurrence is discoverable after restart, and standalone Mission process recovery can create
a second recovery wake from the interrupted Assistant projection.

The direct trigger is therefore a missing closure fence at two recovery authorities, not retry policy. Existing
pending/leased inbox protection is correct but applies before Message materialization only. Provider activity retry,
capacity scheduling, Task ingress retry, and shutdown settlement may amplify duration or visibility after a wake has
been resurrected, but they do not create the illegal admission and are excluded from this P0.

## P0 design

1. Extend the scheduler delivery result with `mission_wake_closed(message_id, closure_event_id)`. It is the terminal
   disposition for a real scheduler Message that was already materialized before closure. Validation binds the inbox,
   exact Message wake provenance, recipient Session, and active `closing|closed` event.
2. In the transaction that appends the first `closing` event, convert every delivered unanswered scheduler wake for
   that Mission Session to `mission_wake_closed`. Successfully answered wakes are immutable history. This makes the
   closure cut and wake disposition atomically visible before physical cancellation begins.
3. Replace scan-then-resume with reconciliation under `withMissionExecutionAdmission`: re-read the exact inbox,
   successful reply, and current closure. Resume only an unanswered `session_wake` while the execution is open; if
   closure won, persist/reuse `mission_wake_closed`; if another owner already settled the occurrence, return that fact.
   Candidate scans and process-local drain signals remain latency hints only.
4. Fence standalone Mission process recovery with the same admission authority. A closing/closed Mission terminalizes
   interrupted Assistant Messages, atomically fails any pending recovery marker with the closure event recorded in its
   terminal payload, and returns `closure_settled`.
5. Preserve the close order after the atomic cut: cancel Mission prompt, cancel active child Tasks, await settlement,
   drain pending inboxes to `mission_closed`, then append `closed`.

## Verification

- Focused scheduler tests cover atomic `closing + mission_wake_closed`, exact Message and current closure-operation
  identities, answered-wake preservation, existing recovery ordering, and pending `mission_closed` behavior.
- Focused Mission process-recovery tests cover reconciliation while `closing`, incomplete Assistant terminalization,
  atomic pending-marker terminal failure, and the `closure_settled` result.
- Run the complete touched test files, package typecheck, repository documentation check, and `git diff --check`.
- A real Provider checker is required if the repository contains an existing checker that can exercise scheduler wake
  during Mission abort without changing credentials. Otherwise record the exact unmet external acceptance rather than
  substituting mocks for it.
- After first-pass verification, obtain mandatory independent read-only review and repeat it after any corrective
  implementation change until no finding remains.

## Progress

- [x] Isolated worktree and `codex/mission-closure-p0` branch created from current `origin/main`.
- [x] Current architecture, production entries, call sites, tests, and retry boundary investigated.
- [x] Implementation complete.
- [x] Focused verification complete: scheduler delivery 34/34, Mission process recovery 2/2, package typecheck,
      repository `docs:check`, and `git diff --check` pass.
- [x] Independent review complete with no unresolved finding after one corrective pass.
- [x] Commit, upstream merge, final verification, and push complete.
