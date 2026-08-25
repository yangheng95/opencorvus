# Repository Architecture Debt Remediation

## Recall

| Item | Record |
| --- | --- |
| User request | Switch the repository to `0.0.55beta`, then fix the problems recorded by the whole-repository architecture-debt saturation audit. When asked for scope, the user chose **all 36 findings, advanced stage by stage in the recorded dependency order**, on a **dedicated remediation branch** rather than directly on `main`. |
| Source of findings | [2026-08-24-repository-architecture-debt-saturation-audit.md](2026-08-24-repository-architecture-debt-saturation-audit.md). That record is the single finding authority: 26 `P1` and ten `P2`, no proved `P0`, independently reviewed `PASS`. This record does not restate its evidence; it owns only the repair. |
| Acceptance metrics | Each stage removes the audited broken authority rather than masking it; every touched capability keeps exactly one implementation and one fact source; no fallback, compatibility layer, dual read/write, shadow state or host routing gate is introduced; non-UI changes carry focused positive tests; UI changes carry real-page visual evidence; each stage ends with the repository checkers that cover its surface, an uninvolved read-only review, and a scoped commit. |
| Hard constraints | `AGENTS.md` applies in full. No UI automation test may be added, modified or run; existing ones found in touched paths are deleted with their fixtures. Preserve unrelated worktree changes. Do not restart, close or kill the user's running application, windows or processes. Credentials never enter prompts, logs, specs or commits. `specs/` is `.gitignore`d, so every record in this campaign is staged with `git add -f`. |
| Sources read before this record | `AGENTS.md`; `RELEASE.md`; `package.json`; `CHANGELOG.md`; `specs/records/2026-08/README.md`; the full saturation-audit record including its ledger, per-finding evidence, dependency order and verification log; `packages/overlay/src/main.tsx`, `packages/overlay/src/services/workspace.ts`, `packages/overlay/src/store/settings.ts`, `packages/overlay/src/services/task.ts`, `packages/overlay/src/services/chat.ts`. |
| Repository search | `rg` over the tracked tree for the renderer global ABI (`persistOverlaySettings`, `window.appStore`, `window.boardStore`, `window.settingsStore`, `window.applyDirectory`, `window.loadTasks`, `window.selectTask`, `window.loadBoard`, `window.cardTree`, `renderConversation`, `openWorkspaceDiff`, `__overlayInitSettled`, `__overlayTest`, `__ocOverlayTiming`, `__ocNextChatMetadata`) returns five files, all inside `packages/overlay/src`. The Tauri host source consumes none of them. No tracked script, checker, benchmark or test reads them. The previously recorded untracked `packages/opencorvus/script/benchmark/` path no longer exists in the worktree, so no untracked consumer is at risk. |
| Prior authority on stage 1 | [2026-08-13-cs010-overlay-renderer-global-surface.md](2026-08-13-cs010-overlay-renderer-global-surface.md) planned the same repair and was never implemented. Its acceptance target, hard constraints and surface inventory are adopted here; that record is superseded by this one and must not be implemented separately. |
| Independent agent feedback | Stage 1 received an uninvolved read-only review that returned twelve findings. Every one is dispositioned in the stage-1 section below: nine were repaired in this change, two were recorded as deliberate decisions with reasons, and one was carried forward as a new finding. |

## Version state

`bun run version:bump 0.0.55beta` synchronized the release family to `0.0.55-beta`; `bun run version:check` reports `Release-family versions aligned at 0.0.55-beta`. `CHANGELOG.md` keeps an empty `未发布` section for this campaign's user-visible entries. Version metadata is the only change carried into this branch from before stage 1.

## Stage plan

The audit's dependency order is the execution order. A stage may not start before the previous stage is verified, reviewed and committed, because later stages consume the vocabulary the earlier ones establish.

