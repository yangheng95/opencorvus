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

- `test/event-fire-claim-attempt.test.ts` pins the arithmetic: a claim reports the attempt it just took, and a re-claim after a settled retry counts both. It discriminates against `0c4a9a1cd`, where the first claim reported `attempt: 0` and halved the first retry delay — not against `9b8b81bbb`, which already carried the fix.
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

### Second half: the revision is a durable fact, not a process-local counter

- `mcp/auth.ts` kept its compare-and-swap value in a process-local `Map`. A revoke performed by another backend on the same data root was invisible, so a stale holder's write succeeded and resurrected a credential that had been revoked.
- The value now lives in the store as `Entry.revision` — a revocation generation, random, minted only by `invalidate`, preserved by ordinary writes, compared inside the same cross-process lock as the read-modify-write. The first cut of this (a bump-per-mutation counter) broke MCP OAuth and was repaired in the fifth review round, recorded below.
- `revision()` is async now, because the answer comes from the file. Its six call sites await it.
- Focused positive tests in `test/mcp/auth-durable-revision.test.ts`: one captured generation survives a five-write flow; a revoke refuses the old holder and admits the new one; a peer's revoke through the shared file is visible; a pre-removal generation never matches a post-recreation one.

### Still open in ARC-009

Peer caches are still invalidated only in the writing process — `Config`'s `state.reset()`/`global.reset()` and the `config.changed` Bus event do not cross a process boundary. A second backend keeps serving its cached configuration until something in that process resets it. The durable facts are now correct; their propagation is not.

### Stage 2 fourth independent review disposition

Fourteen findings. One was a regression the third-round repair introduced, three were control-lease owners the new gate could not see, and one was the gate itself giving false confidence.

**Regression introduced by the third-round repair, now fixed**

- `scheduleLeaseRecovery`'s "no deadline, re-enqueue on the next tick" branch was a 1 ms loop in exactly the deployment this campaign targets. A `pending` fire whose job's head-of-queue fire is running in *another* runtime has no deadline of its own, so it re-asked every millisecond — each iteration projecting every row of the fire table — for the whole of that runtime's attempt. Every refused claim now backs off; the in-runtime head-of-queue handoff never came through this path, `enqueueNextFireForJob` drives it.

**Owners the gate could not see, and one that never released**

- The gate's direct-table detection was a hardcoded one-element list, so it could only re-find the file it already knew. It now scans for lease-table inserts as a first-class acquire shape, which surfaced `engine/process-liveness.ts`, `engine/task-completion-closure.ts` and `task-api/index.ts`.
- `task-api/index.ts`'s cancellation-convergence owner never released: `close()` cleared only its heartbeat, and `acquireCancellationConvergence` then busy-polled every 100 ms for up to 30 seconds waiting out a lease whose owner had already finished. That is ARC-036's defect plus `mission/execution-closure.ts`'s busy-poll pathology, still live after three rounds. It releases now.
- `engine/process-liveness.ts` deliberately never releases and is declared as such: that lease **is** the liveness fact, so ending it early would assert a process had exited.

**The gate was giving false confidence, and now does not**

It counted presence, not sites, so a second acquire inside an already-declared file passed silently — and three declared files have two acquires each. It also skipped by path prefix, ignored aliased imports of the primitive, and scanned only one package. It now declares an acquire-site count per file, scans the other packages that could take a lease, treats an aliased import as a failure, and is proven to fail on a new acquire in an already-declared file and on an aliased import. It is wired into `.husky/pre-push` — a gate that exists so a fifth round does not rediscover an owner only helps if something runs it.

**Other repairs**

- The `retained` build-cleanup release added in round 3 read the current lease and released it with that row's own id and owner — a fence derived from the thing it was fencing against, so it ended whoever happened to hold the activation rather than the caller's. The build agent now passes its own activation and the release is fenced on it.
- `withSharedJsonFactLock` nested a `forever` cross-process wait inside the keyed lock's 30-second default, so the first caller in a process waited while every other caller of the same file failed with an error naming the wrong lock. The in-process queue now waits as long as the cross-process lock does.
- `config/config.ts` had three further writers of the same file that took no lock: the legacy-permission migration rewrite, the `$schema` injection — which provisioning made newly reachable for files that previously did not exist — and `writeMcpConfigEntry`, a full unlocked read-modify-write. All three now take the same lock and replace the file atomically.
- `bus/index.ts`'s renewal guard swallowed its failure with a bare `catch {}` while the same round added logging to the identical guard in `build/agent.ts`.
- The `$schema` injection no longer fires for a file holding nothing but the empty object. Provisioning made that write newly reachable, so it turned a config *read* into a locked write on every load of a provisioned file — about two seconds of fixture setup in the focused suites. A file the user never created should not gain content from being read.
- The cross-process test's discrimination rested on a 150 ms sleep guessing that the peer had acquired. On a slow machine this process would win the race and the assertion would pass with the lock removed. The peer now announces that it holds the lock and the parent waits for that line.

**A deadlock this round introduced and removed**

Locking the two config load-path writes was wrong: `loadFile` runs inside `writeConfigFile`'s own commit hook, so taking the write lock there deadlocked against the write calling it. The real permission matrix caught it as a 120-second inactivity timeout. Both load-path writes are unlocked again and replace the file atomically, with the reason stated at each: they are idempotent rewrites that the next load re-applies if a concurrent writer wins. `writeMcpConfigEntry` keeps the lock — it is only reached from the CLI, never from inside a write. The keyed-lock timeout also stopped being infinite: waiting forever turns a re-entrant acquisition into a hang instead of an error, so it is now a bounded ten minutes, long enough that a genuine cross-process wait is never mistaken for a deadlock.

**Recorded rather than changed**

