# Task-root compaction and Artifact causality convergence

## Recall

- User request: diagnose the newly stuck Task, identify what surfaced beyond the already-completed Task-root state simplification, and repair the real shared causes.
- Acceptance:
  - automatic or manual compaction never mutates an accepted Task-root ingress Message; one completed compaction summary owns its append-only checkpoint Part and remains the sole Session `MEMORY.MD` source;
  - the production Orchestrator Tool projection contains the existing typed `no_action` decision whenever the prompt requires it, so a status/lifecycle settlement can complete without semantic-limit repair loops;
  - completed Artifact catalog/read/selection facts from Provider steps before the exact current Tool request are visible inside the same retained assistant Message, while every same-step sibling and later physical Turn remains outside authority;
  - a pending compaction control owned by an unexpired durable lease enters idle standby and wakes once at lease expiry instead of spinning the Session loop;
  - direct Task, Mission-created Task, lifecycle/operator ingress, normal/terminal paths, restart recovery, serial/parallel execution and separate Projects keep their existing reducer and lease boundaries;
  - focused production-path tests, package checks, documentation checks and an uninvolved read-only review finish with no unresolved finding.
- Hard constraints: preserve accepted-ingress immutability, streaming-only model interaction, immutable Tool/Provider receipts, one current implementation and one fact source; do not weaken validation, add a compatibility read, synthesize Messages, parse prose, broaden Artifact capability scope across a physical Turn, add/run User Interface automation, restart the user's live application, or mutate its runtime database.
- Read material: `specs/current/architecture/project-memory.md`; `specs/current/architecture/task-control-plane.md`; `specs/records/2026-08/2026-08-15-task-root-no-action-convergence.md`; `specs/records/2026-08/2026-08-15-task-root-decision-repair-and-stage-tool-identity.md`; Session compaction, Message projection, Task-root reducer, Orchestrator Tool-pool projection, Artifact fact resolution and their focused tests.
- Whole-repository search:
  - `SessionCompaction.process` creates a `CompactionPart` whose `messageID` is the source user Message, and `Session.publishCompactionCheckpoint` atomically updates that Part after the compaction summary completes;
  - every non-Tool Part write to a user Message calls `assertAcceptedIngressMessageMutable`, so an accepted Task-root source deterministically throws instead of publishing the checkpoint;
  - Session memory, compaction input/pruning and model-message filtering all identify a completed checkpoint through that source-user marker, so the writer and every reader must move together rather than adding a fallback;
  - `createNoActionTool` and the Orchestrator prompt already define the typed decision, but the canonical scheduler base/projectable Tool ID lists omit it, which makes the real Provider call fail as unavailable;
  - Artifact reference resolvers restrict facts to assistant Messages strictly before the current assistant. After the retained-assistant repair, earlier completed Tool outcomes in the same assistant are therefore invisible even though their Part order is durable;
  - every production Tool wrapper already carries the exact current `toolPartID`, which can locate its persisted Provider `step-start` and define a strict step-level causal boundary without model inference or global widening.
- Existing work: `git status --short` was clean before this record.
- Independent agent feedback: none before implementation. A previously uninvolved read-only delivery review is mandatory after focused verification and after any review-driven repair.

## Observed facts and diagnosis

The supplied bundle was a snapshot before the fatal transition: ingress sequence 2 had reached the exceptional semantic limit, sequence 3 was leased and sequence 4 was ready. Read-only inspection of the same local database later showed sequence 3 complete, sequence 4 accepted and activated, then an automatic compaction summary. Publication failed immediately with `Accepted ingress Message ... is immutable`; epoch 1 persisted `task.failed`, and Mission subsequently reopened epoch 2. The bundle's earlier `active/streaming` state and the later failed epoch are temporal observations, not proof that either unavailable value was zero.

The same durable history contains a failed `no_action({})` request whose Tool outcome says that `no_action` was not in the available production Tool set. That failure generated three decision gaps and `semantic_limit`; prompt intent and raw Tool registration existed, but the capability projection contradicted them.

A retained Orchestrator assistant also completed `artifact_search`, then attempted four `artifact_read` calls with the returned locator references. Each failed because the resolver only admitted facts from an earlier assistant Message. This is a causal-projection defect introduced by moving repair steps into one retained assistant, not an Artifact content defect and not authority to reuse refs after a crash or successor activation.

Unavailable data remains unknown: the current solution-architect outcome was not inferred, the live process was not restarted, and no claim is made that the user's rendered state refreshed after the database observations.

## Canonical repair

