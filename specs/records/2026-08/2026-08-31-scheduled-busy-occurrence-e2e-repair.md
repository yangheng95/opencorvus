# Scheduled busy-Session occurrence E2E repair

Status: implemented, verified, independently reviewed with no remaining findings, and delivered in commit `0e335444`.

## Recall

| Item | Record |
| --- | --- |
| User request | Perform end-to-end testing and ensure the instance works, continuing from the search-native Harness refactor. |
| Acceptance | A real isolated development server serves `/ui/`; Mission Board, Scheduled, and installed Expert Squad capability surfaces render and can be navigated; local streaming E2E checkers pass; the Scheduled checker reaches `outcome: passed` with no findings; focused non-UI scheduler and capability-search contracts pass; no unresolved finding is hidden. |
| Hard constraints | Do not run or add UI automation tests. Visual acceptance uses the real page, screenshots, and manual review. Do not read or copy real Provider credentials without explicit authorization. Preserve one Automation service, immutable definition/Fire/run facts, one control-lease primitive, and streaming LLM paths. Fix the shared root cause without a fallback scheduler, mutable shadow state, or Host workflow gate. |
| Sources read | `AGENTS.md`; `specs/current/architecture/README.md`; `specs/current/architecture/02-data.md`; `specs/records/2026-08/2026-08-12-scheduled-random-isolation-e2e.md`; `packages/opencorvus/script/scheduled-automations-e2e.ts`; current Automation schema, service, projection, Session status, and control-lease implementation; the immutable-definition refactor diff at `627146cc`. |
| Whole-repository search | Searched Scheduled/Automation scripts and package commands; real-Provider opt-in and credential handoff boundaries; due/lease/busy/retry/occurrence paths; Automation and Event schedulers; Session status owners; current architecture authority; focused scheduler tests; historical decisions and the exact regression commit. |
| Independent agent feedback | First review found the process-local scheduled busy gate and ignored spec. Second review confirmed the scheduled multi-process race closed, then returned FAIL: manual API still had a process-local `SessionStatus` precheck; fresh manual Tool acquired its lease after inserting the Fire and mapped delay-lease contention to plain `Error`; standby/dead/unknown durable-reader branches lacked positive scheduler contracts; and two implementation descriptions in this record were stale. Third review found no remaining code issue and one P2 documentation error: this record still reported 15 rather than 19 focused Automation tests. A follow-up found one P3 fresh-versus-pending Fire description mismatch. Both documentation findings were corrected, and the final independent review returned PASS with no P0-P3 finding. |
| Existing unrelated work | Preserve and exclude the user-owned untracked `packages/opencorvus/script/benchmark/`, `script/video/`, and `` paths. |

## Baseline evidence

- Branch `v0.0.55beta` is synchronized with `origin/v0.0.55beta` at the start of this run.
- An isolated development runtime started on `http://127.0.0.1:41755`; listener startup and project recovery completed with zero failures.
- The real `/ui/` rendered Online state on port 41755. Manual browser navigation and screenshot review covered the home composer, Mission Board, Scheduled tasks, Installed Expert Squads, and Base Developer effective Tool/Skill/Model Context Protocol capability projection.
- `bun run check:permission-modes` passed its local streaming Provider, capability reveal, Model Context Protocol, Browser/Computer, scheduling, permission continuation, transport, and recovery matrix.
- The first `bun run check:scheduled-automations-e2e` failed with exactly one finding: `busy Session did not retain and delay its exact due occurrence`. The checker itself still read removed mutable `automation.next_run` and `automation.lease_until` columns after the immutable-definition migration, so that finding alone could not distinguish a product failure from a stale observation path.
- Mission duplex, dynamic Expert Squad, Task-control-real, advanced grill, and evolution checkers explicitly require real Provider credentials or otherwise use the configured real model. This run has no authority to copy or use those credentials, so they are excluded rather than reported as passing.

## Problem depth and impact model

### Observable phenomenon

