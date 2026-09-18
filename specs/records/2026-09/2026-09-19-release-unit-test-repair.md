# Release unit test repair

## Recall

- User request: resolve unit test failures in the GitHub release process.
- Follow-up authorization: after three-system verification, merge and push all reviewed repairs into main, explicitly including the prior capability, CLI, build, Skill documentation and version changes.
- Acceptance: reproduce the hosted failures using the repository runner, repair the actual cause, pass affected and adjacent backend checkers, complete independent read-only review, and deliver a scoped commit. Hosted success must be verified before claiming the GitHub failure resolved.
- Constraints: no UI automation, skipped checks, softened production ownership, user process changes, new branch/worktree or history rewrite. Preserve untracked script/video/. Follow current package scripts and immutable interaction/scheduler contracts.
- Read: test.yml, run-tests.ts, isolated entry/preload/memory fixture, Interaction request/projector and all writer references, scheduler-claim-and-fire-identity checker, AutomationService, Scheduler, Instance disposal, current data/control architecture and the interaction ownership repair record.
- Search: the only direct EngineInteractionRequestTable inserts outside its production writer are the two failing tests. Every production producer uses insertEngineInteractionRequest. Scheduler and Instance cleanup are shared and require a horizontal audit before classifying the Windows timeout.
- Independent agent feedback before implementation: 无.

## Evidence and analysis

- Completed failing run: https://github.com/yangheng95/opencorvus/actions/runs/35334453817 at a9597b8b. macOS/Linux/Windows fail task-root-fact-store and evolution-artifact-evidence-host with `no exact immutable Task owner event`. Earlier run 35328961361 has the same two failures on all systems.
- Both fixtures insert a request row directly, bypassing the atomic interaction.requested Protocol event. The recently repaired projector correctly treats this event as immutable ownership authority after mutable Task/Session removal. Existing focused production tests covered real writers, while these older fixtures retained the obsolete row-only setup. Repair fixtures through the sole production writer and assert projected identity/request/outcome. Do not weaken the projector or invent a compatibility owner.
- Windows run 35334453817 additionally times out in the beforeEach/afterEach cleanup for scheduled successor settlement (90 seconds), then the next test encounters global Instance disposal and times out. The prior hosted Windows run passed these cases. Root cause remains unknown; a passing local rerun alone cannot exclude a shared disposal defect. Inspect all lifecycle entrances and normal/cancel/retry/restart/multi-project behavior before deciding scope.
- Local repository-runner reproduction has reproduced the Interaction failure. Scheduler reproduction/audit is in progress. Newer hosted runs 35364371492 and 35367113545 were still running when inspected; they are not success evidence.

## Plan

1. Replace both obsolete request-row fixtures with insertEngineInteractionRequest in the same transaction; use the production resolver for the request/outcome contract and assert exact Task/Session ownership plus Protocol facts.
2. Audit shared Scheduler/Instance settlement and reproduce the Windows cleanup timeout. Repair any established root cause with focused positive coverage; retain unknowns explicitly if evidence is insufficient.
3. Run the repository test runner on failed files and related interaction/scheduler/lifecycle contracts, typecheck and docs checks. Obtain independent read-only review and resolve all valid findings.
4. Commit, fetch/merge upstream, audit the whole outgoing set and push the authorized reviewed changes. The user explicitly authorized the four prior commits to be included after validation and independent review. No release/tag/publication is requested.

## Verification and delivery

The user authorized verifying and independently reviewing all four pre-existing commits before pushing them with this repair.

### Shared lifecycle audit

All five Scheduler.register producers share Scheduler's abort signal and active-task registry: Automation polling, scheduler-message delivery, Worktree GC, Project GC and truncation GC. Automation's Task/Session/Mission target execution enters the same independent Project lease primitive. Server.settleCurrentProcessExecution already starts Scheduler disposal before waiting for Instance settlement; direct Instance.disposeAll (test memory fixture, DB commands and global database routes) instead waits for active Project leases before it calls Scheduler.disposeGlobal. A scheduled callback holding a Project lease until scheduler cancellation therefore forms a circular wait. Instance background work has a separate cancellation owner and must also be cancelled before either class is drained. This shared ordering defect is independently reproducible even though the exact active owner in the hosted 90-second timeout was not logged. Do not claim that unrecorded owner is known.

Add a deterministic two-project positive test through real Scheduler registration and Instance disposal, retaining a test-only manual release in finally so a red test cannot wedge later checks. Then move scheduler cancellation/settlement ahead of lease draining while cancelling all captured Project background owners first. Keep the single disposal promise, exact lease lifetime, per-project disposal, scheduler rollback and Server's wider terminal protocol unchanged. Test serial and concurrent cancellation, background settlement, scheduled successor/retry, Mission occurrence closure, multi-project retry and process shutdown contracts. No durable schema or queue frontier changes are proposed.