- The cross-process config lock is held across `MCP.reconcileProjectConfig` and a Bus round-trip, and that reconciliation takes a second cross-process lock (`mcp-auth.json`). The ordering is project-config → mcp-auth and must never invert; no inverting path exists today, because `reconcileProjectConfig` does not write config back. A critical section that outruns `proper-lockfile`'s ten-second stale threshold surfaces as a compromise error from `release()` after the write already committed.
- Provisioning leaves a file behind if the operation throws. Every reader accepts the empty representation, but a provisioned `.opencorvus/opencorvus.jsonc` becomes a canonical-config conflict for descendant directories in the same worktree, and each config write now creates a transient lock directory inside the user's repository where the old in-memory lock created nothing.
- The first project-config commit costs about 5.6 seconds on this machine, measured against the pre-change revision as well, so it is not this change's cost. It is why `permission-two-mode.test.ts`'s untimed test now sits near the default five-second per-test limit.

### Stage 2 fifth independent review disposition

Fifteen findings. The critical one: the durable-revision design shipped in the previous commit deterministically broke MCP OAuth.

**Critical, fixed**

- `Entry.revision` was bumped by *every* mutation, but every OAuth consumer captures one revision and presents it to several writes — client registration, state, verifier, tokens are one flow under one captured revision. The flow's own first write invalidated its second: `state()` threw `MCP auth lease was revoked` on the very next SDK callback, and `finishAuth` failed after the tokens were already written. The reviewer traced it through the SDK's real callback order, and the previous commit's own test had codified the defect (`revision === current + 1` after a holder's own write).
- The revision is now a **revocation generation**, not a mutation counter: a random string minted only by `invalidate`, preserved unchanged by every ordinary write, absent on a fresh entry. One captured generation stays valid across a flow's writes; a revoke refuses every outstanding holder; and because generations are random, a generation captured before a removal can never match one minted after recreation — which also closes the reviewer's ABA finding (the counter restarting at 1 after remove-and-recreate). The tests now assert the real contract: a five-write flow under one captured generation, revoke-refuses-old-admits-new, peer revoke through the file, and no post-recreation match.
- `invalidate` on a key with no entry stays a no-op, stated in its contract: flows over a never-revoked key are fenced by the stored OAuth state and the single pending-flow slot, not by the generation. `clearOAuthStateIfOwned`'s cleanup works again as a consequence of the flow's generation staying valid.

**Other repairs**

- A `pending` fire refused because its job's head runs elsewhere now waits on the *head's* deadline instead of polling every 250 ms for up to the full retry backoff — the reviewer showed `enqueueNextFireForJob` selects the head, not the queued fire, so nothing else drives that handoff.
- `task-api`'s convergence `close()` logs when the handback did not take without an error — it runs in a `finally`, so it must not throw, but a silent non-release returns the next cancellation to the poll this change removed.
- The Bus renewal guard stops its interval like the `build/agent.ts` guard it was modeled on, and its comment no longer claims an unreachable cause.
- The gate: the process-liveness declaration names the real function (`expireProcessLivenessLease`); the three scanned roots are prefixed so identical relative paths cannot collide across packages; the root-selection criterion is stated in the file.
- `process-lock.ts`'s two constants have their own doc comments again instead of one carrying the other's.

**ARC-040 — a durable Bus subscriber that runs a model turn inline (new finding, open, attempt reverted)**