| Stage | Findings | Outcome that ends the stage |
| --- | --- | --- |
| 1 | ARC-030 | The release renderer exposes no live store, no secret and no business mutator on `window`; production modules reach the same capabilities through typed imports. |
| 2 | ARC-009, ARC-014, ARC-016, ARC-017, ARC-018, ARC-019, ARC-026, ARC-027, ARC-036 | One shared kernel owns cross-process revisioned mutation, caller-visible request occurrence, fenced lease release and terminal receipts; every listed finding consumes it. |
| 3 | ARC-010, ARC-011, ARC-012, ARC-013 | Task creation/message and Session creation/fork commit as one prepared-then-commit boundary; post-create patch and catch-only compensation paths are deleted. |
| 4 | ARC-015, ARC-020, ARC-021, ARC-022, ARC-034 | One journal/completeness protocol serves Project promotion, Skill replacement, package installation, Worktree readiness and SDK generation; physical existence never means Ready. |
| 5 | ARC-005, ARC-023, ARC-024, ARC-025 | Exact process occurrence, one structured spawn/stream/termination owner and machine-readable startup/lifecycle receipts; the parallel Bun/Node/PowerShell public owners are removed. |
| 6 | ARC-001, ARC-002, ARC-003, ARC-004, ARC-006, ARC-007, ARC-008, ARC-031, ARC-033 | Immutable provider/owner identity flows through configuration, discovery, permission, invocation, result and cleanup; Browser and Computer share one launch/ownership policy; Channel has one public composition root. |
| 7 | ARC-028, ARC-029, ARC-032, ARC-035 | The SDK/Transport topology cycle is broken, LSP is removed or restored, Board freshness is real or its parameter is deleted, the dead-code gate is green, and the architecture authority index matches the current authorities. |

`specs/current/architecture/**` is updated inside the stage that changes the described authority, not afterwards.

## Stage 1 — Renderer privilege containment (ARC-030)

### Analysis

- Observable behavior: any renderer script or DevTools expression in a release build reads `window.settingsStore.password` in plaintext and calls `window.applyDirectory`, `window.loadTasks`, `window.selectTask`, `window.loadBoard` and `window.persistOverlaySettings`, which are live production mutators, not observers.
- Direct trigger: `installGlobalBridges()` runs unconditionally at renderer start, and `window.openWorkspaceDiff` is assigned unconditionally at module scope.
- Control/data-flow root cause: diagnostic observation was implemented by publishing production containers and functions on the global object. `packages/overlay/src/services/workspace.ts` then consumed `window.persistOverlaySettings` for real persistence, so the bridge became a production control-flow edge instead of an isolated hook.
- Why the existing path does not cure it: host transport capability checks constrain host calls, not same-renderer global reads. Nothing in the renderer gates the bridge by build mode.
- Definitions, callers, contracts: the repository search above proves the entire consumer set is inside `packages/overlay/src`, and that `workspace.ts` already imports `saveSettings` from `../store/settings`, so the global indirection is redundant rather than load-bearing.
- Data, tests, documentation, delivery: no durable data changes. No test consumes the bridge. No document declares it as a contract. Delivery is the Overlay renderer bundle only.
- Excluded as not applicable: server, engine, database, permission and scheduler surfaces are untouched by this stage.

### Change boundary

1. Delete `installGlobalBridges()` and its invocation; delete the `window.openWorkspaceDiff` assignment, the then-unreferenced `openWorkspaceDiff` function, and the `openWorkspace` function it was the only caller of; delete the `__overlayInitSettled` global readiness flag. None has a consumer in the tracked tree or in the Tauri host.
2. Replace the `window.persistOverlaySettings` lookup in `services/workspace.ts` with the already-imported `saveSettings()` call.
3. Remove the imports in `main.tsx` that only existed to feed the deleted bridge.
4. Delete the remaining application-written renderer globals of the same class, each with no writer or no reader in the tracked tree: `takeChatMetadata` and its `window.__ocNextChatMetadata` ingress (`services/chat.ts`); the `window.__ocOverlayTiming` / `window.__overlayTest` timeout overrides behind `chatRequestTimeoutMs`, replaced by `CHAT_REQUEST_TIMEOUT_MS` (`services/task.ts`); `overlayTestConfig` and `overlayTiming` (`store/settings.ts`); `setMarkdownPrewarmPending` and its `window.__ocMarkdownRenderPrewarmPending` counter (`utils/markdown.ts`); and the `?acceptance-locale` to `__OPENCORVUS_LOCALE__` ingress in `index.html` with its read in `utils/i18n.ts`.
5. Do not add a replacement diagnostic adapter. None is required by any current consumer, and adding one would create a second, unused renderer ABI.
6. Add the positive regression gate CS-010 specified: `packages/overlay/script/check-renderer-public-surface.ts` asserts that the application-written renderer globals equal one declared set, and the `packages/overlay` `build` script runs it immediately after `build:vite`.
7. Repair the broken visual-review toolchain: `packages/opencorvus/script/screenshot-overlay.ts`, `overlay-snap.ts` and `browser-inactivity.ts` all imported the removed `packages/overlay/test/launch` module. Replace all three with one Node.js Playwright script and correct both the Chinese and English benchmark documents that referenced them.