### Authorized outgoing CLI review

Independent review found the previously unreviewed host CLI has concrete delivery defects: mutation commands ignore --format json; comma splitting changes literal Question answers; client-native path.resolve corrupts foreign server absolute paths; Ledger omits continuation coordinates; Task cancellation prose claims a terminal result although HTTP accepts cancelling. Search confirmed their definitions, SDK fields and authored examples. Repair through one shared mutation-output formatter, one lossless JSON answer array input, exact preservation of POSIX/Windows absolute server paths, canonical Ledger cursor fields and actual cancellation status. Update the sole Skill instructions and positive CLI contracts. These changes neither execute real user mutations nor alter server permissions or Question storage.

The pre-existing overlay build-source string checker also asserts a retired variable name after the authorized build-script change. It tests UI build source strings rather than executing packaging. Remove that obsolete test per repository UI-test rules; inspect/build-tool lock behavior through an isolated executable helper and temporary files, never by stopping the user's Overlay.

### Local verification

Second review traced foreign-directory corruption one layer further: the SDK's Windows-only MINGW heuristic rewrites a valid remote POSIX `/a/project` to `A:\project` after the CLI preserves it. Search of SDK consumers shows directory comes from local canonical cwd/registered Project paths or an explicit attached server directory. The transport cannot infer the remote operating system from the client's process.platform. Remove this heuristic at the single SDK boundary, document directory as server-owned and assert actual outgoing query bytes for POSIX single-letter roots. No second client path or platform flag is introduced.

- Repository `bun run test` on task-root-fact-store, evolution-artifact-evidence-host, engine-interaction-recovery and task-control-reconciliation: 3 + 8 + 7 + 12 passed. Both original failing cases reproduced before the fixture fix.
- Repository runner on instance-background-work, scheduler-claim-and-fire-identity, process-shutdown-task-lifecycle and server-lifecycle-occurrence: 8 + 27 + 2 + 5 passed. The new two-project scheduled-owner case failed before the ordering repair and passed afterwards. The original 27-case scheduler file passed both before and after; the exact hosted timeout owner remains unknown.
- Runtime-execution-settlement and project-instance-lock-liveness: 17 + 9 passed, covering cross-project settlement, active Session ownership, process handoff, retry and concurrent Instance admission/disposal.
- CLI attach/attached-commands/ledger-render: 9 + 14 + 4 passed. Transport fixtures validate mutation receipts, lossless answers, cursor parameters and cancelling prose; a separate real isolated Server.App check creates a Mission draft through the CLI and reads it back. No model, live user service or external mutation is used.
- Overlay repository runner, build-binary-lock: 2 passed on Windows, including a real temporary exclusive file lock and preserved writable output bytes. This is a filesystem/build-tool contract, not UI automation or visual acceptance.
- Full root typecheck passed (8 workspace tasks), including SDK imports, AI runtime and Expert Squad types. version:check reports 0.1.2-beta aligned; docs:check, architecture-index and diff whitespace checks passed.
- Initial independent review identified the six outgoing-CLI/build issues recorded above; the second review caught the SDK directory rewrite. All were repaired and the final independent review reported no unresolved findings, including an independent actual HTTP check of `/a/project`.

### Delivery candidate

Implementation commit `171ae127d3feaffba38e825feb188749af277f0c` was pushed to `origin/codex/paper-preliminary-results` after fetching and merging its upstream (already current). The outgoing set contains this repair, the previously reviewed capability repair `96982e4f` and the four explicitly authorized/reviewed host-tooling/version commits `1cffbf64`, `3c8cbecd`, `bd867d32`, `e7ccbd83`. Push hooks passed typecheck, routes, docs, control-lease owners, architecture, package/release/module topology and secret scan. Unrelated `script/video/` remains untracked and unchanged.

Hosted build check [35370836838](https://github.com/yangheng95/opencorvus/actions/runs/35370836838) and typecheck [35370836683](https://github.com/yangheng95/opencorvus/actions/runs/35370836683) passed on that exact commit. The thirteen-file focused matrix is [35370893148](https://github.com/yangheng95/opencorvus/actions/runs/35370893148); the automatic full suite is a separate run [35370836675](https://github.com/yangheng95/opencorvus/actions/runs/35370836675). Focused results must not be described as a completed full suite. No tag or Release was created and main was not changed.

The focused Linux, macOS and Windows jobs, plus Channel Runtime and Overlay unit jobs, all passed. This satisfies the user's condition for integrating the complete reviewed repair set into main. The automatic full suite remains a separate unfinished check; no full-suite success is claimed. The main integration preserves its already-published UI changes and uses a normal merge, without rewriting either history.