The Scheduled E2E starts a real streaming turn in one exact Session, waits until the local Provider is holding that stream open, then creates an Automation due two seconds later. After the due time, the definition must still project its original `next_run`, while a short future lease prevents another poller, Run now, update, or delete from stealing the delayed occurrence. The stale checker read fields that no longer exist on the immutable definition row. Independent source/history inspection then confirmed that the production busy branch also stopped writing any delay fact during the same migration.

### Direct trigger

Before this repair, `AutomationService.validateDueAutomationBeforeClaim()` recognized `SessionStatus` values `streaming` and `retry`, logged a retry timestamp based on `HEARTBEAT_BUSY_RETRY_MS`, and immediately returned. It never acquired or recorded the delay lease.

### Data/control-flow root cause

Before immutable Automation definitions were introduced, the busy branch updated mutable `automation.lease_until` while leaving `lease_owner` null. Commit `627146cc` moved ownership to the shared `engine_control_activation_lease` fact and correctly rewrote normal claim, renewal, completion, retry, update, delete, and manual-run paths. The busy branch deleted the old table update but did not replace it with a control-lease acquisition. The retained constant and log describe a delay that no durable fact enforces.

The canonical repair boundary is therefore the existing Automation owner transaction:

1. select the due definition from the bounded frontier;
2. observe the exact target Session as busy;
3. under one immediate writer transaction, re-read the latest active definition and re-project its frontier;
4. revalidate the exact fresh-or-pending frontier, due time, lease state, and target Session;
5. acquire the existing `automation` control lease for `HEARTBEAT_BUSY_RETRY_MS` with an explicit busy-delay occurrence owner;
6. for the fresh due occurrence reproduced here, create no Fire, attempt, run, or receipt; for an already pending retry, retain its immutable Fire and create no new attempt, run, or receipt until the Session becomes available and a later poll resumes it.

This keeps one fact source: the original due time remains the logical occurrence identity, and the control lease is only the physical admission delay.

### Why the existing paths did not prevent it

- The prior E2E had passed before the immutable-definition migration and already encoded the correct busy contract, but it was not run in the search-native refactor validation matrix.
- The checker was not migrated from raw mutable definition columns to `currentAutomationFrontiersInTransaction()`, the canonical current scheduling projection required by the architecture.
- Focused scheduler tests cover normal claims, retry receipts, lease loss, revision races, update/delete conflicts, recovery, fan-out, and Fire identity, but none drives a due Session Automation while its exact Session is streaming.
- Run-now checks process-local Session status before claiming and can still return HTTP 409, masking the missing durable delay lease. That error alone does not prove another poller or mutation path is fenced.

### Horizontal shared-mechanism audit

- **Recurring Session Automation, normal due path:** affected; it is the failing entry.
- **Session retry status:** affected by the same branch because `retry` is classified as busy beside `streaming`.
- **Run now:** returns a typed busy conflict while the Session is locally busy, then must continue to be fenced by the delay lease if the in-memory status becomes idle before the lease expires.
- **Update/delete:** both already consult the current Automation control lease and will become correctly fenced once the delay fact exists.
- **Project/global Automation:** excluded from the busy-Session branch; they retain normal claim, Fire, fan-out, retry, and recurrence behavior and remain covered by the full Scheduled E2E.
- **One-shot Session/Task delays:** excluded; they use the same Automation lease target but a separate delay frontier and assistant-admission settlement contract. The helper will require `kind=recurring` and exact Session scope, so it cannot claim a one-shot delay.
- **Fire retry/restart recovery:** included in the same busy admission check. A due `retry_wait` frontier may acquire the short delay lease before the pending-Fire branch; it preserves the existing immutable Fire and creates no new attempt. After lease expiry and Session availability, the unchanged pending path resumes that exact Fire with its existing recovery authority.
- **Event scheduler:** shares the generic control-lease primitive but not Automation definition ownership or Session-busy admission; no code change is required.
- **Multi-process isolation:** the first repair did not satisfy this item because its pre-transaction busy decision read process-local `SessionStatus`. The second repair must derive busy execution from the durable `session_prompt_owner` plus an unfinished assistant Message, validate that fact and acquire the Automation delay lease in the same writer transaction, and cover a peer process with a barrier test.