### Retained by decision

- `window.__opencorvusStartupReady` stays. `index.html` paints the startup surface before the module bundle exists so the native window is never empty, and an inline document script shares no import graph with a module bundle. Removing the handoff would mean moving the startup surface into the bundle and reintroducing the empty-window state it exists to prevent. It is declared in the new surface checker with that reason.
- The screenshot tool launches Playwright's `chrome` channel rather than the workspace-pinned Chromium build. The pinned build is not installed on this machine and its download does not complete here, so pinning would leave the repository with no working visual-evidence tool at all. A missing Chrome fails loudly; nothing silently renders somewhere else.
- The dormant Workspace-diff panel state in `main.tsx` is now provably unreachable because `openWorkspace` was its only producer. Removing it is a visible UI change belonging to the dead-subsystem stage, so it is carried as ARC-039 rather than deleted inside a renderer-privilege stage.

### Verification performed

- `bun run --cwd packages/overlay typecheck`: passed, with no unused import or unresolved reference left by the deletions.
- `bun run --cwd packages/overlay build:vite`: the production renderer bundle composes.
- `bun run --cwd packages/overlay check:renderer-surface`: passed at one assignment and one declared global. Proven to fail as intended: a probe file publishing `(window as any).__probeSurface` was reported as an undeclared global, and the check returned to passing once the probe was removed.
- `packages/overlay` focused suites: `workspace-discovery-service`, `task-path`, `task-selection-guard` and `task-rename-service` (22 tests) plus the new `workspace-directory-persistence` suite (2 tests), all passing.
- Focused positive test for the one behavior contract that changed: `packages/overlay/test/workspace-directory-persistence.test.ts` asserts that switching the active directory persists the switched directory carrying no earlier project's workspace memory, and that a rejected host settings save fails the switch with the host's exact error.
- Real-page visual acceptance: the product UI at `http://127.0.0.1:4599/ui` renders correctly on the rebuilt bundle, and clicking `acceptance-project` in the sidebar switches the active project — the row becomes selected, the composer headline becomes "What should we build in acceptance-project?", the project-scoped sidebar entry becomes available, and the page reports no console or page errors.
- Uninvolved read-only review: completed, twelve findings, dispositioned below.

### Independent review disposition

- Repaired in this change: the screenshot tool's wrong default port (now `7878`, the repository serve default); its render gate, which was satisfied by the document's static startup markup and is now bound to the mounted application host with an absolute ceiling; its response rule, which failed the whole capture on any subresource status of 400 or above and now applies only to the page's own document response; the orphaned `openWorkspace`; the surviving `__OPENCORVUS_LOCALE__` acceptance ingress; the missing CS-010 regression gate; the missing positive test; the untracked plan record and the un-updated `specs/README.md`; and the English benchmark document, which still pointed at two scripts that do not exist.
- Recorded as decisions rather than defects: the retained startup handshake, and the `chrome` channel, both above.
- Carried forward: ARC-039.
- Deviation from CS-010 worth stating: CS-010 wanted the surface receipt derived from emitted chunks. The emitted chunks also carry third-party `window.matchMedia` and `window.navigator` assignments, which are not application-written, so the checker derives its receipt from `packages/overlay/src/**` including `index.html`, the file that becomes the emitted document. That is exactly CS-010's stated acceptance target.

### ARC-039 — Dormant Workspace-diff panel (new finding, open)

