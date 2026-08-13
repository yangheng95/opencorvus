# Scheduled global inactivity configuration ownership

Status: implemented, verified, and independently reviewed with no unresolved findings.

## Recall

| Item | Record |
| --- | --- |
| User request | Repair the Scheduled page failure shown in the supplied screenshot. |
| Acceptance | Explain the visible failure from real evidence; keep the formal runtime and database untouched; run the existing random-port, isolated-database, fresh-project Scheduled checker; repair every confirmed current-source Scheduled regression; prove the public route and real streaming execution path; manually inspect the real connected page if the checker reaches its visual hold. |
| Hard constraints | Preserve unrelated dirty-worktree changes. Do not restart or stop a user-owned process. Do not add or run User Interface automation tests. Keep one global Automation service, one inactivity fence, one configuration authority, and one streaming Session wake path; do not add a fallback, compatibility read, host gate, synthetic Message, or non-streaming model call. |
| Sources read | `AGENTS.md`; `specs/current/architecture/18-scheduled-automations.md`; `2026-08-12-scheduled-random-isolation-e2e.md`; `2026-08-12-local-database-rebuild-and-startup-recovery.md`; current Overlay Scheduled panel, Provider/config loaders, API transport, connection monitor, Tauri sidecar lifecycle, Automation/Event services, inactivity fence, Engine config, Config global reader, checker, and focused scheduler tests. |
| Whole-repository search | Searched the visible Scheduled strings and failing global routes, API base/host selection, managed-sidecar information/logging and listeners, `createSchedulerExecutionInactivityFence`, every `EngineConfig.get()` and `Config.getGlobal()` caller, inactivity timeout configuration, Automation and Event execution entry points, and relevant current/historical architecture records. |
| Independent agent feedback | None before implementation. After the first green verification, an uninvolved read-only reviewer confirmed the explicit global/project ownership design, source boundaries, tests, and regression evidence. The reviewer found one delivery issue: this record is ignored by `/specs/` and therefore must be force-staged explicitly. |

## Problem depth and impact

### Observable state

- The screenshot combines failures from the Scheduled definition load, Project discovery, and global Provider/config projection. `Failed to fetch` is a transport failure, not a Scheduled schema or business error.
- At investigation time there was no OpenCorvus/Bun process and no loopback listener for the saved `http://127.0.0.1:7878` server URL. The canonical sidecar log directory had no 2026-08-13 launch record. This confirms that the captured surface could not reach a backend, but it does not by itself prove why the earlier backend was absent.
- The existing isolated checker started a healthy random-port backend and returned HTTP 200 for `GET /global/automations`. It then reproduced a separate current-source regression: the first public `POST /global/automations/:id/run` returned HTTP 500 before target execution.

### Direct trigger and call chain

The reproducible failure is:

`POST /global/automations/:id/run`
→ `AutomationService.runNow()`
→ `executeWithRuntimeSettlement()`
→ `execute()`
→ `createSchedulerExecutionInactivityFence()`
→ `EngineConfig.get()`
→ `Config.get()`
→ `ProjectInstanceContext.use()`
→ `No context found for instance`.

The global Automation route intentionally has no ambient Project instance. The inactivity fence is armed before target resolution, so Session, Project, Global, recurring, manual, natural-due, retry, and delayed-wake executions all cross the same invalid project-context read.

### Root cause and why earlier coverage missed it

Commit `76132f342` added the shared scheduler inactivity fence and read `assistant.activity.task_queue_run_timeout_ms` through the project-scoped `EngineConfig.get()`. That reader is correct for code already executing inside an initialized Project, including Event jobs and Task queue work, but it is not valid for the process-wide Automation owner.

Focused inactivity tests install an in-memory timeout override. That correctly verifies physical abort and retry settlement but bypasses the production configuration read, so it could not detect the missing global ownership path. The previous Scheduled end-to-end result predates the liveness commit.

### Shared repair boundary