- Evidence, from the failed `check:permission-modes` run at 15:05–15:06: `POST /session/.../abort` completed at :21.7, the attached CLI was still alive at :31.7 when the checker gave up, `Durable Bus publication failed for project.memory.organize.requested` logged at :32.899, and `POST /session/.../message` completed at :32.927 — 28 ms later, with a 31.97-second total duration. The CLI cannot exit before its `session.prompt` HTTP response, and that response was blocked for eleven seconds behind the durable delivery of `project.memory.organize.requested`, whose subscriber (`project-memory.organizer`) runs a complete Organizer model turn inline in the delivery.
- Why it is architecture: the durable Bus's delivery receipt is the retry authority for its subscribers, so a subscriber whose work is a model turn couples every publisher of that event — including a user message's own settlement — to LLM latency. The organize request's facts (pending entries, organizer lease, `retry_wait` status) are all durable *before* the event fires, so the delivery does not need to encompass the turn.
- Two implementation attempts were made and both reverted, which is why this is recorded open rather than fixed: a detached background runner loses instance context the moment the delivering scope ends (`Cannot access instance context through a closed instance cache lease` across eight memory tests), and a runner holding its own Instance lease deadlocks `Instance.disposeAll` — disposal waits for every lease before running the state disposers that would abort the runner (observed as the canonical runner's 120-second inactivity kill).
- Bounded direction: the organizer needs a disposal-aware background execution primitive — a reservation that instance disposal cancels *before* waiting on leases, which is what `RuntimeExecutionSettlement` provides at process scope but nothing provides at instance scope. That primitive, not another ad-hoc runner, is the fix; it likely also serves the other inline-LLM subscriber candidates. **Implemented — see "ARC-040 — the Organizer runs behind the request" below.**
- ARC-038's CLI symptom is therefore two-layered: the settled terminal publication gap (recorded earlier, still open), and this settlement coupling, either of which alone can hold the CLI past the checker's ten-second bound.

### Stage 2 sixth independent review disposition

The OAuth-flow repair was verified correct against the SDK's real callback order, and the ARC-040 revert was verified byte-identical. Seven findings; the two high ones were both the `""` state.

**The empty generation conflated three different facts (fixed)**

- `INITIAL_REVISION = ""` meant "never existed", "exists but never revoked" and "was removed" at once. The reviewer proved both consequences with executed probes: a holder that captured `""` on a fresh key kept writing after `removeMany` deleted the entry, and after a *recreation* — where its stale `updateTokens` also wiped the freshly configured static credential, because ordinary writes clear `staticCredential`. The previous round's ABA claim was therefore false for exactly the `""` case, and the test suite hid it by calling `invalidate` before the removal.
- The repair makes a lease something that is always explicitly established: `beginCredentialLease` revokes whatever existed and mints the caller's generation in one store write (also collapsing the `invalidate`-then-`revision` two-step the review flagged as a race), `startAuthFlow` and the CLI's OAuth test both start their flows through it, and `assertRevisionInStore` refuses `""` outright — the empty generation is the absence of a lease, never a lease, so the entire class of "captured before removal, admitted after recreation" is now an explicit error rather than a probe result.
- The connection path reads and must not revoke a flow to do so: over a credential no flow has ever leased (including stores written before leases existed), its provider carries no lease and its refresh writes stay unfenced, exactly as they were before ARC-009. Over a leased credential it carries the current generation and is fenced against revokes.
- Tests now cover: a five-write flow under one established lease; `beginCredentialLease` refusing the previous holder and admitting the new one; a peer's revoke through the shared file; a pre-removal lease refused after recreation with the static credential intact; and the outright refusal of an unestablished lease.

**Other repairs from this round**

- The Bus renewal guard stopped renewing on *any* error, so one transient `SQLITE_BUSY` tick would let a long delivery outlive its lease. It now stops only on a lost fence — the two exact fence errors the lease primitives throw — and retries transient failures on the next tick.
- The head-deadline lookup projected every fire of every job on every pending scheduling, and one malformed row anywhere in the table would have failed recovery scheduling for an unrelated fire. It is bounded to the fire's own job's revisions now.
- A queued fire behind a head running in another runtime polls that head every 2.5 seconds instead of waiting out the head's whole 30-second lease — the head's settlement wakes only its own runtime, so the poll is the handoff, and the full lease remains the crash bound.
- A note for anyone who ran a build of this branch between `ab2860df2` and this commit: that interim design stored numeric revisions, and the store schema is now a string, so `mcp-auth.json` from that window fails parsing until deleted. The window exists only on this branch; no release carries it, and no compatibility parser is added.

## ARC-026 — Restart and shutdown as admitted lifecycle occurrences

- Root cause as audited: both routes returned `{ok:true}` from a 25 ms timer race — the handler could be cleared in between (`requestServerShutdown` re-reads it and returned silently), the handler could fail (shutdown swallowed the rejection into a console line; restart logged and dropped it), and the caller had no identity to ask about any of it.
- The repair: `server/lifecycle-occurrence.ts` admits one lifecycle occurrence synchronously — availability is checked at admission, the response carries the occurrence's stable ID, and the execution that follows the listener-release delay settles the occurrence as `failed` with the exact error when the handler was cleared or threw. A repeated request for the same transition converges on the live occurrence; a conflicting transition is refused with it (409 carrying the live occurrence's ID). `GET /lifecycle/:occurrenceID` returns the state; there is deliberately no `succeeded` for a shutdown, because success is the process exiting, which the process cannot observe about itself — `executing` is the last honest state a completed shutdown shows.
- `requestServerShutdown` now returns the handler's own promise instead of swallowing its rejection, and its only caller is the admission module. A dead `canRestartServer`/`startServerRestart` import in `routes/global.ts` was deleted.
- Public contract: the two POST responses gained an optional `occurrenceID`, the new GET was added, and the tracked OpenAPI, the generated SDK, the API MDX docs and the docs i18n group were regenerated through the repository pipeline; `api:routes-check` (332 ops) and `docs:check` pass.
- Focused positive tests in `test/server-lifecycle-occurrence.test.ts`: an admitted shutdown executes the handler bound at admission; missing handlers are exact refusals; a failing restart handler settles the occurrence as `failed` with its error; a handler cleared between admission and execution fails the occurrence instead of silently no-opping; a repeated request converges and a conflicting one is refused with the live occurrence.

## ARC-038 — the settled terminal publishes through the live path's owner

- Implemented. `persistSettledSessionTerminalStatus` no longer suppresses the Bus publication and persists directly through the protocol bridge — the split that left every Bus subscriber, including an attached public client, without the settled path's terminal receipt. It now publishes through `SessionStatus.set`, the same owner a live prompt's terminal uses, and the bridge subscriber persists it; the direct `persistTaskSessionLifecycle` call is deleted.
- `SessionStatus.set` gained a `settledOccurrence` option: the prompt-owner gate exists to stop a stale writer from clobbering the live owner's status, and a settlement validated against the durable occurrence is not a stale writer — silently dropping it would leave the occurrence without its terminal publication. The latch still updates only the matching occurrence, so a historical settlement cannot replace the session's live occurrence.
- A repeat settlement of an already-terminal occurrence now converges on the latch instead of appending a duplicate protocol row, which the old direct-persist path did.
- Focused positive tests in `test/settled-terminal-publication.test.ts`: the settled terminal reaches a Bus subscriber with the exact occurrence identity and is not re-published on a repeat; a historical occurrence's settlement publishes without touching the live occurrence. Four neighbor suites (`engine-interrupted-session-recovery`, `active-operator-wake-settlement`, `conversation-projector-ownership`, plus the new suite) pass.
- Scope note: the settled path serves Task-owned Sessions (`taskID` is required), so this closes the Bus half of ARC-038 for them. The checker's CLI symptom on plain sessions was traced to ARC-040's settlement coupling; the Task-aggregate binding of `protocol_event` for non-Task sessions remains the separately recorded half.
- Commit attribution anomaly, recorded for honesty: while this change sat uncommitted, a parallel OpenCorvus product Task ("撰写 OpenCorvus 学术论文") checkpointed the worktree as `a88f8e7e8` and swept the three files into its checkpoint commit. The content in that commit is exactly this change; history is not rewritten because the parallel task owns its commit and was live. This record is the authoritative description of that diff.

## Open verification anomaly — `build-terminal-fact-publication`

`test/build-terminal-fact-publication.test.ts` fails 6 of 9 on this machine ("Task cancellation reconciler is already configured" after ~20-second per-test stalls across project close/reopen). Three-way attribution ran identically — with and without the ARC-038 diff, and with `engine/build-observation-cleanup.ts`, `engine/persist.ts` and `build/agent.ts` restored to their pre-campaign (`454b357ba`) versions — so the signature is independent of both. The runs were taken while a parallel product Task held five Bun processes on this machine, and the stall shape is consistent with load; the suite had not been run earlier in this campaign, so no green baseline exists on this branch. It must re-run on a quiet machine before any saturation or release claim; until then it stays an unexplained anomaly, not an explained one.