- Evidence: `main.tsx` declares `workspaceOpen`, `workspaceTarget` and `fileChangesActiveView`. With `openWorkspace` deleted, `setWorkspaceOpen(true)`, `setWorkspaceTarget` and `setFileChangesActiveView("diff")` have no caller, so `FileChangesPanel`'s `hasDiff` memo can never be true and its `DiffPreviewPanel` branch is unreachable. `DiffPreviewPanel` itself stays, because `FileChangesView` is the live diff owner.
- Why it is architecture: a second, dormant implementation of the diff capability behind a permanently false condition is a dual source with no reachable owner.
- Bounded direction: delete the dormant state, the `FileChangesPanel` diff branch and its props, and the center-workbench "diff" open/close effect, then re-verify the Changes panel on a real page. Owned by stage 7.

## Stage 2 — Shared mutation and occurrence kernel

### ARC-036 — fenced claim and lease-ending settlement (implemented)

- Root cause confirmed in code: `claim()` read the definition, decided it was claimable, then acquired the lease in a *separate* transaction and re-read. A revision committed in between left an acquired lease with no fire owner, and `execute`/`fail` never ended the lease they settled — `finally` disposed only the renewal timer.
- Change: `engine/control-lease.ts` now exposes `acquireControlLeaseInTransaction` and `releaseControlLeaseInTransaction`, so validation and acquisition share one write transaction and a settlement ends its lease in the transaction that records why. `scheduler/automation-service.ts` claims inside one `immediateTransaction`, and the recurring settlement, the one-shot delay settlement, the activity-triggered Task-wait settlement and `fail()` each release their exact fenced lease alongside their receipts. `claimPendingTaskWaitsFromActivity` takes its leases under the same revision fence.
- Focused positive tests in `test/scheduler-claim-and-fire-identity.test.ts`: a claim takes the fire owner for the exact current revision and a refused claim leaves that owner in place with one lease row; a completed fire ends its lease with its terminal receipt and the definition is immediately mutable; a failed fire ends its lease with its retry receipt. Six tests pass in that file; 13 further tests pass across the six related scheduler and protocol-delivery suites.
- Real-checker evidence: `bun run --cwd packages/opencorvus check:permission-modes` now records `execute:call_permission_check_schedule_delete:start` followed by `:done`. The deterministic `AutomationRunningConflictError` that terminated the audit's run is gone.

### ARC-037 — Permission effect leases were abandoned, not released (new finding, implemented)

- How it surfaced: with ARC-036 cleared, the same checker advanced to MCP task recovery and failed with `Permission execution per_… did not settle before Session deletion`.
- Trigger and impact: an execution attempt interrupted while its durable MCP task is still open keeps its 120-second `effect` control lease. Recovery in the next process calls `acquireEffectLease`, cannot take the abandoned lease, and `awaitExecutionSettlement` polls for only ten seconds before failing. Every recovery inside the lease window fails deterministically.
- Root and failed cure: `executeUnderEffectLease` in `permission/authority.ts` only cleared its renewal interval in `finally`; `completeExecution` and `appendEffectOutcome` fenced the lease but never ended it, and the two "durable task is still open, rethrow" branches returned without releasing ownership. This is exactly ARC-036's defect on the Permission authority's own lease target, which the audit's ARC-036 boundary scoped only to Automations.
- Change: `completeExecution` and `appendEffectOutcome` release the attempt's lease inside the transaction that writes its terminal receipt, and a new `abandonEffectLease` releases ownership on both paths that deliberately leave the attempt open for recovery.
- Evidence after the change: the checker passes MCP task recovery and the SSE, CLI and ACP transport hydration steps that follow it.

### ARC-038 — Attached public clients have no terminal signal on a non-Task Session (new finding, open)