The timeout remains defined and merged only by `EngineConfig`. Add an explicit global reader that applies the same merge to `Config.getGlobal()`, and make every inactivity-fence caller declare its configuration owner. Process-wide Automation uses the global view; Project-owned Event fires retain the project view. Do not catch a failed project read, substitute defaults, infer a Project from the request, or move the fence below target resolution. Project-owned Task queue and Session `EngineConfig.get()` callers remain unchanged.

The focused positive contract must arm and fire the production global inactivity fence with no Project context. The random-isolation checker must then pass the complete existing Scheduled scenario matrix and reach the real page visual hold.

## Plan

1. Add `EngineConfig.getGlobal()` as the explicit project-independent view over the same `fromAssistantConfig()` merge authority.
2. Make the fence require an explicit global/project configuration owner; route process-wide Automation through the global reader and retain the project reader for Event fires.
3. Add a focused positive non-UI contract for a no-Project-context fence and run the relevant scheduler tests and typecheck.
4. Rerun `check:scheduled-automations-e2e` with random ports and isolated runtime state; at visual readiness, inspect the real current page and release the checker.
5. Run documentation checks and diff checks, obtain an uninvolved read-only review, repair valid findings, repeat verification, commit only task-owned files, inspect the complete upstream push set, and push if safe.

## Implementation and first verification

- `EngineConfig.getGlobal()` now projects `Config.getGlobal().assistant` through the same private `merge()` function used by project-owned `EngineConfig.get()`. No new default, cache, fallback, or configuration surface was added.
- `createSchedulerExecutionInactivityFence()` now requires the caller to declare `global` or `project` configuration ownership. Process-wide Automation passes `global`; Event fires pass `project`, preserving their existing Project-owned override semantics. The fence position, timeout validation, AbortSignal composition, lease renewal, target resolution, and settlement paths are unchanged.
- The focused contract covers three explicit projections: global assistant activity values are merged by `EngineConfig`, a no-Project-context Automation fence reads the global owner and emits the typed `SchedulerExecutionInactivityError`, and an Event fence retains the project owner for the same typed settlement.
- Backend TypeScript checking passed. The adjacent Automation suite passed `19/19` with 51 assertions, and the Event durable-fire suite passed `30/30` with 77 assertions.
- The repaired random-isolation run `scheduled-e2e-20260812181432-9f215708` used backend port `61314`, Provider port `56663`, database identity `5ab0d318-adc3-48fe-8cd1-19f6de2484b4`, and two fresh Git projects. Its machine-readable result is `outcome: passed` with `findings: []`. The previously failing manual route returned HTTP 200 after a real streamed reply; the checker also completed exact Session, busy Session, Global natural due, Project fan-out/retry, worktree, target replacement, pause/resume, history, deletion, and preserved-Session-result checks.
- At the visual hold, the real current page showed `Online · Port 61314`, all five paused definitions, and no fetch-error card. The Global detail showed its Global inbox target, explicit model, High reasoning effort, zero consecutive failures, and one `Succeeded` run linked to the visible Chat. This was manually inspected through the real page; no UI automation test, fixture, baseline, or screenshot assertion was added or run.
- After the visual release, the checker deleted every owned definition, wrote its passing result, stopped, and released both isolated listeners. The formal 7878 listener and canonical database were never used.
- `docs:check` passed with 338 operations across 25 groups, and `git diff --check` passed.

## Independent review

- The uninvolved reviewer reported no source, ownership, test-quality, or regression finding. It confirmed that Automation and its outer delayed-wake fence are process-wide and therefore global-owned, while Event fires and unchanged Task queue behavior remain project-owned.
- The review independently passed the three ownership tests, all 49 adjacent Automation/Event tests with 128 assertions, backend TypeScript checking, and the relevant diff check.
- The sole delivery finding was valid: `.gitignore` ignores `/specs/`, so this new record must be force-staged. The final cached-diff inspection must include this exact record and exclude unrelated concurrent work.
