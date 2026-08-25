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

- Trigger and impact: `opencorvus run --attach <server> --session <id>` converges only on `agent.execution.lifecycle` with a terminal status for its session (`cli/cmd/run.ts:556-564`). For a Session that no Task owns, that event is never published, so an attached CLI does not exit when the session is aborted — it waits out its stall timeout instead. The checker proves it: after `transport:session-aborted` the CLI is still alive ten seconds later.
- Root: `persistTaskSessionLifecycle` (`orchestrator/protocol/message-bridge.ts`) resolves `taskID = explicitTaskID ?? lineageTaskID` and returns without publishing when there is none, and `appendBridgeEvent` writes every bridge event as `aggregate: "task"` with `aggregate_id: taskID`. `session.events` streams `ProtocolStore.subscribeEvents({ sessionID })`, so the terminal fact never reaches the subscriber. `persistSettledSessionTerminalStatus` deliberately sets `publish: false` and delegates to that bridge, so no other publication covers it.
- Why this is architecture, not a local bug: the terminal execution fact is a Session fact, but its only publication path is a Task aggregate. Every attached public client of a non-Task Session therefore has no terminal receipt.
- Bounded direction: the settled terminal status must publish on the Session aggregate when no Task owns the Session, so one event type carries one fact for every Session. `protocol_event.task_id` is already nullable, so this is an aggregate-binding change rather than a schema migration. Not implemented in this change.

### Checker repair

`packages/opencorvus/script/permission-modes-check-worker.ts` required `full_access` as a *ledger event type*. `PermissionEventType` (`permission/permission.sql.ts:6-22`) has no such member — `full_access` is the `mode` column. The assertion could never pass and had been unreachable behind the ARC-036 failure. The checker now collects `modes` from the same history rows and asserts `full_access` where it is actually recorded.

## Stage log

- Stage 1 (ARC-030): complete, reviewed and repaired against the review. Verification evidence is in the stage-1 section.
- Stage 2 (ARC-036, ARC-037): implemented and verified as recorded above. ARC-038 is recorded and open; `check:permission-modes` still terminates on it, which is the honest current state of that checker.