- Trigger and impact: `opencorvus run --attach <server> --session <id>` converges only on `agent.execution.lifecycle` with a terminal status for its session (`cli/cmd/run.ts:556-564`). When the Session settles through the restart-safe settled path, that event is published on no transport the CLI can see, so the CLI does not exit when the session is aborted — it waits out its stall timeout instead.
- It is nondeterministic, which is why it must not be downgraded. Before the second review's repairs, two consecutive `check:permission-modes` runs on the same source disagreed: the first reported `{"status":"passed"}` with `transports.cli` bound to the exact permission request; the second failed with `Attached CLI did not exit after the transport session was aborted`.
- Current observation, stated as observation and not as a fix: after the second review's repairs — in particular `session/control.ts`'s early-return release and `session/loop.ts`'s settlement-conflict releases, which stop a dead compaction owner from holding a `session_control` lease while the prompt tries to settle — the checker passed three consecutive full runs. The structural gap is unchanged: `persistSettledSessionTerminalStatus` still suppresses the Bus publication that the attached CLI subscribes to, so which transport carries the terminal receipt still depends on which path settles the Session. The symptom stopped reproducing here; the missing publication did not go away, and ARC-038 stays open until the settled path publishes through the same owner the normal path uses.
- Root: the settled terminal path publishes nowhere the CLI can see it. `persistSettledSessionTerminalStatus` (`session/status-publication.ts:81-89`) calls `SessionStatus.set(..., { publish: false })` on both of its branches, which suppresses the `agent.execution.lifecycle` Bus publication that `SessionStatus.set` otherwise performs (`session/status.ts:322-345`), and then delegates to `persistTaskSessionLifecycle`, which returns without publishing when no Task owns the Session (`orchestrator/protocol/message-bridge.ts`: `taskID = explicitTaskID ?? lineageTaskID`, then `if (!taskID) return`) and which in any case writes to `protocol_event` as `aggregate: "task"`, feeding `session.events` rather than the global Bus stream.
- Which transport each client uses, corrected by the independent review: `cli/cmd/run.ts:419` subscribes through `sdk.event.subscribe({})` — the global Bus SSE route (`server/routes/app.ts`, `operationId: "event.subscribe"`) — not `session.events`. So the CLI's blocker is the suppressed Bus publication, while the Overlay and web `session.events` subscribers are blocked by the Task-aggregate binding. Two transports, one missing fact.
- Why this is architecture, not a local bug: one terminal execution fact has two publication owners and the settled path satisfies neither. The normal path (`publishSessionStatus`) publishes on the Bus; the restart-safe settled path publishes on neither, for every Session, Task-owned or not.
- Bounded direction: the settled terminal fact must publish exactly once through the same owner the normal path uses, so an attached client converges regardless of which path settled the Session; the Task-aggregate binding of `protocol_event` is the separate half that `session.events` subscribers need. Not implemented in this change — the record earlier attributed the CLI symptom to the aggregate binding alone, which would have repaired `session.events` and left the CLI exactly as stuck.

### Checker repair

`packages/opencorvus/script/permission-modes-check-worker.ts` required `full_access` as a *ledger event type*. `PermissionEventType` (`permission/permission.sql.ts:6-22`) has no such member — `full_access` is the `mode` column. The assertion could never pass and had been unreachable behind the ARC-036 failure. The checker now collects `modes` from the same history rows and asserts `full_access` where it is actually recorded.

### Stage 2 second independent review disposition

The repair commit was reviewed again. Fourteen findings; the important ones are that the sweep was incomplete, that it introduced one arithmetic regression, and that it re-created in three new places the error-masking defect the first round asked it to remove.

**Regression introduced by the first repair, now fixed**

- `claimFire` synthesized its return value from a projection taken *before* the acquire, overriding only `status`, `owner_id` and `lease_until`. `attempt` and `time_started` are also lease-derived, and `attempt` is the retry backoff exponent — so a first claim reported `attempt: 0`, making the first retry `1000 * 2 ** -1` = 500 ms instead of 1000 ms, with every later attempt one step behind. It now re-projects inside the same transaction. `AutomationService.claim` does the same synthesis correctly because `AutomationRow` has only two lease-derived fields, both overridden; the event version copied the shape without checking the field set.

**Sweep completed**

- `bus/index.ts` is a seventh control-lease owner and released nothing: terminal `succeeded`/`ignored`/`failed` receipts were written under a fence and the `finally` cleared only the renewal timer. Its receipts now release. The same-owner lease-reuse branch that let it tolerate never releasing is deleted; a live lease for an exact delivery is now a real concurrent owner.
- `session/control.ts` still had an abandonment path inside a file the sweep claimed to have covered: the `terminalExists` early return left the caller's lease live, and `session/loop.ts` then threw a settlement conflict with no release. Both are fixed.
- `protocol/delivery.ts`'s terminal settlement and `event-service.ts`'s `deferFire` are named in the record as owners the "every owner" claim does not cover: the first is benign because terminal status wins over the lease in its projection and due selection filters terminal rows, and the second deliberately rides the lease as its recovery schedule on shutdown.

