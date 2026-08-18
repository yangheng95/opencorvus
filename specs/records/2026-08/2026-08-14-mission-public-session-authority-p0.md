# Mission public Session authority P0 (batch 3)

## Recall

- User requirement: continue the Mission scheduling P0 in bounded repair batches and fix the next verified production
  gap in the existing isolated worktree.
- Acceptance: a Mission can be created, opened/resumed, aborted, archived, or deleted only through the canonical Mission
  operations. Public generic Session execution routes return one typed authority error for a Mission instead of
  starting, queueing, compacting, or cancelling its physical Session. The Overlay sends an active Mission continuation
  and its in-flight stop through `mission.wake` and `mission.abort`. Ordinary Assistant, Task, Provider-capacity, and
  retry behavior remains unchanged.
- Hard constraints: preserve the first two batches' closure events, occurrence admission, activation receipt, and
  durable scheduler dispositions; do not add a compatibility path or a second Mission queue; do not change Provider
  retry policy; preserve streaming model execution; add positive non-UI typed-error and production-route tests. Since
  the Overlay transport owner changes, verify the real page visually without creating or running UI automation.
- Sources read: both prior P0 Recalls, `specs/current/architecture/task-control-plane.md`, public Session and Mission
  routes, Mission Session identity and closure admission, `TaskQueueService`, Session wake and prompt ownership,
  Overlay chat/task submission, Work Ledger identity projection, Composer stop handling, Mission client operations,
  current SDK contracts, and server NamedError serialization.
- Whole-repository search: `session.prompt`, `session.prompt_async`, `session.summarize`, `session.init`,
  `session.command`, and `session.shell` can execute a Mission Session without Mission occurrence admission;
  `session.abort` cancels only Session prompt/queue ownership and never appends Mission `closing|closed`;
  `session.create(kind=mission)` and forking a Mission can bypass canonical Mission identity; generic Session delete or
  archive bypasses the joinable Mission close operation. `TaskQueueService` is reached by the public Session prompt and
  compaction routes only, and its durable async row has no Mission occurrence identity. The Overlay's active Session
  continuation and stored chat abort target use those generic routes even when the Work Ledger identifies the Session
  as a Mission. Read-only Session projections, generic configuration editing, transcript editing, Task occurrence
  ingress/cancellation, scheduler Automation/Event admission, Provider capacity, and Provider retry are separate from
  this execution/lifecycle bypass and are excluded from this batch.
- Independent agent feedback: none before implementation. An uninvolved read-only agent must review the complete
  implementation, tests, documentation, and visual evidence after first-pass verification; every valid finding must be
  fixed and re-reviewed.

## Root cause and impact

The first two batches made the canonical Mission entrances closure-safe, but public Session routes still treated
`kind=mission` as an ordinary Assistant. That gives one physical Session two operator control planes. A generic async
prompt can persist a queue row without the Mission occurrence identity and be claimed after close/reopen; generic abort
can stop the model without establishing durable Mission closure; generic create/fork can construct a Mission Session
without the canonical Mission identity transaction. The Overlay used this parallel path for active Mission follow-up
messages, so the bypass was reachable in normal product use rather than only through an unsupported SDK call.

This is an entrance-ownership defect. No retry branch is required to trigger it, and changing retry classification
would not remove the second control plane.

## P0 design

1. Define one typed `MissionSessionAuthorityError` containing the exact generic operation, canonical Mission operation,
   and available Session/Mission identity. Central helpers reject public `kind=mission` creation and public execution or
   lifecycle mutation of an existing Mission Session.
2. Apply that authority before generic Session create/fork, prompt sync/async, init, summarize, command, shell, abort,
   delete, and archive execution. Title-only Session metadata updates, configuration editing, transcript editing, and
   reads remain outside this batch.
3. Guard `TaskQueueService` prompt/compaction admission as the physical backstop so it accepts only ordinary Assistant
   Sessions; it must never acquire a Mission business lifecycle or invent an occurrence binding.
4. Route Overlay follow-up submission by the Work Ledger's exact Session identity. A Mission row calls `mission.wake`
   with its `missionID`, directory, product pillar, attachments, and selected model; the request state carries a Mission
   abort target so stop calls `mission.abort`. Ordinary conversation and Task paths keep their existing transports.
5. Keep dedicated Mission wake/abort behavior unchanged: operator wake may open/reopen under Mission admission and
   releases at physical prompt activation; abort appends and joins the durable close operation.
6. Document that generic Session APIs are not a second Mission operator surface. No fallback from a rejected generic
   request to an unbound queue row is retained.

## Verification

- Positive authority tests assert exact typed errors for public Mission create and every execution/lifecycle operation,
  including the canonical replacement operation and exact durable identity.
- Production HTTP tests submit a real generic async prompt and abort against a canonical Mission Session and assert the
  serialized typed error contract; a dedicated Mission wake/abort test proves the canonical replacement remains live.
- TaskQueue tests assert direct Mission prompt/compaction admission resolves to the same typed contract.
- Existing Mission route, closure/recovery, scheduler admission, ordinary async Session queue, and Overlay type/build
  checks remain green. Do not alter or broaden retry tests.
- Start the real development application on an isolated port, open a Mission, send a follow-up through the Composer,
  stop an active Mission request, and visually inspect the Mission conversation/Composer before and after. Do not add or
  run UI automation.
- Run package typechecks, the repository documentation check, and `git diff --check`; then obtain mandatory independent
  read-only review and repeat review after fixes until no finding remains.

## Progress

- [x] Public Session, Mission, TaskQueue, Overlay, lifecycle, and recovery call surfaces horizontally audited.
- [x] Batch-3 root cause, boundary, exclusions, and acceptance recorded before implementation.
- [x] Implementation and focused positive verification complete: the new authority suite passed with 3 tests and 41
      expectation calls; the seven-suite Mission/closure/scheduler/TaskQueue regression set passed with 67 tests and 297
      assertions; OpenCorvus and Overlay typechecks, the Overlay production build, generated API documentation check,
      and `git diff --check` passed.
- [x] Real-page Mission continuation/stop visual verification complete on isolated ports with an isolated local
      OpenAI-compatible streaming provider and no user credentials. The Composer opened the Mission through
      `mission.wake`, displayed `Running`, retained the streamed `BATCH3_STREAM_STARTED` content, and Stop settled the
      Mission to `Not running`. The first pass exposed a contradictory local AbortError dialog; local operator abort is
      now treated as successful Stop completion, and the rebuilt page was rechecked with an empty Composer and no
      failure dialog. One unrelated existing overlay-log drain timeout remained in the isolated console; it did not
      affect Mission execution, closure, or rendered state.
- [ ] Independent review reports no unresolved finding.
- [ ] Commit, upstream merge, final verification, and push complete.