### Stage 2 seventh independent review disposition

The lease redesign, ARC-026 and ARC-038's Bus half were verified sound end-to-end — one established lease survives the SDK's full callback order including its retry loops, the connection path gains no overwrite power it did not have before leases existed, the tauri supervisor cannot be stranded by the new 409, and the settled path cannot replace a live occurrence. Eight findings.

**Repaired**

- `GET /lifecycle/:occurrenceID` sat behind the project-directory gate, contradicting its own contract: a lifecycle occurrence is state of the process itself, and its whole point is to be readable while the process is shutting down — exactly when a project bootstrap can be refused. `/lifecycle/` is bypass-listed in the transport protocol and the SDK mirror, and the regenerated OpenAPI no longer stamps a `directory` parameter on it.
- `startAuthFlow` established its lease as a bare entry and only wrote the server identity on the next store write. In that window credential reconciliation classified the entry as stale — `!stored.serverUrl` — and any concurrent project-config commit would collect it out from under the flow, which then died at its next fenced write with a misleading revocation error. The lease now carries the server identity from the start, at both establishment sites.
- Fence loss is a typed fact, `ControlLeaseFenceLostError`, thrown by the two lease primitives and matched by `instanceof` in the Bus renewal guard — replacing the error-message substring match the previous round introduced, which a rewording would have silently degraded to renew-forever.
- `SessionStatus.set`'s `publish` option was dead after ARC-038 — no caller suppressed publication any more — and is deleted with its branch.
- The stage-log sentence claiming ARC-038 "remains open as an unrepaired publication gap" predated the Bus-half repair and contradicted the ARC-038 section; corrected below.

**Recorded as decisions or notes**

- `opencorvus mcp debug`'s OAuth probe now deliberately revokes any pending interactive flow on the credential it probes: its SDK callbacks write registration and state, and a writer needs the lease. Stated at the call site.
- The repeat-settlement convergence of the settled terminal path is process-local — after a restart the settled path re-publishes and the bridge appends another row. The one production caller reads the durable protocol store first, so this is benign, and the mechanism's scope is now stated here rather than overclaimed.
- The settled path's Bus publication now reaches the mission caller-receipt subscriber. All settled-path callers target non-mission sessions today and the recorder is idempotent for exact repeats; a future settled terminal on a mission session with a different reason than its recorded receipt would surface as a receipt-identity conflict inside Bus dispatch.

## ARC-040 — the Organizer runs behind the request, not inside it