**Error masking removed a second time**

- The first repair guarded `abandonEffectLease` with a try/catch and then added three unguarded `releaseControlLease` calls on error paths — worst inside `mission/execution-closure.ts`'s `finally`, where a throw discards the original close failure entirely. All four now go through one primitive, `releaseControlLeaseOnErrorPath`, which reports its own failure instead of raising it. The bespoke try/catch in `authority.ts` is deleted in favor of it.

**Other repairs**

- `build/agent.ts`'s cleanup renewal `setInterval` had no guard. Now that the settle releases the lease, a tick landing after settlement throws out of a timer callback — an unhandled exception. It is guarded and stops itself.
- A legacy row whose `retry_wait` receipt was written before this change keeps a live lease, and its recovery timer floor of 1 ms turned that into a hot claim/refuse loop until the lease expired. The floor is now 250 ms, and this one-time transition cost is stated rather than left to be discovered.
- `completeExecution`'s release assertion was unreachable — the release predicate is the assert predicate, same transaction, same instant — and is removed rather than left as defensive dead code.
- `triggerTaskWaitFromActivity`'s error named the first *claimed* wait, which is usually one that settled fine; it now names the first unsettled wait and lists the settled ids, because partial commit is deliberate and a caller must be able to tell the halves apart.
- A duplicated stale comment block was removed.

**Tests added for the behavior this change actually alters**

- `test/control-lease-settlement.test.ts`: a release fenced to the exact lease ends it and frees the target for the next owner; a release carrying a superseded lease identity leaves the current lease untouched (the `leaseID` fence, which owner identity alone could not provide since owner strings are `pid:now`); the error-path release reports its own outcome.
- `test/channel-ingress-fact-storage.test.ts`: a settled ingress ends its effect lease with its outcome receipt.

**Still open after this round**

- `engine/task-root-fact-store.ts` contains a second complete implementation of acquire/renew/assert against `EngineControlActivationLeaseTable`, bypassing `engine/control-lease.ts`, and it has no release at all. It is the same class as the `event_fire` shadow this stage deleted. Not introduced here and outside this stage's boundary, so the record does not claim the shared mechanism has one implementation yet.
- `mission/execution-closure.ts`, `engine/build-observation-cleanup.ts`, `session/control.ts` and the three `event_fire` receipts have no lease test of their own.
- The renamed claim test still does not discriminate against the pre-change revision, because the pre-change `claim` re-projected after acquiring inside the same transaction and therefore already carried the lease it took. It is kept as a true contract test, not as coverage of the interleaving.

### Stage 2 third independent review disposition

Thirteen findings. Two were new lease owners the previous two rounds had missed, one was a hot loop the previous repair had rate-limited rather than fixed, and one was the reviewer's structural point about why each round keeps finding another owner.

**Correctness**

- `bus/index.ts`'s already-terminal branch returned while still holding the lease, reachable whenever the stale-subscriber sweep settles a delivery between this owner's `prior` check and its own transaction. It now hands the lease back before returning. The same transaction also read the clock twice — the fence at one `Date.now()` and the release at a later one, the exact defect round 2 fixed in `permission/authority.ts` — and now uses one settlement instant.
- `engine/persist.ts` writes the terminal `retained` build-cleanup receipt on the normal success path and never ended that cleanup's lease, so a terminal receipt committed while a two-minute lease stayed live. It releases now. That makes `build_cleanup` the second owner found after the sweep was declared complete.
- `scheduleLeaseRecovery` chose its deadline as `retry_at ?? lease_until`. `retry_at` survives as a *past* value on every attempt after the first, so a fire another runtime is currently executing was re-enqueued against an expired retry time and polled for the whole of that runtime's attempt. The 250 ms floor added in the previous round rate-limited that loop instead of removing it. The deadline now comes from the status being recovered — `lease_until` while `running`, `retry_at` while `retry_wait` — and a genuinely due row, which has neither, re-enqueues on the next tick rather than waiting out the contention floor.
- `releaseControlLeaseOnErrorPath` documented itself as reporting its own failure and only returned it; three of its four call sites discarded the result, so a handback that silently did not happen was invisible. It logs inside the primitive, which is the single-owner fix — two of those call sites have no logger of their own.
- `session/loop.ts`'s three settlement-conflict paths called `abandonControlLease()` after `SessionControl.settle` had already handed the lease back inside the transaction that observed the conflict. The redundant caller-side handback is removed; the renewal-failure paths keep theirs, because there is no settlement there to carry it.
- `build/agent.ts`'s renewal guard could not tell "our own settlement ended this lease" from "another owner took it while this build is still running", and the second case has no later fence to surface it. It logs before stopping.
- Four `releaseControlLease` imports left dead by the move to the error-path primitive, and `bus/index.ts`'s `settleDelivery`, which had no caller before this stage began, are deleted.