## Implementation plan

1. Add a transaction-local busy-delay claim in `AutomationService` that performs all current-definition/frontier/target/due checks and acquires the canonical Automation control lease for the short delay interval.
2. Make `validateDueAutomationBeforeClaim()` return only after that durable delay attempt, and log the factual lease expiry only when the lease was acquired.
3. Add one focused positive scheduler contract proving a busy exact Session keeps the same due time behind a live control lease and that the lease fences manual mutation after the process-local status settles.
4. Run the focused scheduler test, all directly related scheduler contracts, the complete Scheduled E2E, and the capability-search runtime contract that exercises real SessionLoop reveal/execution with a local Provider.
5. Recheck the real instance page and browser console after code changes, rerun the relevant repository gates, then obtain independent read-only review of the complete diff and evidence. Fix and re-review until no findings remain.
6. Update this record with final evidence, audit `git status`, commit only owned files, fetch and merge upstream without rebase, inspect `upstream..HEAD`, rerun affected checks if the merge changes relevant code, and push.

## Implemented result

- Scheduled `claim()` now re-reads the latest active recurring definition, complete current fresh-or-pending frontier, and durable Session active-execution compound fact under one immediate writer transaction. It revalidates Session scope/identity, frontier due time, Fire identity when pending, and lease expiry before acquiring the existing `automation` control lease.
- The busy-delay owner is the compact deterministic call identity of `definition ID + frontier due time`. Repeated physical delay intervals remain attached to one logical occurrence: a fresh occurrence creates no Fire, while a pending retry preserves its existing immutable Fire; neither path creates a new attempt, run, receipt, or shadow cursor while busy.
- The busy log now reports only an acquired lease's factual owner and expiry, rather than claiming that an unpersisted retry time exists.
- The Scheduled E2E now reads the canonical batched frontier projection instead of removed mutable table columns.
- A focused positive test acquires the durable Session Prompt owner and opens an unfinished assistant Message, lets one recurring Session Automation become naturally due, and proves the original due time is retained behind the deterministic live lease. After the assistant becomes terminal and the Prompt owner releases, the same test proves Run now, update, and delete still receive the typed running conflict from that durable delay lease.
- The scheduler Harness test now names the search-native canonical `panel_query_task` and `panel_resume_task` leaves already present in the Mission prompt instead of deleted pre-cutover aliases.
- The repository control-lease owner registry now declares the fourth Automation acquire site and its deliberate expiry settlement: a busy recurring Session creates no Fire or receipt, so the bounded admission-delay lease expires before the next poll revalidates the same due occurrence.

### Independent-review correction

- `SessionStatus` remains the correct in-process User Interface/runtime lifecycle projection, but it cannot authorize a shared scheduler decision.
- The existing durable `session_prompt_owner` is the unique physical Prompt-loop owner; by itself it also covers idle standby and therefore is not a busy fact. An unfinished assistant Message owned by a live or conservatively unknown Prompt process is the existing shared execution fact. A dead/reused owner does not block a takeover wake.
- Scheduled and manual API claims will re-read that compound fact inside the same immediate transaction that would otherwise acquire the Automation execution lease and create a Fire. A natural due occurrence acquires only the short deterministic delay lease; manual API/Tool runs return the typed running conflict without creating a Fire.
- A two-process fixture will keep the exact Prompt owner plus assistant open in process A while process B polls the due Automation, then prove the original due time and delay lease with zero Fire/attempt/run facts. After A commits assistant terminal state and releases the Prompt owner, the test will expire the bounded delay as a clock boundary and prove a successor poll creates exactly one scheduled Fire and one successful run.