- Implemented, on the third attempt — the first two failed for structural reasons the record keeps above, and the difference this time is the primitive those failures called for.
- `runInstanceBackgroundWork` (`project/instance.ts`): work runs under its own serving lease, so its context stays valid exactly as long as it runs, and every teardown path — `runTeardownTurn` for refresh and single-instance disposal, `disposeAll` for global disposal — aborts the work's signal *before* draining serving handles, so the work unwinds at its next checkpoint instead of being the lease teardown waits on forever. That pairing is what distinguishes it from `Instance.provide` in a fire-and-forget callback, which is a deadlock against disposal. It requires only the instance context, not a lease, because durable Bus deliveries replayed from the outbox — its first scheduler — run with a project identity and no lease of their own.
- The memory Organizer's durable Bus subscriber now settles its delivery when the request has reached it and runs the model turn as instance background work, one coalescing runner per project. The pending inputs, the Organizer attempt lease and the `retry_wait` status were already durable before the event fired; they are the recovery authority, re-driven by the next request or project open.
- Focused positive tests: `test/instance-background-work.test.ts` pins the primitive's three contracts — context stays valid after the scheduling scope returns (the first attempt's failure), disposal cancels in-flight work instead of waiting for it (the second attempt's deadlock), and completed work leaves nothing to cancel. `test/memory/organizer-background.test.ts` pins the decoupling itself: a user message's own settlement completes while the Organizer's model turn is held open, and the run then settles through its durable states.
- The obsolete shutdown test — which asserted the old coupling by cancelling `protocol_publication` to abort the Organizer — is rewritten to the current contract: instance disposal cancels the in-flight run, and the durable owner settles to `retry_wait` with the pending input intact. Its old form was also the source of the memory suite's flake; the suite now passes three consecutive runs.

### Stage 2 eighth independent review disposition

The primitive's cancellation topology, the organizer rewire's coalescing and replay semantics, the rewritten shutdown test's discrimination, and all round-7 fixes were verified sound — with five findings.

**Repaired**

- The controller could end up registered on a dead entry while the work admitted on a live one: the entry is resolved at scheduling, but `Instance.provide` re-resolves at admission, so an entry replaced in between left the work uncancellable — the exact disposeAll wait the primitive exists to prevent. The work now verifies at admission that the cache still holds the entry its controller guards, and refuses to run otherwise.
- Project deletion never cancelled background work — an in-flight model turn longer than the deletion's inactivity budget failed the deletion instead of being aborted. `disposeProjectEntries` cancels each target entry's work before waiting, and the nested exclusive-drain path in `prepareContextExclusive` cancels before draining serving handles, so the record's "every teardown path" claim is now true rather than aspirational.
- Five committed test call sites still passed the deleted `publish` option to `SessionStatus.set` — invisible to typecheck because the test tree is excluded from it. All five are cleaned to the current signature.
- `scheduleOrganizerRun` populated its per-project slot before scheduling; a synchronous scheduling failure would have wedged the project's Organizer until restart, with every later request taking the `again` path toward a runner that never existed. The slot is now cleared on a synchronous throw.

**Rejected with evidence**

- The finding that `mcp debug` can destroy a stored static credential is unreachable: the debug command returns at its `oauth === false` guard before the 401 OAuth probe (`cli/cmd/mcp.ts:666-670`), and the config schema forces `credential` ⇒ `oauth: false`, so a static-credential server can never reach the probe that would stamp the OAuth identity. TypeScript agrees — a guard added at the probe site fails to compile, because `oauth` is already narrowed to exclude `false` there.

**Recorded**

- The reviewer confirmed a deliberate contract change worth naming: the durable Bus's backoff retry no longer re-drives a transiently failed Organizer turn on a timer — the durable `retry_wait` status is re-driven by the next request or project open. That is the recovery owner this design chose.
- One doc correction: outbox-replayed deliveries do run under a lease; the true constraint the primitive addresses is that the delivering lease dies at settlement, not that no lease exists.

## ARC-014 — a global Task request owns one Project and one Task across replays

- Root cause as audited: `GlobalTaskService.create` allocated a random carrying Project before creating the Task, and request replay looked the request up inside `Instance.project.id` — the Project the retry itself had just allocated. A lost response therefore duplicated both the Project and the Task, and the caller's `requestID` could never find the first attempt.
- The repair: the request identity of a global create is global. `findGlobalTaskByRequest` resolves a live Task carrying the request ID whose root Session still lives in an anonymous Project directory, BEFORE any Project is allocated; the service then re-enters that Project and runs the same per-project replay path every create uses — one idempotency implementation, including its pillar and artifact-import conflict checks. Only an unresolved request allocates a new Project.
- Boundary stated in the lookup: a Project promoted out of the anonymous root stops matching, so a replay arriving after the user adopted the Project allocates anew — the pre-existing behavior for every replay, now confined to that narrow window.
- Focused positive tests in `test/global-task-request-replay.test.ts`: a replayed create returns the first attempt's exact `{task_id, project_id, directory}`, and a conflicting replay is refused by the same per-project idempotency error every create uses.
- Second recorded boundary (from the ninth review): two concurrent in-flight creates with the same request ID — in one process or two — can both find nothing and allocate two Projects, because find-then-allocate runs under no lock and the unique request index is per-project. This is strictly narrower than before (previously every lost-response replay duplicated deterministically) and is left open rather than half-locked. Replay resolution over any such residue is deterministic: the lookup orders candidates by `(time_created, id)` and every replay resolves the earliest commit.

## ARC-016 — the credential commits before the definition it serves

- Root cause as audited: `MCP.configure` committed the server definition first and the static credential second. An interruption between the two left an enabled definition whose required secret was durably absent — a half-configured server that failed persistently with nothing to recover it, because no reconciler creates secrets.
- First repair (round 9's ordering inversion) was found incomplete by the tenth review: it closed the create path, but an identity-changing RE-configure still destroyed the previous active secret before the new definition committed — a crash in that window converged, through reconciliation's mismatch sweep, to exactly the audited "enabled definition whose secret is durably absent", permanently. The record's original claim that every interruption leaves only an orphan "for a name no definition declares" was wrong for that case and is superseded by this section.
- The current repair is a staged-secret two-phase with reconciliation as the crash owner: `Entry.stagedStaticCredential` holds the configure's uncommitted secret (never served), staged BEFORE the definition commits without touching the active credential the previous definition still serves, and promoted to active AFTER. Every interruption converges: a crash before the definition commit leaves a staged secret matching no committed definition, which reconciliation drops (the previous credential keeps serving); a crash between commit and promotion leaves a staged secret matching the committed definition, which reconciliation promotes — running BEFORE its orphan/stale sweep so the sweep cannot remove an entry whose promotion makes it current. A definition-commit failure drops the staged slot in the same call (the active credential was never touched, so round 9's snapshot rollback — and its tenth-review finding about clobbering concurrent flows — is gone); if the drop itself fails, both errors surface as one `AggregateError`.
- Focused positive tests in `test/mcp/configure-credential-order.test.ts` (5): a definition-commit failure leaves neither half; an orphan active credential is collected by the reconciler; a crash between commit and promotion is completed by reconciliation (rotated secret promoted); an interrupted identity-changing reconfigure leaves the previous credential serving and its abandoned staged secret dropped; a completed configure serves its secret.

## ARC-017 — a provider OAuth authorization is a durable flow occurrence

- Root cause as audited: a provider OAuth authorization lived only in a process-local per-provider slot, so a second authorize silently replaced the first, a callback could complete against a different flow than the one that produced its code, and nothing durable recorded that a flow ever existed.
- The repair: `ProviderOAuthFlowStore` (`provider-oauth-flows.json`) records each authorization as a durable occurrence `{id, providerID, scope, method, inputsDigest, state: pending | superseded | consumed | failed}`. Opening a flow supersedes the previous pending occurrence for the provider and scope atomically (in-process keyed queue plus the shared cross-process lock), as an explicit durable fact rather than a silent replacement. The live executor — the plugin's closure holding PKCE material a restart cannot resurrect — is held under the occurrence's own ID and claimed exactly once by the callback. `ProviderAuthAuthorization` gains a required `flowID`; both callback routes accept it to settle the exact occurrence; mismatch, already-settled and not-executable each fail with a named error.
- The consume-before-write trade, stated: the callback consumes the occurrence BEFORE `Auth.set`. The reversed order would let a flow superseded mid-callback durably clobber the newer flow's credential; consume-first instead converts a crash or credential-write failure inside that window into a re-authorization of a flow marked consumed. A lost consume-settle reports the flow's real durable state (for a claimed executor that can only be a supersession, so no credential was written).
- Not settling a flow on `NotExecutable` is deliberate: settling would break a concurrent legitimate finisher, and in a multi-backend deployment would make a callback routed to the wrong process unrecoverable — as is, retrying against the opener process still succeeds. A dead-executor flow stays pending, bounded to one per provider and scope by supersession.
- Recorded boundaries: a `Flow` carries no project identity, so two projects authorizing the same provider supersede each other — consistent with the credential store being per data root, and stated here rather than implied. `inputsDigest` is a forensic fact only; nothing reads it yet.
- Ledger note against the one-implementation rule: `cli/cmd/auth.ts` drives the plugin closure directly and performs its own `Auth.set` — a pre-existing second OAuth-finish implementation that bypasses the occurrence store, so CLI logins record no flow. Open.
- Focused positive tests in `test/provider-oauth-flow.test.ts` (5); SDK/OpenAPI/docs regenerated and parity-gated.

## ARC-018 — the OAuth callback completes from durable facts (bounded half)

- Root cause as audited: finishing an MCP OAuth flow required the process-local `pendingOAuthFlows` owner record, while every fact the finish actually needs — the OAuth state, the PKCE verifier, the credential lease generation — is already durable in the MCP auth store (made so by ARC-009's lease work). A process restart between authorize and callback therefore rejected a completion whose every durable fact matched.
- The repair: `assertOAuthState` and `finishAuth` rebuild the flow owner from the durable entry when the in-memory map lacks it, requiring all three facts to be present; a rebuilt owner writes under the durable lease generation, so every write stays exactly as fenced as the original flow's, and a flow whose durable facts are gone — revoked, superseded, or never started — is refused precisely as before. The CSRF fence is unchanged: the provided state must equal the durable state.
- Focused positive test in `test/mcp/durable-oauth-finish.test.ts`: against a real local OAuth-plus-MCP endpoint, a process whose map has never seen the flow finishes the callback, the token exchange presents the durable PKCE verifier and the callback's code, and the tokens land under the same lease generation the dead process held.
- Open remainder of ARC-018: the fixed-port callback listener (`127.0.0.1:19876`) is still a process-local singleton, so the browser redirect lands on whichever process bound the port, not necessarily the one asked to finish; the durable rebuild makes any process ABLE to finish, which is the recoverable half. The listener-ownership half needs a routing decision and is not half-baked here.

## ARC-019 — token exchange journaling (open, blocked at the plugin ABI)

- The audited defect: a provider token exchange that succeeds remotely but dies locally before `Auth.set` loses the minted tokens with no durable trace. The full repair is a journal-before-exchange: record the exchange intent durably, then exchange, then settle.
- Why it is not repaired here: the exchange runs inside plugin closures behind the plugin ABI — plugins call `client.auth.set` after exchanging on their own, cannot import engine internals, and expose no seam between "exchange succeeded" and "credential stored". A journal would require either a new plugin ABI (`auth.beginRotation`-style two-phase surface) or intercepting the token-endpoint fetch inside plugin execution. Both are contract designs, not tail-end increments; wedging either in would create exactly the kind of half-mechanism this campaign removes.
- Disposition: open, with this analysis as the recorded starting point. ARC-017's durable flow occurrences narrow the blast radius — a died-mid-exchange flow is at least a durable pending/failed fact now, not an invisible loss.

### Stage 2 ninth independent review disposition

The ninth uninvolved read-only review (ARC-017 commit and the ARC-014 plus round-8 commit) found no critical defects, confirmed the round-8 rejection with independent evidence (`cli/cmd/mcp.ts` returns at its `oauth === false` guard before the 401 probe, and the config schema forces `credential` ⇒ `oauth: false`), and verified the store's supersede-and-insert atomicity, the executor claim, the round-8 repairs and the SDK/docs parity. Six findings, all repaired or recorded:

- **Repaired**: the record's missing ARC-017 section and the stale "not started" stage-log sentence (this update); the lost consume-settle reporting `"consumed"` when no credential was written (now reports the flow's real durable state); the executor map never releasing superseded closures — for the global scope a process-lifetime leak of live PKCE material (opening a flow now sweeps every executor whose flow is no longer pending); the unordered replay lookup (now `(time_created, id)`); the missing CHANGELOG entries for the ARC-017 public surface and the replay/configure/durable-finish fixes.
- **Recorded**: ARC-014's surviving concurrent-create window (above, in its section); the CLI's second OAuth-finish implementation (above, in ARC-017's ledger note).

## ARC-027 — every public Session execution requires one caller-visible request occurrence

- Root cause as audited: `session.prompt` minted a Message ID server-side when the caller omitted one, so a retry of the documented body started a second model Turn with repeated Tool effects; `session.command` made identity optional and executed embedded shell substitutions before its user Message was durable; `session.shell` minted identities internally after entering the execution path, so no replay could ever address its occurrence.
- The repair takes the audit's "requires" branch: the public route schemas for all three mutations now require a caller-minted `messageID` (added to `session.shell`'s public schema; the internal schemas keep it optional for internal callers that manage their own idempotency). The server never mints an identity for a public execution again.
- One replay-identity implementation: `executePublicSessionExecution` in the session routes is the single occurrence executor for all three operations — in-process operation map keyed by `(sessionID, messageID)`, durable check against the Message store, body fingerprint bound in the user Message's `extra.publicSessionPromptIdentity`, conflicting bodies refused with the existing 409 `PublicSessionPromptIdentityConflictError` (now declared on the command and shell routes too). Convergence is per-operation policy: prompt and command converge through `convergePromptTurn` (return the completed reply, else re-drive the Session loop against the durable input — the same cross-process recovery either always had); shell converges through `convergeShellExecution` (return the occurrence's durable assistant Message in whatever state it reached — a shell command never runs twice for one identity, and an occurrence whose input Message committed but whose assistant Message did not is refused, because the command starts only after both are durable).
- `session.command` carries the identity into its user Message via a new internal `extra` passthrough on `CommandInput`/`ShellInput` (never part of the public schemas). Recorded boundary: a command whose FIRST attempt dies between its template shell substitutions and its user Message commit re-runs those substitutions on retry — the pre-existing window, now confined to the first attempt; once the Message is durable, replays converge and never re-execute.
- `session.shell`'s declared 200 response schema was corrected to the `{info, parts}` shape the route has always returned.
- Callers: the Overlay already minted `messageID`; `cli run` now mints for its prompt and command sends; OpenAPI, SDK and both docs locales regenerated (`api:routes-check` 332 ops, `docs:check` green).
- Focused positive tests: `test/server/session-command-idempotency.test.ts` (a replayed command converges on the first occurrence, one physical Turn, its template substitution ran exactly once — asserted through a real substitution side effect) and `test/server/session-shell-idempotency.test.ts` (a replayed shell request returns the durable occurrence and the real command ran exactly once); the existing `session-prompt-idempotency` suite covers prompt.