**The structural finding, and the gate for it**

Three review rounds each found a lease owner the previous round missed, because nothing enumerated them. `packages/opencorvus/script/check/control-lease-owners.ts` is that enumeration: every site that acquires a control lease is declared with the release its settlement performs, an undeclared acquire fails the check, and a declaration whose acquire is gone fails too, so the list cannot rot. It is wired as `bun run check:control-lease-owners` and is proven to fail on a newly added acquire site. It also keeps `engine/task-root-fact-store.ts` visible: that file acquires by inserting into the lease table directly, never releases, and carries its own consumed-activation predicate — a second implementation of this mechanism that this stage does not converge, declared as such rather than left to be rediscovered.

**Tests**

- `test/event-fire-claim-attempt.test.ts` pins the arithmetic the previous round's regression broke: a claim reports the attempt it just took, and a re-claim after a settled retry counts both. Against the previous revision the first claim reported `attempt: 0`, which is what halved the first retry delay.
- `test/control-lease-settlement.test.ts` gains the branch that is the primitive's reason to exist: discovering the lease has moved on is reported, not raised.

**Still open**

- `engine/task-root-fact-store.ts`'s parallel implementation, now declared and gated rather than silent.
- `protocol/delivery.ts`'s terminal settlement deliberately does not release; the reason is recorded in the owner declaration so it does not have to be re-derived.
- `mission/execution-closure.ts`, `engine/build-observation-cleanup.ts` and `session/control.ts` still have no lease test of their own.

## ARC-009 — Shared data root versus process-local mutation locks

### First half: no shared fact is replaced from a snapshot the writer did not read under the lock

- Root cause as recorded by the audit: `withKeyedLock` is a process-local `Map`, while the current data architecture explicitly supports several backends over one data root. Two processes read the same snapshot, update different keys, and the later atomic replacement discards the earlier update. Atomic replacement prevents torn bytes, not lost updates.
- The repository already had the correct pattern in exactly one place: `provider/models.ts` wraps its keyed lock in `withProcessLock` and re-reads inside it. This change generalizes that pattern rather than inventing a mechanism: `withSharedJsonFactLock` in `util/process-lock.ts` provisions the fact file with the empty representation its readers already synthesize, takes the process-local writer queue, then takes the cross-process lock, and runs the read-modify-write inside it.
- Applied to every mutable shared JSON fact the audit named: `config/config.ts` (`writeConfigFile`, both project and global), `auth/index.ts` (`set`/`remove`), `mcp/auth.ts` (`updateStore`/`removeMany`) and `expert-squad/configuration.ts`, which had only a module-level promise chain.
- Contention policy converged: `CROSS_PROCESS_LOCK_RETRY` is now declared once in `util/process-lock.ts` and consumed by the JSON fact lock, by `expert-squad/install-lock.ts` (which had declared its own copy) and by `provider/models.ts` (which had none, so a contended catalog write failed instead of waiting).
- Focused positive test: `test/shared-json-fact-lock.test.ts` spawns a second OS process that holds the critical section while this process performs its own read-modify-write, and asserts both updates survive. Without the cross-process lock the peer's write lands last and drops this process's key entirely.

### Second half, not implemented

The audit's boundary also requires that readers and writers consume the same revisioned fact. That is untouched: `mcp/auth.ts` still keys its compare-and-swap on a process-local `revisions` Map, and a peer process's caches are still invalidated only in the writer process. Making the revision durable and the invalidation cross-process is the remaining half of ARC-009 and is not claimed here.

## Stage log