1. The completed summary assistant owns its `CompactionPart`. Its `parentID` remains the exact source user Message; after validated summary completion, the Part carrying tail/anchor/focus metadata is appended atomically in its own checkpoint transaction. A process cut may leave an unmarked summary, which every checkpoint reader ignores while the pending control remains retryable. Accepted input is never updated.
2. `no_action` belongs to the canonical Orchestrator private/base/projectable Tool pool used by production resolution. The prompt, raw definition and projected capability therefore share one Tool ID authority.
3. Artifact resolution takes the exact current Tool Part identity to locate its persisted Provider `step-start`. It admits only completed locator-producing Tool outcomes in the same control-parent Turn that precede that exclusive step boundary. This includes earlier Provider steps in one retained assistant, excludes every same-step parallel sibling regardless of completion order, and preserves the existing physical-Turn parent boundary.
4. Compaction lease contention returns a typed persisted expiry. The Session immediately enters idle standby, ignores only that exact already-observed control during the waiter re-read, and schedules one expiry wake; other user, runtime and newly-created control wakes remain live. A renewed lease supplies its new expiry on the next atomic acquisition attempt.

## Horizontal audit and verification plan

- Task/Mission/Session: direct and Mission-created Task-root compaction share `Session.publishCompactionCheckpoint`; ordinary Chat/Work compaction uses the same writer. All become append-only without a Task-only bypass.
- Normal/terminal: successful summary, empty/error summary, manual summarize, predictive compaction, lifecycle `no_action`, valid dispatch/wait and terminal decisions retain typed outcomes.
- Retry/restart: completed checkpoint and Tool outcomes remain immutable; a new physical assistant must mint new Artifact refs. An unexpired old compaction lease parks until its durable expiry and then admits one successor owner; no semantic budget or lease is reset.
- Serial/parallel: the exact current Provider step boundary admits only prior-step facts; concurrent sibling requests do not observe each other's outcomes even when one finishes first. Existing parallel dispatch decision sets remain unchanged.
- Multi-project isolation: Session, parent Message, Task and Project checks remain required; no global mutable cache or relaxed locator lookup is introduced.
- Positive tests:
  - real Session compaction publishes a summary-owned checkpoint when the source user Message is accepted Task-root ingress, reads `MEMORY.MD`, and continues without lifecycle failure;
  - production Orchestrator Tool projection contains and executes `no_action` under the existing decision receipt contract;
  - one retained assistant persists `artifact_search`; a same-step sibling read cannot consume that result even when search completes first, while a next-step read resolves it and an explicitly malformed reference returns the typed resolution error;
  - one stale unexpired compaction lease causes zero Provider executions before expiry and exactly one successor execution/settlement after the single standby wake;
  - official isolated focused tests, package typecheck, docs/API/control-state checks and `git diff --check` pass.

## Completion record

- Implemented one summary-owned compaction checkpoint representation across the writer, Session memory, compaction selection/repeat handling, Message pruning and Session-loop recovery. The public Part writer and SQLite trigger still reject ordinary writes after assistant completion; only `Session.publishCompactionCheckpoint` can atomically append the one validated checkpoint to a completed compaction summary. The accepted Task-root source user Message remains unchanged.
- Replaced compaction lease-contention `continue` with a typed expiry and idle standby. The waiter ignores only the exact leased control, retains every unrelated durable wake, clears its timer on settlement/abort, and retries one atomic acquisition at expiry rather than touching the database in a tight loop.
- Added `no_action` to the canonical Orchestrator private/base/projectable Tool ID authority. The production projected scheduler surface now executes its typed `immediate_park` receipt.
- Propagated exact current Tool Part identity through ordinary Artifact Tools, Orchestrator projected Tools, Architect output, Mission panel read/resume/completion, Mission completion projection and plugin publication. The shared resolver validates that Tool request, locates its preceding persisted Provider `step-start`, and admits only completed producer facts before that exclusive step boundary in the same control-parent Turn.
- Official isolated runner passed 64/64 tests and 223 assertions across `session-memory`, Artifact provider-reference/input, Mission panel terminal authority, Tool-result control, schema contract, Tool fact storage, SessionLoop Tool authority and Research Studio package suites. Root `typecheck` passed 8/8 packages; `docs:check` passed 333 operations/25 groups; route inventory passed 6 rules/34 files; control-state redundancy passed 43 tables/7 fact classes; `git diff --check` passed.
- The uninvolved read-only review found and verified two P1 repairs. First, current Tool Part order allowed a faster same-step parallel Tool result to leak to its sibling before the model had consumed it; the boundary is now the exact persisted Provider `step-start`, with same-step rejection/next-step visibility coverage. Second, an unexpired old compaction lease returned `continue` and tight-looped until expiry; it now enters idle standby and wakes once at the durable expiry, with positive zero-before/one-after execution coverage. After the 500ms Windows/continuous-integration fixture stabilization, the reviewer independently reran `session-memory` (11/11, 34 assertions), root typecheck (8/8) and diff check and reported no unresolved P0–P3. The earlier complete 9-file review also passed.
- No real Provider request was run because use of the user's Provider credentials/model was not authorized for this repair. No live application process was restarted and no runtime database was mutated.