## Production repair — a mid-Turn user message could never persist

- Found while verifying ARC-027: `consumeMaterializedUserMessageForPersistence` stamped `pendingDelivery` onto the deep-frozen materialized snapshot, so EVERY user Message persisted while a Turn was in flight threw `TypeError: Attempting to define property on object that is not extensible` and surfaced as HTTP 500. The overlap contract (queue at write time, deliver at the Turn boundary) was unreachable in production. Present on `origin/main` — the freeze and the mutation landed in the same commit (`49028f70c`).
- The repair: the persistence copy is where write-time facts are stamped; the frozen snapshot keeps its integrity role. One-line ownership split, covered by the rewritten overlap test below.
- Three pre-existing red tests in `test/server/session-prompt-idempotency.test.ts` (red at the pre-change baseline on this branch, verified by stash runs) were repaired to the current contracts rather than left red:
  - Two summary tests failed with "Compaction checkpoint assistant must be a valid completed summary": their `SessionProcessor` mocks predate the `beforeAssistantCompletion` hook that stamps `summary: true` on a valid compaction reply. The mocks now honor the hook exactly as the real processor does.
  - The obsolete "Host-mints identities" test asserted the server-minting behavior ARC-027 removes; it is rewritten as "persists overlapping caller-identified inputs durably under one Session owner and answers the delivered tail exactly" — asserting the write-side contract that is now true (durable identity-bound persistence with `pendingDelivery` while one owner serves) and the delivered tail's exact reply.
  - A second obsolete no-identity sender (the concurrent-sessions test) now mints caller identities per the current contract.