- Stage 1 (ARC-030): complete, reviewed and repaired against the review. Verification evidence is in the stage-1 section.
- Stage 2 (ARC-036, ARC-037, plus the shared-mechanism sweep across `channel`, `build_cleanup`, `lifecycle`, `session_control` and `event_fire` lease owners): implemented, independently reviewed, and repaired against that review. `check:permission-modes` reached a full `{"status":"passed"}` for the first time on this branch, alternated with the ARC-038 CLI hang, and after the second review's repairs passed three consecutive runs. ARC-038 remains open as an unrepaired publication gap whose symptom no longer reproduces here. ARC-009's first half is implemented; its revisioned-fact half and the remaining ledger items (ARC-014, ARC-016 through ARC-019, ARC-026, ARC-027) are not started.

### Stage 2 independent review disposition

The uninvolved read-only review of the stage-2 commit returned twelve findings.

**Repaired in the follow-up change**

- The `AGENTS.md` shared-mechanism sweep the stage owed. Four further control-lease owners abandoned their leases exactly as ARC-036 described, and all four now end their lease with the receipt that settles them: `channel/ingress.ts` (same `effect` target as ARC-037, and its `executeMessage` had no failure path at all), `engine/build-observation-cleanup.ts` (both the complete and the failed receipt, where reconciliation re-selects only after the lease ends), `mission/execution-closure.ts` (whose next closure busy-polls every 10-100 ms until the previous lease expires, and whose throwing path released nothing), and `session/control.ts` plus `session/loop.ts` (terminal settlement, and the renewal-failure path that abandons a still-pending control).
- The `event_fire` shadow implementation. `event-projection.ts` derived a `leaseConsumed` flag to pretend a retry_wait receipt had ended its lease, and `event-service.ts` reconstructed the same predicate a second time to compute `supersedeLeaseID`. Both are deleted: `settleSuccess`, `settleDisposition` and `scheduleRetry` now release the lease with their receipt, and `claimFire` validates head-of-queue and acquires under one write transaction instead of three.
- `triggerTaskWaitFromActivity` settled its whole batch in one transaction, so one job's lost fence rolled back every earlier job's tombstone *and its release*. Each wait now settles in its own transaction, and a wait whose revision moved on still hands its lease back.
- `releaseControlLeaseInTransaction` now fences on the exact `leaseID`, like `assertControlLeaseInTransaction` and `renewControlLease`. Automation owner strings are `pid:now`, so owner identity alone was not an identity.
- `completeExecution` asserted its fence at one `Date.now()` and released at a later one, and dropped the release's boolean; it now uses one settlement instant and fails if the release did not take.
- `abandonEffectLease` could replace the caller's real error with its own write failure; it now keeps the original error and logs the handback failure.
- The one-shot Automation settlement committed its succeeded receipt and then returned on a changed revision, contradicting the "one terminal transaction" it claims; it now throws so nothing commits.
- The recurring, activity and failure settlements now take the same immediate write lock as the delay settlement.
- `claim()` no longer runs the full run-history projection twice inside the write lock.
- The checker's required-event loop no longer lists `mcp_task_status` and immediately skips it — that event is asserted after MCP task recovery, where it is produced — and the `full_access` assertion now also requires the `full-access-policy` decision actor, which is the settled decision the original list position implied.

**Accepted as accurate and acted on**

- ARC-038's recorded root cause was wrong about the transport. Corrected above.
- The first added test asserts refusal and single-lease bookkeeping, which held before the change too. It is renamed to what it proves and now also asserts that a claim publishes the lease it took. The interleaving that ARC-036 describes needs a concurrent revision commit between two statements of one transaction and is not reproducible in-process without a production seam, so it is covered by the atomic transaction rather than by a test; this is stated rather than implied.
- Two settlement paths gained the missing positive tests: a fire that throws hands back its lease with its failure receipt (through the real `executeWithRuntimeSettlement` failure path), and the one-shot delay settlement ends its lease with its terminal receipt (through the real `runDueNow` path).

**Still open**

- ARC-037 has no unit test of its own. Its evidence is the real `check:permission-modes` run, which reaches and passes MCP task recovery, the durable task result, and SSE/CLI/ACP transport hydration, and which now passes on consecutive runs.
- The activity-triggered Task-wait release and `claimPendingTaskWaitsFromActivity`'s revision fence are exercised only indirectly.