The correction is implemented. Scheduled claim, manual API claim, and both fresh/replayed manual Tool claim transactions consult the same durable execution reader before acquiring an execution lease or creating a Fire. The new two-process test passed on Windows with a live exact process-instance observation.

### Second-review corrections

- Delete the manual API's process-local `SessionStatus` precheck and import. `claim(force=true)` becomes its only busy authority, so stale local lifecycle cannot reject a durable-idle Session.
- In the fresh manual Tool transaction, acquire the Automation execution lease before inserting its Fire. Active durable execution and any still-live delay/execution lease both map to `AutomationRunningConflictError`; replay keeps its existing typed owner conflict, and a terminal replay returns its immutable history.
- Extend scheduler contracts to prove: stale local `SessionStatus=streaming` without the durable compound fact permits manual execution; live standby owner without unfinished assistant permits claim; dead/reused owner with unfinished assistant permits takeover; unknown-live owner remains conservatively busy; fresh/replayed manual Tool busy/lease/terminal paths preserve one exact Fire authority.
- Replace the stale first-round helper and `SessionStatus` focused-test descriptions in this record with the current transaction-owned durable reader and prompt-owner/assistant facts.

These corrections are implemented. Manual API has no `SessionStatus` dependency; fresh manual Tool acquires before Fire insertion and maps contention to the typed conflict; replay returns the immutable terminal result. The new contracts cover stale local lifecycle, live standby, dead/reused takeover, unknown-live preservation, active durable Tool conflict, live delay-lease conflict, one terminal Fire, and exact terminal replay.

## Verification evidence

- Focused immutable Automation suite: `19 pass / 0 fail`.
- Final isolated Scheduled E2E after all second-review corrections: `outcome: passed`, `findings: []`, backend port `55123`, local streaming Provider port `55114`, 197 HTTP requests, and 10 Provider requests. It covered exact Session manual execution, busy exact-Session natural due and delayed replay, Global natural due, two-Project fan-out with one-target retry, worktree execution, target replacement, pause/resume, history, deletion, and preserved Session results.
- Search-native native MCP execution: `4 pass / 0 fail`, including `capability_search`, exact reveal, Host-owned leaf execution through the real `SessionLoop`, stale terminalization, partial MCP App input, and permission-policy composition.
- Permission-mode checker: passed its local streaming Provider, built-in/MCP/MCP App/Browser/Computer/schedule invocation, continuation recovery, Server-Sent Events, command-line interface, and Agent Client Protocol transport matrix.
- Final scheduler horizontal suite: `51 pass / 0 fail` across ten files and 243 expectations. It includes the two-process busy-owner barrier, cleanup-hardened focused contract, stale-local/standby/dead/unknown branches, and fresh/replayed manual Tool ownership.
- Package TypeScript check exited 0. `docs:check` passed with 339 operations in 25 groups. `check:architecture-index` passed with 16 indexed documents and every link live.
- `check:control-lease-owners` passed with 17 owners and 21 acquire sites, all declared. `check:control-state-redundancy` passed across 51 tables and seven allowed fact classes.
- The owned development instance restarted from the same isolated runtime on port 41755 with zero recovery failures. After reload, the real page reached Online and completed Project loading; the browser console reported zero warning/error entries and the final screenshot had no observed layout blocker.
- The checked-out and upstream branch are named `v0.0.55beta`, while both contain canonical package version `0.0.58-beta`; the real UI truthfully displayed `v0.0.58beta`. This task does not rewrite version authority merely to match a historical branch name.

## Remaining unknowns

- Whether independent review finds a lease-ownership, recovery, test-contract, or documentation gap. This remains open until the mandatory review closes with no findings.
- Real-Provider Mission duplex, Dynamic Expert Squad, Task-control, advanced grill, and evolution runs remain intentionally unexecuted because this request did not authorize copying or using external Provider credentials. Their explicit opt-in boundary is known rather than misreported as a product pass.