- The suite is 9/9 green under the canonical runner — the pre-change baseline was 6/9.

## ARC-041 — batch delivery orphans earlier attached reply callers (new finding, open)

- Found while rewriting the overlap test: `partitionPendingDelivery` delivers every queued user Message at once at the Turn boundary (by design — the 2026-08-17 incident note in `session/loop.ts`), and the next Turn answers the LAST user Message. `flushCallbacks` resolves only callbacks whose `replyToMessageID` matches the reply's parent, so the caller of a middle queued Message is never settled: its request hangs until abort, and its attached serving handle wedges `Instance.disposeAll`.
- Strictly a liveness gap, not a correctness gap: the middle Message IS durable, delivered, and seen by the model; only its caller's callback has no settlement path. The bounded candidate repair — settle every callback whose Message was delivered into a Turn with that Turn's reply — changes the reply contract (`parentID` no longer matches the caller's Message) and touches the hottest loop in the product, so it is recorded open for its own reviewed change rather than wedged in here. The rewritten overlap test documents the boundary and settles the orphan through session abort.

### Stage 2/3 tenth independent review disposition

The tenth uninvolved read-only review (ARC-016 commit, ARC-018 commit, round-9 repairs, and the ARC-027 body across the swept checkpoint commits) found no critical defects and verified: the ARC-018 fence model (every write of a rebuilt owner is fenced by the live durable generation, so no rebuilt owner can write under a superseded lease); holdExecutor's claim/sweep interleavings; the ARC-027 fingerprint's determinism over the zod-validated body; the shell converge's "command starts only after both Messages are durable" ordering claim; the parts.ts shallow-copy's safety (both persist paths clone via schema parse; no consumer relies on info object identity); the summary mocks' fidelity to the real processor's hook order; SDK/OpenAPI/docs parity; and the round-8/9 record statements. Eight findings, all repaired or recorded:

**Repaired**

- ARC-016's reconfigure residue (Medium) — replaced by the staged-secret two-phase above, which also dissolves the review's low finding about the unconditional snapshot rollback.
- Two callers still built without the caller-minted identity (Medium): the scheduled-automations e2e checker's busy-session prompt (which the schema change had silently broken) and the SDK example. Both now mint.
- `session.init` was a fourth public execution mutation outside the occurrence executor in the same file (Medium): a replayed init re-ran the effect-laden /init command as a second physical Turn. It now runs through `executePublicSessionExecution` with the prompt-turn convergence and the same 409; focused replay test added.
- `finishAuth`'s retained map-identity check was vacuous (same-tick read), and the exported no-flow entry had become a second, weaker finish implementation with no state fence. `finishAuth` is now private and flow-required — the only finish path is `finishAuthCallback` through `assertOAuthState`.
- A stale in-memory flow owner could veto a valid callback for the durable fact another process minted (one spurious CSRF refusal). `assertOAuthState` now lets the durable fact win: if the local owner's state mismatches but the durable state matches the callback, the stale record is dropped and the rebuilt owner proceeds.
- The record's hang-probe attribution sentence named the wrong commit (corrected above).

**Recorded boundaries (from the review)**

- A shell occurrence interrupted after its assistant Message persisted — before or during the command — converges forever to that assistant in its last durable state (a running `bash` part nothing settles). Honest to the convergence contract, but no terminal settlement exists for it; open alongside ARC-041.
- The occurrence operation map is process-local: a prompt/command replay arriving at a DIFFERENT process while the first process's Turn is live re-drives the Session loop concurrently rather than joining the in-flight operation. The durable convergence still holds; the cross-process in-flight join is open.

## Stage 3 — Aggregate database boundaries (ARC-010 through ARC-013)

### ARC-013 — the conversation model overlay commits in the Session insert

- Root cause as audited: both Chat/Work creation paths published the Session first and patched the model overlay after, so a process death between the two published a Session carrying the base model.
- The repair: the validated initial overlay (normalized by the same `previewOverlayUpdate` the merge path trusts) is part of the creation input and commits inside the Session insert's metadata; both post-create `mergeConfigOverlay` patch paths are deleted. Focused test drives the real `/coding/chat/session` route and asserts the response Session — the first published fact — already carries the overlay, and the durable row is the same fact.

### ARC-012 — Session fork commits the target and its transcript in one transaction

- Root cause as audited: `Session.fork` created the child first and cloned messages one persist at a time, so an interruption left a visible child carrying a transcript prefix that no retry would ever complete.
- The repair takes the audit's transaction branch: the fork prepares the target (`prepareNext`, lineage-checked) and the complete bounded clone map BEFORE any write, then commits the target Session and every cloned Message in ONE reentrant transaction (savepoint-joined bundle persists); event publication rides the transaction's effect queue and fires only after the commit. An interrupted fork leaves nothing visible, so a retry runs a whole new fork — the "retry resolves the same target" branch was not needed once no partial target can exist. Focused tests: the fork's first observable state is the complete remapped transcript (parent edges included), and a bounded fork stops before the cut message.

### ARC-010 — the root Session commits inside the Task aggregate transaction

- Root cause as audited: Task creation committed the root Session in its own transaction, then `persistTask` committed the Task aggregate; a death between the two left a visible ownerless root Session that request replay — indexed by the absent Task row — could never find.
- The repair: creation prepares the root Session (`prepareRootNext`) and `persistTask` inserts it via `persistPreparedNextInTransaction` at the top of the same transaction that commits the Task row, package/process bindings, artifact imports and the creation ingress. Session events publish after that single commit. Focused test injects a `persistTask` failure and asserts the Session table is byte-identical, then retries the same request to a complete occurrence.
- Contract migration: the test tree is outside typecheck, so 52 test files still built fixtures with the old create-then-persist shape. All are migrated to the prepared-root contract by codemod plus targeted reorderings (fixtures that created children of the root, or hand-rolled task rows, before the root was durable). Every migrated suite was run; each red suite was stash-bisected against the pre-change baseline and found identically red there — recorded below, not introduced here.

### ARC-011 — operator message acceptance is one transaction

- Root cause as audited: a Task message committed its side effects one by one — model overlay, per-attachment Task references, terminal reopen — before `continueTaskMessage` atomically persisted the Message and ingress; the catch restored only the overlay and could not compensate a process death, so the next Turn could observe state for which no Message existed.
- The repair follows the audit's boundary exactly: immutable bytes are prepared first (attachment materialization, overlay validation/preview/profile pinning, canonical AttachmentStore metadata), then every durable fact commits in the ONE transaction that persists the Message — through a new `acceptanceEffects` seam in the canonical persist commit, ordered overlay → attachments → reopen → rewind-clear → ingress. The overlay merge is split into `prepareConfigOverlayMergeInProject` (async validation) plus a synchronous in-transaction commit, and the ordinary merge path is REBUILT on that same split — one implementation. The in-transaction concurrent-change guard makes a prepared merge that lost a race fail the caller's whole transaction rather than commit a stale view. The catch-only overlay restore is deleted.
- Recorded boundary: the task-message path commits the overlay without the ordinary path's in-process keyed lock; the transactional stored-overlay comparison is the correctness fence, so a lost race surfaces as the message's failure instead of a lost update.
- Focused test injects a persist failure (selectively, so the Task's own background orchestrator persists are untouched) and asserts zero residue — overlay and message table unchanged — then retries to a fully committed occurrence with its ingress.

### Pre-existing red suites recorded during the stage-3 verification

Stash-bisected to identical failures at the pre-change baseline, all in areas outside this campaign's changes: the builtin package version drift (fixtures pin 2026.08.18.1, builtins now 2026.08.19.1 with new selector metadata) plus an "Artifact provenance requires persisted Tool Part" contract across the expert-squad package family (commercial-legal, hr-operations, omnichannel, sales-strategy, tax-compliance, viral-content; data-analysis is green); two evolution-artifact-evidence-host tests (same drift class plus a snapshot-file ENOENT); three tool-result-control-protocol coordination-projection tests ("request_orchestrator_decision is unavailable"); one date-coupled expert-squad-feedback-revision expectation; and the background "SessionRuntimeContract pending wake identity changed before notification" crash that any live orchestrator loop can emit in tests (baseline-verified with a minimal probe) — the ARC-010/011 tests scope it out with the no-op ingress-runner test hook.

## Stage log

- Stage 3 (ARC-010 through ARC-013): implemented with focused failure-injection tests, the 52-file fixture migration verified suite by suite, and the pre-existing red suites bisected and recorded. Awaiting its independent review round.
- Stage 1 (ARC-030): complete, reviewed and repaired against the review. Verification evidence is in the stage-1 section.
- Stage 2 parallel-worktree attribution, continued: the paper-evidence task's checkpoint commits `a77e8f689` and `3485ce44e` swept this campaign's in-flight ARC-027 working tree (the session route/exec changes, the idempotency tests, the regenerated SDK artifacts, and a since-deleted scratch probe file) into that task's commits alongside its own `tool/grep` work. The content is exactly this campaign's, verified intact; per the no-history-rewrite rule the attribution is recorded here instead of amended. The probe file (`test/server/hang-probe.test.ts`) was deleted, and that deletion itself was swept into the parallel task's final commit `3485ce44e`.
- Stage 2 (ARC-036, ARC-037, ARC-009, ARC-026, ARC-038's Bus half, plus the shared-mechanism sweep across seven lease owners): implemented, independently reviewed across six rounds, and repaired against every round. The seventh review round was terminated externally by a session limit before reporting and must be re-run. `check:permission-modes` reached a full `{"status":"passed"}` for the first time on this branch, alternated with the ARC-038 CLI hang, and after the second review's repairs passed three consecutive runs. ARC-038's Bus half is repaired; its remaining half is the `protocol_event` Task-aggregate binding for non-Task sessions. ARC-009 is implemented, including the durable per-credential lease generation (corrected across the fifth and sixth review rounds); ARC-026 is implemented; the cross-process invalidation of peer caches remains open. ARC-014, ARC-016, ARC-017 and ARC-018's recoverable half are implemented and reviewed (sections above); ARC-019 is recorded open at the plugin ABI boundary; ARC-027 is implemented (section above), which closes the stage-2 ledger except its recorded-open items.

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
